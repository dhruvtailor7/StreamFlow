const DatabaseService = require('../services/database/DatabaseService');
const { createLogger } = require('../utils/logger');

class Model {
  static tableName;
  static _logger;

  static get logger() {
    if (!this._logger) {
      this._logger = createLogger(this.name);
    }
    return this._logger;
  }

  static create(data) {
    this.addDefaultValuesIfNotExists(data);

    try {
      const db = DatabaseService.getDbConnection();
      const columns = Object.keys(data);
      const values = Object.values(data);
      const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${values.map(() => '?').join(', ')})`;
      const stmt = db.prepare(query);
      const result = stmt.run(values);
      return result;
    } catch (error) {
      this.logger.error(`Error creating record: ${error.message}`);
      throw error;
    }
  }

  static find(id, columns = '*') {
    try {
      const db = DatabaseService.getDbConnection();
      const stmt = db.prepare(`SELECT ${columns} FROM ${this.tableName} WHERE id = ?`);
      const result = stmt.get(id);
      return result;
    } catch (error) {
      this.logger.error(`Error finding record: ${error.message}`);
      throw error;
    }
  }

  static addDefaultValuesIfNotExists(data) {
    if(!data.created_at) {
      data.created_at = new Date().toISOString();
    }
  }
}

module.exports = Model;