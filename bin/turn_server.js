module.exports = ()=>
{

    const Turn = require('node-turn'); // Этот TURN сервер не используется (юзаю внешний), тут код -для примера
    const turnServer = new Turn({
        Port: 3478,
        listeningIps: ['192.168.88.242'],
        externalIps: ['195.3.129.213'],  // к сожалению, так не работает и клиенты не могут "извне" достучаться до этого IP, использую внешний TURN- сервер
        allocationLifetime: 600, // Lifetime in seconds
        realm: 'myrealm',
        authMech: 'long-term',
        credentials: {
            user1: 'password1',
            user2: 'password2',
        },
        debugLevel: 'ALL',

        ltCredMech: true,
        fingerprint: true,
        minPort: 49152,
        maxPort: 65535,
    });

    turnServer.start();
}