// Constants for CCTV recorder service
require('dotenv').config();

const path = require('path')

// RTSP Configuration
const rtspUrl = process.env.RTSP_URL;

// MQTT Configuration
const mqttHost = process.env.MQTT_HOST;
const mqttPort = process.env.MQTT_PORT;
const mqttTopics = {
  NEW_RECORDING: 'cctv/recordings/new',
}
const recordingSegmentDurationInSeconds = process.env.RECORDING_SEGMENT_DURATION_IN_SECONDS || 900;

const email = process.env.EMAIL

const requiredEnvVars = [email];

if(!rtspUrl) {
  requiredEnvVars.push(rtspIp, rtspPort);
} else {
  requiredEnvVars.push(rtspUrl);
}

if (requiredEnvVars.some(envVar => !envVar)) {
  const missingEnvVars = requiredEnvVars.filter(envVar => !envVar);
  throw new Error(`Missing environment variables: ${missingEnvVars.join(', ')}`);
}

function getRtspUrl() {
  if(rtspUrl) {
    return rtspUrl;
  } 
}

module.exports = {
  email,
  mqttHost,
  mqttPort,
  mqttTopics,
  maxRecordingsFolderSizeInGB: Number(process.env.MAX_RECORDINGS_FOLDER_SIZE_IN_GB) || 2,
  recordingsPath: path.join(process.env.RECORDING_BASE_DIR, "CCTV_Recordings"),
  recordingSegmentDurationInSeconds: recordingSegmentDurationInSeconds,
  recordingFormat: process.env.RECORDING_FORMAT || 'mkv',
  getRtspUrl
};