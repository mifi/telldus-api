'use strict';

const assert = require('assert');
const crypto = require('crypto');
const querystring = require('querystring');

const Debug = require('debug');
const fetch = require('node-fetch');
const OAuth = require('oauth-1.0a');

const debug = Debug('telldus-api');

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
};

const supportedMethods = Object.values(commands).reduce((memo, num) => memo + num, 0);


class Api {
  async getProfile() {
    return this.request({ path: '/user/profile' });
  }

  async listSensors() {
    const response = await this.request({ path: '/sensors/list' });
    return response.sensor;
  }

  async getSensorInfo(id) {
    return this.request({ path: '/sensor/info', qs: { id } });
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

  async listDevices() {
    const response = await this.request({ path: '/devices/list', qs: { supportedMethods } });
    return response.device;
  }

  async getDeviceInfo(id) {
    return this.request({ path: '/device/info', qs: { id, supportedMethods } });
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
    return this.request({ path: '/device/dim', qs: { id, level } });
  }

  async onOffDevice(id, on) {
    return this.request({ path: `/device/turn${on ? 'On' : 'Off'}`, qs: { id } });
  }

  async stopDevice(id) {
    return this.request({ path: '/device/stop', qs: { id } });
  }

  async upDownDevice(id, up) {
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
  constructor(config) {
    super();
    this.config = config;
  }

  async request({ method = 'GET', path, qs }) {
    const telldusLiveBaseUrl = 'https://api.telldus.com/json';

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
