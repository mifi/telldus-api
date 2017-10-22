'use strict';

const { LiveApi, LocalApi } = require('./');

const api = new LiveApi({
  key: '...',
  secret: '...',
  tokenKey: '...',
  tokenSecret: '...',
});

const api2 = new LocalApi({
  host: '192.168.1.100',
  accessToken: '...',
});

api.listDevices().then(console.log).catch(console.error);

// api.listSensors().then(console.log).catch(console.error);

// api.deviceInfo(1280861).then(console.log).catch(console.error);

// api.onOffDevice(1280861, false).then(console.log).catch(console.error);

// api.commandDevice(4, 'dim', 255).then(console.log).catch(console.error);

// api.deviceHistory(1280861, 1508633133 - 1000, 1508633133).then(console.log).catch(console.error);

// api.listEvents().then(console.log).catch(console.error);

api2.listDevices().then(console.log).catch(console.error);
