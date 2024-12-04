clientId = 'client1';

const ws = new WebSocket('wss://195.3.129.213:3003');

ws.onopen(()=>{
    console.log("websocket connected");
    ws.send(JSON.stringify({type: 'register', payload: clientId}));

});