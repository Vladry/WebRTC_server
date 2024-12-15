import {WebSocketServer} from "ws";
const wss = new WebSocketServer.Server({noServer: true});
const clients = new Map(); // Используем Map для хранения объектов ws всех клиентов с их Id в поле ws.clientId
const sessionLifeTime = 24 * 60 * 60 * 1000;
import {getSession} from './handleUpgradeToWS.js';

{// Функция обработки WebSocket-соединения
   function handleWebSocketConnection(request, socket, head, session) {
        wss.on('connection', (ws, req) => {
            console.log('new empty wss created');

            getSession(request, socket)
                .then(session => {
                    console.log("Session is ready:", session);
//  do my code here!!!
                })
                .catch(error => {
                    console.error("Failed to get session:", error);
                });


            ws.send(JSON.stringify({type: 'notification', msg: `Hello, client ${req}!`}));

            ws.on('message', (message) => {
                const data = JSON.parse(message);
                // console.log("ws.on('message')-> session: ", session)

                switch (data.type) {


                    case 'register':
                        let renameRequired = false;
                        console.log('register ->');
                        //проверка имени с фронта на уникальность среди logged in юзеров
                        while (userCheck(data.userName, session)) { // и видоизменяем "data.userName" прилетевшее с фронта для повторной попытки логина с уникальным именем
                            data.userName += "_";
                            renameRequired = true;
                        } // TODO тут сервер может зависнуть при не верномкоде 

                        if (renameRequired) { // тут уникальное имя уже подобрано и  положено в "data.userName"
                            ws.send(JSON.stringify({
                                type: "errSuchUserLoggedIn",
                                error: `Такой пользователь уже залогинен в системе. Ваше имя будет изменено на: ${data.userName}`,
                                uniqueName: data.userName
                            }));
                        }
                        console.log("old name: ", ws.clientId)
                        ws.clientId = data.userName;
                        clients.set(ws.clientId, {ws: ws, session: session});  //в Map, по ключу клиентского Id размещаем этот объект ws, который потом перешлём собеседнику для создания связи
                        console.log(`new name : ${data.userName}`);
                        console.log("session.clientId: ", `${session.clientId + "   ->" + data.userName}`)
                        prnClients("at end of register-> ");
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
                    prnClients("on Close: ");
                }

            });

            // });
        });

        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }

}

function prnClients(prefix) {
    console.log("clients ", prefix);
    clients.forEach((value, key) => console.log(key));
}

function userCheck(name, session) {
    let userExists = false;
    for (const [key, client] of clients.entries()) {
        if (client.lastActivity <= Date.now() - sessionLifeTime) { // вычистить юзеров по устаревшим сессиям
            clients.delete(key);
        }
        if (client.session.clientId === session.clientId) { // если висел юзер с такой же сессией как новый юзер - старого удалить
            clients.delete(key)
        }

        if (key === name) {  // возвращаем подтверждение того, что юзер с таким же именем уже существует в базе
            userExists = true
        }
    }
    return userExists;
}

export default handleWebSocketConnection;
