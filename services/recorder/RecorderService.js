const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const Recording = require('../../model/Recording');
const constants = require('../../config/constants');
const { createLogger } = require('../../utils/logger');
const FileWatcherService = require('../watcher/FileWatcherService');
const MqttService = require('../mqtt/MqttService');

const logger = createLogger('Recorder');

const rootPrefix = '../..'

class RecorderService {
  constructor() {
    this.rtspUrl = constants.getRtspUrl();
    this.basePath = path.join(__dirname, `${rootPrefix}/${constants.recordingsFolder}`);
    this.outputDir = null;
    this.isRecording = false;
    this.ffmpegCommand = null;
    this.unwatchSegments = null;
  }

  /**
   * Start recording from RTSP stream
   */
  startRecording() {
    if (this.isRecording) {
      logger.warn('Recording is already in progress');
      return;
    }

    try {
      this.isRecording = true;
      this._recordClip();
      logger.success('Recording started successfully');
    } catch (error) {
      this.isRecording = false;
      logger.error(`Failed to start recording: ${error.message}`);
    }
  }

  /**
   * Record clip with synchronized segments
   */
  _recordClip() {
    const startTime = new Date();
    
    logger.info(`Starting recording at ${startTime.toUTCString()}`);

    const segmentFormat = 'mkv'
    
    const segmentPattern = path.join(this.basePath, `segment_%Y-%m-%d_%H-%M-%S.${segmentFormat}`);
    const segmentDuration = constants.recordingSegmentDurationInSeconds;
    
    this.ffmpegCommand = ffmpeg(this.rtspUrl)
      .inputOptions([
        '-rtsp_transport tcp',
      ])
      .outputOptions([
        '-use_wallclock_as_timestamps 1',
        '-c:v copy',
        '-c:a copy',
        '-f segment',
        '-reset_timestamps 1',
        `-segment_time ${segmentDuration}`,
        `-segment_format ${segmentFormat}`,
        '-segment_atclocktime 1',
        '-strftime 1',
      ])
      .on('start', (commandLine) => {
        logger.info(`Spawned FFmpeg with command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        logger.debug(`Processing: ${JSON.stringify(progress)}% done`);
      })
      .on('end', async () => {
        logger.success('Recording session finished');
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(`Error during recording: ${err.message}`);
        logger.error('FFmpeg stdout:', stdout);
        logger.error('FFmpeg stderr:', stderr);
      })
      .output(segmentPattern);

    this.ffmpegCommand.run();

    this._watchSegments();
  }

  /**
   * Process a new segment
   */
  async _processNewSegment(filepath) {
    try {
      const filename = path.basename(filepath);
      const dateString = filename.split('_')[1];
      const dayFolderPath = path.join(this.basePath, dateString);

      if (!fs.existsSync(dayFolderPath)) {
        fs.mkdirSync(dayFolderPath, { recursive: true });
      }

      const oldFilePath = path.join(this.basePath, filename);
      const newFilePath = path.join(dayFolderPath, filename);

      fs.renameSync(oldFilePath, newFilePath);

      const recordingData = {
        filename: filename,
        filepath: newFilePath,
        date: dateString
      };

      const createResult = Recording.create(recordingData);
      const newRecordingId = createResult.lastInsertRowid
      await MqttService.publish(constants.mqttTopics.NEW_RECORDING, {recordingId: newRecordingId})
      logger.info(`Recording data saved to database with ID: ${newRecordingId}`);
    } catch (error) {
      logger.error(`Error processing new segment: ${error.message}`);
    }
  }

  /**
   * Watch the segments
   */
  _watchSegments() {
    this.unwatchSegments = FileWatcherService.watchNewFiles(this.basePath, (filepath) => {
      logger.info('added: ', filepath)
      this._processNewSegment(filepath)
    })
  }

  /**
   * Stop the recording process
   */
  stop() {
    if (this.ffmpegCommand) {
      this.ffmpegCommand.kill('SIGTERM');
      this.ffmpegCommand = null;
    }
    
    if (this.unwatchSegments) {
      this.unwatchSegments()
    }
    
    this.isRecording = false;
    logger.info('Recorder service stopped');
  }
}

module.exports = RecorderService; 