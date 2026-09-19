export function fingerprint(publicKeyHex: string) {
  return publicKeyHex.match(/.{1,4}/g)?.slice(0, 6).join(" ") ?? publicKeyHex;
}
