const fs = require('fs/promises');
const path = require('path');

async function getFolderSize(dirPath) {
  let totalSize = 0;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isFile()) {
      const { size } = await fs.stat(fullPath);
      totalSize += size;
    } else if (entry.isDirectory()) {
      totalSize += await getFolderSize(fullPath);
    }
  }

  return totalSize; // bytes
}

module.exports = { getFolderSize };
