const $ = (id) => document.getElementById(id);
const authView = $("authView"), chatView = $("chatView"), authForm = $("authForm"), authError = $("authError");
const usernameInput = $("username"), passwordInput = $("password"), registerBtn = $("registerBtn");
const peersEl = $("peers"), messagesEl = $("messages"), messageInput = $("messageInput"), sendBtn = $("sendBtn");
const attachBtn = $("attachBtn"), fileInput = $("fileInput"), recordBtn = $("recordBtn");
const peerName = $("peerName"), peerState = $("peerState"), networkLabel = $("networkLabel"), connectionDot = $("connectionDot");
const voiceCallBtn = $("voiceCallBtn"), videoCallBtn = $("videoCallBtn"), permissionsBtn = $("permissionsBtn");
const callPanel = $("callPanel"), localVideo = $("localVideo"), remoteVideo = $("remoteVideo"), callState = $("callState");
let token = localStorage.getItem("secure-chat-lan-token");
let me = localStorage.getItem("secure-chat-lan-user");
let socket = null, selectedPeer = null, peerList = [];
let identity = null, peerKeys = new Map(), pc = null, activePeer = null, dataChannel = null;
let localStream = null, recorder = null, recordingParts = [], pendingTransfers = new Map();

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const hexSafe = (value) => value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);

async function api(path, body) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "تعذر إكمال الطلب");
  return data;
}

async function createIdentity() {
  if (!window.isSecureContext || !window.crypto?.subtle) throw new Error("التشفير يحتاج HTTPS أو localhost. افتح التطبيق عبر https://IP:PORT أو اختبره على localhost.");
  identity = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
}
async function publicKeyJwk() { return crypto.subtle.exportKey("jwk", identity.publicKey); }
async function derivePeerKey(username) {
  const peerPublic = peerKeys.get(username);
  if (!peerPublic) throw new Error("لم يصل مفتاح التشفير للطرف الآخر بعد. حدّث قائمة الأجهزة وحاول ثانية.");
  const imported = await crypto.subtle.importKey("jwk", peerPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  return crypto.subtle.deriveKey({ name: "ECDH", public: imported }, identity.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptText(text, recipient) {
  const key = await derivePeerKey(recipient);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  return { iv: b64(iv), ciphertext: b64(ciphertext), kind: "text" };
}
async function decryptText(packet) {
  const key = await derivePeerKey(packet.from);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(packet.iv) }, key, fromB64(packet.ciphertext));
  return decoder.decode(clear);
}
function notifyError(error) { console.error(error); authError.textContent = error.message || String(error); }
function showApp(username) { me = username; localStorage.setItem("secure-chat-lan-user", me); authView.classList.add("hidden"); chatView.classList.remove("hidden"); connectSocket(); }
function addMessage(text, mine, kind = "text", meta = "") { const el = document.createElement("div"); el.className = `bubble ${mine ? "" : "incoming"}`; el.textContent = text; if (meta) { const small = document.createElement("small"); small.textContent = meta; el.appendChild(small); } messagesEl.querySelector(".empty")?.remove(); messagesEl.appendChild(el); messagesEl.scrollTop = messagesEl.scrollHeight; }
function renderPeers() { peersEl.replaceChildren(); const others = peerList.filter((p) => p.username !== me); if (!others.length) { const empty = document.createElement("p"); empty.className = "micro"; empty.textContent = "لا توجد أجهزة أخرى متصلة بعد."; peersEl.appendChild(empty); return; } others.forEach((peer) => { const button = document.createElement("button"); button.className = `peer ${selectedPeer === peer.username ? "selected" : ""}`; button.innerHTML = `<span class="avatar">${peer.username.slice(0, 2).toUpperCase()}</span><span class="meta"><strong>${escapeHtml(peer.username)}</strong><small>متصل على الشبكة المحلية</small></span><span class="online"></span>`; button.onclick = () => selectPeer(peer.username); peersEl.appendChild(button); }); }
function escapeHtml(value) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function selectPeer(username) { selectedPeer = username; peerName.textContent = username; peerState.textContent = "مفتاح ECDH محلي · AES-GCM"; [messageInput, sendBtn, attachBtn, recordBtn, voiceCallBtn, videoCallBtn].forEach((el) => { el.disabled = false; }); renderPeers(); sendCryptoKey(username); }
function sendSignal(to, data) { socket?.emit("webrtc:signal", { to, data }); }
async function sendCryptoKey(to) { if (!identity) return; sendSignal(to, { type: "crypto-key", publicKey: await publicKeyJwk() }); }
function connectSocket() {
  if (socket) return;
  socket = io({ auth: { token } });
  socket.on("connect", () => { connectionDot.parentElement.classList.add("connected"); networkLabel.textContent = "متصل بالشبكة"; socket.emit("presence:request"); });
  socket.on("connect_error", (error) => { networkLabel.textContent = "فشل الاتصال"; authError.textContent = error.message === "AUTH_REQUIRED" ? "انتهت الجلسة، سجل الدخول من جديد." : error.message; });
  socket.on("session:ready", async ({ users }) => { peerList = users; renderPeers(); for (const user of users) if (user.username !== me) sendCryptoKey(user.username); });
  socket.on("presence:list", (users) => { peerList = users; renderPeers(); if (selectedPeer && !users.some((u) => u.username === selectedPeer)) { selectedPeer = null; peerName.textContent = "اختر جهازاً للبدء"; peerState.textContent = "لا يوجد مستلم محدد"; } });
  socket.on("presence:joined", ({ username }) => { if (username !== me) sendCryptoKey(username); });
  socket.on("message:encrypted", async (packet) => { try { const clear = await decryptText(packet); addMessage(clear, false); } catch (error) { addMessage("تعذر فك رسالة واردة: تحقق من بصمة الطرف الآخر.", false, "text", error.message); } });
  socket.on("webrtc:signal", handleSignal);
}
async function handleSignal({ from, data }) {
  if (data.type === "crypto-key") { peerKeys.set(from, data.publicKey); if (selectedPeer === from) peerState.textContent = "مفتاح ECDH متاح · AES-GCM جاهز"; return; }
  if (data.type === "offer") { selectedPeer = from; renderPeers(); await createPeerConnection(from, false); await pc.setRemoteDescription(data.offer); if (data.callType && data.callType !== "data") await startLocalMedia(data.callType); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); sendSignal(from, { type: "answer", answer }); callPanel.classList.remove("hidden"); callState.textContent = "مكالمة واردة · متصل"; return; }
  if (data.type === "answer" && pc) { await pc.setRemoteDescription(data.answer); callState.textContent = "متصل"; return; }
  if (data.type === "ice" && pc && data.candidate) { try { await pc.addIceCandidate(data.candidate); } catch (error) { console.warn("ICE candidate failed", error); } }
}
async function createPeerConnection(peer, initiator) {
  if (pc && activePeer === peer) return pc;
  if (pc) pc.close();
  activePeer = peer; pc = new RTCPeerConnection({ iceServers: [] });
  pc.onicecandidate = ({ candidate }) => { if (candidate) sendSignal(peer, { type: "ice", candidate }); };
  pc.ontrack = ({ streams }) => { remoteVideo.srcObject = streams[0]; callPanel.classList.remove("hidden"); };
  pc.ondatachannel = ({ channel }) => setupDataChannel(channel);
  if (initiator) setupDataChannel(pc.createDataChannel("secure-files"));
  if (localStream) localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  return pc;
}
function setupDataChannel(channel) { dataChannel = channel; channel.binaryType = "arraybuffer"; channel.onopen = () => { callState.textContent = "قناة P2P مباشرة جاهزة"; }; channel.onmessage = handleDataMessage; }
async function startLocalMedia(type) { if (!navigator.mediaDevices?.getUserMedia) throw new Error("المتصفح لا يدعم الكاميرا والميكروفون."); localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" }); localVideo.srcObject = localStream; }
async function startCall(type) { if (!selectedPeer) return; try { await startLocalMedia(type); await createPeerConnection(selectedPeer, true); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); sendSignal(selectedPeer, { type: "offer", offer, callType: type }); callPanel.classList.remove("hidden"); callState.textContent = "جاري الاتصال بالطرف الآخر..."; } catch (error) { alert(error.message); } }
function stopCall() { pc?.close(); pc = null; dataChannel = null; activePeer = null; localStream?.getTracks().forEach((track) => track.stop()); localStream = null; localVideo.srcObject = null; remoteVideo.srcObject = null; callPanel.classList.add("hidden"); }
function sendViaDataChannel(file, kind = "file") { if (!dataChannel || dataChannel.readyState !== "open") throw new Error("افتح مكالمة أو قناة P2P أولاً لإرسال الملفات."); const reader = new FileReader(); const transferId = crypto.randomUUID(); reader.onload = () => { const bytes = new Uint8Array(reader.result); const chunkSize = 16 * 1024; dataChannel.send(JSON.stringify({ type: "file-meta", transferId, name: file.name || "voice.webm", mime: file.type || "application/octet-stream", size: bytes.length, kind })); for (let offset = 0; offset < bytes.length; offset += chunkSize) dataChannel.send(JSON.stringify({ type: "file-chunk", transferId, chunk: b64(bytes.slice(offset, offset + chunkSize)) })); dataChannel.send(JSON.stringify({ type: "file-end", transferId })); addMessage(kind === "voice" ? "رسالة صوتية مشفرة أرسلت عبر P2P" : `ملف مشفر أرسل عبر P2P: ${file.name}`, true); }; reader.readAsArrayBuffer(file); }
function handleDataMessage(event) { const packet = JSON.parse(typeof event.data === "string" ? event.data : decoder.decode(event.data)); if (packet.type === "file-meta") pendingTransfers.set(packet.transferId, { ...packet, chunks: [] }); if (packet.type === "file-chunk") pendingTransfers.get(packet.transferId)?.chunks.push(fromB64(packet.chunk)); if (packet.type === "file-end") { const transfer = pendingTransfers.get(packet.transferId); if (!transfer) return; const blob = new Blob(transfer.chunks, { type: transfer.mime }); const url = URL.createObjectURL(blob); const el = document.createElement("div"); el.className = "bubble incoming"; el.innerHTML = `<a href="${url}" download="${escapeHtml(transfer.name)}">⬇ ${escapeHtml(transfer.name)}</a><small>نقل مباشر P2P · ${Math.round(transfer.size / 1024)} KB</small>`; messagesEl.querySelector(".empty")?.remove(); messagesEl.appendChild(el); messagesEl.scrollTop = messagesEl.scrollHeight; pendingTransfers.delete(packet.transferId); } }

async function loginOrRegister(register = false) { authError.textContent = ""; const username = hexSafe(usernameInput.value.trim()); const password = passwordInput.value; try { const data = await api(register ? "/api/register" : "/api/login", { username, password }); token = data.token; localStorage.setItem("secure-chat-lan-token", token); await createIdentity(); showApp(data.username); } catch (error) { notifyError(error); } }
authForm.onsubmit = (event) => { event.preventDefault(); loginOrRegister(false); };
registerBtn.onclick = () => loginOrRegister(true);
$("logoutBtn").onclick = async () => { if (token) await api("/api/logout", { token }).catch(() => {}); localStorage.removeItem("secure-chat-lan-token"); localStorage.removeItem("secure-chat-lan-user"); location.reload(); };
$("refreshPeers").onclick = () => socket?.emit("presence:request");
permissionsBtn.onclick = async () => { try { await startLocalMedia("video"); localStream?.getTracks().forEach((track) => track.stop()); localStream = null; localVideo.srcObject = null; alert("تم منح أذونات الميكروفون والكاميرا لهذه الجلسة."); } catch (error) { alert(error.message); } };
voiceCallBtn.onclick = () => startCall("audio"); videoCallBtn.onclick = () => startCall("video"); $("hangupBtn").onclick = stopCall;
sendBtn.onclick = async () => { if (!selectedPeer || !messageInput.value.trim()) return; try { const packet = await encryptText(messageInput.value.trim(), selectedPeer); socket.emit("message:encrypted", { to: selectedPeer, ...packet }, (result) => { if (!result?.ok) addMessage("تعذر الإرسال: المستخدم غير متصل.", true); }); addMessage(messageInput.value.trim(), true); messageInput.value = ""; } catch (error) { alert(error.message); } };
messageInput.onkeydown = (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendBtn.click(); } };
attachBtn.onclick = () => fileInput.click(); fileInput.onchange = () => { const file = fileInput.files?.[0]; if (file) try { sendViaDataChannel(file); } catch (error) { alert(error.message); } fileInput.value = ""; };
recordBtn.onclick = async () => { try { if (recorder?.state === "recording") { recorder.stop(); recordBtn.classList.remove("recording"); return; } if (!localStream) await startLocalMedia("audio"); recordingParts = []; recorder = new MediaRecorder(localStream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined }); recorder.ondataavailable = (event) => event.data.size && recordingParts.push(event.data); recorder.onstop = () => { const blob = new Blob(recordingParts, { type: recorder.mimeType }); try { sendViaDataChannel(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }), "voice"); } catch (error) { alert(error.message); } }; recorder.start(); recordBtn.classList.add("recording"); } catch (error) { alert(error.message); } };
$("bluetoothBtn").onclick = async () => { if (!navigator.bluetooth) return alert("Web Bluetooth غير مدعوم في هذا المتصفح. استخدم Chrome/Edge على HTTPS أو localhost."); try { const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true }); alert(`تم العثور على الجهاز: ${device.name || "جهاز غير مسمى"}. Web Bluetooth لا ينقل رسائل Socket.io تلقائياً؛ الربط الكامل يحتاج GATT profile أو Android أصلي.`); } catch (error) { if (error.name !== "NotFoundError") alert(error.message); } };

(async function boot() { if (token && me) { try { await createIdentity(); showApp(me); } catch (error) { token = null; localStorage.removeItem("secure-chat-lan-token"); authError.textContent = error.message; } } })();
