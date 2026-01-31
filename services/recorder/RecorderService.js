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
    this.outputDir = null;
    this.isRecording = false;
    this.ffmpegCommand = null;
    this.unwatchSegments = null;

    this.segmentListFile = path.join(this.basePath, `segment_list.txt`);
  }

  /**
   * Ensure segment_list.txt exists before using it
   */
  _ensureSegmentListFileExists() {
    try {
      // Check if the file exists
      if (!fs.existsSync(this.segmentListFile)) {
        // Create the file if it doesn't exist
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

    try {
      this.isRecording = true;
      this._ensureSegmentListFileExists();
      this._recordClip();
      this._watchSegments();
      logger.success('Recording started successfully');
    } catch (error) {
      this.isRecording = false;
      this.stop();
      logger.error(`Failed to start recording: ${error.message}`);
      throw error
    }
  }

  /**
   * Record clip with synchronized segments
   */
  _recordClip() {
    const startTime = new Date();
    
    logger.info(`Starting recording at ${startTime.toUTCString()}`);

    const segmentFormat = constants.recordingFormat || 'mkv'

    let audioCodec = 'copy'
    if(segmentFormat == 'mp4') {
      audioCodec = 'aac'
    }
    
    const segmentPattern = path.join(this.basePath, `segment_%Y-%m-%d_%H-%M-%S.${segmentFormat}`);
    const segmentDuration = constants.recordingSegmentDurationInSeconds;

    const args = [
      '-rtsp_transport', 'tcp',
      '-i', this.rtspUrl,
      '-use_wallclock_as_timestamps', '1',
      '-c:v', 'copy', '-c:a', audioCodec,
      '-f', 'segment',
      '-reset_timestamps', '1',
      `-segment_time`, `${segmentDuration}`,
      `-segment_format`, `${segmentFormat}`,
      '-segment_atclocktime', '1',
      '-strftime', '1',
      `-segment_list`, this.segmentListFile, // If you need to track the segment list
      '-segment_list_type', 'flat',
      segmentPattern
    ];

    this.ffmpegProcess = spawn('ffmpeg', args);

    // Log the FFmpeg output
    this.ffmpegProcess.stdout.on('data', (data) => {
      logger.info(`FFmpeg stdout: ${data}`);
    });

    this.ffmpegProcess.stderr.on('data', (data) => {
      logger.debug(`FFmpeg stderr: ${data}`);
    });

    this.ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        logger.info('FFmpeg process finished successfully');
      } else {
        logger.error(`FFmpeg process exited with code ${code}`);
      }
      
      this.isRecording = false;
    });

    this.ffmpegProcess.on('error', (err) => {
      logger.error(`FFmpeg process failed to start: ${err.message}`);
      this.isRecording = false;
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
      logger.info(`Recording data saved to database with ID: ${newRecordingId}`);
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
    if (this.ffmpegCommand) {
      logger.info("stopping ffmpeg")
      this.ffmpegProcess.kill('SIGINT');
      this.ffmpegCommand = null;
    }
    
    if (this.unwatchSegments) {
      logger.info("unwatching new segments")
      this.unwatchSegments()
    }
    
    this.isRecording = false;
    logger.info('Recorder service stopped');
  }
}

module.exports = RecorderService; 