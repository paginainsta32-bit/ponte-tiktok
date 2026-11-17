const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');

const TIKTOK_USERNAME = process.env.TIKTOK_USER || 'respirando.a.f';
const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });
let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter((c) => c !== ws);
  });
});

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function connectToTikTok() {
  const tiktok = new WebcastPushConnection(TIKTOK_USERNAME);

  tiktok.connect()
    .then((state) => console.log(`Conectado à live de @${TIKTOK_USERNAME} (Sala: ${state.roomId})`))
    .catch((err) => {
      console.log('Live offline ou erro, tentando novamente em 15s...');
      setTimeout(connectToTikTok, 15000);
    });

  tiktok.on('chat', (data) => broadcast({ event: 'chat', data }));
  tiktok.on('like', (data) => broadcast({ event: 'like', data }));
  tiktok.on('gift', (data) => {
    if (data.giftType === 1 && !data.repeatEnd) return;
    broadcast({ event: 'gift', data });
  });
  tiktok.on('disconnected', () => setTimeout(connectToTikTok, 10000));
}

connectToTikTok();
console.log(`Servidor WebSocket rodando na porta ${PORT}`);
