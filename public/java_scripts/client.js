// Подключение к WebSocket-серверу
const websocket = new WebSocket('wss://195.3.129.213:3003'); // Используйте wss для HTTPS
let clientId = null;
let targetIdGlobal = null;
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
    localStorage.setItem('clientId', uniqueName)
}

events.forEach(e => confirmSelectUserEl.addEventListener(e, handlSelectClient));

function initialize (){
    if (localStorage.getItem('clientId')) {
        clientId = localStorage.getItem('clientId');
        selectClientEl.value = clientId;
        doRegisterFlag = true; //FIXME -разобраться с применением этого флага.   Его задача - запускает внутри ws.onopen функцию регистрации клиента
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


const initiate = (clientId, newTargetId) => {
    // После регистрации можно инициализировать вызов (по UI или заранее определённому targetId)
    targetIdGlobal = newTargetId;
    console.log(`Initiate->  ${clientId} is calling ${newTargetId}`);
    websocket.send(JSON.stringify({
        type: 'initiate',
        targetId: newTargetId, // Запрос на установление соединения с targetId
    }));
}




websocket.onmessage = async (message) => {
    const data = JSON.parse(message.data);


    switch (data.type) {

        case 'registered':
            console.log(data.msg);
            setUniqueName(data.uniqueName);
            break;

        case 'initiated':
            // if (data.from === targetId) {
                console.log('Call initiated by: ', data.from);
                targetIdGlobal = data.targetId;
                // Создаем предложение (offer)
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                console.log('Sending offer to: ', data.from);
                websocket.send(JSON.stringify({
                    type: 'offer',
                    targetId: data.from,
                    sdp: peerConnection.localDescription,
                }));
            // }
            break;

        case 'offer':
            console.log('Offer received: ', data.sdp);
            console.log(data.sdp)
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


        case "notification":
            console.log(data.msg)
            break;

        case 'error':
            console.log(data.message)
            break;

        case 'updateUsers':
            console.log(`updatedUserList: ${data.payload}`)
            updateUsers(data.payload);
            break;

        default:
            console.error('Unknown message type: ', data.type);
    }


    function updateUsers(userListNames) {
        const userList = document.querySelector(".users-list")
        userList.addEventListener('click', (e) => {
            callHandler(e)
        });
        const userListElements = userListNames.flatMap((userName) => {
            if (userName !== clientId) {
                const liEl = document.createElement("li")
                liEl.className = 'user-list-item'
                liEl.textContent = userName;
                return liEl;
            }
            return [] // если нашёл собственное имя - вернуть  пустой массив, который исключится из выдачи методом flat(), flatMap()
        })
        userList.innerHTML = '';
        userList.append(...userListElements) // так добавляем несколько <li> в <ul.user-list>
    }


    function callHandler(e) {
        console.log('in callHandler(e)');
        const target = e.target;
        console.log('target.tagName: ', target.tagName);
        if(target.tagName.trim().toUpperCase() === 'LI'){
            console.log(`calling initiate(${clientId}, ${target.textContent})`);
            targetIdGlobal = target.textContent;
            initiate(clientId, target.textContent);
        }
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
            console.log('Проблемное место:  ICE candidate sening to ', targetIdGlobal);
            console.log('Sending candidate: ', event.candidate);
            websocket.send(JSON.stringify({
                type: 'candidate',
                candidate: event.candidate,
                targetId: targetIdGlobal, // Отправляем ICE-кандидата конкретному клиенту //FIXME сюда в targetId приходит "Mary" почему-то
            }));
            console.log('Проблемное место:  ICE candidate sent to ', targetIdGlobal);
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
