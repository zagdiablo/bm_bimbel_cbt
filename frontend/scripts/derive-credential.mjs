#!/usr/bin/env node
/**
 * Helper untuk menguji API GAS dari terminal.
 * Menghasilkan "credential" PBKDF2 (100k iterasi) yang dikirim sebagai pengganti password.
 *
 * Usage:
 *   node scripts/derive-credential.mjs user@sekolah.sch.id "KataSandi#123"
 */
import { pbkdf2Sync } from 'node:crypto';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node scripts/derive-credential.mjs <email> <password>');
  process.exit(1);
}

const credential = pbkdf2Sync(
  password,
  `cbt:v1:${email.trim().toLowerCase()}`,
  100_000,
  32,
  'sha256',
).toString('base64');

console.log(credential);
