#!/usr/bin/env node
// require('../web_sockets');

/**
 * Module dependencies.
 */

const app = require('../app');
const debug = require('debug')('webrtc-server:server');
const http = require('http');
const locations =require( '../locations.json');
require('dotenv').config({path: `${locations.env}`});
const WebSocket = require('ws');

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
  // console.log(`Server is listening on port ${port}`)});
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

const wss = new WebSocket.Server({server});

// module.exports = server;
// module.exports = wss;


console.log("wss: " + wss);
let clients = {};
wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'register':
          clients[data.clientId] = ws;
          console.log(`Client registered: ${data.clientId}`);
          break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          const targetClient = clients[data.targetId];
          if (targetClient) {
            targetClient.send(JSON.stringify(data));
            console.log("webSocket action done: SEND");
          } else {
            console.log(`Target client ${data.targetId} not found`);
          }
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    for (const [clientId, clientWs] of Object.entries(clients)) {
      if (clientWs === ws) {
        delete clients[clientId];
        console.log(`Client disconnected: ${clientId}`);
        break;
      }
    }
  });
});

