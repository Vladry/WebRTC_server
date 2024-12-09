const {parse} = require('cookie');
const clients = new Map(); // Используем Map для хранения объектов ws всех клиентов с их Id в поле ws.clientId
// Создаем WebSocket сервер поверх HTTP сервера
let clientId = null;
let lastUserName = null;
let newUserName = null;

{// Функция обработки WebSocket-соединения
    function handleWebSocketConnection(request, socket, head, wss, session) {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);

            wss.on('connection', (ws) => {
                console.log('wss created');
/*
                // Извлекаем cookie из запроса
                const cookies = parse(request.headers.cookie || '');
                const sessionId = cookies['connect.sid']?.split('.')[0];
                if (!sessionId) {
                    ws.send('Session not found');
                    ws.close();
                    return;
                }*/

                //
                // // Восстанавливаем сессию
                // sessionStore.get(sessionId, (err, session) => {
                //     if (err || !session) {
                //         console.error('Failed to retrieve session:', err || 'Session not found');
                //         ws.send('Invalid session');
                //         ws.close();
                //         return;
                //     }
                clientId = session.clientId;

                lastUserName = session.lastUserName;
                // console.log(`WebSocket Client ID: ${clientId}`);
                ws.send(`Hello, client ${clientId}!`);


                // Добавляем поле для хранения session.clientId в объекте WebSocket
                ws.clientId = clientId;

                ws.on('message', (message) => {
                    // console.log(`message received from user: ${clientId}`);
                    const data = JSON.parse(message);

                    const entries = Array.from(clients.entries());
                    const firstEntry = entries[0]; // Первая запись
                    const secondEntry = entries[1]; // Вторая запись


                    switch (data.type) {
                        case 'register':
                            console.log('register ->');


                            ws.clientId = clientId;     // Сохраняем clientId в объекте WebSocket для последующей отправки собеседникам всего объекта WebSocket уже с Id данного клиента
                            if (clients.get(ws.clientId)) {
                                clients.delete(ws.clientId);
                            }

                            clients.set(clientId, {ws: ws, name: data.userName});  //в Map, по ключу клиентского Id размещаем этот объект ws, который потом перешлём собеседнику для создания связи
                            console.log(`new name : ${data.userName}`);
                            console.log('lastUserName: ', lastUserName);
                            console.log('client\'s session.clientId: ', clientId);

                            /*                    for (let [key, value] of clients.entries()) {
                                                    console.log('clients: ', key);
                                                }*/

                            break;

                        case 'initiate':
                            // Проверяем наличие targetId в Map
                            const targetWs = clients.get(data.targetId).ws;
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
                            const offerTargetWs = clients.get(data.targetId).ws;
                            if (offerTargetWs) {
                                offerTargetWs.send(JSON.stringify({
                                    type: 'offer', sdp: data.sdp, from: ws.clientId,
                                }));
                                console.log(`Forwarded offer from ${ws.clientId} to ${data.targetId}`);
                            }
                            break;

                        case 'answer':
                            const answerTargetWs = clients.get(data.targetId).ws;
                            if (answerTargetWs) {
                                answerTargetWs.send(JSON.stringify({
                                    type: 'answer', sdp: data.sdp, from: ws.clientId,
                                }));
                                console.log(`Forwarded answer from ${ws.clientId} to ${data.targetId}`);
                            }
                            break;

                        case 'candidate':
                            const candidateTargetWs = clients.get(data.targetId).ws;
                            if (candidateTargetWs) {
                                candidateTargetWs.send(JSON.stringify({
                                    type: 'candidate', candidate: data.candidate, from: ws.clientId,
                                }));
                                console.log(`Forwarded candidate from ${ws.clientId} to ${data.targetId}`);
                            }
                            break;

                        default:
                            console.error(`Unknown message type: ${data.type}`);
                            ws.send(JSON.stringify({
                                type: 'error', message: `Unknown message type: ${data}`,
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

                });

                // });
            });

        })
    }

}
module.exports = handleWebSocketConnection;