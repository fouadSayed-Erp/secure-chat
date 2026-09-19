import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import nacl from "tweetnacl";
import { fingerprint } from "./crypto-utils";

const IDENTITY_SECRET = "secure-chat.identity.secret";
const IDENTITY_PUBLIC = "secure-chat.identity.public";

type Identity = { publicKey: Uint8Array; secretKey: Uint8Array };
type EncryptedEnvelope = { nonce: string; ciphertext: string; senderPublicKey: string };

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);

async function secureSet(key: string, value: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureGet(key: string) {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function getOrCreateIdentity(): Promise<Identity> {
  const [secretHex, publicHex] = await Promise.all([secureGet(IDENTITY_SECRET), secureGet(IDENTITY_PUBLIC)]);
  if (secretHex && publicHex) return { secretKey: fromHex(secretHex), publicKey: fromHex(publicHex) };

  const keyPair = nacl.box.keyPair();
  await Promise.all([secureSet(IDENTITY_SECRET, toHex(keyPair.secretKey)), secureSet(IDENTITY_PUBLIC, toHex(keyPair.publicKey))]);
  return { secretKey: keyPair.secretKey, publicKey: keyPair.publicKey };
}

export async function getPublicIdentityKey() {
  const identity = await getOrCreateIdentity();
  return toHex(identity.publicKey);
}

export async function encryptForPeer(plainText: string, peerPublicKeyHex: string): Promise<EncryptedEnvelope> {
  const identity = await getOrCreateIdentity();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const sharedKey = nacl.box.before(fromHex(peerPublicKeyHex), identity.secretKey);
  const message = new TextEncoder().encode(plainText);
  const ciphertext = nacl.secretbox(message, nonce, sharedKey);
  return { nonce: toHex(nonce), ciphertext: toHex(ciphertext), senderPublicKey: toHex(identity.publicKey) };
}

export async function decryptFromPeer(envelope: EncryptedEnvelope): Promise<string | null> {
  const identity = await getOrCreateIdentity();
  const sharedKey = nacl.box.before(fromHex(envelope.senderPublicKey), identity.secretKey);
  const clear = nacl.secretbox.open(fromHex(envelope.ciphertext), fromHex(envelope.nonce), sharedKey);
  return clear ? new TextDecoder().decode(clear) : null;
}

