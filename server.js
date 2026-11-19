const WebSocket = require('ws');

const TIKTOK_USERNAME = process.env.TIKTOK_USER || 'respirando.a.f';
const API_KEY = (process.env.SIGN_API_KEY || '').trim();
const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });
let clients = [];
let eulerWs = null;
let isEulerConnected = false;

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.isAlive = true;
  console.log('📱 Jogo conectado! Telas abertas:', clients.length);

  // Envia imediatamente o status atual para o jogo
  ws.send(JSON.stringify({ event: 'status', connected: isEulerConnected }));

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (msg) => {
    // Responde qualquer ping vindo do navegador do iPhone
    if (msg.toString() === 'ping') {
      ws.send(JSON.stringify({ event: 'pong', t: Date.now() }));
    }
  });
  ws.on('close', () => {
    clients = clients.filter((c) => c !== ws);
  });
});

// Heartbeat JSON a cada 8 segundos: impede o Render e o Safari do iPhone de derrubarem a conexão por inatividade!
setInterval(() => {
  const pulse = JSON.stringify({ event: 'heartbeat', live: isEulerConnected, t: Date.now() });
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(pulse);
    }
  });

  // Mantém a conexão com o EulerStream também acordada
  if (eulerWs && eulerWs.readyState === WebSocket.OPEN) {
    eulerWs.ping();
  }
}, 8000);

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

  eulerWs = new WebSocket(url);

  eulerWs.on('open', () => {
    isEulerConnected = true;
    console.log(`✅ CONECTADO AO EULERSTREAM PARA @${TIKTOK_USERNAME}!`);
    broadcast({ event: 'status', connected: true });
  });

  eulerWs.on('message', (raw) => {
    try {
      const packet = JSON.parse(raw.toString());
      const messages = packet.messages || [packet];

      messages.forEach((msg) => {
        const type = msg.type || msg.event || '';
        const data = msg.data || msg;
        const user = data.user || data;

        if (type.includes('Chat') || type === 'chat') {
          const cleanData = {
            nickname: user.nickname || user.uniqueId || 'Seguidor',
            uniqueId: user.uniqueId || 'user',
            profilePictureUrl: user.profilePictureUrl || '',
            comment: data.comment || ''
          };
          console.log(`💬 CHAT [${cleanData.nickname}]: ${cleanData.comment}`);
          broadcast({ event: 'chat', data: cleanData });
        }

        if (type.includes('Like') || type === 'like') {
          const cleanData = {
            nickname: user.nickname || user.uniqueId || 'Seguidor',
            uniqueId: user.uniqueId || 'user',
            profilePictureUrl: user.profilePictureUrl || '',
            likeCount: data.likeCount || data.count || 1
          };
          broadcast({ event: 'like', data: cleanData });
        }

        if (type.includes('Gift') || type === 'gift') {
          const cleanData = {
            nickname: user.nickname || user.uniqueId || 'Seguidor',
            uniqueId: user.uniqueId || 'user',
            profilePictureUrl: user.profilePictureUrl || '',
            giftName: (data.giftDetails && data.giftDetails.giftName) || data.giftName || 'Presente',
            diamondCount: (data.giftDetails && data.giftDetails.diamondCount) || data.diamondCount || 1,
            repeatCount: data.repeatCount || 1
          };
          console.log(`🎁 PRESENTE de ${cleanData.nickname}: ${cleanData.giftName}`);
          broadcast({ event: 'gift', data: cleanData });
        }
      });
    } catch (e) {}
  });

  eulerWs.on('close', (code, reason) => {
    isEulerConnected = false;
    broadcast({ event: 'status', connected: false });
    console.log(`⏳ EulerStream fechado (${code} ${reason || ''}). Reconectando em 4s...`);
    setTimeout(connectEulerStream, 4000);
  });

  eulerWs.on('error', (err) => {
    console.log('❌ Erro EulerStream:', err.message);
  });
}

connectEulerStream();
