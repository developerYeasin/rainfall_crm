import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { sendMail } from './mailer.js';

// No look-alike characters (0/O, 1/l/I) so a password read off a screen can be typed back.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '@#$%';

const pick = (set) => set[crypto.randomInt(set.length)];

/** 10-character password with at least one of each class. */
export const generatePassword = (length = 10) => {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/** Emails a freshly generated login. Best-effort: the creator also sees it on screen. */
export const mailCredentials = ({ name, email, password, reset = false }) =>
  sendMail({
    to: email,
    subject: reset ? 'Your Rainfall CRM password was reset' : 'Your Rainfall CRM login',
    text: [
      `Hi ${name},`,
      '',
      reset ? 'Your password has been reset. Use these details to log in:' : 'An account has been created for you. Use these details to log in:',
      '',
      `Login: ${config.jobs.appUrl}/login`,
      `Email: ${email}`,
      `Password: ${password}`,
      '',
      'Please change the password after your first login.',
      '— Rainfall Media',
    ].join('\n'),
  });
