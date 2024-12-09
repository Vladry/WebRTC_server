#!/usr/bin/env node
/**
 * Module dependencies.
 */

const app = require('../app').app;
const debug = require('debug')('webrtc-server:server');
// const http = require('http');
const locations =require( '../locations.json');
require('dotenv').config({path: `${locations.env}`});


/**
 * Готовим переменные под сертификат для https
 * **/
const https = require('https');
const fs = require('fs');
const path = require("path");

//  Новая сертификация: https
const key = fs.readFileSync(path.join(__dirname, "../secrets/key.pem"), 'utf8');
const cert = fs.readFileSync(path.join(__dirname, "../secrets/cert.pem"), 'utf8');
const credentials = {key: key, cert: cert,  secureProtocol: 'TLS_method',
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'AES128-GCM-SHA256',
    'AES256-GCM-SHA384',
  ].join(':'),
};

//  Старая сертификация: https
/*
const https = require('https');
const fs = require('fs');
const path = require("path");
const privateKey = fs.readFileSync(path.join(__dirname, "../secrets/private.key"), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, "../secrets/server.crt"), 'utf8');
const credentials = {key: privateKey, cert: certificate};
*/

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */
// const server = http.createServer(app);
// server.listen(port,'0.0.0.0');
// server.listen(port);                               это было создание http сервера, а это:

const server = https.createServer(credentials, app); // это создание https сервера

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port, '0.0.0.0', () => {
  // console.log(` on port ${port}`);
  server.on('error', onError);
  server.on('listening', onListening);
});

  /**
   * Normalize a port into a number, string, or false.
   */

  function normalizePort(val) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
      // named pipe
      return val;
    }

    if (port >= 0) {
      // port number
      return port;
    }

    return false;
  }

  /**
   * Event listener for HTTP server "error" event.
   */

  function onError(error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  /**
   * Event listener for HTTP server "listening" event.
   */

  function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    debug('Listening on ' + bind);
    console.info('listening on ' + addr.address + ":" + bind);
  }


// Подключаем WebSocket и передаём в него сервер
require('./handleUpgradeToWS.js')(server);
// вызываем модуль turnServer-a
// require('./turn_server.js')();