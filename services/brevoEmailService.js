const brevo = require('@getbrevo/brevo');

const sendOtpEmail = async (email, otp) => {
  const apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(brevo.ApiClient.instance.authentications['api-key'], process.env.BREVO_API_KEY);

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = 'Reset Your OneVishwam Password';
  sendSmtpEmail.to = [{ email }];
  sendSmtpEmail.sender = {
    name: process.env.BREVO_FROM_NAME || 'OneVishwam',
    email: process.env.BREVO_FROM_EMAIL || 'noreply@onevishwam.com',
  };
  sendSmtpEmail.htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">OneVishwam</h1>
      </div>
      <h2 style="font-size: 18px; color: #1e293b; margin: 0 0 8px;">Reset Your OneVishwam Password</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
        Hello,<br/><br/>
        We received a request to reset your password.
      </p>
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #f1f5f9; border-radius: 12px; padding: 16px 32px; letter-spacing: 8px; font-size: 32px; font-weight: 700; color: #1e293b;">
          ${otp}
        </div>
      </div>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
        This code is valid for <strong>5 minutes</strong>.
      </p>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        OneVishwam Team
      </p>
    </div>
  `;

  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

module.exports = { sendOtpEmail };
