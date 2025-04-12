const { markAsUploaded, getPendingUploads, getRecordingById } = require('../../db/database');
const mqttController = require('../../mqtt/mqttController');
const { uploadFileToDrive } = require('../../utils/driveUpload');
const { createLogger } = require('../../utils/logger');
const fs = require('fs');

const logger = createLogger('Uploader');

class UploaderService {
  constructor() {
    this.isRunning = false;
    this.retryInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.retryTimer = null;
    // Store topics for easy access
    this.topics = mqttController.getTopics();
  }

  /**
   * Initialize the uploader service
   */
  async initialize() {
    try {
      
      await mqttController.subscribe(this.topics.NEW_RECORDING, (recordingData) => {
        this._handleNewRecording(recordingData);
      });
      
      logger.info('Uploader service initialized successfully');
      
      this._processBacklog();
      
      this.retryTimer = setInterval(() => {
        this._processBacklog();
      }, this.retryInterval);
      
      this.isRunning = true;
      return true;
    } catch (error) {
      logger.error(`Failed to initialize uploader service: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle a new recording notification
   * @param {Object} recordingData - Data about the new recording
   */
  async _handleNewRecording(recordingData) {
    logger.info(`Received new recording notification for file id: ${recordingData.id}`);
      
    try {
      const recording = await getRecordingById(recordingData.id);

      await this._uploadRecording(recording);
    } catch (error) {
      logger.error(`Error uploading recording ${recordingData.id}: ${error.message}`);
    }
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
      
      await markAsUploaded(
        recording.id,
        uploadResult.id,
        uploadResult.webViewLink
      );
      
      await mqttController.publish(this.topics.UPLOAD_SUCCESS, {
        recordingId: recording.id,
        driveFileId: uploadResult.id,
        driveLink: uploadResult.webViewLink
      });
      
      logger.success(`Successfully uploaded recording ${recording.id} to Google Drive`);
    } catch (error) {
      logger.error(`Error uploading recording ${recording.id}: ${error.message}`);
      
      await mqttController.publish(this.topics.UPLOAD_ERROR, {
        recordingId: recording.id,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Process any recordings in the backlog that need uploading
   */
  async _processBacklog() {
    try {
      logger.info('Processing backlog of pending uploads...');
      
      const pendingUploads = await getPendingUploads();
      
      if (pendingUploads.length === 0) {
        logger.info('No pending uploads found in backlog');
        return;
      }
      
      logger.info(`Found ${pendingUploads.length} pending uploads in backlog`);
      
      for (const recording of pendingUploads) {
        try {
          await this._uploadRecording({
            id: recording.id,
            filename: recording.filename,
            filepath: recording.filepath,
            date: recording.date,
          });
        } catch (error) {
          logger.error(`Error processing backlog upload for recording ${recording.id}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error processing backlog: ${error.message}`);
    }
  }

  /**
   * Stop the uploader service
   */
  async stop() {
    this.isRunning = false;
    
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    
    logger.info('Uploader service stopped');
  }
}

module.exports = UploaderService; 