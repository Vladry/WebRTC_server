const Turn = require('node-turn');
// const turnServer = require('../turn_server');

const turnServer = new Turn({
    listeningPort: 3478,
    // IP вашего сервера
    // listeningIps: ['195.3.129.213'],
    // listeningIps: ['0.0.0.0'],
    listeningIps: ['192.168.88.242'],

    // Пользователи и их учетные данные
    authMech: 'long-term',
    credentials: {
        user1: 'password1',
        user2: 'password2',
    },

// Включение логирования
    debugLevel: 'ALL',
});


turnServer.start();
console.log('TURN server is running');

module.exports = turnServer