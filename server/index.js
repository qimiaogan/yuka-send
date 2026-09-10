/**
 * Yuka Send 信令服务器
 * 只负责：生成房间码、管理房间、转发 SDP/ICE
 * 不转发任何文件数据（P2P 直传）
 */

const { WebSocketServer } = require("ws");
const http = require("http");
const path = require("path");

const PORT = process.env.PORT || 3000;

// 房间状态：{ code: { host: ws, guest: ws, createdAt: timestamp } }
const rooms = new Map();

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const ROOM_TTL_MS = 5 * 60 * 1000;

function generateCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function sendJSON(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(code, obj, exclude) {
  const room = rooms.get(code);
  if (!room) return;
  [room.host, room.guest].forEach(ws => {
    if (ws && ws !== exclude) sendJSON(ws, obj);
  });
}

function cleanupRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.host && room.host.readyState === room.host.OPEN) room.host.close();
  if (room.guest && room.guest.readyState === room.guest.OPEN) room.guest.close();
  rooms.delete(code);
  console.log("[room] " + code + " destroyed");
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.host && room.guest) continue;
    if (now - room.createdAt > ROOM_TTL_MS) cleanupRoom(code);
  }
}, 30 * 1000);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  const filePath = path.join(__dirname, "..", "public", req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);
  const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" };
  try {
    const fs = require("fs");
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    } else { res.writeHead(404); res.end("Not Found"); }
  } catch { res.end(); }
});

const wss = new WebSocketServer({ server });

let connId = 0;
wss.on("connection", (ws) => {
  const thisConnId = ++connId;
  let myCode = null, myRole = null;
  console.log("[conn #" + thisConnId + "] new connection, total clients: " + (wss.clients.size));

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    console.log("[conn #" + thisConnId + "] <<< " + msg.type + (myCode ? (" room=" + myCode) : "") + (msg.code ? (" joinCode=" + msg.code) : "") + (msg.sdp ? (" sdpType=" + msg.sdp.type) : "") + (msg.candidate ? (" iceCandidate") : ""));

    switch (msg.type) {
      case "CREATE": {
        let code, tries = 0;
        do { code = generateCode(); tries++; } while (rooms.has(code) && tries < 10);
        rooms.set(code, { host: ws, guest: null, createdAt: Date.now() });
        myCode = code; myRole = "host";
        sendJSON(ws, { type: "CREATED", code });
        console.log("[room] " + code + " created");
        break;
      }
      case "JOIN": {
        const code = msg.code.toUpperCase();
        const room = rooms.get(code);
        if (!room) { sendJSON(ws, { type: "ERROR", reason: "房间码不存在或已过期" }); return; }
        if (room.host && room.guest) { sendJSON(ws, { type: "ERROR", reason: "房间已满" }); return; }
        room.guest = ws; myCode = code; myRole = "guest";
        sendJSON(ws, { type: "JOINED", code });
        sendJSON(room.host, { type: "PEER_JOINED" });
        console.log("[room] " + code + " guest joined");
        break;
      }
      case "SDP": { if (myCode) broadcast(myCode, { type: "SDP", sdp: msg.sdp }, ws); break; }
      case "ICE": { if (myCode) broadcast(myCode, { type: "ICE", candidate: msg.candidate }, ws); break; }
      case "BYE": { if (myCode) broadcast(myCode, { type: "BYE", from: myRole }, ws); break; }
    }
  });

  ws.on("close", () => {
    if (myCode && rooms.has(myCode)) {
      const room = rooms.get(myCode);
      const other = myRole === "host" ? room.guest : room.host;
      if (other && other.readyState === other.OPEN) sendJSON(other, { type: "PEER_LEFT", role: myRole });
      cleanupRoom(myCode);
    }
  });
  ws.on("error", () => ws.close());
});

server.listen(PORT, () => {
  console.log("Yuka Send signaling server on ws://localhost:" + PORT);
});
