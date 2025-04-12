const { drive } = require('@googleapis/drive');
const fs = require('fs');
const path = require('path');
const constants = require('./constants');

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const DRIVE_FOLDER_NAME = 'CCTV Recordings';

let driveClient = null;

async function getDriveClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Credentials file not found at ${CREDENTIALS_PATH}. Please download credentials from Google Cloud Console.`);
  }

  if (!driveClient) {
    driveClient = drive({version: "v3"})
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

module.exports = {
  getDriveClient,
  findOrCreateFolder,
  DRIVE_FOLDER_NAME
}; 