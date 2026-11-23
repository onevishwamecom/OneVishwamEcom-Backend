const fs = require('fs');
const path = require('path');
const swaggerSpec = require('../config/swagger');

const outPath = path.join(__dirname, '../docs/openapi.json');
fs.writeFileSync(outPath, JSON.stringify(swaggerSpec, null, 2), 'utf8');
console.log(`[generateOpenApi] Successfully written OpenAPI spec (${Object.keys(swaggerSpec.paths).length} paths) to ${outPath}`);
