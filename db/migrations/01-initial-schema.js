/**
 * Initial schema migration
 */
module.exports = {
  id: 1,
  name: 'initial_schema',
  sql: `
    CREATE TABLE IF NOT EXISTS recordings (
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