const express = require("express");
const app = express();
const routes = require("./views");
const cors = require("cors");

app.use(
    cors({
        origin: "*"
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", routes);

app.listen(3000, () => console.log("Server running on 3000"));