// AES-GCM sealing for per-org provider credentials at rest. Uses WebCrypto
// (available on Workers AND Node 26), so no pgcrypto / native dep. The key is
// SECRET_SEAL_KEY (base64, 32 bytes). Output: base64(iv[12] ‖ ciphertext).
import type { Env } from './env.ts';

const IV_BYTES = 12;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function importKey(env: Env): Promise<CryptoKey> {
  const raw = env.SECRET_SEAL_KEY;
  if (!raw) throw new Error('SECRET_SEAL_KEY is not set');
  return crypto.subtle.importKey('raw', b64ToBytes(raw.trim()), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function seal(env: Env, data: Record<string, unknown>): Promise<string> {
  const key = await importKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const pt = new TextEncoder().encode(JSON.stringify(data));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return bytesToB64(packed);
}

export async function unseal(env: Env, sealed: string): Promise<Record<string, string>> {
  const key = await importKey(env);
  const packed = b64ToBytes(sealed);
  const iv = packed.subarray(0, IV_BYTES);
  const ct = packed.subarray(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}
