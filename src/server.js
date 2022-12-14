const cassandra = require('cassandra-driver');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

const args = process.argv.slice(2);
const port = process.env.PORT || 3000;

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

const redis_client = redis.createClient({
  //host: 'redis-env.eba-8nrzyqft.us-east-1.elasticbeanstalk.com',
  //port: 6379,
  url: 'redis://redis.y599az.ng.0001.use1.cache.amazonaws.com:6379'
});

redis_client.on('error', (err) => console.log('Redis Client Error', err));

app.get('/api', async(req, res) => {
  await redis_client.connect();
  await redis_client.set('test', 'test');
  await redis_client.disconnect();

  res.send('ok');
});

let server = app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});

module.exports = server;