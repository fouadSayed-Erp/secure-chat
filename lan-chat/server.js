const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const express = require("express");
const { Server } = require("socket.io");

const PORT = Number(process.env.LAN_PORT || 3100);
const HOST = process.env.HOST || "0.0.0.0";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const users = new Map(); // username -> { passwordSalt, passwordHash }
const sessions = new Map(); // token -> { username, expiresAt }
const sockets = new Map(); // socket.id -> username

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { passwordSalt: salt, passwordHash };
}
function safeEqualHex(left, right) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function validateCredentials(username, password) {
  return typeof username === "string" && /^[\p{L}\p{N}_-]{3,32}$/u.test(username.trim()) && typeof password === "string" && password.length >= 8;
}
function issueSession(username) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}
function usernameForToken(token) {
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return session.username;
}
function publicUsers() {
  return [...new Set(sockets.values())].sort().map((username) => ({ username }));
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, transport: "socket.io", lan: true }));

app.post("/api/register", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!validateCredentials(username, password)) return res.status(400).json({ error: "اسم المستخدم 3-32 حرفاً وكلمة المرور 8 أحرف على الأقل." });
  if (users.has(username)) return res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل على هذا الخادم." });
  users.set(username, hashPassword(password));
  return res.json({ token: issueSession(username), username });
});
app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const account = users.get(username);
  if (!account || !validateCredentials(username, password) || !safeEqualHex(hashPassword(password, account.passwordSalt).passwordHash, account.passwordHash)) return res.status(401).json({ error: "بيانات الدخول غير صحيحة." });
  return res.json({ token: issueSession(username), username });
});
app.post("/api/logout", (req, res) => { sessions.delete(String(req.body?.token || "")); res.status(204).end(); });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, maxHttpBufferSize: 15 * 1024 * 1024 });

io.use((socket, next) => {
  const username = usernameForToken(socket.handshake.auth?.token);
  if (!username) return next(new Error("AUTH_REQUIRED"));
  socket.data.username = username;
  next();
});
io.on("connection", (socket) => {
  const username = socket.data.username;
  sockets.set(socket.id, username);
  socket.join("lan");
  socket.emit("session:ready", { username, users: publicUsers() });
  socket.broadcast.to("lan").emit("presence:joined", { username });
  io.to("lan").emit("presence:list", publicUsers());

  socket.on("presence:request", () => socket.emit("presence:list", publicUsers()));
  socket.on("message:encrypted", (packet, ack) => {
    if (!packet || typeof packet.to !== "string" || typeof packet.iv !== "string" || typeof packet.ciphertext !== "string") return ack?.({ ok: false, error: "INVALID_PACKET" });
    const recipient = [...sockets.entries()].find(([, name]) => name === packet.to);
    if (!recipient) return ack?.({ ok: false, error: "USER_OFFLINE" });
    io.to(recipient[0]).emit("message:encrypted", { ...packet, from: username });
    ack?.({ ok: true });
  });
  socket.on("webrtc:signal", (packet, ack) => {
    if (!packet || typeof packet.to !== "string" || !packet.data) return ack?.({ ok: false, error: "INVALID_SIGNAL" });
    const recipient = [...sockets.entries()].find(([, name]) => name === packet.to);
    if (!recipient) return ack?.({ ok: false, error: "USER_OFFLINE" });
    io.to(recipient[0]).emit("webrtc:signal", { from: username, data: packet.data });
    ack?.({ ok: true });
  });
  socket.on("disconnect", () => { sockets.delete(socket.id); io.to("lan").emit("presence:list", publicUsers()); io.to("lan").emit("presence:left", { username }); });
});

setInterval(() => { for (const [token, session] of sessions) if (session.expiresAt < Date.now()) sessions.delete(token); }, 60_000).unref();
server.listen(PORT, HOST, () => console.log(`Secure Chat LAN listening on http://${HOST}:${PORT}`));
