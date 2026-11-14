const fs = require('fs');
const path = require('path');
const createCRUDController = require('./baseController');

/**
 * Master Sector Registry
 * Auto-discovers and loads all sector domain modules in `modules/` at startup.
 *
 * Exported Structure:
 * {
 *   groceries: { id: 'groceries', model, config, service, routes, controller },
 *   properties: { id: 'properties', model, config, service, routes, controller },
 *   ...
 * }
 */
const registry = {};

// Skip internal / non-sector directories
const EXCLUDE_DIRS = new Set(['node_modules']);

const entries = fs.readdirSync(__dirname, { withFileTypes: true });

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const dirName = entry.name;
  if (EXCLUDE_DIRS.has(dirName)) continue;

  const dirPath = path.join(__dirname, dirName);
  const modelPath = path.join(dirPath, 'model.js');

  // A directory is a domain module if it defines a Mongoose model
  if (!fs.existsSync(modelPath)) continue;

  let model;
  try {
    model = require(modelPath);
  } catch (err) {
    console.error(`[MODULES] Failed to load model for '${dirName}':`, err.message);
    continue;
  }

  // Load config.js if present, or generate sensible defaults
  const configPath = path.join(dirPath, 'config.js');
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = require(configPath);
    } catch (err) {
      console.warn(`[MODULES] Failed to load config for '${dirName}':`, err.message);
    }
  }

  // Determine canonical module ID / slug (kebab-case or dirName)
  const id = config.slug || (dirName === 'financeOfferings' ? 'finance-offerings' : dirName);

  // Load service.js if present
  const servicePath = path.join(dirPath, 'service.js');
  let service = {};
  if (fs.existsSync(servicePath)) {
    try {
      service = require(servicePath);
    } catch (err) {
      console.warn(`[MODULES] Failed to load service for '${dirName}':`, err.message);
    }
  }

  // Load or generate controller
  const controllerPath = path.join(dirPath, 'controller.js');
  let controller;
  if (fs.existsSync(controllerPath)) {
    try {
      controller = require(controllerPath);
    } catch (err) {
      console.warn(`[MODULES] Failed to load controller for '${dirName}':`, err.message);
    }
  }

  if (!controller) {
    // Zero-boilerplate fallback for simple sectors: auto-generate BaseController
    controller = createCRUDController({ model, config, service });
  }

  // Load routes.js if present
  const routesPath = path.join(dirPath, 'routes.js');
  let routes = null;
  if (fs.existsSync(routesPath)) {
    try {
      routes = require(routesPath);
    } catch (err) {
      console.warn(`[MODULES] Failed to load routes for '${dirName}':`, err.message);
    }
  }

  registry[id] = {
    id,
    dirName,
    model,
    config,
    service,
    controller,
    routes,
  };
}

// Attach non-enumerable array methods so legacy `modules.forEach(mod => ...)` remains 100% backwards-compatible
Object.defineProperty(registry, 'forEach', {
  value: function (callback) {
    Object.values(this).forEach(callback);
  },
  enumerable: false,
});

Object.defineProperty(registry, 'map', {
  value: function (callback) {
    return Object.values(this).map(callback);
  },
  enumerable: false,
});

Object.defineProperty(registry, 'find', {
  value: function (predicate) {
    return Object.values(this).find(predicate);
  },
  enumerable: false,
});

Object.defineProperty(registry, 'filter', {
  value: function (predicate) {
    return Object.values(this).filter(predicate);
  },
  enumerable: false,
});

Object.defineProperty(registry, Symbol.iterator, {
  value: function* () {
    yield* Object.values(this);
  },
  enumerable: false,
});

module.exports = registry;
