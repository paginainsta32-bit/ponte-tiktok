const WebSocket = require('ws');

const TIKTOK_USERNAME = process.env.TIKTOK_USER || 'respirando.a.f';
const API_KEY = (process.env.SIGN_API_KEY || '').trim();
const PORT = process.env.PORT || 8080;

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

function connectEulerStream() {
  if (!API_KEY) {
    console.log('❌ ERRO: SIGN_API_KEY não configurada no Render!');
    return;
  }

  const url = `wss://ws.eulerstream.com?uniqueId=${encodeURIComponent(TIKTOK_USERNAME)}&apiKey=${encodeURIComponent(API_KEY)}`;
  console.log(`🔌 Conectando ao EulerStream para @${TIKTOK_USERNAME}...`);

  const eulerWs = new WebSocket(url);

  eulerWs.on('open', () => {
    console.log(`✅ CONECTADO AO EULERSTREAM PARA @${TIKTOK_USERNAME}!`);
  });

  eulerWs.on('message', (raw) => {
    try {
      const packet = JSON.parse(raw.toString());
      const messages = packet.messages || [packet];

      messages.forEach((msg) => {
        const type = msg.type || msg.event || '';
        const data = msg.data || msg;

        if (type.includes('Chat') || type === 'chat') {
          const user = data.user || data;
          const cleanData = {
            nickname: user.nickname || user.uniqueId || 'Aluno',
            uniqueId: user.uniqueId || 'user',
            profilePictureUrl: user.profilePictureUrl || '',
            comment: data.comment || ''
          };
          console.log(`💬 CHAT [${cleanData.nickname}]: ${cleanData.comment}`);
          broadcast({ event: 'chat', data: cleanData });
        }

        if (type.includes('Gift') || type === 'gift') {
          const user = data.user || data;
          const cleanData = {
            nickname: user.nickname || user.uniqueId || 'Aluno',
            profilePictureUrl: user.profilePictureUrl || ''
          };
          console.log(`🎁 PRESENTE de ${cleanData.nickname}`);
          broadcast({ event: 'gift', data: cleanData });
        }
      });
    } catch (e) {
      console.log('⚠️ Pacote recebido:', raw.toString().substring(0, 120));
    }
  });

  eulerWs.on('close', (code, reason) => {
    console.log(`⏳ EulerStream fechado (${code} ${reason || ''}). Reconectando em 10s...`);
    setTimeout(connectEulerStream, 10000);
  });

  eulerWs.on('error', (err) => {
    console.log('❌ Erro EulerStream:', err.message);
  });
}

connectEulerStream();
