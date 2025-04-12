const { initDb, closeDb } = require('./database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Database');

class DbController {
  constructor() {
    if (DbController.instance) {
      return DbController.instance;
    }
    
    this.isInitialized = false;
    this.initPromise = null;
    DbController.instance = this;
  }
    
  async init() {
    if (this.isInitialized) {
      return Promise.resolve();
    }
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
    logger.info('Starting database initialization...');
    this.initPromise = initDb().then(() => {
      logger.success('Database controller initialization complete');
      this.isInitialized = true;
      return true;
    }).catch(err => {
      logger.error(`Database controller initialization failed: ${err.message}`);
      this.initPromise = null;
      throw err;
    });
    
    return this.initPromise;
  }
  

  async close() {
    if (this.isInitialized) {
      logger.info('Closing database connections...');
      this.isInitialized = false;
      this.initPromise = null;
      return closeDb().then(() => {
        logger.success('Database controller closed successfully');
        return true;
      }).catch(err => {
        logger.error(`Error closing database: ${err.message}`);
        throw err;
      });
    }
    return Promise.resolve();
  }
}

module.exports = new DbController(); 