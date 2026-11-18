const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');

const TIKTOK_USERNAME = process.env.TIKTOK_USER || 'respirando.a.f';
const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });
let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    clients = clients.filter((c) => c !== ws);
  });
});

// Mantém a conexão ativa no Render a cada 20 segundos (evita ficar caindo!)
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
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

let tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME);

function connectToTikTok() {
  tiktokConnection.connect().then((state) => {
    console.log(`Conectado à live de ${TIKTOK_USERNAME} (Room ID: ${state.roomId})`);
  }).catch((err) => {
    console.log('Aguardando live abrir... tentando novamente em 15s');
    setTimeout(connectToTikTok, 15000);
  });
}

tiktokConnection.on('chat', (data) => {
  broadcast({ event: 'chat', data });
});

tiktokConnection.on('like', (data) => {
  broadcast({ event: 'like', data });
});

tiktokConnection.on('gift', (data) => {
  broadcast({ event: 'gift', data });
});

tiktokConnection.on('disconnected', () => {
  console.log('Live desconectada. Reconectando em 10s...');
  setTimeout(connectToTikTok, 10000);
});

connectToTikTok();
