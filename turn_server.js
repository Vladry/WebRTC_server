/*
const Turn = require('node-turn');

const turnServer = new Turn({
    listeningPort: 3478,
    // Попробуйте указать `0.0.0.0` для привязки ко всем интерфейсам
    listeningIps: ['0.0.0.0'],
    realm: 'myrealm',
    authMech: 'long-term',
    credentials: {
        user1: 'password1',
        user2: 'password2',
    },
    debugLevel: 'ALL',
});

turnServer.on('listening', () => {
    console.log('TURN server is running and listening on port 3478');
});

turnServer.on('error', (error) => {
    console.error('TURN server error:', error);
});

turnServer.start();

module.exports = turnServer*/
