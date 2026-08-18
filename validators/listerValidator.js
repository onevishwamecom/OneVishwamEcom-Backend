const { body } = require('express-validator');
const {
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REGEX,
  PASSWORD_RULES_MESSAGE,
  OTP_LENGTH,
  PHONE_REGEX,
} = require('../config/authConfig');

const phoneField = (field = 'phone') =>
  body(field).trim().notEmpty().withMessage('Phone number is required')
    .isLength({ min: 10, max: 15 }).withMessage('Phone number must be between 10 and 15 digits')
    .custom((value) => {
      // Accepts raw formats; normalization/validation handled in service.
      const digits = String(value || '').replace(/\D/g, '');
      if (!digits || digits.length < 10 || digits.length > 13) {
        throw new Error('Please enter a valid phone number');
      }
      return true;
    });

const passwordField = (field = 'password') =>
  body(field).notEmpty().withMessage('Password is required')
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
    .matches(PASSWORD_REGEX).withMessage(PASSWORD_RULES_MESSAGE);

const sendOtpRules = [
  phoneField('phone'),
];

const verifyOtpRules = [
  phoneField('phone'),
  body('otp').trim().notEmpty().withMessage('OTP is required')
    .isLength({ min: OTP_LENGTH, max: OTP_LENGTH }).withMessage(`OTP must be exactly ${OTP_LENGTH} digits`)
    .isNumeric().withMessage('OTP must contain only digits'),
];

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`),
  body('email').optional({ nullable: true, checkFalsy: true }).trim()
    .isLength({ max: EMAIL_MAX_LENGTH }).withMessage(`Email must not exceed ${EMAIL_MAX_LENGTH} characters`)
    .isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  passwordField(),
  body('confirmPassword').notEmpty().withMessage('Confirm password is required')
    .custom((val, { req }) => val === req.body.password).withMessage('Passwords do not match'),
];

const loginRules = [
  phoneField('phone'),
  body('password').notEmpty().withMessage('Password is required'),
];

const updateProfileRules = [
  body('name').optional().trim()
    .isLength({ min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })
    .withMessage(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`),
  body('email').optional({ nullable: true, checkFalsy: true }).trim()
    .isLength({ max: EMAIL_MAX_LENGTH }).withMessage(`Email must not exceed ${EMAIL_MAX_LENGTH} characters`)
    .isEmail().withMessage('A valid email is required').normalizeEmail(),
];

module.exports = {
  sendOtpRules,
  verifyOtpRules,
  registerRules,
  loginRules,
  updateProfileRules,
};
