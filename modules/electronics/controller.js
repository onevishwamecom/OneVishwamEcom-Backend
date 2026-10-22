const createCRUDController = require('../baseController');
const electronicService = require('./electronicService');

module.exports = createCRUDController(electronicService);
