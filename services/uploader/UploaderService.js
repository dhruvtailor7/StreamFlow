const { createLogger } = require('../../utils/logger');
const Recording = require('../../model/Recording');
const uploadHelper = require('./uploadHelper')
const mqtt = require('../mqtt/MqttService')

const crypto = require('node:crypto');
const { mqttTopics } = require('../../config/constants');
const logger = createLogger('UploaderService');

class UploaderService {
  constructor() {
    this.processSingle = this.processSingle.bind(this)
    this.unsubscribe = null;
  }

  async initialize() {
    this.unsubscribe = await mqtt.subscribe(mqttTopics.NEW_RECORDING, this.processSingle)
  }

  _getLockId() {
    return crypto.randomUUID()
  }

  /**
   * Process a single recording (MQTT)
   */
  async processSingle({recordingId}) {
    logger.info(`Processing single recording ${recordingId}`);    

    const recording = await Recording.runInTransaction(() => {
      const recordings = Recording.find({
        where: { id: recordingId, lock_id: null }
      });

      if (recordings.length == 0) {
        logger.warn(`Recording ${recordingId} not found or locked.`);
        return;
      }

      const record = recordings[0]

      Recording.update(
        { lock_id: this._getLockId(), locked_at: (new Date()).toUTCString() },
        { where: { id: record.id, lock_id: null } }
      );

      return record
    })

    await uploadHelper.uploadInSafeBlock(recording);
  }

  async stop() {
    if(this.unsubscribe) {
      await this.unsubscribe();
    }
  }
}

module.exports = UploaderService;
