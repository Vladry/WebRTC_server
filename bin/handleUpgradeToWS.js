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

    function cbSessionStore(err, session) {
        let newSession = null;
        if (err) {
            // sendBadRequest(socket, 'Invalid session'); // это на случай, если при отсутствии сессии мы посылаем фронт нафиг
            console.log("cbSessionStore-> err retrieving session from sessionStore")
            return null;
        }
        console.log("Session from cbSessionStore:", session);
        newSession = createNewSession(sessionId, sessionStore); //если не найдена сессия, то создаём ее без логина, для любого юзера
        console.log("there was no session in sessionStore-> created session: ", newSession)
        return newSession;
    }

    // Получаем сессию по sessionId
    const session = getSessionById(sessionId, sessionStore, cbSessionStore);


    function getSessionById(sessionId, sessionStore, cb) {
        let _session;
        console.log('-> getSessionById');
        sessionStore.get(sessionId, (err, session) => {
            if (err) {
                console.log('Error retrieving session:', err);
                _session = cb(err, null); // Возвращаем ошибку через коллбэк
                return _session;
            } else if (!session) {
                console.log('retrieved an EMPTY session:', session);
                _session = (cb(null, null)); // Задаем в колбэк пустое, а получаем - новую сессию
                return _session;
            }
            console.log('Session retrieved:', session);
            _session = (cb(null, session)); // Возвращаем найденную сессию через коллбэк
            return _session;

        });
        return _session;
    }


    handleWebSocketConnection(request, socket, head, wss, session);

}


function createNewSession(sessionId, sessionStore) {
    const newSession = {
        clientId: uuidv4(),
        lastUserName: null,  // потом вставим сюда полученный с фронта имя пользователя
        lastActivity: Date.now(),
    }
    sessionStore.set(sessionId, newSession, (setErr) => {
        if (setErr) {
            console.error('Error saving session:', err);
            return undefined;
        }
    });
    return newSession;
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







