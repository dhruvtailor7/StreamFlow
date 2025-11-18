/**
 * Add column next retry at in recordings
 */

const addColumnQuery = `ALTER TABLE recordings 
    ADD COLUMN next_retry_at DATETIME DEFAULT NULL;`;
const dropColumnQuery = `ALTER TABLE recordings 
    DROP COLUMN next_retry_at;`;

const createIndexQuery1 = `CREATE INDEX idx_recordings_lock_id
    ON recordings (lock_id);`; 

const dropIndexQuery1 = `DROP INDEX IF EXISTS idx_recordings_lock_id;`;

const createIndexQuery2 = `CREATE INDEX idx_recordings_upload_status_retry_count_next_retry_at
    ON recordings (upload_status, retry_count, next_retry_at);`;
    
const dropIndexQuery2 = `DROP INDEX IF EXISTS idx_recordings_upload_status_retry_count_next_retry_at;`;

module.exports = {
  id: 2,
  name: 'add_next_retry_at_in_recordings',
  up: [addColumnQuery, createIndexQuery1, createIndexQuery2],
  down: [dropIndexQuery2, dropIndexQuery1, dropColumnQuery]
}; 