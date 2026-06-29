const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fieldErrors = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return res.status(400).json({
      success: false,
      message: fieldErrors.map((e) => e.message).join(', '),
      errors: fieldErrors,
    });
  }
  next();
};

module.exports = validate;
