// Подключение к WebSocket-серверу
const websocket = new WebSocket('wss://195.3.129.213:3003'); // Используйте wss для HTTPS


websocket.onopen = () => {
    // console.log('WebSocket connected');

    // Регистрация клиента на сервере
    websocket.send(JSON.stringify({
        type: 'register',
        clientId: clientId,
    }));
    console.log(`Sent registration: clientId = ${clientId}`);

    // После регистрации можно инициализировать вызов (по UI или заранее определённому targetId)
    websocket.send(JSON.stringify({
        type: 'initiate',
        targetId: targetId, // Запрос на установление соединения с targetId
        from: clientId,
    }));
    console.log(`Initiated call with targetId = ${targetId}`);
};


websocket.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    console.log('WebSocket message received: ', data);

    switch (data.type) {
        case 'initiate':
            if (data.from === targetId) {
                console.log('Call initiated by: ', data.from);

                // Создаем предложение (offer)
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                console.log('Sending offer to target: ', targetId);
                websocket.send(JSON.stringify({
                    type: 'offer',
                    targetId: data.from,
                    sdp: peerConnection.localDescription,
                }));
            }
            break;

        case 'offer':
            console.log('Offer received: ', data.sdp);

            // Устанавливаем удаленное описание и создаем ответ (answer)
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            console.log('Sending answer to: ', data.from);
            websocket.send(JSON.stringify({
                type: 'answer',
                targetId: data.from,
                sdp: peerConnection.localDescription,
            }));
            break;

        case 'answer':
            console.log('Answer received: ', data.sdp);

            // Устанавливаем удаленное описание
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            break;

        case 'candidate':
            console.log('Candidate received: ', data.candidate);

            // Добавляем ICE-кандидата
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            break;

        default:
            console.error('Unknown message type: ', data.type);
    }
};




// Создание RTCPeerConnection
const peerConnection = new RTCPeerConnection(configuration);
console.log("peerConnection: ", peerConnection);
peerConnection.oniceconnectionstatechange = () => {  // Логгирование ICE-событий
    console.log('ICE connection state: ', peerConnection.iceConnectionState);
};


peerConnection.onicecandidate = (event) => {  // Отправка кандидатов
    if (event.candidate) {
        console.log('Sending candidate: ', event.candidate);
        websocket.send(JSON.stringify({
            type: 'candidate',
            candidate: event.candidate,
            targetId: targetId, // Отправляем ICE-кандидата конкретному клиенту
        }));
        console.log('ICE candidate sent');
    }
};

peerConnection.ontrack = (event) => {
    const remoteVideoEl = document.getElementById('remoteVideo');
    remoteVideoEl.srcObject = event.streams[0];
    console.log('Remote video stream set:', event.streams[0]);
    remoteVideoEl.play().catch(error => { // запустить после добавления потока (т.к. автоплей не срабатывал на Андроиде, а на айфоне срабатывал)
        console.error('Ошибка автозапуска видео после добавления трека:', error);
    });
};

// Захват видео с локальной камеры
// navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
navigator.mediaDevices.getUserMedia({ video: true, audio: {echoCancellation: true,} }).then((stream) => {
    const localVideoEl = document.getElementById('localVideo');
    localVideoEl.srcObject = stream;
    stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
    });
     console.log('Local stream added to PeerConnection');
}).catch((error) => {
    console.error('Error accessing media devices:', error);
});
