const Model = require('./Model');

class Recording extends Model {
  static tableName = 'recordings';

  static UPLOAD_STATUS = {
    PENDING: 0,
    UPLOADED: 1,
    FAILED: 2
  }

  static STATUS = {
    ACTIVE: 0,
    DELETING: 1,
    DELETED: 2
  }

}

module.exports = Recording;