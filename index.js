require('dotenv').config();
const RecorderService = require('./services/recorder/RecorderService');
const UploaderService = require('./services/uploader/UploaderService');
const dbController = require('./db/dbController');
const mqttController = require('./mqtt/mqttController');
const { systemLogger: logger } = require('./utils/logger');
const path = require('path');
const fs = require('fs');

const storageDir = path.join(__dirname, '../storage/documents/CCTV Recordings');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const args = process.argv.slice(2);
const mode = args[0] || 'all'; // Default to running both services

async function shutdown(signal) {
  logger.warn(`Received ${signal}, shutting down...`);
  
  try {
    if (recorderService) {
      await recorderService.stop();
      logger.info('Recorder service stopped successfully');
    }
    
    if (uploaderService) {
      await uploaderService.stop();
      logger.info('Uploader service stopped successfully');
    }
    
    await mqttController.disconnect();
    
    await dbController.close();
    
    logger.success('Shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

let recorderService = null;
let uploaderService = null;

async function startRecorder() {
  recorderService = new RecorderService();
  const initialized = await recorderService.initialize();
  
  if (initialized) {
    recorderService.startRecording();
    logger.success('Recorder service started');
  } else {
    logger.error('Failed to start recorder service');
    process.exit(1);
  }
}

async function startUploader() {
  uploaderService = new UploaderService();
  const initialized = await uploaderService.initialize();
  
  if (initialized) {
    logger.success('Uploader service started');
  } else {
    logger.error('Failed to start uploader service');
    process.exit(1);
  }
}

async function start() {
  try {
    logger.info(`Starting in mode: ${mode}`);
    
    logger.info('Initializing database...');
    await dbController.init();
    logger.success('Database initialized successfully');
    
    logger.info('Initializing MQTT connection...');
    await mqttController.connect();
    logger.success('MQTT connection established successfully');
    
    if (mode === 'all' || mode === 'recorder') {
      await startRecorder();
    }
    
    if (mode === 'all' || mode === 'uploader') {
      await startUploader();
    }
    
    logger.success('Startup complete');
  } catch (error) {
    logger.error(`Error during startup: ${error.message}`);
    
    try {
      if (mqttController) {
        await mqttController.disconnect().catch(err => {
          logger.error(`Error disconnecting MQTT during startup failure: ${err.message}`);
        });
      }
      
      if (dbController) {
        await dbController.close().catch(err => {
          logger.error(`Error closing database during startup failure: ${err.message}`);
        });
      }
    } catch (cleanupError) {
      logger.error(`Error during cleanup: ${cleanupError.message}`);
    }
    
    process.exit(1);
  }
}

start();
