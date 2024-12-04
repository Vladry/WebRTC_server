#!/usr/bin/env node
// require ('../turn_server');

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


  // Создаем WebSocket сервер поверх HTTP сервера
const wss = new WebSocket.Server({server});

const clients = new Map(); // Используем Map для хранения объектов ws всех клиентов с их Id в поле ws.clientId

wss.on('connection', (ws) => {
  console.log('New client connected');
  let timerConfirmAlive = null;
  let timerRequestAlive = null;
  let requestTimeout = 10000;
  let aliveTimeout = requestTimeout * 2;

  // Добавляем поле для хранения clientId в объекте WebSocket
  ws.clientId = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'register':

        ws.clientId = data.clientId;     // Сохраняем clientId в объекте WebSocket для последующей отправки собеседникам всего объекта WebSocket уже с Id данного клиента
        clients.set(data.clientId, ws);  //в Map, по ключу клиентского Id размещаем этот объект ws, который потом перешлём собеседнику для создания связи
        console.log(`Client registered: ${data.clientId}`);
        break;

      case 'initiate':
        // Проверяем наличие targetId в Map
        const targetWs = clients.get(data.targetId);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: 'initiate', from: ws.clientId,
          }));
          console.log(`Initiate:  ${data.fromId} is calling ${data.targetId}`);
        } else {
          console.error(`Target client ${data.targetId} not found`);
          ws.send(JSON.stringify({
            type: 'error', message: `Target client ${data.targetId} not connected`,
          }));
        }
        break;

      case 'offer':
        const offerTargetWs = clients.get(data.targetId);
        if (offerTargetWs) {
          offerTargetWs.send(JSON.stringify({
            type: 'offer', sdp: data.sdp, from: ws.clientId,
          }));
          console.log(`Forwarded offer from ${ws.clientId} to ${data.targetId}`);
        }
        break;

      case 'answer':
        const answerTargetWs = clients.get(data.targetId);
        if (answerTargetWs) {
          answerTargetWs.send(JSON.stringify({
            type: 'answer', sdp: data.sdp, from: ws.clientId,
          }));
          console.log(`Forwarded answer from ${ws.clientId} to ${data.targetId}`);
        }
        break;

      case 'candidate':
        const candidateTargetWs = clients.get(data.targetId);
        if (candidateTargetWs) {
          candidateTargetWs.send(JSON.stringify({
            type: 'candidate', candidate: data.candidate, from: ws.clientId,
          }));
          console.log(`Forwarded candidate from ${ws.clientId} to ${data.targetId}`);
        }
        break;

      case 'imAlive':
        timerConfirmAlive = null; // отключаем таймер удаления абонента из clients Map(), т.к. он подтвердил ,что он "живой" и, видимо просто перегружался
        break;

      default:
        console.error(`Unknown message type: ${data.type}`);
        ws.send(JSON.stringify({
          type: 'error', message: `Unknown message type: ${data.type}`,
        }));
    }
  });


  ws.on('close', () => {
    // Удаляем клиента из Map при отключении, но ставим таймер на случай, если кандидат просто перегрузился (т.е. только временно вышел из WS)
    if (ws.clientId) {
      timerConfirmAlive = setTimeout(() => {
        clients.delete(ws.clientId);
        console.log(`Client deleted: ${ws.clientId}`);
        ws.clientId = null;
      }, aliveTimeout); // если после этого времени не пришел ответ что "imAlive" - удаляем из Map() подключённых участников

      console.log(`Client disconnected: ${ws.clientId}.  Server will now check it client alive or permanently disconnected`);

      timerRequestAlive = setTimeout(() => {
        ws.send(JSON.stringify({type: 'checkAlive'}))
      }, requestTimeout); //даём время на перезагрузку клиента, потом запрашиваем жив ли он
    }
  });
});


/*const Turn = require('node-turn'); // Этот TURN сервер не используется (юзаю внешний), тут код -для примера
const turnServer = new Turn({
  Port: 3478,
  listeningIps: ['192.168.88.242'],
  externalIps: ['195.3.129.213'],  // к сожалению, так не работает и клиенты не могут "извне" достучаться до этого IP, использую внешний TURN- сервер
  allocationLifetime: 600, // Lifetime in seconds
  realm: 'myrealm',
  authMech: 'long-term',
  credentials: {
    user1: 'password1',
    user2: 'password2',
  },
  debugLevel: 'ALL',

  ltCredMech: true,
  fingerprint: true,
  minPort: 49152,
  maxPort: 65535,
});

turnServer.start();*/
