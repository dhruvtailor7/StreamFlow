const mqttService = require('./mqttService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('MQTT');

/**
 * MQTT controller singleton
 * Ensures only one MQTT connection per process
 */
class MqttController {
  constructor() {
    if (MqttController.instance) {
      return MqttController.instance;
    }
    
    this.isConnected = false;
    this.connectPromise = null;
    MqttController.instance = this;
  }
  
  /**
   * Initialize the MQTT connection
   * @param {Object} config - Optional MQTT configuration
   * @returns {Promise} - Resolves when connected
   */
  async connect(config = {}) {
    if (this.isConnected) {
      return Promise.resolve();
    }
    
    if (this.connectPromise) {
      return this.connectPromise;
    }
    
    logger.info('Initializing MQTT connection...');
    this.connectPromise = mqttService.connect(config).then(() => {
      logger.success('MQTT controller connection established');
      this.isConnected = true;
      return true;
    }).catch(err => {
      logger.error(`MQTT controller connection failed: ${err.message}`);
      this.connectPromise = null;
      throw err;
    });
    
    return this.connectPromise;
  }
  
  /**
   * Subscribe to a topic
   * @param {string} topic - The topic to subscribe to
   * @param {Function} callback - Callback function for messages
   * @returns {Promise} - Resolves when subscribed
   */
  async subscribe(topic, callback) {
    if (!this.isConnected) {
      throw new Error('MQTT not connected. Call connect() first');
    }
    
    return mqttService.subscribe(topic, callback);
  }
  
  /**
   * Publish a message to a topic
   * @param {string} topic - The topic to publish to
   * @param {Object} message - The message to publish
   * @returns {Promise} - Resolves when published
   */
  async publish(topic, message) {
    if (!this.isConnected) {
      throw new Error('MQTT not connected. Call connect() first');
    }
    
    return mqttService.publish(topic, message);
  }
  
  /**
   * Get MQTT topics
   * @returns {Object} - Topic constants
   */
  getTopics() {
    return mqttService.TOPICS;
  }
  
  /**
   * Disconnect from MQTT broker
   * @returns {Promise} - Resolves when disconnected
   */
  async disconnect() {
    if (this.isConnected) {
      logger.info('Closing MQTT connection...');
      this.isConnected = false;
      this.connectPromise = null;
      return mqttService.disconnect().then(() => {
        logger.success('MQTT controller disconnected successfully');
        return true;
      }).catch(err => {
        logger.error(`Error disconnecting MQTT: ${err.message}`);
        throw err;
      });
    }
    return Promise.resolve();
  }
}

// Export singleton instance
module.exports = new MqttController(); 