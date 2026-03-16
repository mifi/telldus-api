'use strict';

const assert = require('assert');
const crypto = require('crypto');
const querystring = require('querystring');
const https = require('https');
const http = require('http');
const Debug = require('debug');
const nodeFetch = require('node-fetch');
const OAuth = require('oauth-1.0a');

const debug = Debug('telldus-api');

// Fils system stuff
const fs = require('fs');
const path = require('path');
const cacheFolder = path.join(__dirname, 'Cache');

function getFinalUrl(url, qs) {
  return qs ? `${url}?${querystring.stringify(qs)}` : url;
}

const commands = {
	on: 0x0001, // 1
	off: 0x0002, // 2
	bell: 0x0004, // 4
	toggle: 0x0008, // 8
	dim: 0x0010, // 16
	learn: 0x0020, // 32
	execute: 0x0040, // 64
	up: 0x0080, // 128
	down: 0x0100, // 256
	stop: 0x0200, // 512
	rgb: 0x0400, // 1024
	thermostat: 0x800, // 2048
  };

// query parameteres devices
const supportedMethods = Object.values(commands).reduce((memo, num) => memo + num, 0);
const extras = 'devicetype';

// query parameteres sensors
const includeValues = '1';
const includeScale = '1';

const sensorCacheTimeLimit = 60000; // 1 minute
const deviceCacheTimeLimit = 5000; // 5 seconds

// https://github.com/johnlemonse/homebridge-telldus/issues/76
async function fetch(url, opts) {
  return nodeFetch(url, {
    ...opts,
    agent: ({ protocol }) => (protocol === 'http:' ? new http.Agent() : new https.Agent({ minVersion: 'TLSv1' })),
  });
}


class Api {

  // cache handling in memory
  lastSensorRead = new Date('2022-01-01');
  lastDeviceRead = new Date('2022-01-01');

  // memory cache
  sensorCache = null;
  deviceCache = null;

  async getProfile() {
    return this.request({ path: '/user/profile' });
  }

  async listSensors(id) {

      // Specify the file path
      const fileName = 'sensors.json';

      const now = (new Date()).getTime();
      const cacheTime = this.lastSensorRead.getTime();

      if (now - cacheTime < sensorCacheTimeLimit) { // Milliseconds, newer than limit, just use cache
        // chache exists?
        if (this.sensorCache) {

            // this.log(`Sensor cache data for id ${id}`);

            // return list or single item if id is set
            if (id) {

                const sensorInfo = this.sensorCache.sensor.filter(a => a.id == id)[0]; // first and only element
                // this.log(`Devicedata for id ${id}, ${JSON.stringify(deviceInfo, null, 2)}`);
                return sensorInfo;
            }
            else {
                return this.sensorCache.sensor;
            }

        }
      }  

    // read from api

    try {

        const response = await this.request({ path: '/sensors/list', qs: { includeValues, includeScale } });

        // this.log(`Sensor data from API`);

        // ok, set date and fill memory cache
        this.lastSensorRead = new Date();
        this.sensorCache = response;

        // ok get from service, write to file
        this.writeJsonToFile(response, fileName);

        // return list or single item if id is set
        if (id) {

          const sensorInfo = response.sensor.filter(a => a.id == id)[0]; // first and only element
          //this.log(`Sensordata for id ${id}, ${JSON.stringify(sensorInfo, null, 2)}`);

          return sensorInfo;
        }
        else {
          return response.sensor;
        }

    } catch(error) {	

        // code to run if there are any problems
        // check for error 429?
        const jsonData = this.readJsonFromFile(fileName);

        // this.log(`Sensor data from File`);
        
        // this.log(`Sensordata fra fil ${JSON.stringify(jsonData, null, 2)}`);

        if (jsonData) {
          if (id) {

            const sensorInfo = jsonData.sensor.filter(a => a.id == id)[0]; // first and only element
            //this.log(`Sensordata for id ${id}, ${JSON.stringify(sensorInfo, null, 2)}`);

            return sensorInfo;
          }
          else {
            return jsonData.sensor;
          }
        }
        else {
          return [];
        }

    }

  }

  async getSensorInfo(id) {

    // Get list of sensorts with values and find element for id
    // This way cached value will be used if neccesary
    return this.listSensors(id)

//    return this.request({ path: '/sensor/info', qs: { id } });
  }

  async setSensorName(id, name) {
    return this.request({ path: '/sensor/setName', qs: { id, name } });
  }

  async setSensorIgnore(id, ignore) {
    return this.request({ path: '/sensor/setIgnore', qs: { id, ignore } });
  }

  async listClients() {
    return this.request({ path: '/clients/list' });
  }

  async listDevices(id) {

      // Specify the file path
      const fileName = 'devices.json';

      const now = (new Date()).getTime();
      const cacheTime = this.lastDeviceRead.getTime();

      // this.log(`listDevices ${id}, diff ${now - cacheTime}`);

      if (now - cacheTime < deviceCacheTimeLimit) { // Milliseconds, newer than limit, just use cache
          // chache exists?
          if (this.deviceCache) {

              // this.log(`Cache data for id ${id}`);

              // return list or single item if id is set
              if (id) {

                  const deviceInfo = this.deviceCache.device.filter(a => a.id == id)[0]; // first and only element
                  // this.log(`Devicedata for id ${id}, ${JSON.stringify(deviceInfo, null, 2)}`);
                  return deviceInfo;
              }
              else {
                  return this.deviceCache.device;
              }

          }
      }  

      // try to list
      try {

        // read from api
        const response = await this.request({ path: '/devices/list', qs: { supportedMethods, extras } });

        // ok, set date and fill memory cache
        this.lastDeviceRead = new Date()
        this.deviceCache = response; // memory cache

        // this.log(`Device data from API`);

        // ok, write to file
        this.writeJsonToFile(response, fileName);

        // return list or single item if id is set
        if (id) {

          const deviceInfo = response.device.filter(a => a.id == id)[0]; // first and only element
          //this.log(`Devicedata for id ${id}, ${JSON.stringify(deviceInfo, null, 2)}`);

          return deviceInfo;
        }
        else {
          return response.device;
        }

    } catch(error) {	

        // code to run if there are any problems
        const jsonData = this.readJsonFromFile(fileName);

        // this.log(`Device data from File`);

        if (jsonData) {
          if (id) {

            const deviceInfo = jsonData.device.filter(a => a.id == id)[0]; // first and only element
            //this.log(`Devicedata for id ${id}, ${JSON.stringify(deviceInfo, null, 2)}`);
  
            return deviceInfo;
          }
          else {
            return jsonData.device;
          }
        } 
        else {
          return [];
        }


    }
  }

  async getDeviceInfo(id) {

    // Get list of device with values and find element for id
    // This way cached value will be used if neccesary

    return this.listDevices(id);

//    return this.request({ path: '/device/info', qs: { id, supportedMethods } });
  }

  async addDevice(device) {
    return this.request({ path: '/device/setName', qs: device });
  }

  async deviceLearn(id) {
    return this.request({ path: '/device/learn', qs: { id } });
  }

  async setDeviceModel(id, model) {
    return this.request({ path: '/device/setModel', qs: { id, model } });
  }

  async setDeviceName(id, name) {
    return this.request({ path: '/device/setName', qs: { id, name } });
  }

  async setDeviceParameter(id, parameter, value) {
    return this.request({ path: '/device/setParameter', qs: { id, parameter, value } });
  }

  async setDeviceProtocol(id, protocol) {
    return this.request({ path: '/device/setProtocol', qs: { id, protocol } });
  }

  async removeDevice(id) {
    return this.request({ path: '/device/remove', qs: { id } });
  }

  async bellDevice(id) {
    return this.request({ path: '/device/bell', qs: { id } });
  }

  async dimDevice(id, level) {

    this.log(`onDimDevice id: ${id}, level: ${level}`);

    // update local cache with new state
    // sett statevalue
    this.updateCacheStateValue(id, level);  // 255 basert? sjekk

    return this.request({ path: '/device/dim', qs: { id, level } });
  }

  async onOffDevice(id, on) {

    this.log(`onOffDevice id: ${id}, on: ${on}`);

    // update local cache with new state
    // set state with command value
    this.updateCacheState(id, on ? commands.on : commands.off);

    return this.request({ path: `/device/turn${on ? 'On' : 'Off'}`, qs: { id } });
  }

  async stopDevice(id) {
    // update local cache with new state
    // set state
    updateCacheState(id, up ? commands.up : commands.down);

    return this.request({ path: '/device/stop', qs: { id } });
  }

  async upDownDevice(id, up) {

    // update local cache with new state
    // set state
    this.updateCacheState(id, up ? commands.up : commands.down);

    return this.request({ path: `/device/${up ? 'up' : 'down'}`, qs: { id } });
  }

  async commandDevice(id, command, value) {
    if (!commands[command]) throw new Error('Invalid command supplied');
    return this.request({ path: '/device/command', qs: { id, method: command, value } });
  }

  async listEvents() {
    return this.request({ path: '/events/list' });
  }

  /**
   * Returns device history
   * @param id device id
   * @param from timestamp in seconds
   * @param to timestamp in seconds
   * @returns {*} a Promise
   */
  async deviceHistory(id, from, to) {
    return this.request({ path: '/device/history', qs: { id, from, to } });
  }

  // MARK: Helper file functions

  // Update current value for cahce
  updateCacheState(id, state) {

      this.log(`updateCacheState id ${id}`);

      const index = this.deviceCache.device.findIndex(a => a.id == id);
      const beforeUpdate = this.deviceCache.device[index].state;

      // this.log(`updateCacheState beforeUpdate ${beforeUpdate}`);

      if (index > -1) {
        this.deviceCache.device[index].state = (state == commands.on && beforeUpdate == commands.dim) ? commands.dim : state;  // keep dim state if turend on
        this.log(`updateCacheState id: ${id}, ${state}, in cahce: ${beforeUpdate}, after update in cache ${this.deviceCache.device[index].state}`);
      }

  }

  updateCacheStateValue(id, stateValue) {

      // this.log(`updateCacheStateValue id ${id}, stateValue ${stateValue}`);

      // find index for id
      const index = this.deviceCache.device.findIndex(a => a.id == id);
      const beforeUpdate = this.deviceCache.device[index].stateValue;

      if (index > -1) {
        this.deviceCache.device[index].stateValue = stateValue;
        this.log(`updateCacheStateValue id: ${id}, ${stateValue}, in cahce: ${beforeUpdate}, after update in cache ${this.deviceCache.device[index].stateValue}`);
      }

    
  }

  createCahceFolder() {
    
    if (!fs.existsSync(cacheFolder)) {
      // If it doesn't exist, create the folder
      fs.mkdir(cacheFolder, (err) => {
        if (err) {
          console.error('Error creating folder:', err);
        } else {
          console.log('Folder created successfully:', cacheFolder);
        }
      });
    } else {
      // ok, dont do anything
      // console.log('Folder already exists:', cacheFolder);
    }
      
  }

  writeJsonToFile(response, fileName) {
    
    // Convert the JSON object to a JSON string
    const jsonString = JSON.stringify(response, null, 2); // The third parameter (2) is for indentation (optional, for better readability)

    // creates folder if neccesary
    this.createCahceFolder(); 

    const filePath = path.join(cacheFolder, fileName);

    // Write the JSON string to the file
    fs.writeFileSync(filePath, jsonString, (err) => {
      if (err) {
        this.log('Error writing to file:', err);
      } else {
          // this.log('JSON string has been written to', filePath);
      }
    });
        
  }

  readJsonFromFile(fileName) {
    
    // creates folder if neccesary
    this.createCahceFolder(); 

    const filePath = path.join(cacheFolder, fileName);

    // this.log(`Read from file: '${fileName}'`);

    try {
      // Read the file synchronously
      const data = fs.readFileSync(filePath, 'utf8');
    
      // Parse the JSON data
      const jsonData = JSON.parse(data);

      // this.log(`Data fra fil ${JSON.stringify(jsonData, null, 2)}`);
    
      return jsonData

    } catch (err) {
        this.log('Error reading file:', err);
      return []
    }

  }

}

class LocalApi extends Api {
  constructor({ host, accessToken, tokenRefreshIntervalSeconds = 60 * 60 }) {
    super();

    this.host = host;
    this.accessToken = accessToken;
    this.tokenRefreshIntervalSeconds = tokenRefreshIntervalSeconds;

    this.lastRefresh = 0;
  }

  getBaseUrl() {
    return `http://${this.host}/api`;
  }

  async refreshAccessToken() {
    if (new Date().getTime() - this.lastRefresh < this.tokenRefreshIntervalSeconds * 1000) return;
    this.lastRefresh = new Date().getTime();

    const response = await fetch(`${this.getBaseUrl()}/refreshToken?token=${this.accessToken}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    assert(response.status, 200);

    const body = await response.json();

    if (!body.expires) {
      debug(body);
      throw new Error(`Unable to refresh access token: ${body.error}`);
    }

    debug('Refrehed access token, expires', new Date(body.expires * 1000).toISOString());
  }

  async request({ method = 'GET', path, qs }) {
    await this.refreshAccessToken();

    const finalUrl = getFinalUrl(`${this.getBaseUrl()}${path}`, qs);

    const response = await fetch(finalUrl, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    assert.equal(response.status, 200);
    return response.json();
  }
}

class LiveApi extends Api {
  constructor(config, log) {
    super();
    this.config = config; 
    this.log = log;
  }

  async request({ method = 'GET', path, qs }) {
    const telldusLiveBaseUrl = 'https://pa-api.telldus.com/json';

    const {
      key,
      secret,
      tokenKey,
      tokenSecret,
    } = this.config;

    const oauth = OAuth({
      consumer: {
        key,
        secret,
      },
      signature_method: 'HMAC-SHA1',
      hash_function: (baseString, key2) => crypto.createHmac('sha1', key2).update(baseString).digest('base64'),
    });

    const finalUrl = getFinalUrl(`${telldusLiveBaseUrl}${path}`, qs);

    const response = await fetch(finalUrl, {
      method,
      headers: {
        ...oauth.toHeader(oauth.authorize(
          { url: finalUrl, method },
          { key: tokenKey, secret: tokenSecret },
        )),
      },
    });

    assert.equal(response.status, 200);
    return response.json();
  }
}

module.exports = { LocalApi, LiveApi };
