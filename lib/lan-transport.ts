import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, type Socket } from "socket.io-client";

export const LAN_SERVER_KEY = "secure-chat.lan.server-url";
export type LanPresence = { username: string };
export type EncryptedPacket = { to: string; iv: string; ciphertext: string; kind?: string };

type LanHandlers = {
  onPresence?: (users: LanPresence[]) => void;
  onEncryptedMessage?: (packet: EncryptedPacket & { from: string }) => void;
  onSignal?: (packet: { from: string; data: unknown }) => void;
  onStatus?: (connected: boolean) => void;
};

let socket: Socket | null = null;

export async function getLanServerUrl() {
  return (await AsyncStorage.getItem(LAN_SERVER_KEY)) ?? "http://192.168.1.100:3100";
}

export async function saveLanServerUrl(url: string) {
  const normalized = url.trim().replace(/\/$/, "");
  if (!/^https?:\/\/.+/.test(normalized)) throw new Error("أدخل رابطاً يبدأ بـ http:// أو https://");
  await AsyncStorage.setItem(LAN_SERVER_KEY, normalized);
  return normalized;
}

export async function connectLan(token: string, handlers: LanHandlers = {}) {
  if (socket?.connected) return socket;
  const serverUrl = await getLanServerUrl();
  socket = io(serverUrl, { auth: { token }, transports: ["websocket"] });
  socket.on("connect", () => handlers.onStatus?.(true));
  socket.on("disconnect", () => handlers.onStatus?.(false));
  socket.on("connect_error", () => handlers.onStatus?.(false));
  socket.on("presence:list", handlers.onPresence ?? (() => undefined));
  socket.on("message:encrypted", handlers.onEncryptedMessage ?? (() => undefined));
  socket.on("webrtc:signal", handlers.onSignal ?? (() => undefined));
  return socket;
}

export function sendEncryptedMessage(packet: EncryptedPacket, onResult?: (result: { ok: boolean; error?: string }) => void) {
  if (!socket?.connected) throw new Error("غير متصل بخادم LAN");
  socket.emit("message:encrypted", packet, onResult);
}

export function sendLanSignal(to: string, data: unknown) {
  if (!socket?.connected) throw new Error("غير متصل بخادم LAN");
  socket.emit("webrtc:signal", { to, data });
}

export function disconnectLan() {
  socket?.disconnect();
  socket = null;
}
