const fs = require('fs');
const Recording = require('../../model/Recording');
const FileNotFoundError = require('../../model/errors/FileNotFound');
const { uploadFileToDrive } = require('../../utils/googleDriveHelper');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('UploaderHelper');

class UploadHelper {
    constructor() {
        this.maxRetries = 3;
    }

    async uploadInSafeBlock(recording) {
        try {
            await this._uploadRecording(recording);
        } catch (err) {
            let retryCount = (recording.retry_count ?? 0) + 1;
            const baseDelayMs = 5 * 60 * 1000;
            const nextRetry = new Date(Date.now() + Math.pow(2, recording.retry_count ?? 0) * baseDelayMs);

            if (err instanceof FileNotFoundError) {
                retryCount = this.maxRetries;
                nextRetry = null;
            }

            logger.error(`Upload failed for ${recording.id}: ${err.message}`);

            Recording.update(
            {
                upload_status: Recording.UPLOAD_STATUS.FAILED,
                retry_count: retryCount,
                lock_id: null,
                locked_at: null,
                next_retry_at: nextRetry.toUTCString(),
            },
            { where: { id: recording.id } }
            );
        }
    }

  /**
   * Actual upload logic
   */
  async _uploadRecording(recording) {
    if (!fs.existsSync(recording.filepath)) {
      throw new FileNotFoundError(`File not found: ${recording.filepath}`);
    }

    logger.info(`Uploading recording ${recording.id}...`);

    const result = await uploadFileToDrive(recording.filepath, recording.date);

    Recording.update({
      upload_status: Recording.UPLOAD_STATUS.UPLOADED,
      drive_file_id: result.id,
      drive_link: result.webViewLink,
      uploaded_at: new Date().toUTCString(),
      lock_id: null,
      locked_at: null,
    }, { where: { id: recording.id } });

    logger.success(`Uploaded recording ${recording.id}`);
  }
}

module.exports = new UploadHelper()