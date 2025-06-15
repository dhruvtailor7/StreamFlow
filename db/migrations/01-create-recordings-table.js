/**
 * Create recordings table
 */
module.exports = {
  id: 1,
  name: 'create_recordings_table',
  sql: `
    CREATE TABLE recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      date DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      uploaded INTEGER DEFAULT 0,
      uploaded_at DATETIME,
      drive_file_id TEXT,
      drive_link TEXT
    )
  `
}; 