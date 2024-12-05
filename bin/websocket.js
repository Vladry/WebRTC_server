
module.exports = (server)=> {


// Создаем WebSocket сервер поверх HTTP сервера
const WebSocket = require("ws");
const wss = new WebSocket.Server({server});

const clients = new Map(); // Используем Map для хранения объектов ws всех клиентов с их Id в поле ws.clientId

wss.on('connection', (ws) => {
    console.log('WSS created');
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
        console.log("client disconnected and his WSS descroyed. But we'll try to keep it")
        // Удаляем клиента из Map при отключении, но ставим таймер на случай, если кандидат просто перегрузился (т.е. только временно вышел из WS)
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
    });
});



};