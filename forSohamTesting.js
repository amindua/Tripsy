const bodyParser = require("body-parser");
const express = require("express");
const fs = require("fs");
const path = require("path");
const portNumber = 5001;
const app = express();

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(__dirname));




app.get("/", (req, res) => {
    res.render("home");
});

app.get("/create", (req, res) => {
  res.render("create");
});


app.listen(portNumber);
console.log(`Web server started and running at http://localhost:${portNumber}`);