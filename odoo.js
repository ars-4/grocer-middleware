const axios = require("axios");

async function jsonRPC(params) {
    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params,
        id: Date.now()
    };
    const ODOO_URL = `https://${params.args[0]}.odoo.com/jsonrpc`;
    const { data } = await axios.post(ODOO_URL, payload, {
        headers: { "Content-Type": "application/json" }
    });

    if (data.error) throw data.error;
    return data.result;
}

async function login(DB, USER, PASSWORD) {
    return await jsonRPC({
        service: "common",
        method: "login",
        args: [DB, USER, PASSWORD]
    });
}


module.exports = {
    jsonRPC,
    login
}