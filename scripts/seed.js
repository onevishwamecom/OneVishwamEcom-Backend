const { execSync } = require('child_process');
const path = require('path');

const scripts = [
  'seedProperties.js',
  'seedVehicles.js',
  'seedAutomobiles.js',
  'seedJewellery.js',
  'seedGarments.js',
  'seedGroceries.js',
  'seedFinance.js',
  'seedFinanceOfferings.js',
];

scripts.forEach(script => {
  console.log(`Running script: ${script}...`);
  try {
    execSync(`node "${path.join(__dirname, script)}"`, { stdio: 'inherit' });
    console.log(`Finished ${script}.\n`);
  } catch (error) {
    console.error(`Failed running ${script}:`, error.message);
  }
});
