/**
 * Client-side password strengthening.
 *
 * The 100k-iteration PBKDF2 runs in the browser (Web Crypto) so the plain
 * password never leaves the device. The server only stores/compares a peppered
 * HMAC of the resulting verifier. This keeps login fast inside Apps Script,
 * which cannot afford 100k HMAC calls within its execution limit.
 */
const ITERATIONS = 100_000;
const SALT_PREFIX = 'cbt:v1:';

export async function deriveCredential(email: string, password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Browser tidak mendukung Web Crypto. Gunakan browser modern (Chrome/Edge/Safari).');
  }
  const encoder = new TextEncoder();
  const salt = encoder.encode(`${SALT_PREFIX}${email.trim().toLowerCase()}`);
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function randomPassword(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}
