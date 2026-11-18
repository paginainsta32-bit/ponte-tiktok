const tiktokConnector = require('tiktok-live-connector');
const { WebcastPushConnection } = tiktokConnector;
const WebSocket = require('ws');

const TIKTOK_USERNAME = process.env.TIKTOK_USER || 'respirando.a.f';
const API_KEY = process.env.SIGN_API_KEY || process.env.TIKTOK_SIGN_API_KEY || '';
const PORT = process.env.PORT || 8080;

if (API_KEY) {
  process.env.TIKTOK_SIGN_API_KEY = API_KEY;
  if (tiktokConnector.SignConfig) {
    tiktokConnector.SignConfig.apiKey = API_KEY;
  }
}

const wss = new WebSocket.Server({ port: PORT });
let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.isAlive = true;
  console.log('📱 Jogo conectado! Telas abertas:', clients.length);

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

let isConnecting = false;
let isConnected = false;

function connectToTikTok() {
  if (isConnecting || isConnected) return;
  isConnecting = true;

  const options = {
    processInitialData: false,
    enableExtendedGiftInfo: true
  };
  if (API_KEY) {
    options.signApiKey = API_KEY;
  }

  // Cria uma instância NOVA a cada tentativa para nunca travar após erro
  const tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME, options);

  tiktokConnection.on('chat', (data) => {
    const cleanData = {
      nickname: data.nickname || (data.user && data.user.nickname) || data.uniqueId || 'Aluno',
      uniqueId: data.uniqueId || (data.user && data.user.uniqueId) || 'user',
      profilePictureUrl: data.profilePictureUrl || (data.user && data.user.profilePictureUrl) || '',
      comment: data.comment || ''
    };
    console.log(`💬 CHAT [${cleanData.nickname}]: ${cleanData.comment}`);
    broadcast({ event: 'chat', data: cleanData });
  });

  tiktokConnection.on('gift', (data) => {
    const cleanData = {
      nickname: data.nickname || (data.user && data.user.nickname) || data.uniqueId || 'Aluno',
      profilePictureUrl: data.profilePictureUrl || (data.user && data.user.profilePictureUrl) || ''
    };
    console.log(`🎁 PRESENTE de ${cleanData.nickname}`);
    broadcast({ event: 'gift', data: cleanData });
  });

  tiktokConnection.on('disconnected', () => {
    console.log('⚠️ Desconectado da live. Tentando novamente em 10s...');
    isConnected = false;
    setTimeout(connectToTikTok, 10000);
  });

  tiktokConnection.on('error', (err) => {
    console.log('⚠️ Erro na conexão:', err.message || err);
  });

  tiktokConnection.connect()
    .then((state) => {
      isConnecting = false;
      isConnected = true;
      console.log(`✅ CONECTADO COM SUCESSO NA LIVE DE @${TIKTOK_USERNAME} (Sala: ${state.roomId})`);
    })
    .catch((err) => {
      isConnecting = false;
      isConnected = false;
      console.log(`⏳ Aguardando @${TIKTOK_USERNAME} entrar ao vivo... (${err.message || 'offline'})`);
      setTimeout(connectToTikTok, 12000);
    });
}

connectToTikTok();
