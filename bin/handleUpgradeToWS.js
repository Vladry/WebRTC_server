import attachWebSocketHandlers, {handleWebSocketConnection} from './wsConnection.js';
import {v4 as uuidv4} from 'uuid';
let sessionStore = null;
let upgradeHandlerAttached = false;
let websocketHandlersAlreadyAttached = false;
export default (server) => {
    // Обрабатываем запросы upgrade

    if (!upgradeHandlerAttached) {
        server.on('upgrade', (request, socket, head) => {
            handleUpgradeRequest(request, socket, head);
        });
        upgradeHandlerAttached = true;
    }
    // WebSocket server is running
};


// Функция обработки upgrade-запросов
function handleUpgradeRequest(request, socket, head) {
    console.log("handleUpgradeRequest->")


    getSession(request, socket)
        .then(session => {
            // console.log("sessionId: ", sessionId)
            console.log("Тут получаем сессию только для будущей авторизации, пока что всех пропускаем в систему.", session);
            console.log("'эту сессию никуда не передаём")
            if (!websocketHandlersAlreadyAttached) {
                attachWebSocketHandlers(request, socket, head); //вызвать единожды для регистрации хэндлеров в WS_Сервере
                websocketHandlersAlreadyAttached = true;
            }
            handleWebSocketConnection(request, socket, head); // вызывать при каждой перезагрузке с фронта
        })
        .catch(error => {
            console.error("Failed to get session:", error);
        });
}


export async function getSession (request, socket) {
    if (!sessionStore) {
        const {sessionStoreInst} = await import ('../app.js');
        sessionStore = sessionStoreInst;
    }
    const sessionId = await getSessionIdFromRequest(request);
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
        console.log("creating session in   createNewSession->")
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
   async function getSessionIdFromRequest(request) {
        const {parse} = await import ('cookie');
        const cookies = parse(request.headers.cookie || '');
       return cookies['connect.sid']?.split('.')[0]; // Извлекаем sessionId
    }
// Функция отправки ошибки 400
    function sendBadRequest(socket, message) {
        socket.write(`HTTP/1.1 400 Bad Request\r\n\r\n${message}\r\n`);
        socket.destroy();  // Закрываем сокет
    }
}


