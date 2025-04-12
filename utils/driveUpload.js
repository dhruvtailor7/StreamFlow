const fs = require('fs');
const path = require('path');
const { getDriveClient, findOrCreateFolder, DRIVE_FOLDER_NAME } = require('../config/drive-config');
const { createLogger } = require('./logger');

const logger = createLogger('Drive');

/**
 * Upload a file to Google Drive
 * @param {string} filePath - Path to the file to upload
 * @param {string} folderName - Name of the folder (e.g. date) to organize files
 * @returns {Promise<object>} - File metadata from Google Drive
 */
async function uploadFileToDrive(filePath, folderName) {
  try {
    const drive = await getDriveClient();
    
    logger.info(`Finding or creating parent folder: ${DRIVE_FOLDER_NAME}`);
    const parentFolderId = await findOrCreateFolder(drive, DRIVE_FOLDER_NAME);
    
    logger.info(`Finding or creating date folder: ${folderName}`);
    const dateFolderId = await findOrCreateFolder(drive, folderName, parentFolderId);
    
    const fileName = path.basename(filePath);
    const fileMetadata = {
      name: fileName,
      parents: [dateFolderId]
    };
    
    const media = {
      mimeType: 'video/mp4',
      body: fs.createReadStream(filePath)
    };
    
    logger.info(`Starting upload of ${fileName} to Google Drive...`);
    
    const uploadedFile = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink'
    });
    
    logger.success(`Successfully uploaded ${fileName} to Google Drive`);
    logger.info(`File ID: ${uploadedFile.data.id}`);
    logger.debug(`View URL: ${uploadedFile.data.webViewLink}`);
    
    return uploadedFile.data;
  } catch (error) {
    logger.error(`Error uploading file to Google Drive: ${error.message}`);
    throw error;
  }
}

module.exports = {
  uploadFileToDrive
}; 