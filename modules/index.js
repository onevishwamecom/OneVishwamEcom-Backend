const modules = [
  { id: 'properties', model: require('./properties/model'), routes: require('./properties/routes') },
  { id: 'vehicles', model: require('./vehicles/model'), routes: require('./vehicles/routes') },
  { id: 'groceries', model: require('./groceries/model'), routes: require('./groceries/routes') },
  { id: 'garments', model: require('./garments/model'), routes: require('./garments/routes') },
  { id: 'jewellery', model: require('./jewellery/model'), routes: require('./jewellery/routes') },
  { id: 'finance', model: require('./finance/model'), routes: require('./finance/routes') },
  { id: 'finance-offerings', model: require('./financeOfferings/model'), routes: require('./financeOfferings/routes') },
];

module.exports = modules;
