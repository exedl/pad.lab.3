const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

const args = process.argv.slice(2);
const port = process.env.PORT || 3000;

app.get('/', async(req, res) => {
  res.send({result: true});
});

let server = app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});

module.exports = server;