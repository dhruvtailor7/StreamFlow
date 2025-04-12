const colors = {
  reset: '\x1b[0m',
  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  // Bright text colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * Formats the current timestamp
 * @returns {string} Formatted timestamp YYYY-MM-DD HH:MM:SS.mmm
 */
function getTimestamp() {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0];
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return `${date} ${time}.${ms}`;
}

/**
 * Creates a logger for a specific service
 * @param {string} serviceName - The name of the service
 * @returns {Object} Logger object with log, info, warn, error, and debug methods
 */
function createLogger(serviceName) {
  const serviceColor = colors.brightCyan;
  const servicePrefix = `${serviceColor}${serviceName}${colors.reset}`;
  
  return {
    /**
     * Log regular information
     * @param {...any} args - Arguments to log
     */
    log: (...args) => {
      const timestamp = getTimestamp();
      console.log(`${colors.brightWhite}${timestamp}${colors.reset} ${servicePrefix}: ${args.join(' ')}`);
    },
    
    /**
     * Log information messages
     * @param {...any} args - Arguments to log
     */
    info: (...args) => {
      const timestamp = getTimestamp();
      console.info(`${colors.brightWhite}${timestamp}${colors.reset} ${servicePrefix}: ${colors.green}${args.join(' ')}${colors.reset}`);
    },
    
    /**
     * Log warning messages
     * @param {...any} args - Arguments to log
     */
    warn: (...args) => {
      const timestamp = getTimestamp();
      console.warn(`${colors.brightWhite}${timestamp}${colors.reset} ${servicePrefix}: ${colors.yellow}${args.join(' ')}${colors.reset}`);
    },
    
    /**
     * Log error messages
     * @param {...any} args - Arguments to log
     */
    error: (...args) => {
      const timestamp = getTimestamp();
      console.error(`${colors.brightWhite}${timestamp}${colors.reset} ${servicePrefix}: ${colors.red}${args.join(' ')}${colors.reset}`);
    },
    
    /**
     * Log debug messages
     * @param {...any} args - Arguments to log
     */
    debug: (...args) => {
      if (process.env.DEBUG) {
        const timestamp = getTimestamp();
        console.debug(`${colors.brightWhite}${timestamp}${colors.reset} ${servicePrefix}: ${colors.magenta}${args.join(' ')}${colors.reset}`);
      }
    },
    
    /**
     * Log success messages
     * @param {...any} args - Arguments to log
     */
    success: (...args) => {
      const timestamp = getTimestamp();
      console.info(`${colors.brightWhite}${timestamp}${colors.reset} ${servicePrefix}: ${colors.brightGreen}${args.join(' ')}${colors.reset}`);
    }
  };
}

// Main system logger
const systemLogger = createLogger('System');

module.exports = {
  createLogger,
  systemLogger,
  colors
}; 