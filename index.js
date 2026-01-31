require('dotenv').config();

const RecorderService = require('./services/recorder/RecorderService');
const UploaderService = require('./services/uploader/UploaderService');
const mqttService = require('./services/mqtt/MqttService');
const migrationService = require('./db/migrationService');
const DatabaseService = require('./services/database/DatabaseService');
const { systemLogger: logger } = require('./utils/logger');
const CleanUpService = require('./services/cleanup/CleanUpService');

const args = process.argv.slice(2);
const mode = args[0] || 'all'; // Default to running both services

async function shutdown(signal) {
  logger.warn(`Received ${signal}, shutting down...`);
  
  try {
    if (recorderService) {
      recorderService.stop();
      logger.info('Recorder service stopped successfully');
    }

    if (cleanupService) {
      await cleanupService.stop();
      logger.info('Cleanup service stopped successfully');
    }
    
    if (uploaderService) {
      await uploaderService.stop();
      logger.info('Uploader service stopped successfully');
    }
    
    await mqttService.disconnect();
    
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
let cleanupService = null;
let uploaderService = null;

function startRecorder() {
  recorderService = new RecorderService();
  recorderService.startRecording();
  logger.success('Recorder service started');
}

async function startCleaner() {
  cleanupService = new CleanUpService();
  await cleanupService.initialize();
}

async function startUploader() {
  uploaderService = new UploaderService();
  await uploaderService.initialize();
  logger.success('Uploader service started');
}

async function start() {
  try {
    logger.info(`Starting in mode: ${mode}`);

    logger.info('Migrating database...');
    await migrationService.runMigrations();
    logger.success('Database migrated successfully');
    
    logger.info('Initializing MQTT connection...');
    await mqttService.connect();
    logger.success('MQTT connection established successfully');
    
    if (mode === 'all' || mode === 'recorder') {
      startRecorder();
      await startCleaner();
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