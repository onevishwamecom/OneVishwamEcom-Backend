const { body } = require('express-validator');
const {
  PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_REGEX, PASSWORD_RULES_MESSAGE,
  NAME_MIN_LENGTH, NAME_MAX_LENGTH, EMAIL_MAX_LENGTH, PHONE_REGEX, OTP_LENGTH,
} = require('../config/authConfig');

const emailField = (field = 'email') =>
  body(field).trim().notEmpty().withMessage('Email is required')
    .isLength({ max: EMAIL_MAX_LENGTH }).withMessage(`Email must not exceed ${EMAIL_MAX_LENGTH} characters`)
    .isEmail().withMessage('Valid email is required').normalizeEmail();

const passwordField = (field = 'password') =>
  body(field).notEmpty().withMessage('Password is required')
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
    .matches(PASSWORD_REGEX).withMessage(PASSWORD_RULES_MESSAGE);

const registerRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required')
    .isLength({ min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`),
  emailField(),
  body('mobile').trim().notEmpty().withMessage('Mobile number is required')
    .matches(PHONE_REGEX).withMessage('Invalid mobile number'),
  passwordField(),
  body('confirmPassword').notEmpty().withMessage('Confirm password is required')
    .custom((val, { req }) => val === req.body.password).withMessage('Passwords do not match'),
];

const loginRules = [
  emailField(),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordRules = [emailField()];

const verifyOtpRules = [
  emailField(),
  body('otp').trim().notEmpty().withMessage('OTP is required')
    .isLength({ min: OTP_LENGTH, max: OTP_LENGTH }).withMessage(`OTP must be exactly ${OTP_LENGTH} digits`)
    .isNumeric().withMessage('OTP must contain only digits'),
];

const resendOtpRules = [emailField()];

const resetPasswordRules = [
  emailField(),
  body('verifyToken').trim().notEmpty().withMessage('Verification token is required'),
  passwordField(),
  body('confirmPassword').notEmpty().withMessage('Confirm password is required')
    .custom((val, { req }) => val === req.body.password).withMessage('Passwords do not match'),
];

module.exports = { registerRules, loginRules, forgotPasswordRules, verifyOtpRules, resendOtpRules, resetPasswordRules };
