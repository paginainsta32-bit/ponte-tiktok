const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');

const TIKTOK_USERNAME = process.env.TIKTOK_USER || 'respirando.a.f';
const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });
let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => { clients = clients.filter((c) => c !== ws); });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 20000);

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

const connectionOptions = {};
if (process.env.SIGN_API_KEY) {
  connectionOptions.signApiKey = process.env.SIGN_API_KEY;
}

let tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME, connectionOptions);

function connectToTikTok() {
  tiktokConnection.connect().then((state) => {
    console.log(`✅ CONECTADO À LIVE DE ${TIKTOK_USERNAME} (Room ID: ${state.roomId})`);
  }).catch((err) => {
    console.log('❌ Motivo do erro:', err.message || err);
    setTimeout(connectToTikTok, 15000);
  });
}

tiktokConnection.on('chat', (data) => {
  const cleanData = {
    nickname: data.nickname || (data.user && data.user.nickname) || data.uniqueId || 'Aluno',
    uniqueId: data.uniqueId || (data.user && data.user.uniqueId) || 'user',
    profilePictureUrl: data.profilePictureUrl || (data.user && data.user.profilePictureUrl) || '',
    comment: data.comment || ''
  };
  console.log(`💬 [${cleanData.nickname}]: ${cleanData.comment}`);
  broadcast({ event: 'chat', data: cleanData });
});

tiktokConnection.on('gift', (data) => {
  const cleanData = {
    nickname: data.nickname || (data.user && data.user.nickname) || data.uniqueId || 'Aluno',
    profilePictureUrl: data.profilePictureUrl || (data.user && data.user.profilePictureUrl) || ''
  };
  broadcast({ event: 'gift', data: cleanData });
});

tiktokConnection.on('disconnected', () => {
  setTimeout(connectToTikTok, 10000);
});

connectToTikTok();
