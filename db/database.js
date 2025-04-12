const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const migrationService = require('./migrationService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Database');

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'recordings.db');
const db = new Database(dbPath, { 
  fileMustExist: false
});

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

async function initDb() {
  try {
    await migrationService.runMigrations();
    logger.success('Database initialized successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to initialize database: ${error.message}`);
    throw error;
  }
}

function addRecording(filename, filepath, date) {
  try {
    const stmt = db.prepare(`
      INSERT INTO recordings (filename, filepath, date, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    
    const result = stmt.run(filename, filepath, date);
    
    logger.success(`Added recording to database with ID: ${result.lastInsertRowid}`);
    return {
      id: result.lastInsertRowid,
      filename,
      filepath,
      date,
    };
  } catch (error) {
    logger.error(`Error adding recording to database: ${error.message}`);
    throw error;
  }
}

function getRecordingById(id) {
  try {
    const stmt = db.prepare(`
      SELECT id, filepath FROM recordings WHERE id = ?
    `);
    const row = stmt.get(id);
    return row;
  } catch (error) {
    logger.error(`Error getting recording by ID: ${error.message}`);
    throw error;
  }
}

function getPendingUploads() {
  try {
    const stmt = db.prepare(`
      SELECT * FROM recordings
      WHERE uploaded = 0
      ORDER BY created_at ASC
    `);
    
    const rows = stmt.all();
    logger.info(`Found ${rows.length} pending uploads`);
    return rows;
  } catch (error) {
    logger.error(`Error getting pending uploads: ${error.message}`);
    throw error;
  }
}

function markAsUploaded(id, driveFileId, driveLink) {
  try {
    const stmt = db.prepare(`
      UPDATE recordings
      SET uploaded = 1, uploaded_at = datetime('now'), drive_file_id = ?, drive_link = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(driveFileId, driveLink, id);
    logger.success(`Marked recording ${id} as uploaded (changes: ${result.changes})`);
    return {
      id,
      changes: result.changes
    };
  } catch (error) {
    logger.error(`Error marking recording ${id} as uploaded: ${error.message}`);
    throw error;
  }
}

async function closeDb() {
  try {
    await migrationService.close();
    
    db.close();
    logger.info('Main database connection closed');
    return true;
  } catch (error) {
    logger.error(`Error during database closure: ${error.message}`);
    throw error;
  }
}

module.exports = {
  initDb,
  addRecording,
  getRecordingById,
  getPendingUploads,
  markAsUploaded,
  closeDb
}; 