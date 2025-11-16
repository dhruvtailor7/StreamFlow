class FileNotFoundError extends Error {
    constructor(message) {
        super(message || 'File now found')
    }
}

module.exports = FileNotFoundError