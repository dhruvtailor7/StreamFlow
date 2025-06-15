const { uploadFileToDrive } = require('../../utils/googleDriveHelper');
const { createLogger } = require('../../utils/logger');
const Recording = require('../../model/Recording');
const fs = require('fs');
const crypto = require('node:crypto');
const logger = createLogger('Uploader');

class UploaderService {
  constructor() {
    this.pendingUploads = [];
    this.lastUploadedId = 0;
    this.batchSize = 10;
    this.maxRuntime = 1000 * 60 * 30; // 30 minutes
    this.lockId = crypto.randomUUID();
    this.maxRetries = 3;
  }

  /**
   * Initialize the uploader service
   */
  async initialize() {
    try {
      this.startTime = new Date();
      await this._processBacklog();
    } catch (error) {
      logger.error(`Failed to initialize uploader service: ${error.message}`);
    }
  }

  /**
   * Process any recordings in the backlog that need uploading
   */
  async _processBacklog() {
    logger.info('Processing backlog of pending uploads...');
    
    do{
      if(new Date() - this.startTime > this.maxRuntime) {
        logger.info('Stopping uploader service due to max runtime of 30 minutes');
        break;
      }

      this.pendingUploads = this._getPendingUploads();

      if(this.pendingUploads.length === 0) {
        logger.info('No pending uploads found in backlog');
        break;
      }

      logger.info(`Found ${this.pendingUploads.length} pending uploads in backlog`);

      for (const recording of this.pendingUploads) {
        try {
          await this._uploadRecording(recording);
          this.lastUploadedId = recording.id;
        } catch (error) {
          logger.error(`Error uploading recording ${recording.id}: ${error.message}`);
          Recording.update(
            {
              upload_status: Recording.UPLOAD_STATUS.FAILED,
              lock_id: null,
              locked_at: null,
              retry_count: recording.retry_count + 1
            }, 
            {
              where: {id: recording.id}
            }
          );
        }
      }
    } while (true);
  }

  _getPendingUploads() {
    return Recording.runInTransaction(() => {
      const rows = Recording.find({
        limit: this.batchSize,
        where: {
          id: { '>': this.lastUploadedId },
          OR: [
            { upload_status: Recording.UPLOAD_STATUS.PENDING },
            // { upload_status: Recording.UPLOAD_STATUS.FAILED, retry_count: { '<=': this.maxRetries } }
          ],
          lock_id: null
        }
      });
    
      if (rows.length === 0) return [];
    
      Recording.update({
        lock_id: this.lockId,
        locked_at: new Date().toISOString()
      }, {
        where: { id: { IN: rows.map(r => r.id) } }
      });
    
      return rows;
    });
  }


  /**
   * Upload a recording to Google Drive
   * @param {Object} recording - Recording object from the database
   */
  async _uploadRecording(recording) {
    try {
      if (!fs.existsSync(recording.filepath)) {
        throw new Error(`File not found: ${recording.filepath}`);
      }
      
      logger.info(`Uploading recording ${recording.id} to Google Drive: ${recording.filepath}`);
      
      const uploadResult = await uploadFileToDrive(recording.filepath, recording.date);
      
      Recording.update({
        upload_status: Recording.UPLOAD_STATUS.UPLOADED,
        drive_file_id: uploadResult.id,
        drive_link: uploadResult.webViewLink,
        uploaded_at: new Date().toISOString(),
        lock_id: null,
        locked_at: null
      }, {
        where: {id: recording.id}
      });
      
      logger.success(`Successfully uploaded recording ${recording.id} to Google Drive`);
    } catch (error) {
      logger.error(`Error uploading recording ${recording.id}: ${error.message}`);
      
      throw error;
    }
  }

  /**
   * Stop the uploader service
   */
  async stop() {
    
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    
    logger.info('Uploader service stopped');
  }
}

module.exports = UploaderService; 