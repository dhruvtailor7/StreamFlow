const { createLogger } = require('../../utils/logger');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const logger = createLogger('Database');

class DatabaseService {
  static instance = null;
  constructor() {
    if (DatabaseService.instance) {
      return DatabaseService.instance;
    }
    
    this.db = null;

    DatabaseService.instance = this;
  }

  connect() {
    try {
      const dbDir = path.join(__dirname, '../../db');
      const dbPath = path.join(dbDir, 'recordings.db');

      logger.info(`Connecting to database at ${dbPath}`);

      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new Database(dbPath, { 
        fileMustExist: false
      });
      
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      
      logger.success('Database connected successfully');
    } catch (error) {
      logger.error(`Failed to connect to database: ${error.message}`);
      throw error;
    }
  }

  getDbConnection() {
    if(!this.db) {
      this.connect();
    }

    return this.db;
  }

  disconnect() {
    logger.info('Closing database connections...');
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    logger.success('Database closed successfully');
  }
}

module.exports = new DatabaseService();