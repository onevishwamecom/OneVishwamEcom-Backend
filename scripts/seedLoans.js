require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const LoanProduct = require('../models/LoanProduct');

const loans = [
  {
    name: 'Home Loan',
    provider: 'HDFC Ltd.',
    type: 'home',
    interestRate: 7,
    maxAmount: 50000000,
    minAmount: 500000,
    tenureMonths: 360,
    processingFee: 0.5,
    description: '100% pre-approved home loans with competitive rates. Buy, construct, or renovate your dream home with flexible EMI options.',
    eligibility: ['Salaried / Self-employed individuals', 'Age: 21 – 65 years', 'Minimum income: ₹25,000/month', 'CIBIL Score: 650+'],
    documents: ['Aadhaar Card', 'PAN Card', 'Income Proof (6 months)', 'Bank Statements (6 months)', 'Property Documents'],
    status: 'active',
    contactPhone: '9364862542',
    contactEmail: 'ceo@onevishwam.com',
  },
  {
    name: 'Vehicle Loan',
    provider: 'Bajaj Finserv',
    type: 'vehicle',
    interestRate: 8,
    maxAmount: 20000000,
    minAmount: 50000,
    tenureMonths: 84,
    processingFee: 1,
    description: 'Financing for two-wheelers, three-wheelers, cars, and commercial vehicles. Zero down payment options with quick disbursal.',
    eligibility: ['Salaried / Self-employed individuals', 'Age: 21 – 60 years', 'Minimum income: ₹15,000/month', 'CIBIL Score: 600+'],
    documents: ['Aadhaar Card', 'PAN Card', 'Income Proof', 'Vehicle Quotation', 'Bank Statements'],
    status: 'active',
    contactPhone: '9364862542',
    contactEmail: 'ceo@onevishwam.com',
  },
  {
    name: 'Personal Loan',
    provider: 'ICICI Bank',
    type: 'personal',
    interestRate: 10.5,
    maxAmount: 5000000,
    minAmount: 50000,
    tenureMonths: 60,
    processingFee: 1.5,
    description: 'Instant personal loans with zero collateral. Funds credited within 24 hours of approval with minimal documentation.',
    eligibility: ['Salaried individuals', 'Age: 23 – 58 years', 'Minimum income: ₹20,000/month', 'CIBIL Score: 700+'],
    documents: ['Aadhaar Card', 'PAN Card', 'Salary Slips (3 months)', 'Bank Statements (3 months)'],
    status: 'active',
    contactPhone: '9364862542',
    contactEmail: 'ceo@onevishwam.com',
  },
  {
    name: 'Business Loan',
    provider: 'State Bank of India',
    type: 'business',
    interestRate: 9,
    maxAmount: 20000000,
    minAmount: 100000,
    tenureMonths: 120,
    processingFee: 0.75,
    description: 'Business loans under Mudra Yojana and MSME schemes for working capital, startups, and business expansion. Collateral-free up to ₹10L.',
    eligibility: ['Business owner / Proprietor', 'Business vintage: 1+ years', 'ITR filed for 1+ years', 'CIBIL Score: 650+'],
    documents: ['Aadhaar Card', 'PAN Card', 'Business Proof', 'ITR (2 years)', 'Bank Statements (6 months)', 'GST Returns'],
    status: 'active',
    contactPhone: '9364862542',
    contactEmail: 'ceo@onevishwam.com',
  },
  {
    name: 'Education Loan',
    provider: 'Axis Bank',
    type: 'education',
    interestRate: 9,
    maxAmount: 15000000,
    minAmount: 200000,
    tenureMonths: 180,
    processingFee: 1,
    description: 'Education loans for undergraduate, postgraduate, and doctoral studies in India and abroad. Moratorium period available.',
    eligibility: ['Student age: 18 – 35 years', 'Admission to recognized institution', 'Co-applicant required', 'Indian resident'],
    documents: ['Admission Letter', 'Fee Structure', 'Student KYC', 'Co-applicant KYC', 'Co-applicant Income Proof'],
    status: 'active',
    contactPhone: '9364862542',
    contactEmail: 'ceo@onevishwam.com',
  },
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onevishwam';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    await LoanProduct.deleteMany({});
    console.log('Cleared existing loan products');

    const created = [];
    for (const data of loans) {
      const item = await LoanProduct.create(data);
      created.push(item);
    }
    console.log(`Seeded ${created.length} loan products successfully`);

    const count = await LoanProduct.countDocuments();
    console.log(`Total loan products in DB: ${count}`);

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
