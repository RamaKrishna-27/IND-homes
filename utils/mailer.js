const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  return transporter;
}

// Sends an email if SMTP is configured; otherwise logs to console so local dev still works.
async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log('\n--- EMAIL (no SMTP configured, logging instead) ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log(text || html);
    console.log('--- END EMAIL ---\n');
    return { simulated: true };
  }

  return t.sendMail({
    from: process.env.EMAIL_FROM || 'IND Homes <no-reply@indhomes.com>',
    to,
    subject,
    html,
    text
  });
}

module.exports = { sendMail };
