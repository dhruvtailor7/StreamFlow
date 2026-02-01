const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Recording = require('../../model/Recording');
const constants = require('../../config/constants');
const { createLogger } = require('../../utils/logger');
// const FileWatcherService = require('../watcher/FileWatcherService');
const MqttService = require('../mqtt/MqttService');
const TailFileService = require('../watcher/TailFileService');

const logger = createLogger('Recorder');

class RecorderService {
  constructor() {
    this.rtspUrl = constants.getRtspUrl();
    this.basePath = constants.recordingsPath;

    this.segmentListFile = path.join(this.basePath, `segment_list.txt`);

    this.ffmpegProcess = null;
    this.isRecording = false;
    this.isStopping = false;
    this.restartAttempts = 0;
    this.lastStartTime = 0;

    this.unwatchSegments = null;
  }

  /**
   * Ensure segment_list.txt exists before using it
   */
  _ensureSegmentListFileExists() {
    try {
      if (!fs.existsSync(this.segmentListFile)) {
        fs.writeFileSync(this.segmentListFile, '', 'utf8');
        logger.info(`Created missing segment list file: ${this.segmentListFile}`);
      }
    } catch (error) {
      logger.error(`Failed to create segment list file: ${error.message}`);
    }
  }

  /**
   * Start recording from RTSP stream
   */
  startRecording() {
    if (this.isRecording) {
      logger.warn('Recording is already in progress');
      return;
    }

    this.isStopping = false;
    this.isRecording = true;

    this._ensureSegmentListFileExists();
    this._startFFmpeg();
    this._watchSegments();

    logger.success('Recording started');
  }

  /**
   * Record clip with synchronized segments
   */
  _startFFmpeg() {
    this.lastStartTime = Date.now();
    const segmentFormat = constants.recordingFormat || 'mkv';
    const segmentDuration = constants.recordingSegmentDurationInSeconds;

    let audioCodec = 'copy';
    if (segmentFormat === 'mp4') audioCodec = 'aac';

    const segmentPattern = path.join(
      this.basePath,
      `segment_%Y-%m-%d_%H-%M-%S.${segmentFormat}`
    );


    const args = [
      // Relaiability and reconnection - RTSP can close incase of network break, this help with maintaining continuity
      '-rtsp_transport', 'tcp',
      '-timeout', '5000000', 
      '-reorder_queue_size', '100',

      // input
      '-i', this.rtspUrl,
      // For clean timestamps
      '-use_wallclock_as_timestamps', '1',

      // Codec
      '-c:v', 'copy',
      '-c:a', audioCodec,

      // Segmentation
      '-f', 'segment',
      '-reset_timestamps', '1',
      '-segment_time', `${segmentDuration}`,
      '-segment_format', `${segmentFormat}`,
      '-segment_atclocktime', '1',
      '-strftime', '1',
      '-segment_list', this.segmentListFile,
      '-segment_list_type', 'flat',

      // Output
      segmentPattern
    ];

    logger.info('Starting FFmpeg...');

    fs.writeFileSync(this.segmentListFile, '', 'utf8');

    this.ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['ignore', 'ignore', 'pipe']
    });

    this.ffmpegProcess.stderr.on('data', (data) => {
      logger.debug(`FFmpeg: ${data.toString().trim()}`);
    });

    this.ffmpegProcess.on('close', (code, signal) => {
      logger.warn(`FFmpeg exited code=${code}, signal=${signal}`);
      this.ffmpegProcess = null;

      const runtime = Date.now() - this.lastStartTime;

      // Reset counter if FFmpeg survived > 30s
      if (runtime > 30000) {
        this.restartAttempts = 0;
      } else {
        this.restartAttempts++;
      }

      if (this.restartAttempts > 5) {
        logger.error('FFmpeg failed repeatedly. Restart aborted.');
        process.exit(code)
        return;
      }

      /**
       * exit code 0 is NOT success for live RTSP
       */
      if (!this.isStopping) {
        logger.info('Restarting FFmpeg in 3 seconds...');
        setTimeout(() => this._startFFmpeg(), 3000);
      }
    });

    this.ffmpegProcess.on('error', (err) => {
      logger.error(`FFmpeg spawn error: ${err.message}`);
      this.ffmpegProcess = null;

      if (!this.isStopping) {
        setTimeout(() => this._startFFmpeg(), 5000);
      }
    });
  }

  /**
   * Process a new segment
   */
  async _processNewSegment(filename) {
    try {
      const dateString = filename.split('_')[1];
      const dayFolderPath = path.join(this.basePath, dateString);

      if (!fs.existsSync(dayFolderPath)) {
        fs.mkdirSync(dayFolderPath, { recursive: true });
      }

      const oldFilePath = path.join(this.basePath, filename);
      const newFilePath = path.join(dayFolderPath, filename);

      fs.renameSync(oldFilePath, newFilePath);

      const { size } = fs.statSync(newFilePath);

      const recordingData = {
        filename: filename,
        filepath: newFilePath,
        filesize: size,
        date: dateString
      };

      const createResult = Recording.create(recordingData);
      const newRecordingId = createResult.lastInsertRowid
      await MqttService.publish(constants.mqttTopics.NEW_RECORDING, {
        recordingId: newRecordingId,
        filepath: recordingData.filepath,
        filesize: recordingData.filesize
      })
      logger.info(`Recording saved (ID=${newRecordingId})`);
    } catch (error) {
      logger.error(`Error processing new segment: ${error.message}`);
    }
  }

  /**
   * Watch the segments
   */
_watchSegments() {
    this.unwatchSegments = TailFileService.watchNewLines(this.segmentListFile, (line) => {
      logger.info('added: ', line)
      this._processNewSegment(line)
    })

    /**
     * Using file watcher is less reliable and also does not work on Android device with FUSE file system.
     * The fs watch does not fire events reliably and also fire the event before the file write is complete
     * even if `awaitFileWrite` flag is passed. So i used tail package to watch new lines in the segments list 
     * file generated by ffmpeg.
     * 
     */
    // this.unwatchSegments = FileWatcherService.watchNewFiles(this.basePath, (filepath) => {
    //   logger.info('added: ', filepath)
    //   this._processNewSegment(filepath)
    // })
  }

  /**
   * Stop the recording process
   */
  stop() {
    logger.info('Stopping recorder gracefully...');
    this.isStopping = true;
    this.isRecording = false;

    if (this.unwatchSegments) {
      this.unwatchSegments();
      this.unwatchSegments = null;
    }

    if (this.ffmpegProcess) {
      // SIGINT allows FFmpeg to close the current segment cleanly
      this.ffmpegProcess.kill('SIGINT');
      this.ffmpegProcess = null;
    }

    logger.info('Recorder stopped');
  }
}

module.exports = RecorderService; 