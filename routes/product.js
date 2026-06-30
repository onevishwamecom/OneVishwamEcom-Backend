const express = require('express');
const modules = require('../modules');

const router = express.Router();

modules.forEach(mod => {
  router.use(`/${mod.id}`, mod.routes);
});

module.exports = router;
