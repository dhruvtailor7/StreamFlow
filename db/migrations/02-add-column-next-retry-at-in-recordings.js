/**
 * Add column next retry at in recordings
 */
module.exports = {
  id: 2,
  name: 'add_next_retry_at_in_recordings',
  sql: `
    ALTER TABLE recordings 
        ADD COLUMN next_retry_at DATETIME DEFAULT NULL;
  `
}; 