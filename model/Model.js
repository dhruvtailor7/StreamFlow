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

  static _dbContext = null;

  static setDbContext(db) {
    this._dbContext = db;
  }

  static clearDbContext() {
    this._dbContext = null;
  }

  static get db() {
    return this._dbContext || DatabaseService.getDbConnection();
  }

  static runInTransaction(callback) {
    const db = DatabaseService.getDbConnection();
  
    return db.transaction(() => {
      this.setDbContext(db);
      try {
        return callback();
      } finally {
        this.clearDbContext();
      }
    })();
  }

  static create(data) {
    this.addDefaultValuesIfNotExists(data);

    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${values.map(() => '?').join(', ')})`;
      this.logger.debug(`query: ${query}`);
      const stmt = this.db.prepare(query);
      const result = stmt.run(values);
      return result;
    } catch (error) {
      this.logger.error(`Error creating record: ${error.message}`);
      throw error;
    }
  }

  static find({columns = '*', limit, offset, where = {}, orderBy = []}) {
    try {
      let query = `SELECT ${columns} FROM ${this.tableName}`;
      const whereData = this.prepareWhereClause(where);
      if(whereData.clause) {
        query += ` WHERE ${whereData.clause}`;
      }

      query += this.prepareOrderBy(orderBy);

      if(limit) {
        query += ` LIMIT ${limit}`;
      }

      if(offset) {
        query += ` OFFSET ${offset}`;
      }
      this.logger.debug(`query: ${query}`);
      const stmt = this.db.prepare(query);
      const result = stmt.all(whereData.values);
      return result;
    } catch (error) {
      this.logger.error(`Error finding record: ${error.message}`);
      throw error;
    }
  }

  static update(data = {}, {where = {}} = {}) {
    if(Object.keys(data).length === 0) {
      throw new Error('data is required for update');
    }

    let query = `UPDATE ${this.tableName} SET ${Object.keys(data).map(key => `${key} = ?`).join(', ')}`;
    const whereData = this.prepareWhereClause(where);
    if(whereData.clause) {
      query += ` WHERE ${whereData.clause}`;
    }
    this.logger.debug(`query: ${query}`);
    const stmt = this.db.prepare(query);
    const result = stmt.run(Object.values(data).concat(whereData.values));
    return result;
  }

  static addDefaultValuesIfNotExists(data) {
    if(!data.created_at) {
      data.created_at = new Date().toUTCString();
    }
  }

  static prepareWhereClause(where) {
    const conditions = [];
    const values = [];
    for(const key in where) {
      if(key === 'AND' || key === 'OR') {
        const nestedConditions = this.buildNestedConditions(where[key], key);
        conditions.push(nestedConditions.clause);
        values.push(...nestedConditions.values);
      } else {
        const pcResponse = this.prepareCondition(key, where[key]);
        conditions.push(pcResponse.clause);
        if(pcResponse.value !== null) {
          if(Array.isArray(pcResponse.value)) {
            values.push(...pcResponse.value);
          } else {
            values.push(pcResponse.value);
          }
        }
      }
    }
    return { clause: `(${conditions.join(' AND ')})`, values };
  }

  static buildNestedConditions(where, key) {
    const conditions = [];
    const values = [];

    for(const condition of where) {
      const nestedConditions = this.prepareWhereClause(condition);
      conditions.push(nestedConditions.clause);
      values.push(...nestedConditions.values);
    }
    
    return { clause: `(${conditions.join(` ${key} `)})`, values };
  }

  static prepareCondition(key, value) {
    if(value === null) {
      return { clause: `${key} IS NULL`, value: null };
    } else if(typeof value === 'object') {
      const op = Object.keys(value)[0];
      const opValue = value[op];
      if(op === 'IN' || op === 'NOT IN') {
        return { clause: `${key} ${op} (${opValue.map(() => '?').join(', ')})`, value: opValue };
      } else {
        return { clause: `${key} ${op} ?`, value: opValue };
      }
    } else {
      return { clause: `${key} = ?`, value };
    }
  }

  static prepareOrderBy(orderBy = []) {
    if (!Array.isArray(orderBy) || orderBy.length === 0) {
      return '';
    }

    const directions = ['ASC', 'DESC'];

    const clauses = orderBy
      .filter(([_, direction]) =>
        directions.includes(direction.toUpperCase())
      )
      .map(([column, direction]) =>
        `${column} ${direction.toUpperCase()}`
      );

    return clauses.length ? ` ORDER BY ${clauses.join(', ')}` : '';
  }

}

module.exports = Model;
