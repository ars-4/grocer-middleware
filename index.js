const express = require("express");
const app = express();
const routes = require("./views");

app.use(express.json());
app.use("/", routes);

app.listen(3000, () => console.log("Server running on 3000"));