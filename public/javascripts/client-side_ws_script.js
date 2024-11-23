const express = require('express');
const WebSocket = require('ws');

const app = express();
const port = 3003;

// Создаем WebSocket сервер поверх HTTP сервера
const server = app.listen(port, () => {
    console.log(`Server is running on http://195.3.129.213:${port}`);
});

const wss = new WebSocket.Server({ server });

let clients = {}; // Храним активные WebSocket соединения

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