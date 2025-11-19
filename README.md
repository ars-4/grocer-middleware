# Odoo JSON-RPC Express API

This API allows interaction with an **Odoo 19** backend for e-commerce functionality. It supports **products, categories, orders, and customer management** via JSON-RPC.

All requests require Odoo DB credentials via **query parameters**:

```
?ODOO_DB=<db_name>&ODOO_USER=<username>&ODOO_PASS=<password>
```

---

## Base URL

```
http://<your-server>/<route>
```

.env file Using => Nodemailer and Upstash.com

```bat
REDIS_URL="https://...."
REDIS_TOKEN="AZkV........." 

EMAIL_USER="Email"
EMAIL_PASS="email password"

JWT_SECRET="....."
```

---

## Routes

### 1. Get Categories

**URL:** `/categories`  
**Method:** `GET`  

**Query Parameters:**

| Name       | Required | Description                        |
|------------|----------|------------------------------------|
| ODOO_DB    | Yes      | Odoo database name                 |
| ODOO_USER  | Yes      | Odoo username                      |
| ODOO_PASS  | Yes      | Odoo password                      |

**Response:**

```json
[
  {
    "id": 1,
    "name": "Flour",
    "parent_id": false,
    "sequence": 1,
    "image": "https://mydb.odoo.com/web/image/product.public.category/1/image_256"
  }
]
```

### 2. Get Products (All or by Category)

**URL:** `/products`  
**Method:** `GET`

**Query Parameters:**

| Name        | Required | Description                         |
|-------------|----------|-------------------------------------|
| ODOO_DB     | Yes      | Odoo database name                  |
| ODOO_USER   | Yes      | Odoo username                       |
| ODOO_PASS   | Yes      | Odoo password                       |
| category_id | No       | Filter products by category ID      |

**Response:**

```json
[
  {
    "id": 3,
    "name": "Organic Flour",
    "list_price": 500,
    "description_ecommerce": "Naturally whole wheat flour...",
    "website_published": true,
    "categories": ["Flour", "Organic"],
    "ribbon_name": "New!",
    "ribbon_bg_color": "0xFFd9026a",
    "ribbon_text_color": "0xFFFFFFFF",
    "images": [
      "https://mydb.odoo.com/web/image/product.template/3/image_256"
    ]
  }
]
```

### 3. Get Single Product

**URL:** `/product/:id`  
**Method:** `GET`

**Path Parameter:**

| Name | Required | Description     |
|------|----------|----------------|
| id   | Yes      | Product ID      |

**Query Parameters:** Odoo DB credentials as before.

**Response:**

```json
{
  "id": 3,
  "name": "Organic Flour",
  "list_price": 500,
  "description_ecommerce": "Naturally whole wheat flour...",
  "website_published": true,
  "categories": ["Flour", "Organic"],
  "ribbon_name": "New!",
  "ribbon_bg_color": "0xFFd9026a",
  "ribbon_text_color": "0xFFFFFFFF",
  "images": [
    "https://mydb.odoo.com/web/image/product.template/3/image_512",
    "https://mydb.odoo.com/web/image/product.image/12/image_512"
  ]
}
```

### 4. Customer Signup

**URL:** `/customer/signup`  
**Method:** `POST`

**Query Parameters:** Odoo DB credentials as before.

**Request Body:**

```json
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
```

**Response (Success):**

```json
{
  "id": 10,
  "name": "John Doe",
  "phone": "+923054307983",
  "email": "john@example.com",
  "street": "123 Main Street",
  "street2": "Apartment 4B",
  "city": "Lahore",
  "state_id": [5, "Punjab"],
  "zip": "54000",
  "country_id": [1, "Pakistan"]
}
```

**Response (User Exists):**

```json
{
  "error": "Customer with this phone or email already exists"
}
```

### 5. Customer Login

**URL:** `/customer/login`  
**Method:** `POST`

**Query Parameters:** Odoo DB credentials as before.

**Request Body:**

```json
{
  "email": "john_doe@example.com"
}
```

**Response:**

```json
{
  "msg": "OTP Sent",
}
```

### 5. Customer OTP

**URL:** `/auth`  
**Method:** `POST`

**Query Parameters:** Odoo DB credentials as before.

**Request Body:**

```json
{
  "email": "john_doe@example.com"
}
```

**Response:**

```json
{
  "id": 10,
  "name": "John Doe",
  "phone": "+923054307983",
  "email": "john@example.com",
  "street": "123 Main Street"
}
```


### 6. Create Order

**URL:** `/create-order`  
**Method:** `POST`

**Query Parameters:** Odoo DB credentials as before.

**Request Body:**

```json
{
  "customer_id": 10,
  "products": [
    { "id": 3, "qty": 2 },
    { "id": 4, "qty": 1 }
  ]
}
```

**Response:**

```json
{
  "id": 2,
  "name": "S00002",
  "partner_id": [10, "John Doe"],
  "amount_total": 4465,
  "state": "draft",
  "date_order": "2025-11-16 17:36:37",
  "products": [
    { "product": [3, "Product A"], "qty": 2, "amount": 1000 },
    { "product": [4, "Product B"], "qty": 1, "amount": 1500 }
  ],
  "tag_ids": [1]
}
```

### 7. Get Orders by Customer

**URL:** `/orders`  
**Method:** `GET`

**Query Parameters:**

| Name        | Required | Description               |
|-------------|----------|---------------------------|
| ODOO_DB     | Yes      | Odoo database name        |
| ODOO_USER   | Yes      | Odoo username             |
| ODOO_PASS   | Yes      | Odoo password             |
| customer_id | Yes      | Filter orders by customer |

**Response:**

```json
[
  {
    "id": 2,
    "name": "S00002",
    "partner_id": [10, "John Doe"],
    "amount_total": 4465,
    "state": "draft",
    "date_order": "2025-11-16 17:36:37",
    "order_line": [3, 4, 5],
    "tag_ids": [1]
  }
]
```

### 8. Get Single Order (detailed)

**URL:** `/order/:id`  
**Method:** `GET`

**Path Parameter:**

| Name | Required | Description     |
|------|----------|----------------|
| id   | Yes      | Order ID        |

**Query Parameters:** Odoo DB credentials as before.

**Response:**

```json
{
  "id": 2,
  "name": "S00002",
  "partner_id": [10, "John Doe"],
  "amount_total": 4465,
  "state": "draft",
  "date_order": "2025-11-16 17:36:37",
  "products": [
    { "product": [3, "Product A"], "qty": 2, "amount": 1000 },
    { "product": [4, "Product B"], "qty": 1, "amount": 1500 }
  ],
  "tag_ids": [1]
}
```

---

### Notes
- Every route requires **Odoo credentials** as query parameters.

