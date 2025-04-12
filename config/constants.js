// Constants for CCTV recorder service
require('dotenv').config();

// RTSP Configuration
const username = process.env.RTSP_USERNAME;
const password = process.env.RTSP_PASSWORD;
const rtspIp = process.env.RTSP_IP;
const rtspPort = process.env.RTSP_PORT;

// MQTT Configuration
const mqttHost = process.env.MQTT_HOST;
const mqttPort = process.env.MQTT_PORT;

const email = process.env.EMAIL

if (!username || !password || !rtspIp || !rtspPort || !mqttHost || !mqttPort || !email) {
  throw new Error('All environment variables are required');
}

module.exports = {
  username,
  password,
  rtspIp,
  rtspPort,
  email,
  mqttHost,
  mqttPort,
  getRtspUrl: () => `rtsp://${username}:${encodeURIComponent(password)}@${rtspIp}:${rtspPort}/live/channel0`
};