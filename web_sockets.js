/*
// const WebSocket = require('ws');
// const server = require('./bin/www.js');
// const wss = new WebSocket.Server({server});
// const wss = new WebSocket.Server({port:3003});
// const wss = new WebSocket.WebSocketServer({server});
// const wss = new WebSocket('wss://195.3.129.213:3003/');
// const wss = new WebSocket('wss://192.168.88.242:3003/');
const wss = require('./bin/www.js');

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

*/
