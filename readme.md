nginx
redis
postgre

put - new device
post - measurements
delete - device
patch - device name
get - page

CREATE KEYSPACE smarthome WITH REPLICATION = {'class':'NetworkTopologyStrategy', 'dc1' : 2};

use smarthome;

CREATE TABLE devices (
   name text, 
   location text,
   PRIMARY KEY (name));
   
CREATE TABLE measurements (
   uid text, 
   device text,
   data text,
   PRIMARY KEY (uid));