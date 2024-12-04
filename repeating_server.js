const server  = require ('./bin/www.js');
const WebSocket = require ('ws');

const wss = WebSocket.Server({server});

const clients = new Map();
wss.on('connect', (ws)=> {
   ws.clientId = null;
   ws.on('message', (data)=>{
      switch (data.type){
         case "register":
            ws.clientId = JSON.parse(data.payload);
            clients.set("id", data.payload);


      }
   });

});
