const {parse} = require('cookie');
const HandleUpgradeToWS = require("ws");
const wss = new HandleUpgradeToWS.Server({noServer: true});
const {sessionStore} = require('../app.js');
const handleWebSocketConnection = require('./wsConnection');
const {v4: uuidv4} = require('uuid');


module.exports = (server) => {
    // Обрабатываем запросы upgrade
    server.on('upgrade', (request, socket, head) => {
        handleUpgradeRequest(request, socket, head, wss, sessionStore);
    });
    // WebSocket server is running
};


// Функция обработки upgrade-запросов
function handleUpgradeRequest(request, socket, head, wss, sessionStore) {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
        console.log("sessionId: null");
        sendBadRequest(socket, 'Session ID missing');
        return;
    }



    getSession(sessionId, sessionStore)
        .then(session => {
            // console.log("sessionId: ", sessionId)
            // console.log("Session is ready:", session);
            handleWebSocketConnection(request, socket, head, wss, session);
        })
        .catch(error => {
            console.error("Failed to get session:", error);
        });



    async function getSession(sessionId, sessionStore) {
        // console.log('-> getSession');
        return new Promise((resolve, reject) => {
            sessionStore.get(sessionId, (err, session) => {
                if (err) {
                    console.error("Error retrieving session:", err);
                    return reject(err);
                }
                if (!session) {
                    console.log("No session found, creating a new one");
                    const newSession = createNewSession(sessionId, sessionStore);
                    return resolve(newSession);
                }
                // console.log("Session retrieved!");
                resolve(session);
            });
        });
    }




}


async function createNewSession(sessionId, sessionStore) {
    const newSession = {
        clientId: uuidv4(),
        userName: null,  // Потом вставим сюда полученное с фронта имя пользователя
        lastActivity: Date.now(),
    };

    return new Promise((resolve, reject) => {
        sessionStore.set(sessionId, newSession, (setErr) => {
            if (setErr) {
                console.error('Error saving session:', setErr);
                reject(setErr);
            } else {
                resolve(newSession);
            }
        });
    });
}


// Функция извлечения sessionId из cookies
function getSessionIdFromRequest(request) {
    const cookies = parse(request.headers.cookie || '');
    return cookies['connect.sid']?.split('.')[0]; // Извлекаем sessionId
}
// Функция отправки ошибки 400
function sendBadRequest(socket, message) {
    socket.write(`HTTP/1.1 400 Bad Request\r\n\r\n${message}\r\n`);
    socket.destroy();  // Закрываем сокет
}







