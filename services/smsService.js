/**
 * SMS service abstraction.
 *
 * Provides a single `sendOtp(phone, otp, purpose)` interface used by the
 * registration flow. Provider-specific code lives here so that real SMS
 * providers (Twilio / MSG91 / Fast2SMS / etc.) can be wired in later
 * without touching registration logic.
 *
 * In DEVELOPMENT mode (SMS_PROVIDER=local or NODE_ENV=development) the OTP
 * is NOT sent over a network. It is only logged to the server console,
 * gated behind an explicit environment variable. The OTP is NEVER returned
 * by the API response — not even in development.
 */
class SmsService {
  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'local';
    this.devOtpLog = process.env.SMS_DEV_LOG === 'true';
  }

  /**
   * Sends an OTP to a normalized phone number.
   * @param {string} phone  Normalized E.164-style phone (e.g. "919876543210")
   * @param {string} otp    The 6-digit OTP
   * @param {string} purpose Messaging purpose label (e.g. "LISTER_REGISTRATION")
   * @returns {Promise<{success:boolean, provider:string}>}
   */
  async sendOtp(phone, otp, purpose) {
    if (this.provider === 'local' || process.env.NODE_ENV === 'development') {
      // Dev-only: log, never return to client, never hit a network.
      if (this.devOtpLog) {
        console.log(`[SMS:DEV] [${purpose}] OTP for ${phone}: ${otp}`);
      } else {
        console.log(`[SMS:DEV] [${purpose}] OTP generated for ${phone} (set SMS_DEV_LOG=true to reveal)`);
      }
      return { success: true, provider: 'local' };
    }

    // Real providers would be implemented here.
    switch (this.provider) {
      case 'twilio':
        return this._sendWithTwilio(phone, otp);
      case 'msg91':
        return this._sendWithMsg91(phone, otp);
      case 'fast2sms':
        return this._sendWithFast2Sms(phone, otp);
      default:
        console.warn(`[SMS] Unknown provider "${this.provider}"; OTP was not sent.`);
        return { success: false, provider: this.provider, message: 'SMS provider not configured' };
    }
  }

  _sendWithTwilio(phone, otp) {
    // Placeholder — wire up with TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN when needed.
    throw new Error('Twilio integration not configured');
  }

  _sendWithMsg91(phone, otp) {
    throw new Error('MSG91 integration not configured');
  }

  _sendWithFast2Sms(phone, otp) {
    throw new Error('Fast2SMS integration not configured');
  }
}

module.exports = new SmsService();
