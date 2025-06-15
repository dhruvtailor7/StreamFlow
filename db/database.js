const { createLogger } = require('../utils/logger');

const logger = createLogger('Database');


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


module.exports = {
  getRecordingById,
  getPendingUploads,
  markAsUploaded,
}; 