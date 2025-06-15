// Constants for CCTV recorder service
require('dotenv').config();

// RTSP Configuration
const rtspUrl = process.env.RTSP_URL;

// MQTT Configuration
const mqttHost = process.env.MQTT_HOST;
const mqttPort = process.env.MQTT_PORT;
const recordingSegmentDurationInSeconds = process.env.RECORDING_SEGMENT_DURATION_IN_SECONDS || 3600;

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
  recordingsFolder: "CCTV_Recordings",
  recordingSegmentDurationInSeconds: recordingSegmentDurationInSeconds,
  getRtspUrl
};