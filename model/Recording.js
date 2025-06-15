const Model = require('./Model');

class Recording extends Model {
  static tableName = 'recordings';
}

module.exports = Recording;