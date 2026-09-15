import crypto from 'node:crypto';
import { config } from '../config/index.js';

/** AES-256-GCM for third-party credentials (ad-account tokens). Output: iv.tag.ciphertext, base64. */
const key = () => crypto.createHash('sha256').update(config.credentialsKey).digest();

export const encryptSecret = (plain) => {
  if (plain === null || plain === undefined || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
};

export const decryptSecret = (packed) => {
  if (!packed) return null;
  const [iv, tag, data] = packed.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};
