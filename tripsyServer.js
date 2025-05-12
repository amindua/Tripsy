const express = require("express");
const bodyParser = require("body-parser");
const {MongoClient, ServerApiVersion} = require("mongodb");
const path = require("path");
const app = express();

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const url = 'https://api.content.tripadvisor.com/api/v1/location/search?key=7B4283C32F444523A9449EF36E9976FE&searchQuery=miami&category=hotels&language=en';
const options = {method: 'GET', headers: {accept: 'application/json'}};

fetch(url, options)
  .then(res => res.json())
  .then(json => {
    const locations = json.data;

    locations.forEach(location => {
      const id = location.location_id;
      const name = location.name;
      const address = location.address_obj?.street1;

      console.log(`ID: ${id}, Name: ${name}, Address: ${address}, Rating: ${rating}`);
    });
  })
  .catch(err => console.error(err));