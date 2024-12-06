const {parse} = require('cookie');
const clients = new Map(); // Используем Map для хранения объектов ws всех клиентов с их Id в поле ws.clientId
// Создаем WebSocket сервер поверх HTTP сервера
const WebSocket = require("ws");
const wss = new WebSocket.Server({noServer: true});
const {sessionStore} = require('../app.js');
const {v4 : uuidv4} = require('uuid');

module.exports = (server) => {
    // Обрабатываем запросы upgrade
    server.on('upgrade', (request, socket, head) => {
        handleUpgradeRequest(request, socket, head, wss, sessionStore);
    });
    console.log('WebSocket server is running.');
};


// Функция обработки upgrade-запросов
function handleUpgradeRequest(request, socket, head, wss, sessionStore) {
    console.log('handleUpgradeRequest->');
    const sessionId = getSessionIdFromRequest(request);
    console.log("sessionId: ", sessionId);
    if (!sessionId) {
        console.log("sessionId: null");
        sendBadRequest(socket, 'Session ID missing');
        return;
    }

    // Получаем сессию по sessionId
    getSessionById(sessionId, sessionStore, (err, session) => {
        /**
         * Получить сессию по sessionId или создать новую
         * @param {string} sessionId - ID сессии
         * @param {object} sessionStore - Хранилище сессий
         * @param {function} callback - Функция, вызываемая после завершения
         */
        if (err) {
            sendBadRequest(socket, 'Invalid session'); // это на случай, если при отсутствии сессии мы посылаем нафиг
            return;
        } else if (!session) {
            session = createNewSession(sessionId, sessionStore);
        }

        // создание WebSocket-соединения
        handleWebSocketConnection(request, socket, head, wss, session, sessionStore);
    });
}


function createNewSession(sessionId, sessionStore) {
    console.log('createNewSession->');
    // const sessionId = uuidv4();
    const clientId = uuidv4();
    const clientName = null; // потом вставим сюда полученный с фронта имя пользователя
    const newSession = {
        // sessionId: sessionId,
        clientId: clientId,
        clientName: clientName,
        lastActivity: Date.now(),
    }
    console.log("created new session: ", newSession);
    sessionStore.set(sessionId, newSession, (err) => {
        if (err) {
            console.error('Error saving session:', err);
            return undefined;
        }
    });
    return newSession;
}


// Функция извлечения sessionId из cookies
function getSessionIdFromRequest(request) {
    console.log('getSessionIdFfomRequest->');
    const cookies = parse(request.headers.cookie || '');
    return cookies['connect.sid']?.split('.')[0]; // Извлекаем sessionId
}

// Функция отправки ошибки 400
function sendBadRequest(socket, message) {
    socket.write(`HTTP/1.1 400 Bad Request\r\n\r\n${message}\r\n`);
    socket.destroy();  // Закрываем сокет
}

// Функция получения сессии из sessionStore
function getSessionById(sessionId, sessionStore, callback) {
    console.log('getSessionById->');
    sessionStore.get(sessionId, callback);
}


// Функция обработки WebSocket-соединения
function handleWebSocketConnection(request, socket, head, wss, session, sessionStore) {
    console.log('handleWebSocketConnection->');
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);

        const clientId = session.clientId || 'unknown';
        console.log(`WebSocket Client ID: ${clientId}`);
        ws.send(`Hello, client ${clientId}!`);

wss.on('connection', (ws) => {
    console.log('WSS created');

    // Извлекаем cookie из запроса
    const cookies = parse(request.headers.cookie || '');
    const sessionId = cookies['connect.sid']?.split('.')[0];
    if (!sessionId) {
        ws.send('Session not found');
        ws.close();
        return;
    }


    // Восстанавливаем сессию
    sessionStore.get(sessionId, (err, session) => {
        if (err || !session) {
            console.error('Failed to retrieve session:', err || 'Session not found');
            ws.send('Invalid session');
            ws.close();
            return;
        }
        const clientId = session.clientId || '';
        console.log(`WebSocket Client ID: ${clientId}`);
        ws.send(`Hello, client ${clientId}!`);


        // Добавляем поле для хранения clientId в объекте WebSocket
        // ws.clientId = null;
        ws.clientId = clientId;

        ws.on('message', (message) => {
            console.log(`message received from user: ${clientId}`);

            const data = JSON.parse(message);

            switch (data.type) {
                case 'register':
                    if (clients.get(ws.clientId)) {
                        clients.delete(ws.clientId);
                    }
                    ws.clientId = data.clientId;     // Сохраняем clientId в объекте WebSocket для последующей отправки собеседникам всего объекта WebSocket уже с Id данного клиента
                    clients.set(data.clientId, ws);  //в Map, по ключу клиентского Id размещаем этот объект ws, который потом перешлём собеседнику для создания связи
                    console.log(`Client registered: ${data.clientId}`);

                    for (let [key, value] of clients.entries()) {
                        console.log('clients: ', key);
                    }

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
            console.log("client disconnected and his WSS descroyed. But we'll try to keep it")
            if (ws.clientId) {
                clients.delete(ws.clientId);
                console.log("clients: ");
                clients.forEach((value, key) => console.log(key));
            }


            /*          // Удаляем клиента из Map при отключении, но ставим таймер на случай, если кандидат просто перегрузился (т.е. только временно вышел из WS)
                    if (ws.clientId) {
                        timerConfirmAlive = setTimeout(() => {
                            clients.delete(ws.clientId);
                            console.log(`Client deleted: ${ws.clientId}`);
                            ws.clientId = null;
                        }, aliveTimeout); // если после этого времени не пришел ответ что "imAlive" - удаляем из Map() подключённых участников

                        console.log(`Client disconnected.  Server will now check if client alive or permanently disconnected`);

                        timerRequestAlive = setTimeout(() => {
                            ws.send(JSON.stringify({type: 'checkAlive'}))
                        }, requestTimeout); //даём время на перезагрузку клиента, потом запрашиваем жив ли он
                    }



                    if (ws.clientId) {
                        timerConfirmAlive = setTimeout(() => {
                            clients.delete(ws.clientId);
                            console.log(`Client deleted: ${ws.clientId}`);
                            ws.clientId = null;
                        }, aliveTimeout); // если после этого времени не пришел ответ что "imAlive" - удаляем из Map() подключённых участников

                        console.log(`Client disconnected.  Server will now check if client alive or permanently disconnected`);

                        timerRequestAlive = setTimeout(() => {
                            ws.send(JSON.stringify({type: 'checkAlive'}))
                        }, requestTimeout); //даём время на перезагрузку клиента, потом запрашиваем жив ли он
                    }
             */

        });

    });
});

    })
}