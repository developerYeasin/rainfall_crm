import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let transport;
const getTransport = () => {
  if (!config.smtp.host) return null;
  transport ||= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
  });
  return transport;
};

/** Best-effort email. Without SMTP_HOST it only logs, so development never needs a mail server. */
export const sendMail = async ({ to, subject, text }) => {
  const recipients = [].concat(to).filter(Boolean);
  if (!recipients.length) return;
  const mailer = getTransport();
  if (!mailer) {
    console.log(`[mail] (SMTP not configured) to=${recipients.join(',')} subject="${subject}"`);
    return;
  }
  try {
    await mailer.sendMail({ from: config.smtp.from, to: recipients.join(','), subject, text });
  } catch (err) {
    console.error('[mail] send failed:', err.message);
  }
};
