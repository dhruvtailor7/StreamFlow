const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { addRecording } = require('../../db/database');
const mqttController = require('../../mqtt/mqttController');
const constants = require('../../config/constants');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('Recorder');

class RecorderService {
  constructor() {
    this.rtspUrl = constants.getRtspUrl();
    this.basePath = path.join(__dirname, '../../storage/documents/CCTV Recordings');
    this.outputDir = null;
    this.isRecording = false;
    this.ffmpegCommand = null;
    this.topics = mqttController.getTopics();
  }

  /**
   * Initialize the recorder service
   */
  async initialize() {
    try {
      logger.info('Initializing recorder service...');
      
      
      logger.info('Recorder service initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to initialize recorder service: ${error.message}`);
      return false;
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
      
      this._recordClip(60);
      logger.success('Recording started successfully');
    } catch (error) {
      this.isRecording = false;
      logger.error(`Failed to start recording: ${error.message}`);
    }
  }

  /**
   * Record an hourly clip
   */
  _recordClip(durationInSeconds) {
    const startTime = new Date();
    const dateString = startTime.toISOString().split('T')[0]; // Date string for folder organization
    const dayFolder = path.join(this.basePath, dateString);
    
    if (!fs.existsSync(dayFolder)) {
      fs.mkdirSync(dayFolder, { recursive: true });
    }

    const startEpoch = startTime.getTime();
    const filename = `clip_${startEpoch}.mp4`;
    const outputPath = path.join(dayFolder, filename);
    
    logger.info(`Starting recording after ${startEpoch}`);
    
    this.ffmpegCommand = ffmpeg(this.rtspUrl)
      .addOptions([
        '-c:v copy', 
        '-c:a aac', 
        '-b:a 128k', 
        '-f mp4', 
        '-movflags frag_keyframe+empty_moov', 
      ])
      .duration(`${durationInSeconds}`)  
      .outputOptions([
        '-reset_timestamps 1',
        '-timestamp now'
      ])
      .on('start', (commandLine) => {
        logger.info(`Spawned FFmpeg for ${startEpoch} with command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        logger.debug(`Processing ${startEpoch}: ${JSON.stringify(progress)}% done`);
        const currentDate = new Date().toISOString().split('T')[0];
        if (currentDate !== dateString) {
          logger.info('Day changed, stopping current recording and starting new one');
          if (this.ffmpegCommand) {
            this.ffmpegCommand.kill();
            this.ffmpegCommand = null;
          }
          this._recordClip(durationInSeconds);
        }        
      })
      .on('end', async () => {
        logger.success(`Recording for ${startEpoch} finished`);
        logger.info(`File saved to: ${outputPath}`);
        
        try {
          const recordingData = await addRecording(filename, outputPath, dateString);
          logger.info(`Recording data saved to database with ID: ${recordingData.id}`);
          
          await mqttController.publish(this.topics.NEW_RECORDING, {
            id: recordingData.id,
          });
          
          logger.info(`Published recording info to MQTT topic: ${this.topics.NEW_RECORDING}`);
          
          this._recordClip(durationInSeconds);
          
        } catch (error) {
          logger.error(`Error after recording completion: ${error.message}`);
        }
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(`Error during recording: ${err.message}`);
        logger.debug('FFmpeg stdout:', stdout);
        logger.debug('FFmpeg stderr:', stderr);
        
        this._recordClip(durationInSeconds);
      })
      .saveToFile(outputPath);
  }

  /**
   * Stop the recording process
   */
  async stop() {
    if (this.ffmpegCommand) {
      this.ffmpegCommand.kill();
      this.ffmpegCommand = null;
    }
    this.isRecording = false;
    logger.info('Recorder service stopped');
  }
}

module.exports = RecorderService; 