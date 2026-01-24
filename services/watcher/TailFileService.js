// FileWatcherService.js
const { Tail } = require('tail');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('TailFile');

class TailFileService {
    constructor() {
        this.watchers = new Map(); // key = file path, value = { tail, callbacks }
    }

    /**
     * Watch a file for new lines (e.g., FFmpeg segment list)
     * @param {string} filePath - Path to segment list file
     * @param {(line: string) => void} callback - Called with each new line
     */
    watchNewLines(filePath, callback) {
        // If already watching, just add the callback
        if (this.watchers.has(filePath)) {
            this.watchers.get(filePath).callbacks.add(callback);
            return;
        }

        const callbacks = new Set([callback]);

        const tail = new Tail(filePath);

        tail.on('line', async (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;

            logger.debug("New line added: ", line)

            const watcher = this.watchers.get(filePath);

            // Call all callbacks
            for (const cb of watcher.callbacks) {
                try {
                    await cb(trimmed);
                } catch (err) {
                    logger.error('FileWatcherService callback error:', err);
                }
            }

        });

        tail.on('error', (err) => {
            logger.error('FileWatcherService tail error:', err);
        });

        tail.watch();

        // Save watcher info
        this.watchers.set(filePath, { tail, callbacks });

        return () => this.unwatch(filePath, callback)
    }

    /**
     * Stop watching a file
     * @param {string} filePath
     * @param {function} callback
     */
    unwatch(filePath, callback) {
        if (!this.watchers.has(filePath)) return;

        const entry = this.watchers.get(filePath);

        entry.callbacks.delete(callback);

        if(entry.callbacks.size === 0) {
            entry.tail.unwatch();
        }
        this.watchers.delete(filePath);
    }
}

module.exports = new TailFileService();
