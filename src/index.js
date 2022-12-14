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
const port = args[0];

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

const redis_client = redis.createClient({
  host: '127.0.0.1',
  port: 6379
});

redis_client.on('error', (err) => console.log('Redis Client Error', err));

const client = new cassandra.Client({
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'smarthome'
  });

app.put('/api', async(req, res) => {
  if (req.body.name === undefined || req.body.location === undefined) {
    res.send({result: false, message: 'Invalid request'});
  } else {
    var name = req.body.name;
    var location = req.body.location;

    var query_device = await client.execute('SELECT name, location FROM devices WHERE name = ?', [name]);

    if (query_device.rows.length == 0) {
      await client.execute('INSERT INTO devices (name, location) VALUES (?, ?)', [name, location]);

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

    var query_device = await client.execute('SELECT name, location FROM devices WHERE name = ?', [device]);

    var uid = device + '-' + Date.now() + '-' + data;

    if (query_device.rows.length > 0) {
      await client.execute('INSERT INTO measurements (uid, device, data) VALUES (?, ?, ?)', [uid, device, data]);
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

    var query_device = await client.execute('SELECT name, location FROM devices WHERE name = ?', [device]);

    if (query_device.rows.length > 0) {
      await client.execute('DELETE FROM devices WHERE name = ?', [device]);

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

    var query_device = await client.execute('SELECT name, location FROM devices WHERE name = ?', [device]);

    if (query_device.rows.length > 0) {
      await client.execute('UPDATE devices SET location = ? WHERE name = ?', [location, device]);

      res.send({result: true});
    } else {
      res.send({result: false, message: 'Device does not exist'});
    }
  }
});

app.get('/', async(req, res) => {
  var query_devices = await client.execute('SELECT name, location FROM devices');

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
      var query_measurements = await client.execute('SELECT uid, device, data FROM measurements WHERE device = ? LIMIT 5', [query_devices.rows[item].name]);
  
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

  res.render('index', {port: port, devices: devices});
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});