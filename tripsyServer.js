const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");

const app = express();
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

app.use(session({
  secret: process.env.SESSION_SECRET || "a very secret key",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } 
}));

app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "templates"));
app.use(bodyParser.urlencoded({ extended: false }));

const { MongoClient, ServerApiVersion } = require("mongodb");

const authRouter = require(path.join(__dirname, 'routes', 'auth'));
app.use('/', authRouter);

const mainRouter = require(path.join(__dirname, 'routes', 'main'));
app.use('/', mainRouter);

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/create", (req, res) => {
  res.render("create");
});

app.listen(5001, () => {
  console.log("Server is running on port 5001");
});


