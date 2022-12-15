const cassandra = require('cassandra-driver');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const redis = require('redis');
const app = express();
const fs = require('fs');
const md5 = require('md5');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

const args = process.argv.slice(2);
const port = process.env.PORT || 3000;

const instance_id = md5(Math.floor(Math.random() * 1000));

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

const redis_client = redis.createClient({
  url: 'redis://44.203.190.208:6379',
  password: 'exedl'
});

redis_client.on('error', (err) => console.log('Redis Client Error', err));

let authProvider = new cassandra.auth.PlainTextAuthProvider('iam-at-359255121921', 'X7+LiKf2RMgju3RM0ozjhsyleCNz25ke2MWxUkjZF64=');

const sslOptions1 = {
  ca: [
    fs.readFileSync('sf-class2-root.crt', 'utf-8')
  ],      
  host: 'cassandra.us-east-1.amazonaws.com',
  rejectUnauthorized: true
};

const client = new cassandra.Client({
  contactPoints: ['cassandra.us-east-1.amazonaws.com'],
  localDataCenter: 'us-east-1',
  keyspace: 'smarthome',
  authProvider: authProvider,
  sslOptions: sslOptions1,
  protocolOptions: { port: 9142 }
});

app.get('/api', async(req, res) => {
  res.send('ok');
});

app.put('/api', async(req, res) => {
  if (req.body.name === undefined || req.body.location === undefined) {
    res.send({result: false, message: 'Invalid request'});
  } else {
    var name = req.body.name;
    var location = req.body.location;

    var query_device = await client.execute('SELECT name, location FROM devices WHERE name = ? ALLOW FILTERING', [name]);

    if (query_device.rows.length == 0) {
      await client.execute('INSERT INTO devices (name, location) VALUES (?, ?)', [name, location], { consistency: cassandra.types.consistencies.localQuorum });

      res.send({result: true});
    } else {
      res.send({result: false, message: 'Already exists'});
    }
  }
});

app.post('/api', async(req, res) => {
  if (req.body.device === undefined || req.body.data === undefined) {
    res.send({result: false, message: 'Invalid request'});
  } else {
    var device = req.body.device;
    var data = req.body.data;

    var query_device = await client.execute('SELECT name, location FROM devices WHERE name = ? ALLOW FILTERING', [device]);

    var uid = device + '-' + Date.now() + '-' + data;

    if (query_device.rows.length > 0) {
      await client.execute('INSERT INTO measurements (uid, device, data) VALUES (?, ?, ?)', [uid, device, data], { consistency: cassandra.types.consistencies.localQuorum });
      await redis_client.connect();
      await redis_client.set(device + '_m', '');
      await redis_client.disconnect();

      res.send({result: true});
    } else {
      res.send({result: false, message: 'Device does not exist'});
    }
  }
});

app.delete('/api', async(req, res) => {
  if (req.body.device === undefined) {
    res.send({result: false, message: 'Invalid request'});
  } else {
    var device = req.body.device;

    var query_device = await client.execute('SELECT name, location FROM devices WHERE name = ? ALLOW FILTERING', [device]);

    if (query_device.rows.length > 0) {
      await client.execute('DELETE FROM devices WHERE name = ?', [device], { consistency: cassandra.types.consistencies.localQuorum });

      res.send({result: true});
    } else {
      res.send({result: false, message: 'Device does not exist'});
    }
  }
});

app.patch('/api', async(req, res) => {
  if (req.body.device === undefined || req.body.location === undefined) {
    res.send({result: false, message: 'Invalid request'});
  } else {
    var device = req.body.device;
    var location = req.body.location;

    var query_device = await client.execute('SELECT name, location FROM devices WHERE name = ? ALLOW FILTERING', [device]);

    if (query_device.rows.length > 0) {
      await client.execute('UPDATE devices SET location = ? WHERE name = ?', [location, device], { consistency: cassandra.types.consistencies.localQuorum });

      res.send({result: true});
    } else {
      res.send({result: false, message: 'Device does not exist'});
    }
  }
});

app.get('/', async(req, res) => {
  var query_devices = await client.execute('SELECT name, location FROM devices ALLOW FILTERING');

  var devices = {};

  for (var item in query_devices.rows) {
    await redis_client.connect();
    var redis_cache = await redis_client.get(query_devices.rows[item].name + '_m');
    await redis_client.disconnect();
    
    var name = query_devices.rows[item].name;

    var measurements = [];

    if (redis_cache) {
      try {
        measurements = JSON.parse(redis_cache);
        measurements.push('cached');
      } catch (e) {

      }
    } else {
      var query_measurements = await client.execute('SELECT uid, device, data FROM measurements WHERE device = ? LIMIT 5 ALLOW FILTERING', [query_devices.rows[item].name]);
  
      for (var item_m in query_measurements.rows) {
        measurements.push(query_measurements.rows[item_m].data);
      }

      await redis_client.connect();
      await redis_client.set(query_devices.rows[item].name + '_m', JSON.stringify(measurements));
      await redis_client.disconnect();
    }

    console.log(measurements);

    devices[name] = {
      name: query_devices.rows[item].name,
      location: query_devices.rows[item].location,
      measurements: measurements
    }
  }

  res.render('index', {port: instance_id, devices: devices});
});

let server = app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});

module.exports = server;