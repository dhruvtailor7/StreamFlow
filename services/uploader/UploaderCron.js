const Recording = require('../../model/Recording');
const crypto = require('node:crypto');
const { createLogger } = require('../../utils/logger');
const uploadHelper = require('./uploadHelper');

const logger = createLogger('UploaderCron');

class UploaderCron {
   constructor() {
    this.batchSize = 10;
    this.maxRetries = 3;
    this.maxRuntime = 1000 * 60 * 30; // 30 min
    this.lockId = crypto.randomUUID();
   }

   /**
   * Process full backlog (cron)
   */
  async processBacklog() {
    logger.info('Starting batch upload process...');
    const startTime = Date.now();

    while (true) {
      if (Date.now() - startTime > this.maxRuntime) {
        logger.info('Stopping batch upload – hit max runtime.');
        break;
      }

      const pending = await this._getPendingUploads();
      if (!pending.length) {
        logger.info('No more pending uploads.');
        break;
      }

      logger.info(`Processing batch of ${pending.length} items...`);

      for (const recording of pending) {
        await uploadHelper.uploadInSafeBlock(recording);
      }
    }
  }

    /**
   * Fetch unlocked pending/failed rows for batch
   */
    async _getPendingUploads() {
        return Recording.runInTransaction(() => {
            const rows = Recording.find({
              limit: this.batchSize,
              where: {
                  OR: [
                  { upload_status: Recording.UPLOAD_STATUS.PENDING },
                  { 
                      upload_status: Recording.UPLOAD_STATUS.FAILED, 
                      retry_count: { '<': this.maxRetries }, 
                      next_retry_at: {'<=': new Date().toUTCString()} 
                  }
                  ],
                  lock_id: null
              }
            });

            if (!rows.length) return [];

            // lock them
            Recording.update(
              {
                  lock_id: this.lockId,
                  locked_at: new Date().toUTCString(),
              },
              { where: { id: { IN: rows.map(r => r.id) } } }
            );

            return rows;
        });
    }
}

module.exports = UploaderCron