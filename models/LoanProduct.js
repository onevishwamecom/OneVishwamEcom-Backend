const mongoose = require('mongoose');

const loanProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    provider: { type: String, required: [true, 'Provider is required'] },
    type: {
      type: String,
      enum: ['home', 'vehicle', 'personal', 'business', 'education'],
      required: [true, 'Loan type is required'],
    },
    interestRate: {
      type: Number,
      required: [true, 'Interest rate is required'],
      min: [0, 'Interest rate cannot be negative'],
      max: [50, 'Interest rate cannot exceed 50%'],
    },
    maxAmount: { type: Number, required: [true, 'Max amount is required'] },
    minAmount: { type: Number, default: 0 },
    tenureMonths: { type: Number, required: [true, 'Tenure is required'] },
    processingFee: { type: Number, default: 0 },
    description: { type: String, maxlength: 2000 },
    eligibility: [String],
    documents: [String],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

loanProductSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('LoanProduct', loanProductSchema);
