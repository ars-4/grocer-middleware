const express = require("express");
const { decode } = require("html-entities");
const { login, jsonRPC } = require("./odoo");
const { odooAuth } = require("./middleware");
const router = express.Router();


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
                { fields: ["id", "name", "parent_id", "sequence"] }
            ]
        });
        const categoriesWithImages = categories.map(cat => ({
            ...cat,
            image: `${BASE}/web/image/product.public.category/${cat.id}/image_256`
        }));
        res.json(categoriesWithImages);
    } catch (err) {
        res.status(500).json({ error: err });
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
                        "website_published"
                    ]
                }
            ]
        });
        const productsWithImages = products.map(p => {
            let plainDescription = decode(p.description_ecommerce || "");
            plainDescription = plainDescription.replace(/<[^>]*>/g, "");
            return {
                ...p,
                description_ecommerce: plainDescription,
                image_url: `${BASE}/web/image/product.template/${p.id}/image_256`
            };
        });
        res.json(productsWithImages);
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
                        "product_template_image_ids"
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
            images = [`${BASE}/web/image/product.template/${productId}/image_512`];
        }
        let description = decode(prod.description_ecommerce || "");
        description = description.replace(/<[^>]*>/g, "");
        const productWithImages = {
            ...prod,
            description_ecommerce: description,
            images,
            categories 
        };
        res.json(productWithImages);
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
        res.json(orders);
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
/*
{
  "customer_id": 10,
  "products": [
    {
      "id": 8,
      "qty": 2
    },
    {
      "id": 2,
      "qty": 1
    },
    {
      "id": 7,
      "qty": 4
    }
  ]
}
  */


// ---------------------------------------------------------
// 5. Single Order with lines
// ---------------------------------------------------------
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
        });
    } catch (err) {
        res.status(500).json({ error: err });
    }
});


router.post("/customer/login", odooAuth, async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name && !phone) {
            return res.status(400).json({ error: "Name or phone is required" });
        }
        const { uid, DB, PASSWORD } = req.odoo;
        let domain = [];
        if (name) domain.push(["name", "ilike", name]);
        if (phone) domain.push(["phone", "=", phone]);
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
        res.json(partners[0]);

    } catch (err) {
        res.status(500).json({ error: err });
    }
});
/*
{
  "name": "John Doe",
  "phone": "+923054307983"
}
*/


router.post("/customer/signup", odooAuth, async (req, res) => {
    try {
        const { name, phone, email, street, street2, city, state_id, zip, country_id } = req.body;
        if (!name || !phone || !email || !street) {
            return res.status(400).json({ error: "Name, phone, email, and street are required" });
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
                    state_id: state_id || false,
                    zip: zip || "",
                    country_id: country_id || false
                }]
            ]
        });
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
/**
 {
  "name": "John Doe",
  "phone": "+923054307983",
  "email": "john@example.com",
  "street": "123 Main Street",
  "street2": "Apartment 4B",
  "city": "Lahore",
  "state_id": 5,
  "zip": "54000",
  "country_id": 1
}
 */



module.exports = router;