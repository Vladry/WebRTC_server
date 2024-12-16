import {WebSocketServer} from "ws";
import {getSession} from './handleUpgradeToWS.js';

const wss = new WebSocketServer({noServer: true});

const clients = new Map(); // Используем Map для хранения объектов ws всех клиентов с их Id в поле ws.clientId
const sessionLifeTime = 24 * 60 * 60 * 1000;
// Функция обработки WebSocket-соединения
export default function attachWebSocketHandlers(request, socket, head) {
    wss.on('connection', async (ws, req) => {
        let session;
        console.log('new wss created');

        session = await getSession(request, socket).catch(error => {
            console.error("Failed to get session:", error);
        });

        ws.send(JSON.stringify({type: 'notification', msg: `Hello, client ${req}!`}));

        ws.on('message', (message) => {
            const data = JSON.parse(message);
            // console.log("ws.on('message')-> session: ", session)

            switch (data.type) {


                case 'register':
                    console.log('register ->');
                    //проверка имени с фронта на уникальность среди logged in юзеров
                    const registeredName = issueUniqueName(data.userName, session); // подобрать уникальное имя в случае, если пришёл не уникальный пользователь и вернуть в data.userName
                    register(registeredName, session, ws);

                    ws.send(JSON.stringify({
                        type: "registered",
                        msg: `Ваше имя занесено в систему как: ${registeredName}`,
                        uniqueName: registeredName
                    }));


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
            console.log("client disconnected and his WS descroyed")
            if (ws.clientId) {
                clients.delete(ws.clientId);
                prnClients("on Close: ");
                activeConnections.delete(ws)
                console.log('activeConnections: ', activeConnections.size)
            }

        });

    });
}

export function handleWebSocketConnection(request, socket, head) {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
}

function prnClients(prefix) {
    console.log("clients ", prefix);
    clients.forEach((value, key) => console.log(key));
}

function issueUniqueName(suggestedName, session) { //задача функции: только вернуть уникальное имя и удалить старую запись в clients если юзер с такой сессией уже существовал
    let registeredName = suggestedName;

    for (const [key, client] of clients.entries()) {
        if (client.lastActivity <= Date.now() - sessionLifeTime) { // вычистить юзеров по устаревшим сессиям
            clients.delete(key);
        }
        if (client.session.clientId === session.clientId) { // если висел юзер с такой же сессией как новый юзер - старого удалить
            clients.delete(key)
            return registeredName; // возвращаем на пере-подключение юзера с той же сессией что и была под его новым именем
        }
        if (key === suggestedName) {
            registeredName += `.${Date.now()}`; // создали уникальный ключ-идентификатор юзера в базе clients
            return registeredName; //просто возвращаем новое имя, т.к. существующее уже зарегистрировано и оно не совпадает сессиями с новым (т.е. это не текущий активный юзер)
        }
    }
    return registeredName; //новое имя не совпало ни с одним из существующих в базе, но при этом мы вычистили все совпадающие сессии и устаревшие соединения
}

function register(registeredName, session, ws) {
    ws.clientId = registeredName; // записать основным ключём сюда подобранное уникальное имя
    clients.set(ws.clientId, {ws: ws, session: session});  //в Map, по ключу клиентского Id размещаем этот объект ws, который потом перешлём собеседнику для создания связи
    console.log(`registeredName : ${registeredName}`);
    console.log("session.clientId: ", `${session.clientId + " attached to-> " + registeredName}`)
    prnClients("at end of register-> ");
};

