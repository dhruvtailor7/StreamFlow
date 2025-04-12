/**
 * Add user_agent column to recordings table
 * This is an example of how to add new columns to existing tables
 */
module.exports = {
  id: 2,
  name: 'add_user_agent',
  sql: `
    ALTER TABLE recordings 
    ADD COLUMN user_agent TEXT;
  `
}; 