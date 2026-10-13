const nodemailer = require('nodemailer');

// Outgoing email (forgot-password codes). Configured in backend/.env:
//   SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS), SMTP_USER, SMTP_PASS, MAIL_FROM
// With Gmail, SMTP_PASS is an App password (Google Account > Security > App passwords), not the normal password.
const isMailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
};

// One retry for passing network hiccups (DNS or connection timeouts)
const TRANSIENT = /ETIMEOUT|ETIMEDOUT|ECONNECTION|ECONNRESET|ESOCKET|EDNS|EAI_AGAIN|ENOTFOUND/;
async function sendMail({ to, subject, text, html }) {
  const message = { from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html };
  try {
    return await getTransporter().sendMail(message);
  } catch (err) {
    if (!TRANSIENT.test(`${err.code} ${err.message}`)) throw err;
    await new Promise(r => setTimeout(r, 1500));
    return getTransporter().sendMail(message);
  }
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Reset-code email in English or Bahasa Malaysia
function resetCodeEmail({ name, code, minutes, lang }) {
  const ms = lang === 'ms';
  const hi = ms ? `Hai ${name || ''},`.replace(' ,', ',') : `Hi ${name || ''},`.replace(' ,', ',');
  const lines = ms
    ? {
        subject: `Kod set semula kata laluan HQ Inventory: ${code}`,
        intro: 'Seseorang (diharap anda) meminta untuk set semula kata laluan akaun HQ Inventory anda. Masukkan kod ini di halaman log masuk:',
        expiry: `Kod ini tamat dalam ${minutes} minit dan hanya boleh digunakan sekali.`,
        ignore: 'Jika anda tidak meminta ini, abaikan e-mel ini. Kata laluan anda tidak akan berubah.',
        never: 'Jangan kongsi kod ini dengan sesiapa. Staf HQ tidak akan meminta kod ini.',
      }
    : {
        subject: `Your HQ Inventory password reset code: ${code}`,
        intro: 'Someone (hopefully you) asked to reset the password for your HQ Inventory account. Enter this code on the sign-in page:',
        expiry: `The code expires in ${minutes} minutes and works only once.`,
        ignore: "If you didn't ask for this, ignore this email. Your password won't change.",
        never: 'Never share this code. HQ staff will never ask you for it.',
      };
  const text = `${hi}\n\n${lines.intro}\n\n    ${code}\n\n${lines.expiry}\n\n${lines.ignore}\n${lines.never}\n\nHQ Inventory`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:480px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;padding:28px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;color:#6d28d9">HQ INVENTORY</p>
      <p style="margin:16px 0 8px;font-size:15px">${escapeHtml(hi)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escapeHtml(lines.intro)}</p>
      <p style="margin:0 0 20px;text-align:center;font-size:34px;font-weight:700;letter-spacing:8px;font-family:Consolas,Menlo,monospace;background:#f4f4f5;border-radius:12px;padding:16px 0">${escapeHtml(code)}</p>
      <p style="margin:0 0 12px;font-size:14px;color:#3f3f46">${escapeHtml(lines.expiry)}</p>
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">${escapeHtml(lines.ignore)}<br>${escapeHtml(lines.never)}</p>
    </div>
  </div></body></html>`;
  return { subject: lines.subject, text, html };
}

module.exports = { isMailConfigured, sendMail, resetCodeEmail };
