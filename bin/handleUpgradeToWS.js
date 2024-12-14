let sessionStore;
let parse;


const handleWebSocketConnection = require('./wsConnection');
const {v4: uuidv4} = require('uuid');


module.exports = (server) => {
    // Обрабатываем запросы upgrade
    server.on('upgrade', (request, socket, head) => {
        handleUpgradeRequest(request, socket, head);
    });
    // WebSocket server is running
};


// Функция обработки upgrade-запросов
function handleUpgradeRequest(request, socket, head) {
    console.log("handleUpgradeRequest->")


    getSession(request, socket)
        .then(session => {
            // console.log("sessionId: ", sessionId)
            console.log("Session is ready:", session);
            handleWebSocketConnection(request, socket, head, session);
        })
        .catch(error => {
            console.error("Failed to get session:", error);
        });
}


async function getSession(request, socket) {
    if (!sessionStore) {
        sessionStore = require('../app.js');
    }

    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
        console.log("sessionId: null");
        sendBadRequest(socket, 'Session ID missing');
        return;
    }


    console.log('-> getSession');
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


    async function createNewSession(sessionId, sessionStore) {
        const newSession = {
            clientId: uuidv4(),
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
        if(!parse){
            parse = require('cookie');
        }
        const cookies = parse(request.headers.cookie || '');
        return cookies['connect.sid']?.split('.')[0]; // Извлекаем sessionId
    }
// Функция отправки ошибки 400
    function sendBadRequest(socket, message) {
        socket.write(`HTTP/1.1 400 Bad Request\r\n\r\n${message}\r\n`);
        socket.destroy();  // Закрываем сокет
    }
}

module.exports = getSession;

