/**
 * Create recordings table
 */
module.exports = {
  id: 1,
  name: 'create_recordings_table',
  up: [`
    CREATE TABLE recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      date DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      upload_status INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      lock_id TEXT,
      locked_at DATETIME,
      drive_file_id TEXT,
      drive_link TEXT,
      uploaded_at DATETIME
    )
  `],
  down: [
    `DROP TABLE IF EXISTS recordings`
  ]
}; 