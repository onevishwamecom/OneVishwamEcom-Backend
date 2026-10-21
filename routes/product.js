const express = require('express');
const modules = require('../modules');

const router = express.Router();

modules.forEach(mod => {
  router.use(`/${mod.id}`, mod.routes);
});

router.use('/automobile', require('../modules/vehicles/routes'));
router.use('/automobiles', require('../modules/vehicles/routes'));
router.use('/consumer-electronics', require('../modules/electronics/routes'));
router.use('/consumer_electronics', require('../modules/electronics/routes'));
router.use('/bedding-comfort', require('../modules/bedding/routes'));
router.use('/bedding_comfort', require('../modules/bedding/routes'));

module.exports = router;
