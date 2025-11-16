const { login } = require("./odoo");

async function odooAuth(req, res, next) {
  try {
    const { ODOO_DB, ODOO_USER, ODOO_PASS } = req.query;

    if (!ODOO_DB || !ODOO_USER || !ODOO_PASS) {
      return res.status(400).json({ error: "ODOO_DB, ODOO_USER, and ODOO_PASS are required" });
    }
    const uid = await login(ODOO_DB, ODOO_USER, ODOO_PASS);
    req.odoo = {
      uid,
      DB: ODOO_DB,
      PASSWORD: ODOO_PASS
    };
    next();
  } catch (err) {
    res.status(500).json({ error: "Odoo login failed", details: err.message });
  }
}

module.exports = {
    odooAuth
};