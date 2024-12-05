// Подключение к WebSocket-серверу
const websocket = new WebSocket('wss://195.3.129.213:3003'); // Используйте wss для HTTPS
let clientId = null;
let targetId = null;
const remoteVideoEl = document.getElementById('remoteVideo');
const selectUserEl = document.getElementById('selectUser');
selectUserEl.addEventListener('change', () => {
    selectUserEl.disabled = true;
    clientId = selectUserEl.value;
    register(clientId);
});
const selectTargetEl = document.getElementById('selectTarget');
selectTargetEl.addEventListener('change', () => {
    targetId = selectTargetEl.value;
    btnEl.value = `Звоним ${selectTargetEl.value} ?`;
});
const btnEl = document.getElementById('btn');
btnEl.addEventListener('click', () => initiate(clientId, targetId));
let peerConnection = null;

websocket.onopen = () => {
    // console.log('WebSocket connected');
    //  тут выполняем любой код, который хотим выполнить при загрузке страницы
};

const register = (clientId) => {
    console.log("register->");
    if (clientId === "false") {
        return;
    } else
    // Регистрация клиента на сервере
    websocket.send(JSON.stringify({
        type: 'register',
        clientId: clientId,
    }));
    console.log(`Sent registration: clientId = ${clientId}`);

    peersHandler();
    handlerLocalCamera();
};

const initiate = (clientId, targetId) => {
    console.log("initiate->");
    // После регистрации можно инициализировать вызов (по UI или заранее определённому targetId)
    websocket.send(JSON.stringify({
        type: 'initiate',
        targetId: targetId, // Запрос на установление соединения с targetId
        fromId: clientId,
    }));
    console.log(`Initiate:  ${clientId} is calling ${targetId}`);
}


websocket.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    // console.log('WebSocket message received: ', data);

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

        case 'checkAlive':
            // ответ серверу на запрос на проверку жив ли я(клиент)
            websocket.send(JSON.stringify({
                type: 'imAlive',
            }));
            console.log(`Sending \"imAlive\" to server`);
            break;

        default:
            console.error('Unknown message type: ', data.type);
    }
};


const peersHandler = () => {
// Создание RTCPeerConnection
    peerConnection = new RTCPeerConnection(configuration);
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
        remoteVideoEl.srcObject = event.streams[0];
        console.log('Remote video stream set:', event.streams[0]);
    };
}


remoteVideoEl.onLoadeddata = () => {
    // запустить после добавления потока (т.к. автоплей не срабатывал на Андроиде, а на айфоне срабатывал)
    remoteVideoEl.play().catch(error => {
        console.error('Ошибка автозапуска видео после добавления трека:', error);
    });
}

const handlerLocalCamera = () => { // Захват видео с локальной камеры
    navigator.mediaDevices.getUserMedia({video: true, audio: {echoCancellation: true,}}).then((stream) => {
        const localVideoEl = document.getElementById('localVideo');
        localVideoEl.srcObject = stream;
        stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, stream);
        });
        console.log('Local stream added to PeerConnection');
    }).catch((error) => {
        console.error('Error accessing media devices:', error);
    });
}