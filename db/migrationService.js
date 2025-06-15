const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Migration');

class MigrationService {
  constructor() {
    this.dbDir = path.join(__dirname);
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }
    
    this.dbPath = path.join(this.dbDir, 'recordings.db');
    this.db = new Database(this.dbPath, { 
      fileMustExist: false 
    });
    
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Load migrations from the migrations directory
   * @returns {Array} Array of migration objects
   */
  _loadPendingMigrations(lastMigrationId) {
    try {
      const migrationsDir = path.join(__dirname, 'migrations');
      
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
        logger.info(`Created migrations directory at ${migrationsDir}`);
        return [];
      }
      
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'))
        .filter(file => parseInt(file.split('-')[0]) > lastMigrationId)
      
      logger.info(`Found ${migrationFiles.length} pending migration files`);
      
      const migrations = migrationFiles.map(file => {
        const migrationPath = path.join(migrationsDir, file);
        return require(migrationPath);
      });
      
      migrations.sort((a, b) => a.id - b.id);
      
      return migrations;
    } catch (error) {
      logger.error(`Error loading migrations: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize the migrations table
   * @returns {Promise<void>}
   */
  async initMigrationsTable() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        )
      `).run();
      return true;
    } catch (error) {
      logger.error(`Error initializing migrations table: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the last applied migration ID
   * @returns {Promise<number>} The last migration ID or 0 if none
   */
  async getLastMigrationId() {
    try {
      const stmt = this.db.prepare(`
        SELECT id FROM migrations
        ORDER BY id DESC
        LIMIT 1
      `);
      
      const row = stmt.get();
      return row ? row.id : 0;
    } catch (error) {
      logger.error(`Error getting last migration ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Apply a migration
   * @param {Object} migration - The migration to apply
   * @returns {Promise<void>}
   */
  async applyMigration(migration) {
    try {
      const transaction = this.db.transaction(() => {
        this.db.exec(migration.sql);
        
        this.db.prepare(`
          INSERT INTO migrations (id, name, applied_at)
          VALUES (?, ?, datetime('now'))
        `).run(migration.id, migration.name);
      });
      
      transaction();
      
      logger.success(`Applied migration ${migration.id}: ${migration.name}`);
      return true;
    } catch (error) {
      logger.error(`Error applying migration ${migration.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   * @returns {Promise<void>}
   */
  async runMigrations() {
    try {
      logger.info('Initializing migration service...');
      
      await this.initMigrationsTable();

      const lastMigrationId = await this.getLastMigrationId();
      logger.info(`Last applied migration ID: ${lastMigrationId}`);

      const pendingMigrations = this._loadPendingMigrations(lastMigrationId);
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to apply');
      } else {
        logger.info(`Found ${pendingMigrations.length} pending migrations to apply`);
        
        for (const migration of pendingMigrations) {
          await this.applyMigration(migration);
        }
        
        logger.success('All migrations applied successfully');
      }
      
      await this.close();
      return true;
    } catch (error) {
      logger.error(`Error running migrations: ${error.message}`);
      throw error;
    }
  }

  /**
   * TODO: Add Suppoet for Up and Down for specific version
   */

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    try {
      this.db.close();
      logger.info('Migration service database connection closed');
      return true;
    } catch (error) {
      logger.error(`Error closing migration database: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new MigrationService();