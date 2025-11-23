const express = require("express");
const { decode } = require("html-entities");
const { jsonRPC, getExternalId } = require("./odoo");
const { odooAuth } = require("./middleware");
const { sendEmailOtp, verifyEmailOtp } = require("./passcode");
const router = express.Router();


router.get("/", odooAuth, async (req, res) => {
    try {
        res.json({
            "msg": "Your Credentials Worked"
        }).status(200);
    } catch (e) {
        res.status(400).json({
            "msg": "Your credentials won't work"
        })
    }
})

router.get("/categories", odooAuth, async (req, res) => {
    try {
        const { uid, DB, PASSWORD } = req.odoo;
        const BASE = `https://${DB}.odoo.com`;
        const categories = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "product.public.category",
                "search_read",
                [[]],
                {
                    fields: ["id", "name", "parent_id", "sequence", "image_256"]
                }
            ]
        });
        const categoriesWithImages = categories.map(cat => {
            const hasImage = cat.image_256 && typeof cat.image_256 === 'string';
            const imageUrl = hasImage
                ? `${BASE}/web/image/product.public.category/${cat.id}/image_256`
                : "";
            return {
                id: cat.id,
                name: cat.name,
                parent_id: cat.parent_id,
                sequence: cat.sequence,
                image: imageUrl
            };
        });
        res.json(categoriesWithImages).status(200);
    } catch (err) {
        console.error("Error in /categories middleware:", err);
        res.status(500).json({
            error: "Failed to fetch categories from Odoo.",
            details: err.message || "Unknown error"
        });
    }
});


router.get("/products", odooAuth, async (req, res) => {
    try {
        const { uid, DB, PASSWORD } = req.odoo;
        const BASE = `https://${DB}.odoo.com`;
        let domain = [["website_published", "=", true]];
        if (req.query.category_id) {
            const categoryId = parseInt(req.query.category_id);
            domain.push(["public_categ_ids", "=", categoryId]);
        }
        const products = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "product.template",
                "search_read",
                [domain],
                {
                    fields: [
                        "id",
                        "name",
                        "list_price",
                        "description_ecommerce",
                        "public_categ_ids",
                        "website_published",
                        "image_256",
                        "website_ribbon_id"
                    ]
                }
            ]
        });
        const ribbonIds = [...new Set(
            products
                .map(p => p.website_ribbon_id ? p.website_ribbon_id[0] : null)
                .filter(id => id !== null)
        )];
        let ribbonDetails = {};
        if (ribbonIds.length > 0) {
            const ribbons = await jsonRPC({
                service: "object",
                method: "execute_kw",
                args: [
                    DB, uid, PASSWORD,
                    "product.ribbon",
                    "read",
                    [ribbonIds],
                    {
                        fields: ["display_name", "bg_color", "text_color"]
                    }
                ]
            });
            ribbons.forEach(ribbon => {
                ribbonDetails[ribbon.id] = {
                    name: ribbon.display_name,
                    bg_color: ribbon.bg_color || "#f44336",
                    text_color: ribbon.text_color || "#fff",
                };
            });
        }
        const productsWithImages = products.map(p => {
            let plainDescription = decode(p.description_ecommerce || "");
            plainDescription = plainDescription.replace(/<[^>]*>/g, "");
            const hasImage = p.image_256 && typeof p.image_256 === 'string';
            const imageUrl = hasImage
                ? `${BASE}/web/image/product.template/${p.id}/image_256`
                : "";
            let ribbonName = null;
            let ribbonBgColor = null;
            let ribbonTextColor = null;
            if (p.website_ribbon_id && p.website_ribbon_id.length > 0) {
                const ribbonId = p.website_ribbon_id[0];
                const details = ribbonDetails[ribbonId];
                if (details) {
                    ribbonName = details.name;
                    ribbonBgColor = details.bg_color.replace("#", "0xFF");
                    ribbonTextColor = details.text_color.replace("#", "0xFF");
                }
            }
            return {
                id: p.id,
                name: p.name,
                list_price: p.list_price,
                description_ecommerce: plainDescription,
                public_categ_ids: p.public_categ_ids,
                website_published: p.website_published,
                image_url: imageUrl,
                ribbon_name: ribbonName,
                ribbon_bg_color: ribbonBgColor,
                ribbon_text_color: ribbonTextColor
            };
        });
        res.json(productsWithImages).status(200);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});


router.get("/product/:id", odooAuth, async (req, res) => {
    try {
        const { uid, DB, PASSWORD } = req.odoo;
        const productId = parseInt(req.params.id);
        const BASE = `https://${DB}.odoo.com`;
        const product = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "product.template",
                "read",
                [[productId]],
                {
                    fields: [
                        "id",
                        "name",
                        "list_price",
                        "description_ecommerce",
                        "public_categ_ids",
                        "website_published",
                        "optional_product_ids",
                        "product_template_image_ids",
                        "website_ribbon_id"
                    ]
                }
            ]
        });
        if (!product || product.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        const prod = product[0];
        let categories = [];
        if (prod.public_categ_ids && prod.public_categ_ids.length > 0) {
            const categs = await jsonRPC({
                service: "object",
                method: "execute_kw",
                args: [
                    DB, uid, PASSWORD,
                    "product.public.category",
                    "read",
                    [prod.public_categ_ids],
                    { fields: ["name"] }
                ]
            });
            categories = categs.map(c => c.name);
        }
        const imageIds = prod.product_template_image_ids || [];
        let images = [];
        if (imageIds.length > 0) {
            const imageRecords = await jsonRPC({
                service: "object",
                method: "execute_kw",
                args: [
                    DB, uid, PASSWORD,
                    "product.image",
                    "read",
                    [imageIds],
                    { fields: ["id"] }
                ]
            });
            images = imageRecords.map(img =>
                `${BASE}/web/image/product.image/${img.id}/image_512`
            );
        } else {
            const hasMainImage = prod.image_512 && typeof prod.image_512 === 'string';
            if (hasMainImage) {
                images = [`${BASE}/web/image/product.template/${productId}/image_512`];
            } else {
                images = [];
            }
        }
        let description = decode(prod.description_ecommerce || "");
        description = description.replace(/<[^>]*>/g, "");
        const ribbonTuple = prod.website_ribbon_id;
        let ribbonDetails = {
            name: null,
            bg_color: null,
            text_color: null
        };
        if (ribbonTuple && ribbonTuple.length > 0) {
            const ribbonId = ribbonTuple[0];
            const ribbonRecords = await jsonRPC({
                service: "object",
                method: "execute_kw",
                args: [
                    DB, uid, PASSWORD,
                    "product.ribbon",
                    "read",
                    [[ribbonId]],
                    {
                        fields: ["display_name", "bg_color", "text_color"]
                    }
                ]
            });
            if (ribbonRecords.length > 0) {
                const ribbonData = ribbonRecords[0];
                ribbonDetails.name = ribbonData.display_name;
                ribbonDetails.bg_color = ribbonData.bg_color ? ribbonData.bg_color.replace("#", "0xFF") : null;
                ribbonDetails.text_color = ribbonData.text_color ? ribbonData.text_color.replace("#", "0xFF") : null;
            }
        }
        const productWithImages = {
            ...prod,
            description_ecommerce: description,
            image_512: images[0],
            images,
            categories,
            ribbon_name: ribbonDetails.name,
            ribbon_bg_color: ribbonDetails.bg_color,
            ribbon_text_color: ribbonDetails.text_color
        };
        res.json(productWithImages).status(200);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});


router.get("/orders", odooAuth, async (req, res) => {
    try {
        const { uid, DB, PASSWORD } = req.odoo;
        const customerId = req.query.customer_id ? parseInt(req.query.customer_id) : null;
        let domain = [];
        if (customerId) {
            domain.push(["partner_id", "=", customerId]);
        }
        const orders = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "sale.order",
                "search_read",
                [domain],
                {
                    fields: [
                        "id",
                        "name",
                        "partner_id",
                        "amount_total",
                        "date_order",
                        "order_line",
                        "state",
                        "tag_ids"
                    ]
                }
            ]
        });
        res.json(orders).status(200);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});


router.post("/create-order", odooAuth, async (req, res) => {
    try {
        const { customer_id, products } = req.body;
        if (!customer_id || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: "Customer ID and products are required" });
        }
        const { uid, DB, PASSWORD } = req.odoo;
        const tags = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "crm.tag",
                "search_read",
                [[["name", "=", "mobile"]]],
                { fields: ["id"] }
            ]
        });
        let mobileTagId = tags.length > 0 ? tags[0].id : null;
        const orderLines = products.map(p => [0, 0, {
            product_id: p.id,
            product_uom_qty: p.qty
        }]);
        const orderId = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "sale.order",
                "create",
                [{
                    partner_id: customer_id,
                    order_line: orderLines,
                    tag_ids: mobileTagId ? [[6, 0, [mobileTagId]]] : []
                }]
            ]
        });
        const order = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "sale.order",
                "read",
                [[orderId]],
                {
                    fields: [
                        "id",
                        "name",
                        "partner_id",
                        "amount_total",
                        "state",
                        "date_order",
                        "order_line",
                        "tag_ids"
                    ]
                }
            ]
        });
        res.status(201).json(order[0]);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

router.get("/order/:id", odooAuth, async (req, res) => {
    try {
        const { uid, DB, PASSWORD } = req.odoo;
        const orderId = parseInt(req.params.id);
        const orders = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "sale.order",
                "read",
                [[orderId]],
                {
                    fields: [
                        "id",
                        "name",
                        "partner_id",
                        "amount_total",
                        "state",
                        "date_order",
                        "order_line",
                        "tag_ids"
                    ]
                }
            ]
        });
        if (!orders || orders.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        const order = orders[0];
        const lines = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "sale.order.line",
                "read",
                [order.order_line],
                {
                    fields: ["id", "product_id", "product_uom_qty", "price_total"]
                }
            ]
        });
        const products = lines.map(l => ({
            product: l.product_id,
            qty: l.product_uom_qty,
            amount: l.price_total
        }));
        res.json({
            id: order.id,
            name: order.name,
            partner_id: order.partner_id,
            amount_total: order.amount_total,
            state: order.state,
            date_order: order.date_order,
            products: products,
            tag_ids: order.tag_ids
        }).status(200);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});


router.post("/customer/login", odooAuth, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        const { uid, DB, PASSWORD } = req.odoo;
        let domain = [];
        if (email) domain.push(["email", "=", email]);
        const partners = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "res.partner",
                "search_read",
                [domain],
                { fields: ["id", "name", "email", "phone"] }
            ]
        });
        if (!partners || partners.length === 0) {
            return res.status(404).json({ error: "Customer not found" });
        }
        const otpSent = await sendEmailOtp(email)
        res.json(partners[0]).status(200);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});

router.post("/auth", odooAuth, async (req, res) => {
    const { email, otp } = req.body;
    const { uid, DB, PASSWORD } = req.odoo;
    if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required" });
    }
    try {
        const isValid = await verifyEmailOtp(email, otp);

        if (isValid) {
            const domain = [["email", "=", email]];
            const partners = await jsonRPC({
                service: "object",
                method: "execute_kw",
                args: [
                    DB, uid, PASSWORD,
                    "res.partner",
                    "search_read",
                    [domain],
                    { fields: ["id", "name", "email", "phone", "street", "city"] }
                ]
            });
            if (!partners || partners.length === 0) {
                return res.status(404).json({ error: "Customer not found in Odoo." });
            }
            return res.status(200).json(partners[0]);
        } else {
            return res.status(401).json({
                "error": "Invalid OTP, Authentication Error"
            });
        }
    } catch (e) {
        return res.status(500).json({
            "error": String(e)
        });
    }
});


router.post("/customer/signup", odooAuth, async (req, res) => {
    try {
        const { name, phone, email, street, street2, city, zip, password } = req.body;
        if (!name || !phone || !email || !street) {
            return res.status(400).json({ error: "Name, phone, email, street and password are required" });
        }
        const { uid, DB, PASSWORD } = req.odoo;
        let domain = [];
        if (phone && email) {
            domain = ["|", ["phone", "=", phone], ["email", "=", email]];
        } else if (phone) {
            domain = [["phone", "=", phone]];
        } else if (email) {
            domain = [["email", "=", email]];
        }
        const existing = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "res.partner",
                "search_read",
                [domain],
                { fields: ["id", "name", "phone", "email"] }
            ]
        });
        if (existing.length > 0) {
            return res.status(409).json({ error: "Customer with this phone or email already exists" });
        }
        const partnerId = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "res.partner",
                "create",
                [{
                    name,
                    phone,
                    email,
                    street,
                    street2: street2 || "",
                    city: city || "",
                    state_id: 1,
                    zip: zip || "",
                    country_id: 586
                }]
            ]
        });
        try {
            const portalGroupId = await getExternalId('base.group_portal', DB, uid, PASSWORD);
            await jsonRPC({
                service: "object",
                method: "execute_kw",
                args: [
                    DB, uid, PASSWORD,
                    "res.partner", 
                    "write",
                    [
                        [partnerId], 
                        {
                            "user_ids": [
                                [0, 0, {
                                    "login": email,
                                    "password": password,
                                    "group_ids": [[6, 0, [portalGroupId]]]
                                }]
                            ]
                        }
                    ],
                    {
                        "context": {
                            "no_reset_password": true
                        }
                    }
                ]
            });
        } catch (portalErr) {
            return res.status(500).json({ error: "Customer created, but failed to grant website login access. Please try again." });
        }
        const partner = await jsonRPC({
            service: "object",
            method: "execute_kw",
            args: [
                DB, uid, PASSWORD,
                "res.partner",
                "read",
                [[partnerId]],
                { fields: ["id", "name", "phone", "email", "street", "street2", "city", "state_id", "zip", "country_id"] }
            ]
        });
        res.status(201).json(partner[0]);
    } catch (err) {
        res.status(500).json({ error: err });
    }
});


module.exports = router;