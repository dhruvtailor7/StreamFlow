require('dotenv').config();
const RecorderService = require('./services/recorder/RecorderService');
const UploaderService = require('./services/uploader/UploaderService');
const migrationService = require('./db/migrationService');
const DatabaseService = require('./services/database/DatabaseService');
const { systemLogger: logger } = require('./utils/logger');

const args = process.argv.slice(2);
const mode = args[0] || 'all'; // Default to running both services

async function shutdown(signal) {
  logger.warn(`Received ${signal}, shutting down...`);
  
  try {
    if (recorderService) {
      recorderService.stop();
      logger.info('Recorder service stopped successfully');
    }
    
    if (uploaderService) {
      await uploaderService.stop();
      logger.info('Uploader service stopped successfully');
    }
    
    // await mqttController.disconnect();
    
    DatabaseService.disconnect();
    
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

function startRecorder() {
  recorderService = new RecorderService();
  
  recorderService.startRecording();
  logger.success('Recorder service started');
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

    logger.info('Migrating database...');
    await migrationService.runMigrations();
    logger.success('Database migrated successfully');
    
    // logger.info('Initializing MQTT connection...');
    // await mqttController.connect();
    // logger.success('MQTT connection established successfully');
    
    if (mode === 'all' || mode === 'recorder') {
      startRecorder();
    }
    
    if (mode === 'all' || mode === 'uploader') {
      await startUploader();
    }

    logger.success('Startup complete');
  } catch (error) {
    logger.error(`Error during startup: ${error.message}`);
    
    shutdown('startup-error'); 
  }
}

start()