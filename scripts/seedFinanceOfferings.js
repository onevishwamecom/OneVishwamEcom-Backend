require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const FinanceOffering = require('../modules/financeOfferings/model');

const offerings = [
  {
    order: 1, type: 'home',
    title: '100% Home Loan @7%',
    subtitle: 'Without CIBIL & Income Tax',
    description: 'India\'s most aggressive home loan — 100% funding without CIBIL score or Income Tax Returns. Maximum funding up to ₹3 Crore with tenure up to 30 years.',
    interestRate: '7%',
    maxAmount: '₹3 Crore',
    tenure: 'Up to 30 years',
    features: ['100% property value funding', 'No CIBIL check', 'No ITR required', 'Maximum ₹3 Crore', '30-year tenure', 'Instant provisional approval'],
    processingFee: '0%',
    icon: 'fa-solid fa-house-chimney',
    badge: 'Most Popular',
    badgeColor: 'bg-brand-gold text-brand-white',
  },
  {
    order: 2, type: 'gold',
    title: 'New Jewellery Purchase Loan',
    subtitle: 'Up to ₹20 Lakhs @5% (combo only)',
    description: 'Exclusive new jewellery purchase loan at ultra-low 5% interest — combo offer only. Buy gold, diamond, platinum, or silver jewellery from partner showrooms.',
    interestRate: '5%',
    maxAmount: '₹20 Lakhs',
    tenure: 'Up to 5 years',
    features: ['5% fixed interest rate', 'Up to ₹20 Lakhs', '5-year flexible tenure', 'Combo offer with existing loans', 'Zero processing fees'],
    icon: 'fa-solid fa-gem',
    badge: 'Combo Offer',
    badgeColor: 'bg-brand-orange text-brand-white',
  },
  {
    order: 3, type: 'gold',
    title: 'Old Jewellery Loan',
    subtitle: 'Combo + Takeover option available',
    description: 'Pledge your old gold/diamond jewellery and get up to ₹10 Lakhs at just 5% p.a. Combo loan option available plus takeover of existing high-interest gold loans.',
    interestRate: '5% p.a.',
    maxAmount: '₹10 Lakhs',
    tenure: '',
    features: ['5% p.a. — industry lowest', 'Up to ₹10 Lakhs', 'Combo loan option', 'Existing loan takeover', 'Free doorstep valuation', 'Secure bank-grade lockers'],
    icon: 'fa-solid fa-ring',
  },
  {
    order: 4, type: 'business',
    title: 'Renewable MSME Trade Finance',
    subtitle: 'With insurance coverage',
    description: 'Revolving trade finance facility for MSMEs — up to ₹10 Crore at 7% with comprehensive trade credit insurance coverage. Annual renewable.',
    interestRate: '7%',
    maxAmount: '₹10 Crore',
    tenure: '',
    features: ['Up to ₹10 Crore revolving limit', '7% fixed rate with insurance', 'Annual renewable facility', 'Trade credit insurance included', 'Invoice discounting', 'Export/import finance'],
    icon: 'fa-solid fa-leaf',
    badge: 'Insured',
    badgeColor: 'bg-brand-gold text-brand-white',
  },
  {
    order: 5, type: 'business',
    title: 'Renewable Business Loan',
    description: 'Large-ticket renewable business loan facility for established corporates and high-growth enterprises. Up to ₹50 Crore at 8% with flexible drawdown and annual renewal.',
    interestRate: '8%',
    maxAmount: '₹50 Crore',
    tenure: '',
    features: ['Up to ₹50 Crore', '8% competitive rate', 'Multi-year renewable', 'Flexible drawdown/repayment', 'No end-use restriction', 'Syndication support'],
    icon: 'fa-solid fa-briefcase',
  },
  {
    order: 6, type: 'business',
    title: 'Renewable Overdraft Facilities',
    description: 'Revolving overdraft facility for working capital management — up to ₹20 Crore at 7.5%. Pay interest only on utilized amount.',
    interestRate: '7.5%',
    maxAmount: '₹20 Crore',
    tenure: '',
    features: ['Up to ₹20 Crore OD limit', '7.5% on utilized amount only', 'Annual renewable', 'Interest only on usage', 'Digital real-time monitoring', 'Auto-renewal on performance'],
    icon: 'fa-solid fa-piggy-bank',
  },
  {
    order: 7, type: 'business',
    title: 'All kinds of NPA Takeovers',
    subtitle: '(Combo loans only)',
    description: 'Specialized NPA/stressed asset takeover program — up to ₹5 Crore at 7% exclusively as combo loans. We acquire your existing high-cost debt and restructure at affordable rates.',
    interestRate: '7%',
    maxAmount: '₹5 Crore',
    tenure: '',
    features: ['Up to ₹5 Crore takeover', '7% restructured rate', 'Combo with fresh funding', 'Flexible restructuring', 'Moratorium period available', 'Equity participation optional'],
    icon: 'fa-solid fa-handshake',
  },
  {
    order: 8, type: 'home',
    title: 'Property Purchase / Development Loan',
    subtitle: 'To Builders & Developers',
    description: 'Mega construction finance for reputed builders and developers — up to ₹100 Crore at 9%. Stage-wise disbursement linked to RERA-approved project milestones.',
    interestRate: '9%',
    maxAmount: '₹100 Crore',
    tenure: '',
    features: ['Up to ₹100 Crore', '9% competitive rate', 'Construction-linked disbursement', 'RERA-compliant escrow', 'Land + construction funding', 'Working capital carve-out'],
    icon: 'fa-solid fa-city',
  },
  {
    order: 9, type: 'vehicle',
    title: 'Automobile Loans',
    description: 'New and pre-owned vehicle financing up to ₹20 Lakhs at 8%. Cars, SUVs, EVs, two-wheelers, and commercial vehicles. Zero down payment options.',
    interestRate: '8%',
    maxAmount: '₹20 Lakhs',
    tenure: '',
    features: ['Up to ₹20 Lakhs', '8% fixed rate', 'New & used vehicles', 'EVs & commercial vehicles', 'Zero down payment', 'Insurance bundled', '7-year max tenure'],
    icon: 'fa-solid fa-car',
  },
  {
    order: 10, type: 'equipment',
    title: 'Equipment Loans (All Types)',
    description: 'Comprehensive equipment and machinery financing up to ₹10 Crore at 7%. Covers medical equipment, construction machinery, industrial plants, IT hardware, and renewable energy assets.',
    interestRate: '7% p.a.',
    maxAmount: '₹10 Crore',
    tenure: '',
    features: ['Up to ₹10 Crore', '7% p.a. rate', 'All equipment types', 'Up to 100% financing', '10-year tenure', 'Tax benefits on depreciation', 'Vendor payment direct'],
    icon: 'fa-solid fa-cog',
  },
  {
    order: 11, type: 'investment',
    title: 'Other Financial Services Available',
    description: 'Barter Finance, Revenue Sharing Loans, Small Term Trade Finance, and Venture Funding — all available under one roof.',
    interestRate: '',
    maxAmount: '',
    tenure: '',
    features: ['Barter Finance', 'Revenue Sharing Loans', 'Small Term Trade Finance', 'Venture Funding'],
    icon: 'fa-solid fa-sack-of-money',
  },
];

async function seed() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onevishwam';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    await FinanceOffering.deleteMany({});
    console.log('Cleared existing finance offerings');

    const created = await FinanceOffering.insertMany(offerings);
    console.log(`Seeded ${created.length} finance offerings successfully`);

    const count = await FinanceOffering.countDocuments();
    console.log(`Total finance offerings in DB: ${count}`);

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
