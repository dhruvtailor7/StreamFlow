const { createLogger } = require('../../utils/logger');
const mqtt = require('mqtt');
const constants = require('../../config/constants');

const logger = createLogger('MQTT Service');

// Default MQTT server configuration
const DEFAULT_CONFIG = {
  host: constants.mqttHost,
  port: constants.mqttPort,
  protocol: 'mqtt',
  clientId: `cctv_service_${Math.random().toString(16).slice(2, 8)}`
};

class MqttService {
  static instance = null;

  constructor() {
    if (MqttService.instance) return MqttService.instance;

    this.client = null;
    this.subscriptions = {}; 
    this.connected = false;

    MqttService.instance = this;
  }

  connect(config = {}) {
    return new Promise((resolve, reject) => {
      if (this.client && this.connected) return resolve();

      const mqttConfig = { ...DEFAULT_CONFIG, ...config };
      const url = `${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}`;

      logger.info(`Connecting to MQTT broker at ${url}...`);

      this.client = mqtt.connect(url, mqttConfig);

      this.client.on('connect', () => {
        this.connected = true;
        logger.success('Connected to MQTT broker');
        for (const topic of Object.keys(this.subscriptions)) {
          this.client.subscribe(topic, (err) => {
            if (err) logger.error(`Failed to resubscribe to topic ${topic}`, err);
          });
        }
        resolve()
      });

      this.client.on('message', (topic, rawMessage) => {
        let message = rawMessage.toString();

        try {
          message = JSON.parse(message);
        } catch (_) {}

        const callbacks = this.subscriptions[topic];
        if (!callbacks) return;

        for (const cb of callbacks) {
          Promise.resolve()
            .then(() => cb(message, topic))
            .catch(err => {
              logger.error(`Error in callback for topic ${topic}: ${err.message}`);
            });
        }
      });

      this.client.on('error', (err) => {
        logger.error('MQTT error:', err.message);
      });

      this.client.on('close', () => {
        this.connected = false;
        logger.warn('MQTT connection closed');
      });
    })
  }

subscribe(topic, callback) {
    return new Promise((resolve, reject) => {
      if (!this.subscriptions[topic]) {
        this.subscriptions[topic] = new Set();
        this.client.subscribe(topic, (err) => {
          if (err) {
            logger.error(`Failed to subscribe to topic ${topic}`, err);
            reject(err)
          }
        });
      }

      this.subscriptions[topic].add(callback);

      resolve(() => this.unsubscribe(topic, callback))
    })
  }

  unsubscribe(topic, callback) {
    return new Promise((resolve, reject) => {
      if (!this.subscriptions[topic]) resolve();

      if (callback) {
        this.subscriptions[topic].delete(callback);
      }

      if (this.subscriptions[topic].size === 0) {
        this.client.unsubscribe(topic, (err) => {
          if (err) {
            logger.error(`Failed to unsubscribe from topic ${topic}`, err);
            reject(err)
          }
          delete this.subscriptions[topic];
          resolve()
        });
      }
    })
  }

  publish(topic, message, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.connected) {
        const message = `Cannot publish to ${topic}, MQTT not connected`;
        logger.warn(message);
        reject(message);
      }

      this.client.publish(topic, JSON.stringify(message), options, (err) => {
        if (err) {
          logger.error(`Failed to publish message to ${topic}: ${err.message}`);
          reject(err);
        }
        logger.debug("Publised message")
        resolve()
      });
    })
  }

  disconnect() {
    return new Promise((resolve, reject) => {
      if (this.client && this.connected) {
        this.client.end(false, (err) => {
          if (err) {
            logger.error(`Failed to disconnect: ${err.message}`);
            reject(err);
          }
          logger.info('Disconnected from MQTT broker');
          this.connected = false;
          resolve()
        });
      }
    })
  }
}

module.exports = new MqttService();
