const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  let pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (user && pass) {
    // Strip any accidental spaces from Google App Password
    pass = String(pass).replace(/\s+/g, '');
    
    if (!host || host.includes('gmail.com')) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass }
      });
    }
  }

  return transporter;
}

/**
 * Send 6-digit OTP verification email
 * @param {string} toEmail 
 * @param {string} otpCode 
 * @param {string} purpose 'Password Reset' | '2-Step Password Change'
 */
async function sendOtpEmail(toEmail, otpCode, purpose = 'Password Reset') {
  const mailTransporter = getTransporter();

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px; background-color: #f8fafc;">
      <div style="background-color: #ffffff; border-radius: 16px; padding: 32px 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; padding: 10px 18px; border-radius: 12px; font-weight: 800; font-size: 16px; letter-spacing: -0.5px;">
            Smart Merchant
          </div>
          <h2 style="color: #0f172a; margin-top: 16px; margin-bottom: 8px; font-size: 20px; font-weight: 700;">
            ${purpose}
          </h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">
            Use the 6-digit verification code below to complete your request.
          </p>
        </div>

        <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1;">
          <div style="font-size: 11px; text-transform: uppercase; tracking: 1px; color: #64748b; font-weight: 700; margin-bottom: 6px;">
            Security Verification Code
          </div>
          <div style="font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5;">
            ${otpCode}
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">
            Valid for 10 minutes
          </div>
        </div>

        <p style="color: #475569; font-size: 12px; line-height: 1.6; margin-bottom: 20px;">
          If you did not request this security code, please ignore this email or review your store security settings immediately.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

        <div style="text-align: center; color: #94a3b8; font-size: 11px;">
          Smart Merchant AI Retail Management Suite • Secure Authentication
        </div>
      </div>
    </div>
  `;

  console.log(`\n======================================================`);
  console.log(`📧 [EMAIL OTP GENERATED]`);
  console.log(`   To: ${toEmail}`);
  console.log(`   Purpose: ${purpose}`);
  console.log(`   6-Digit Code: ${otpCode}`);
  console.log(`   Expires in: 10 minutes`);
  console.log(`======================================================\n`);

  if (mailTransporter) {
    try {
      const fromAddress = process.env.SMTP_FROM || `"Smart Merchant Security" <${process.env.SMTP_USER || process.env.GMAIL_USER}>`;
      await mailTransporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: `[${otpCode}] Smart Merchant ${purpose} Code`,
        html: htmlContent
      });
      return { success: true, delivered: true };
    } catch (sendErr) {
      console.warn('SMTP delivery notice (using console fallback):', sendErr.message);
      return { success: true, delivered: false, error: sendErr.message };
    }
  }

  return { success: true, delivered: false, simulated: true };
}

module.exports = { sendOtpEmail };
