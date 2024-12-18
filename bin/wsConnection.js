import {WebSocketServer} from "ws";
import {getSession} from './handleUpgradeToWS.js';
let forwardedCandidateLoggerFlag = false;

const wss = new WebSocketServer({noServer: true});

const clients = new Map(); // Используем Map для хранения объектов ws всех клиентов с их Id в поле ws.clientId
const sessionLifeTime = 24 * 60 * 60 * 1000;

// тут единожды (при запуске сервера) навешиваются "слушатели" ws-событий:
export default function attachWebSocketHandlers(socket) {
    wss.on('connection', async (ws, request) => {
        let session;
        // console.log('new wss created!');


        // console.log('entering getSession_2 ->');
        // console.log('from request_2: ', request.rawHeaders[21]);

        //тут второй раз получаем сессию - для использования в ws -соединениях
        session = await getSession(request, socket).catch(error => {
            console.error("Failed to get session:", error);
        });
        // console.log('session_2: ', session.clientId);

        ws.send(JSON.stringify({type: 'notification', msg: `Hello, new client!`}));

        ws.on('message', (message) => {
            const data = JSON.parse(message);
            // console.log("ws.on('message')-> session: ", session)

            switch (data.type) {


                case 'register':
                    // console.log('register ->');
                    //проверка имени с фронта на уникальность среди logged in юзеров
                    const registeredName = issueUniqueName(data.userName, session); // подобрать уникальное имя в случае, если пришёл не уникальный пользователь и вернуть в data.userName
                    const updatedUserList = register(registeredName, session, ws);

                    ws.send(JSON.stringify({
                        type: "registered",
                        msg: `Ваше имя занесено в систему как: ${registeredName}`,
                        uniqueName: registeredName
                    }));

                    clients.forEach((c) => {
                        c.ws.send(JSON.stringify({type: 'updateUsers', payload: updatedUserList}))
                    })
                    break;


                case 'initiate':
                    // Проверяем наличие targetId в Map
                    console.log('case initiate ->    data.targetId= ', data.targetId);
                    let targetWs;
                    if (clients.get(data.targetId)) {
                        targetWs = clients.get(data.targetId).ws;
                        console.log(`targetWs.clientId= , '${targetWs.clientId}'`);
                    } else {
                        console.log(`вызываемого юзера ${data.targetId} не существует в объекте clients`)
                    }

                    if (targetWs) {
                        targetWs.send(JSON.stringify({
                            // type: 'initiated', from: ws.clientId,
                            type: 'initiated', from: ws.clientId, targetId: data.targetId
                        }));
                        console.log(`Initiated:  ${ws.clientId} is calling ${data.targetId}`);
                    } else {
                        console.error(`Target client ${data.targetId} not found`);
                        ws.send(JSON.stringify({
                            type: 'error', message:  `Target client ${data.targetId} not logged in`
                        }));
                    }
                    break;

                case 'offer':
                    const offerTargetWs = clients.get(data.targetId).ws;
                    if (offerTargetWs) {
                        offerTargetWs.send(JSON.stringify({
                            type: 'offer', sdp: data.sdp, from: ws.clientId,
                        }));
                        // console.log(`Forwarded offer from ${ws.clientId} to ${data.targetId}`);
                    }
                    break;

                case 'answer':
                    const answerTargetWs = clients.get(data.targetId).ws;
                    if (answerTargetWs) {
                        answerTargetWs.send(JSON.stringify({
                            type: 'answer', sdp: data.sdp, from: ws.clientId,
                        }));
                        // console.log(`Forwarded answer from ${ws.clientId} to ${data.targetId}`);
                        // console.log('SDP: ', data.sdp);
                    }
                    break;

                case 'candidate':
                    console.log('in case candidate: ');
                    const candidateTargetWs = clients.get(data.targetId).ws;
                    if (candidateTargetWs) {
                        // console.log('data.candidate: ', data.candidate);

                        candidateTargetWs.send(JSON.stringify({
                            type: 'candidate', candidate: data.candidate, from: ws.clientId,
                        }));
                        if (!forwardedCandidateLoggerFlag) {
                            console.log(`Forwarded candidate from ${ws.clientId} to ${data.targetId}`);
                            forwardedCandidateLoggerFlag= true;
                        }
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
            }

        });

    });
}

export function handleWebSocketConnection(request, socket, head) {
    // перед началом вызовов handleUpgrade нужно, чтобы уже зарегистрировались все слушатели событий ws (attachWebSocketHandlers)
    // Затем handleUpgrade вызывается при каждой перезагрузке страницы и wss.emit каждый раз создает новый ws
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
}

function prnClients(prefix) {
    // ф-ция для распечатки clients. Префикс- для указания, в каком месте кода мы использовали prnClients
    console.log("clients ", prefix);
    clients.forEach((value, key) => console.log('key: ', key));
    // clients.forEach((value, key) => console.log('key: ', key, ' value: ', value));
}

function issueUniqueName(suggestedName, session) {
    //задача функции: принять предлагаемое и вернуть уникальное имя в системе.
    // Затем и удалить старую запись в clients если юзер с такой сессией уже существовал (так мутировать не корректно- но не хочу повторно итерироваться по clients)
    //а предлагаемый юзер потом добавится в clients в ф-ции register(registeredName)
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
    return registeredName; //на случай, если новое имя не совпало ни с одним из существующих в базе, но при этом мы вычистили все совпадающие сессии и устаревшие соединения
}

function register(registeredName, session, ws) {
    ws.clientId = registeredName; // записать основным ключём сюда подобранное уникальное имя
    clients.set(registeredName, {ws: ws, session: session});  //в Map, по ключу клиентского Id размещаем этот объект ws, который потом перешлём собеседнику для создания связи
    // console.log(`registeredName : ${registeredName}`);
    // console.log("session.clientId: ", `${session.clientId + " attached to-> " + registeredName}`)
    prnClients("list of clients (at end of register-> ) ");
    return updatedUserList();
}

function updatedUserList() {
    const clientsArray = [];
    clients.forEach((client) => {
        clientsArray.push(client.ws.clientId);
    })
    return clientsArray;
}

