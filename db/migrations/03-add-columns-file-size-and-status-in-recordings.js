/**
 * Add columns filesize and status in recordings
 */

const upQueries = [
  `ALTER TABLE recordings ADD COLUMN filesize INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE recordings ADD COLUMN status INTEGER NOT NULL DEFAULT 0;`
];

const downQueries = [
  `-- SQLite does not support DROP COLUMN directly. Recreate table without the columns`,
  `PRAGMA foreign_keys=off;`,
  `CREATE TABLE recordings_new AS SELECT id, created_at, other_existing_columns FROM recordings;`,
  `DROP TABLE recordings;`,
  `ALTER TABLE recordings_new RENAME TO recordings;`,
  `PRAGMA foreign_keys=on;`
];

module.exports = {
  id: 3,
  name: 'add_filesize_and_status_in_recordings',
  up: upQueries,
  down: downQueries
};
