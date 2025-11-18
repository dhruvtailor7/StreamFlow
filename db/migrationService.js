const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Migration');

const UP = 'up';
const DOWN = 'down';

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
   * @returns {boolean}
   */
  initMigrationsTable() {
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
   * @returns {number} The last migration ID or 0 if none
   */
  getLastMigrationId() {
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
   * @param {string} type - 'up' or 'down'
   * @returns {boolean}
   */
  applyMigration(migration, type) {
    try {
      const transaction = this.db.transaction(() => {
        if(type === UP) {
          this.applyUpMigration(migration);
        } else if(type === DOWN) {
          this.applyDownMigration(migration);
        } else {
          throw new Error(`Invalid migration type: ${type}`);
        }
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
   * Apply up migration
   * @param {object} migration 
   */
  applyUpMigration(migration) {
    for (const sql of migration.up) {
      this.db.prepare(sql).run();
    }
    
    this.db.prepare(`
      INSERT INTO migrations (id, name, applied_at)
      VALUES (?, ?, ?)
    `).run(migration.id, migration.name, new Date().toISOString());
  }

  /**
   * Apply down migration
   * @param {object} migration 
   */
  applyDownMigration(migration) {
    for (const sql of migration.down) {
      this.db.prepare(sql).run();
    }
    
    this.db.prepare(`
      DELETE FROM migrations WHERE id = ?
    `).run(migration.id);
  }

  /**
   * Run all pending migrations
   * @returns {Promise<void>}
   */
  runMigrations(type = UP) {
    try {
      logger.info('Initializing migration service...');
      this.initMigrationsTable();

      const lastMigrationId = this.getLastMigrationId();
      logger.info(`Last applied migration ID: ${lastMigrationId}`);

      const pendingMigrations = this._loadPendingMigrations(lastMigrationId);
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to apply');
      } else {
        logger.info(`Found ${pendingMigrations.length} pending migrations to apply`);
        
        for (const migration of pendingMigrations) {
          this.applyMigration(migration, type);
        }
        
        logger.success('All migrations applied successfully');
      }
      
      this.close();
      return true;
    } catch (error) {
      logger.error(`Error running migrations: ${error.message}`);
      throw error;
    }
  }

  /**
   * Apply specific migration by ID
   * @param {number} migrationId 
   * @param {string} type 
   * @returns {boolean}
   */
  runMigration(migrationId, type = UP) {
    try {
      logger.info(`Initializing migration service for migration ID ${migrationId}...`);
      this.initMigrationsTable();
      
      const pendingMigrations = this._loadPendingMigrations(0)
        .filter(mig => mig.id === migrationId);

      if (pendingMigrations.length === 0) {
        logger.info(`No migration found with ID ${migrationId}`);
      } else {
        const migration = pendingMigrations[0];
        this.applyMigration(migration, type);
        logger.success(`Migration ${migrationId} applied successfully`);
      }
      
      this.close();
      return true;
    } catch (error) {
      logger.error(`Error running migration ${migrationId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the database connection
   * @returns {Promise<boolean>}
   */
  close() {
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