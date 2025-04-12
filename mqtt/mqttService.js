const mqtt = require('mqtt');
const constants = require('../config/constants');
const { createLogger } = require('../utils/logger');

const logger = createLogger('MQTT Service');

// Default MQTT server configuration
const DEFAULT_CONFIG = {
  host: constants.mqttHost,
  port: constants.mqttPort,
  protocol: 'mqtt',
  clientId: `cctv_service_${Math.random().toString(16).slice(2, 8)}`
};

// Topics
const TOPICS = {
  NEW_RECORDING: 'cctv/recordings/new',
  UPLOAD_SUCCESS: 'cctv/uploads/success',
  UPLOAD_ERROR: 'cctv/uploads/error'
};

let client = null;

/**
 * Connect to MQTT broker
 * @param {Object} config - MQTT connection configuration
 * @returns {Promise} - Resolves when connected
 */
function connect(config = {}) {
  return new Promise((resolve, reject) => {
    // Merge default config with provided config
    const mqttConfig = { ...DEFAULT_CONFIG, ...config };
    const url = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}`;
    
    logger.info(`Connecting to MQTT broker at ${url}...`);
    
    client = mqtt.connect(url, mqttConfig);
    
    client.on('connect', () => {
      logger.success('Connected to MQTT broker');
      resolve(client);
    });
    
    client.on('error', (err) => {
      logger.error(`MQTT connection error: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Publish a message to a topic
 * @param {string} topic - The topic to publish to
 * @param {Object} message - The message to publish
 * @returns {Promise} - Resolves when message is published
 */
function publish(topic, message) {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      reject(new Error('MQTT client not connected'));
      return;
    }
    
    try {
      client.publish(topic, JSON.stringify(message), (err) => {
        if (err) {
          logger.error(`Error publishing to ${topic}: ${err.message}`);
          reject(err);
        } else {
          logger.debug(`Message published to ${topic}`);
          resolve();
        }
      });
    } catch (err) {
      logger.error(`Error preparing message for ${topic}: ${err.message}`);
      reject(err);
    }
  });
}

/**
 * Subscribe to a topic
 * @param {string} topic - The topic to subscribe to
 * @param {Function} callback - The callback to call when a message is received
 * @returns {Promise} - Resolves when subscription is complete
 */
function subscribe(topic, callback) {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      reject(new Error('MQTT client not connected'));
      return;
    }
    
    client.subscribe(topic, (err) => {
      if (err) {
        logger.error(`Error subscribing to ${topic}: ${err.message}`);
        reject(err);
      } else {
        logger.info(`Subscribed to ${topic}`);
        
        client.on('message', (receivedTopic, message) => {
          if (receivedTopic === topic) {
            try {
              const parsedMessage = JSON.parse(message.toString());
              logger.debug(`Received message on ${topic}`);
              callback(parsedMessage);
            } catch (err) {
              logger.error(`Error parsing message from ${topic}: ${err.message}`);
            }
          }
        });
        
        resolve();
      }
    });
  });
}

/**
 * Disconnect from MQTT broker
 * @returns {Promise} - Resolves when disconnected
 */
function disconnect() {
  return new Promise((resolve) => {
    if (client && client.connected) {
      client.end(false, () => {
        logger.info('Disconnected from MQTT broker');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  connect,
  publish,
  subscribe,
  disconnect,
  TOPICS
}; 