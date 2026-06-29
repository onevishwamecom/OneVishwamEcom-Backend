/**
 * Centralized authentication configuration.
 * Single source of truth for password policy, OTP settings, and token config.
 */

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=<>?/{}[\]~|]).{8,}$/;

const PASSWORD_RULES_MESSAGE =
  'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a special character.';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const BCRYPT_SALT_ROUNDS = 12;

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

const RESET_TOKEN_EXPIRY_MINUTES = 5;

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;

const EMAIL_MAX_LENGTH = 254;

const PHONE_REGEX = /^\+?[\d\s-]{10,15}$/;

module.exports = {
  PASSWORD_REGEX,
  PASSWORD_RULES_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  BCRYPT_SALT_ROUNDS,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  RESET_TOKEN_EXPIRY_MINUTES,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PHONE_REGEX,
};
