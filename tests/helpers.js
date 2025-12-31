const fs = require('fs');
const path = require('path');
const os = require('os');

function createTestFolder() {
  const tmpDir = path.join(os.tmpdir(), `snerk-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

function createDummyImageFile(dir, filename = 'test.jpg') {
  const filePath = path.join(dir, filename);
  const dummyContent = Buffer.from('dummy image content for testing');
  fs.writeFileSync(filePath, dummyContent);
  return filePath;
}

function cleanupTestFolder(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = {
  createTestFolder,
  createDummyImageFile,
  cleanupTestFolder,
};
