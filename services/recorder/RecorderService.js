const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const Recording = require('../../model/Recording');
const constants = require('../../config/constants');
const { createLogger } = require('../../utils/logger');
const { Tail } = require('tail'); 

const logger = createLogger('Recorder');

class RecorderService {
  constructor() {
    this.rtspUrl = constants.getRtspUrl();
    this.basePath = path.join(__dirname, `../../${constants.recordingsFolder}`);
    this.outputDir = null;
    this.isRecording = false;
    this.ffmpegCommand = null;
    this.segmentTail = null;
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
    
    logger.info(`Starting recording at ${startTime.toISOString()}`);
    
    const segmentListPath = path.join(this.basePath, 'segments.csv');
    const segmentPattern = path.join(this.basePath, 'segment_%Y-%m-%d_%H-%M-%S.mp4');
    const segmentDuration = constants.recordingSegmentDurationInSeconds;
    
    this.ffmpegCommand = ffmpeg(this.rtspUrl)
      .inputOptions([
        '-re',
        '-rtsp_transport tcp',
        '-timeout 5000000'
      ])
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-b:a 128k',
        '-f segment',
        `-segment_time ${segmentDuration}`,
        '-segment_atclocktime 1',
        '-segment_format mp4',
        '-segment_list_size 0',
        '-segment_list_flags +live',
        '-segment_wrap 0',
        '-segment_start_number 0',
        '-reset_timestamps 1',
        '-segment_time_delta 0.1',
        '-avoid_negative_ts 1',
        '-segment_list_type csv',
        '-strftime 1',
        `-segment_list ${segmentListPath}`
      ])
      .on('start', (commandLine) => {
        logger.info(`Spawned FFmpeg with command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        logger.debug(`Processing: ${JSON.stringify(progress)}% done`);
      })
      .on('end', async () => {
        logger.success('Recording session finished');
        
        this._recordClip();
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(`Error during recording: ${err.message}`);
        logger.error('FFmpeg stdout:', stdout);
        logger.error('FFmpeg stderr:', stderr);
        
        setTimeout(() => {
          this._recordClip();
        }, 5000);
      })
      .output(segmentPattern);

    this.ffmpegCommand.run();

    this._watchSegmentList(segmentListPath);
  }

  /**
   * Process a new segment
   */
  _processNewSegment(filename) {
    try {
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
      logger.info(`Recording data saved to database with ID: ${createResult.lastInsertRowid}`);
    } catch (error) {
      logger.error(`Error processing new segment: ${error.message}`);
    }
  }

/**
 * Watch the segment list CSV file for appended lines using tail
 */
_watchSegmentList(segmentListPath) {
  if (!fs.existsSync(segmentListPath)) {
    fs.writeFileSync(segmentListPath, ''); // create the file if it doesn't exist
  }

  const tail = new Tail(segmentListPath, {
    fromBeginning: false,
    follow: true,
    useWatchFile: true
  });

  tail.on('line', (line) => {
    try {
      const [filename] = line.trim().split(',');
      if (filename) {
        this._processNewSegment(filename);
      }
    } catch (err) {
      logger.error(`Error processing tailed line: ${err.message}`);
    }
  });

  tail.on('error', (error) => {
    logger.error(`Tail error: ${error.message}`);
  });

  this.segmentTail = tail;
}

  /**
   * Stop the recording process
   */
  stop() {
    if (this.ffmpegCommand) {
      this.ffmpegCommand.kill('SIGTERM');
      this.ffmpegCommand = null;
    }
    
    if (this.segmentTail) {
      this.segmentTail.unwatch();
      this.segmentTail = null;
    }
    
    this.isRecording = false;
    logger.info('Recorder service stopped');
  }
}

module.exports = RecorderService; 