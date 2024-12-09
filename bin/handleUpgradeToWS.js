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
    // console.log('WebSocket server is running.');
};


// Функция обработки upgrade-запросов
function handleUpgradeRequest(request, socket, head, wss, sessionStore) {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
        console.log("sessionId: null");
        sendBadRequest(socket, 'Session ID missing');
        return;
    }


    // Получаем сессию по sessionId
    // const session = getSessionById(sessionId, sessionStore);

    const session = getSessionAsync(sessionId, sessionStore);


    async function getSessionById(sessionId, sessionStore) {
        console.log('-> getSessionById');
        return new Promise((resolve, reject) => {
            sessionStore.get(sessionId, async (err, session) => {
                if (err) {
                    reject(null);
                } else if (!session) {
                    try {
                        session = await createNewSession(sessionId, sessionStore);
                        resolve(session);
                    } catch (creationError) {
                        reject(creationError);
                    }
                } else {
                    resolve(session);
                }
            });
        });
    }

    async function getSessionAsync(sessionId, sessionStore) {
        try {
            const session = await getSessionById(sessionId, sessionStore);
            return session;
        } catch (e) {
            console.log('error in getSessionAsync: ', e);
            return null; // Возвращаем null или обрабатываем ошибку
        }
    }


    if (session) {
        handleWebSocketConnection(request, socket, head, wss, session);
    }

}


async function createNewSession(sessionId, sessionStore) {
    const newSession = {
        clientId: uuidv4(),
        lastUserName: null,  // Потом вставим сюда полученное с фронта имя пользователя
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







