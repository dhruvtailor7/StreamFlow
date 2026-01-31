const fs = require('node:fs');
const mqttService = require('../mqtt/MqttService');
const filesHelper = require('../../utils/filesHelper');
const constants = require('../../config/constants');
const Recording = require('../../model/Recording');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('Cleanup');

const MAX_SIZE_BYTES =
  Number(constants.maxRecordingsFolderSizeInGB) * 1024 * 1024 * 1024;

const CLIP_DURATION_SEC = constants.recordingSegmentDurationInSeconds;

class CleanUpService {
    constructor() {
        this.currentSizeBytes = 0;
        this.unsubscribe = null;
    }

    async initialize() {
        this.currentSizeBytes = await filesHelper.getFolderSize(constants.recordingsPath);
        console.log("MAX: "+MAX_SIZE_BYTES)
        console.log("maxRecordingsFolderSizeInGB: "+constants.maxRecordingsFolderSizeInGB);
        logger.info(`Initialized cleanup service. Current folder size: ${this.currentSizeBytes} bytes.Max allowed: ${MAX_SIZE_BYTES}`);

        this.unsubscribe = await mqttService.subscribe(
            constants.mqttTopics.NEW_RECORDING,
            this.onNewRecording.bind(this)
        );

        logger.info('Cleanup service inialized');
    }

    async onNewRecording({ filesize }) {
        if (!filesize) {
            logger.debug('Received new recording event without filesize. Skipping.');
            return;
        }

        this.currentSizeBytes += filesize;
        const availableBytes = MAX_SIZE_BYTES - this.currentSizeBytes;
        const nextClipBytes = filesize;

        logger.info(`New recording added: ${filesize} bytes. Available bytes: ${availableBytes}`);

        if (availableBytes < nextClipBytes) {
            logger.info(`Buffer low. Triggering cleanup to free at least ${nextClipBytes} bytes`);
            await this.cleanupUntilSafe(nextClipBytes).catch(err => {
                logger.error('Error during cleanup:', err);
            });
        }
    }

    async cleanupUntilSafe(nextClipBytes) {
        let requiredBytes = nextClipBytes - (MAX_SIZE_BYTES - this.currentSizeBytes);
        if (requiredBytes <= 0) {
            logger.debug('No cleanup required. Buffer is sufficient.');
            return;
        }

        logger.info(`Starting cleanup. Need to free ${requiredBytes} bytes`);

        while (requiredBytes > 0) {
            const estimatedCount = Math.ceil(requiredBytes / nextClipBytes);
            const batchSize = Math.min(estimatedCount, 100);
            logger.debug(`Fetching batch of ${batchSize} oldest recordings for cleanup`);

            const recordings = Recording.runInTransaction(() => {
                const candidates = Recording.find({
                    columns: ['id', 'filepath', 'filesize'],
                    where: { status: Recording.STATUS.ACTIVE },
                    orderBy: [['created_at', 'ASC']],
                    limit: batchSize,
                });

                if (!candidates.length) {
                    logger.debug('No active recordings found for cleanup in this batch');
                    return [];
                }

                const ids = candidates.map(r => r.id);
                Recording.update(
                    { status: Recording.STATUS.DELETING },
                    { where: { id: { IN: ids }, status: Recording.STATUS.ACTIVE } }
                );

                logger.debug(`Claimed ${ids.length} recordings for deletion: ${ids.join(', ')}`);
                return candidates;
            });

            if (!recordings.length) {
                logger.info('No recordings left to clean up. Exiting cleanup loop.');
                break;
            }

            const deletedIds = [];
            let freedBytesInBatch = 0;

            for (const { id, filepath, filesize } of recordings) {
                if (requiredBytes <= 0) break;

                try {
                    await fs.promises.unlink(filepath);
                    deletedIds.push(id);
                    freedBytesInBatch += filesize;
                    requiredBytes -= filesize;
                    this.currentSizeBytes -= filesize;

                    logger.info(`Deleted file ${filepath} (${filesize} bytes). Freed bytes: ${freedBytesInBatch}`);
                } catch (err) {
                    logger.error(`Cleanup delete failed for file: ${filepath}`, err);
                    break;
                }
            }

            if (deletedIds.length > 0) {
                Recording.update(
                    { status: Recording.STATUS.DELETED },
                    { where: { id: { IN: deletedIds } } }
                );
                logger.debug(`Updated status to DELETED for recordings: ${deletedIds.join(', ')}`);
            }

            if (freedBytesInBatch === 0) {
                logger.info('No files were deleted in this batch. Stopping cleanup loop.');
                break;
            }
        }

        logger.info('Cleanup completed');
    }

    async stop() {
        if (this.unsubscribe) {
            await this.unsubscribe();
        }
        logger.info('Cleanup service stopped');
    }
}

module.exports = CleanUpService;
