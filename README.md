# telldus-api

Node.js interface for [Telldus Live API](http://api.telldus.com/) and [Telldus Local API](https://developer.telldus.com/blog/2016/05/24/local-api-for-tellstick-znet-lite-beta-now-in-public-beta). Since their APIs are similar, I added support for both. All API methods are promise based. Both LiveApi and LocalApi inherit from the same class Api which has the same methods. However not all methods are implemented or make sense on LocalApi.

## Install
⚠️ Requires node 8.3 or greater.
```
npm install telldus-api
```

# Live usage
- You will need a Telldus Live account with configured devices and and OAuth tokens.
- Log in to your Live account, go to http://api.telldus.com/ and `Generate a private token for my user only`.

```
const { LiveApi } = require('telldus-api');

const api = new LiveApi({
  key: '...', // publicKey
  secret: '...', // privateKey
  tokenKey: '...', // token
  tokenSecret: '...', // tokenSecret
});

const devices = await api.listDevices();
console.log(devices);
```

# Local usage
TellStick ZNet Lite can be controlled via a similar API directly via HTTP.
For more info, see [this link](https://developer.telldus.com/blog/2016/05/24/local-api-for-tellstick-znet-lite-beta-now-in-public-beta).

- Find the IP address of your TellStick device
- Install [telldus-local-auth](https://github.com/mifi/telldus-local-auth): `npm i -g telldus-local-auth`
- Run in a terminal `telldus-local-auth <IP OF YOUR DEVICE> appname` and follow instructions. `appname` can be set to whatever you want.
- Note the returned token.

```
const { LocalApi } = require('telldus-api');

const api = new LocalApi({
  host: '...', // Host name or IP address of your device
  accessToken: '...', // The access token you got from telldus-local-auth
});

const devices = await api.listDevices();
console.log(devices);
```

The accessToken will be auto refreshed as long as there are API calls.

# API
See `class Api` in [index.js](https://github.com/mifi/telldus-api/blob/master/index.js)

# Links
- https://github.com/jchnlemon/homebridge-telldus
- https://github.com/mifi/telldus-local-auth
