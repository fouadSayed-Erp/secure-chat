import AsyncStorage from "@react-native-async-storage/async-storage";

export type StoredMessage = {
  id: string;
  peerId?: string;
  text: string;
  time: string;
  mine?: boolean;
  kind?: "text" | "voice" | "media" | "file";
};

const keyFor = (peerId: string) => `secure-chat.messages.${peerId}`;

export async function loadMessages(peerId: string, fallback: StoredMessage[]) {
  const raw = await AsyncStorage.getItem(keyFor(peerId));
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as StoredMessage[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function saveMessages(peerId: string, messages: StoredMessage[]) {
  await AsyncStorage.setItem(keyFor(peerId), JSON.stringify(messages.slice(-500)));
}

export async function clearMessages(peerId: string) {
  await AsyncStorage.removeItem(keyFor(peerId));
}
