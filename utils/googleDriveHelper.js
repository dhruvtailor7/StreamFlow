const fs = require('fs');
const path = require('path');
const constants = require('../config/constants');
const { drive, auth: googleAuth } = require('@googleapis/drive');
const { createLogger } = require('./logger');

const logger = createLogger('Google Drive Helper');

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const DRIVE_FOLDER_NAME = 'CCTV Recordings';

let driveClient = null;

function getDriveClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Credentials file not found at ${CREDENTIALS_PATH}. Please download credentials from Google Cloud Console.`);
  }

  const auth = new googleAuth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  if (!driveClient) {
    driveClient = drive({version: "v3", auth: auth})
  }
  return driveClient
}

async function findOrCreateFolder(drive, folderName, parentId = null) {
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  
  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id'
  });

  await drive.permissions.create({
    fileId: folder.data.id,
    requestBody: {
      role: 'writer',
      type: 'user',
      emailAddress: constants.email,
    }
  })
  
  return folder.data.id;
}

/**
 * Upload a file to Google Drive
 * @param {string} filePath - Path to the file to upload
 * @param {string} folderName - Name of the folder (e.g. date) to organize files
 * @returns {Promise<object>} - File metadata from Google Drive
 */
async function uploadFileToDrive(filePath, folderName) {
  try {
    const drive = getDriveClient();
    
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
      mimeType: 'video/mkv', //get from file
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
  uploadFileToDrive,
}; 