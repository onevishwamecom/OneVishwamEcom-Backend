const createCRUDController = require('../baseController');
const beddingService = require('./beddingService');

module.exports = createCRUDController(beddingService);
