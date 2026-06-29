const { body } = require('express-validator');
const {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REGEX,
  PASSWORD_RULES_MESSAGE,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PHONE_REGEX,
  OTP_LENGTH,
} = require('../config/authConfig');

// ── Reusable field validators ──────────────────────────────────────────────

const emailField = (fieldName = 'email') =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isLength({ max: EMAIL_MAX_LENGTH })
    .withMessage(`Email must not exceed ${EMAIL_MAX_LENGTH} characters`)
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail();

const passwordField = (fieldName = 'password') =>
  body(fieldName)
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
    .matches(PASSWORD_REGEX)
    .withMessage(PASSWORD_RULES_MESSAGE);

const nameField = (fieldName = 'name') =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`);

const phoneField = (fieldName = 'phone') =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(PHONE_REGEX)
    .withMessage('Invalid phone number');

const otpField = (fieldName = 'otp') =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: OTP_LENGTH, max: OTP_LENGTH })
    .withMessage(`OTP must be exactly ${OTP_LENGTH} digits`)
    .isNumeric()
    .withMessage('OTP must contain only digits');

// ── Route-specific validation rule sets ────────────────────────────────────

const registerRules = [
  nameField(),
  emailField(),
  phoneField(),
  passwordField(),
];

const loginRules = [
  emailField(),
  body('password').notEmpty().withMessage('Password is required'),
];

const refreshRules = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

const forgotPasswordRules = [
  emailField(),
];

const verifyOtpRules = [
  emailField(),
  otpField(),
];

const resendOtpRules = [
  emailField(),
];

const resetPasswordRules = [
  emailField(),
  body('verifyToken').trim().notEmpty().withMessage('Verification token is required'),
  passwordField(),
];

const updateProfileRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`),
  body('phone')
    .optional()
    .trim()
    .matches(PHONE_REGEX)
    .withMessage('Invalid phone number'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  passwordField('newPassword'),
];

const saveListingRules = [
  body('listingId')
    .notEmpty()
    .withMessage('Listing ID is required')
    .isMongoId()
    .withMessage('Invalid listing ID'),
];

module.exports = {
  registerRules,
  loginRules,
  refreshRules,
  forgotPasswordRules,
  verifyOtpRules,
  resendOtpRules,
  resetPasswordRules,
  updateProfileRules,
  changePasswordRules,
  saveListingRules,
};
