const chokidar = require('chokidar')
const { createLogger } = require('../../utils/logger');

const logger = createLogger('FileWatcher');

class FileWatcher {
    static instance = null;
    constructor() {
        if(!FileWatcher.instance) {
            FileWatcher.instance = this
        }

        this.subscriptionMap = {}

        return FileWatcher.instance
    }

    watchNewFiles(dir, cb) {
        if(!this.subscriptionMap[dir]) {
            logger.debug(`creating new subscription for ${dir}`)
            const subscription = chokidar.watch(dir, {depth: 0, ignoreInitial: true, awaitWriteFinish: true})
            this.subscriptionMap[dir] = {subscription, callbacks: new Set([cb])}
            subscription.on('add', (path) => {
                for(const fn of this.subscriptionMap[dir].callbacks) {
                    try {
                        fn(path);
                    } catch (err) {
                        logger.error('Callback error:', err);
                    }
                }
            })
        } else {
            logger.debug(`adding new callback for ${dir}`)
            this.subscriptionMap[dir].callbacks.add(cb)
        }

        return () => this.unwatchNewFiles(dir, cb)
    }

    unwatchNewFiles(dir, cb) {
        const entry = this.subscriptionMap[dir];
        if (!entry) return;

        entry.callbacks.delete(cb)

        if(entry.callbacks.size === 0) {
            entry.subscription.close().then(() => {
                delete this.subscriptionMap[dir]
            })
        }
    }

}

module.exports = new FileWatcher()