// Подключение к WebSocket-серверу
const websocket = new WebSocket('wss://195.3.129.213:3003'); // Используйте wss для HTTPS
let clientId = null;
let targetId = null;
let wsIsOpen = false;
let doRegisterFlag = false;

let peerConnection = new RTCPeerConnection(configuration);
const remoteVideoEl = document.getElementById('remoteVideo');
const selectClientEl = document.getElementById('selectUser');
const confirmSelectUserEl = document.getElementById('confirmSelectUser');
const events = ['click', 'dblclick'];
const handlSelectClient = () => {
    clientId = selectClientEl.value;
    localStorage.setItem('clientId', selectClientEl.value);
    console.log('handlerSelectClient-> ')
    location.reload(); //перезагрузка стр. нужна для того, чтобы на бэк прилетела свежая сессия из request именно для текущего юзера
    // -- register(clientId) выполнится уже в initialize() при наличии localStorage.getItem('clientId')
}

function setUniqueName(uniqueName){
//когда с сервера прилетает взамен неуникальному cliendId скорректированное уникальное- устанавливаем его на клиенте
    clientId = uniqueName;
    selectClientEl.value = uniqueName;
    localStorage.set('clientId', uniqueName)
    const container = document.querySelector('.container');
    const uniqueNameWarningEl = document.createElement('p')
    uniqueNameWarningEl.textContent = `Ваше уникальное имя в системе: ${uniqueName}`
    container.appendChild(uniqueNameWarningEl);
}

events.forEach(e => confirmSelectUserEl.addEventListener(e, handlSelectClient));


const btnEl = document.getElementById('confirmSelectTarget');
btnEl.addEventListener('click', () => initiate(clientId, targetId));

const selectTargetEl = document.getElementById('selectTarget');
selectTargetEl.addEventListener('input', () => {
    targetId = selectTargetEl.value;
    localStorage.setItem('targetId', selectTargetEl.value);
    btnEl.innerText = `Звоним ${selectTargetEl.value} ?`;
});


function initialize (){
    if (localStorage.getItem('clientId')) {
        clientId = localStorage.getItem('clientId');
        selectClientEl.value = clientId;
        doRegisterFlag = true; //запускает внутри ws.onopen функцию регистрации клиента
    }

    if (localStorage.getItem('targetId')) {
        targetId = localStorage.getItem('targetId');
        selectTargetEl.value = localStorage.getItem('targetId');
        btnEl.innerText = `Звоним ${targetId} ?`;
    }
}

initialize();



websocket.onopen = () => {
    wsIsOpen = true;
    console.log('WebSocket connected');
    //  тут выполняем любой код, который хотим выполнить при загрузке страницы
    if (doRegisterFlag) {
        register(clientId);
        doRegisterFlag = false;
    }
};

function sendRegistration() {
    // Регистрация клиента на сервере
    websocket.send(JSON.stringify({
        type: 'register',
        userName: clientId,
    }));
    console.log(`ws.send registration: clientId = ${clientId}`);
}

function register(clientId) {
    console.log("register->   ", clientId);
    if (clientId === "false" || clientId === null || clientId === undefined) {
        return;
    }

    sendRegistration();
    peersHandler();
}



const initiate = (clientId, targetId) => {
    // После регистрации можно инициализировать вызов (по UI или заранее определённому targetId)
    websocket.send(JSON.stringify({
        type: 'initiate',
        targetId: targetId, // Запрос на установление соединения с targetId
        fromId: clientId,
    }));
    console.log(`Initiate->  ${clientId} is calling ${targetId}`);
}




websocket.onmessage = async (message) => {
    const data = JSON.parse(message.data);

    switch (data.type) {

        case 'initiate':
            // if (data.from === targetId) {
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
            // }
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

        case 'errSuchUserLoggedIn':
            console.log(data.error);
            setUniqueName(data.uniqueName);
            break;

        case "notification":
            console.log(data.msg)
            break;


        default:
            console.error('Unknown message type: ', data.type);
    }
};


function peersHandler (){
// Создание RTCPeerConnection

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


    handlerLocalCamera();
}


remoteVideoEl.onLoadeddata = () => {
    // запустить после добавления потока (т.к. автоплей не срабатывал на Андроиде, а на айфоне срабатывал)
    remoteVideoEl.play().catch(error => {
        console.error('Ошибка автозапуска видео после добавления трека:', error);
    });
}



function handlerLocalCamera (){ // Захват видео с локальной камеры
    console.log("handleLocalCamera-> ")
    navigator.mediaDevices.getUserMedia({video: true, audio: {echoCancellation: true,}}).then((stream) => {
        const localVideoEl = document.getElementById('localVideo');
        localVideoEl.srcObject = stream;
        stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, stream);
        });
        console.log('Local stream added to PeerConnection:  ', stream);
    }).catch((error) => {
        console.error('Error accessing media devices:', error);
    })
}
