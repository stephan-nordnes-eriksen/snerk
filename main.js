const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const { exiftool } = require('exiftool-vendored');

let mainWindow;

const PRESET_DIR = path.join(os.homedir(), '.snerk', 'presets');
const RAW_EXTENSIONS = ['.raf', '.arw', '.cr3', '.cr2', '.nef', '.dng', '.orf', '.rw2', '.pef', '.srw'];

// Cache for extracted RAW previews to avoid re-extraction
const rawPreviewCache = new Map();
const MAX_CACHE_SIZE = 50; // Maximum number of cached RAW previews

function clearRawPreviewCache() {
  rawPreviewCache.clear();
}

function isRawFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return RAW_EXTENSIONS.includes(ext);
}

async function extractRawPreview(rawPath) {
  // Check cache first
  if (rawPreviewCache.has(rawPath)) {
    // Move to end (LRU)
    const buffer = rawPreviewCache.get(rawPath);
    rawPreviewCache.delete(rawPath);
    rawPreviewCache.set(rawPath, buffer);
    return buffer;
  }

  try {
    const tempDir = os.tmpdir();
    const tempPreviewPath = path.join(tempDir, `preview_${Date.now()}.jpg`);

    await exiftool.extractPreview(rawPath, tempPreviewPath);

    const buffer = await fs.readFile(tempPreviewPath);

    await fs.unlink(tempPreviewPath).catch(() => {});

    // Evict oldest entry if cache is full (LRU)
    if (rawPreviewCache.size >= MAX_CACHE_SIZE) {
      const firstKey = rawPreviewCache.keys().next().value;
      rawPreviewCache.delete(firstKey);
    }

    // Cache the extracted buffer
    rawPreviewCache.set(rawPath, buffer);

    return buffer;
  } catch (error) {
    console.error('Error extracting RAW preview:', error);
    throw new Error(`Failed to extract preview from RAW file: ${error.message}`);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('src/index.html');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

async function initializePresetDirectory() {
  try {
    await fs.mkdir(PRESET_DIR, { recursive: true });

    const snerkDir = path.join(os.homedir(), '.snerk');
    const exportConfigsDir = path.join(snerkDir, 'export-configs');
    await fs.mkdir(exportConfigsDir, { recursive: true });

    const defaultPresetsDir = path.join(__dirname, 'presets');

    if (fsSync.existsSync(defaultPresetsDir)) {
      await copyDefaultPresets(defaultPresetsDir, PRESET_DIR);
    }
  } catch (error) {
    console.error('Error initializing preset directory:', error);
  }
}

async function copyDefaultPresets(source, destination) {
  try {
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await copyDefaultPresets(srcPath, destPath);
      } else if (entry.name.endsWith('.yaml')) {
        try {
          await fs.access(destPath);
        } catch {
          await fs.copyFile(srcPath, destPath);
        }
      }
    }
  } catch (error) {
    console.error('Error copying default presets:', error);
  }
}

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('dialog:saveFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Export Destination'
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('dialog:openXmpFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'XMP Presets', extensions: ['xmp'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    title: 'Import Lightroom XMP Preset'
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('file:readDirectory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile())
      .map(entry => path.join(dirPath, entry.name));

    return files;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
});

ipcMain.handle('file:readFile', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return buffer;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

ipcMain.handle('file:writeFile', async (event, filePath, data) => {
  try {
    await fs.writeFile(filePath, data);
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

ipcMain.handle('preset:getDirectory', async () => {
  return PRESET_DIR;
});

ipcMain.handle('folder:openSnerkFolder', async () => {
  const { shell } = require('electron');
  const snerkDir = path.join(os.homedir(), '.snerk');
  await shell.openPath(snerkDir);
  return snerkDir;
});

ipcMain.handle('shell:openExternal', async (event, url) => {
  const { shell } = require('electron');
  await shell.openExternal(url);
});

ipcMain.handle('window:toggleFullScreen', async () => {
  if (mainWindow) {
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
    return !isFullScreen;
  }
  return false;
});

async function findAllYamlFiles(dirPath, results = []) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await findAllYamlFiles(fullPath, results);
      } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
        results.push(fullPath);
      }
    }

    return results;
  } catch (error) {
    console.error('Error finding YAML files:', error);
    return results;
  }
}

ipcMain.handle('preset:findAll', async () => {
  try {
    const yamlFiles = await findAllYamlFiles(PRESET_DIR);
    return yamlFiles;
  } catch (error) {
    console.error('Error finding presets:', error);
    return [];
  }
});

ipcMain.handle('preset:saveImported', async (event, presetName, yamlContent) => {
  try {
    const importedDir = path.join(PRESET_DIR, 'imported');
    await fs.mkdir(importedDir, { recursive: true });

    // Sanitize filename
    const filename = presetName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.yaml';
    const filePath = path.join(importedDir, filename);

    await fs.writeFile(filePath, yamlContent, 'utf8');
    return filePath;
  } catch (error) {
    console.error('Error saving imported preset:', error);
    throw error;
  }
});

ipcMain.handle('preset:rename', async (event, oldFilePath, newName) => {
  try {
    // Read the existing file
    const content = await fs.readFile(oldFilePath, 'utf8');

    // Update the name in the YAML content
    const updatedContent = content.replace(/^name:\s*"?[^"\n]+"?/m, `name: "${newName}"`);

    // Generate new filename
    const dirPath = path.dirname(oldFilePath);
    const sanitizedName = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newFilePath = path.join(dirPath, `${sanitizedName}.yaml`);

    // Check if new path already exists and is different from old path
    if (newFilePath !== oldFilePath) {
      try {
        await fs.access(newFilePath);
        throw new Error('A preset with this name already exists');
      } catch (err) {
        // File doesn't exist, which is good
        if (err.code !== 'ENOENT') throw err;
      }
    }

    // Write new file with updated content
    await fs.writeFile(newFilePath, updatedContent, 'utf8');

    // Delete old file if path changed
    if (newFilePath !== oldFilePath) {
      await fs.unlink(oldFilePath);
    }

    return newFilePath;
  } catch (error) {
    console.error('Error renaming preset:', error);
    throw error;
  }
});

ipcMain.handle('exportConfig:save', async (event, dirPath, filename, content) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, filename);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  } catch (error) {
    console.error('Error saving export config:', error);
    throw error;
  }
});

ipcMain.handle('settings:getPath', async () => {
  const SETTINGS_FILE = path.join(os.homedir(), '.snerk', 'settings.json');
  return SETTINGS_FILE;
});

ipcMain.handle('settings:load', async () => {
  try {
    const SETTINGS_FILE = path.join(os.homedir(), '.snerk', 'settings.json');
    const buffer = await fs.readFile(SETTINGS_FILE);
    return buffer;
  } catch (error) {
    return null;
  }
});

ipcMain.handle('settings:save', async (event, settingsJson) => {
  try {
    const snerkDir = path.join(os.homedir(), '.snerk');
    await fs.mkdir(snerkDir, { recursive: true });
    const SETTINGS_FILE = path.join(snerkDir, 'settings.json');
    await fs.writeFile(SETTINGS_FILE, settingsJson, 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
});

ipcMain.handle('presetPins:load', async () => {
  try {
    const PINS_FILE = path.join(os.homedir(), '.snerk', 'preset-pins.json');
    const buffer = await fs.readFile(PINS_FILE);
    const text = buffer.toString('utf8');
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
});

ipcMain.handle('presetPins:save', async (event, pinsObj) => {
  try {
    const snerkDir = path.join(os.homedir(), '.snerk');
    await fs.mkdir(snerkDir, { recursive: true });
    const PINS_FILE = path.join(snerkDir, 'preset-pins.json');
    await fs.writeFile(PINS_FILE, JSON.stringify(pinsObj, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving preset pins:', error);
    throw error;
  }
});

ipcMain.handle('file:delete', async (event, filePath) => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
});

ipcMain.handle('file:copy', async (event, srcPath, destPath) => {
  try {
    await fs.copyFile(srcPath, destPath);
    return true;
  } catch (error) {
    console.error('Error copying file:', error);
    throw error;
  }
});

ipcMain.handle('image:getExifData', async (event, imagePath) => {
  try {
    const metadata = await exiftool.read(imagePath);
    const dateTime = metadata.DateTimeOriginal || metadata.CreateDate;
    return {
      make: metadata.Make,
      model: metadata.Model,
      lens: metadata.LensModel,
      iso: metadata.ISO,
      fNumber: metadata.FNumber,
      exposureTime: metadata.ExposureTime,
      focalLength: metadata.FocalLength,
      dateTime: dateTime ? String(dateTime) : undefined,
      width: metadata.ImageWidth,
      height: metadata.ImageHeight,
      rating: metadata.Rating || 0,
    };
  } catch (error) {
    console.error('Error reading EXIF data:', error);
    return {};
  }
});

ipcMain.handle('image:setRating', async (event, imagePath, rating) => {
  try {
    await exiftool.write(imagePath, { Rating: rating });
    return true;
  } catch (error) {
    console.error('Error writing rating:', error);
    throw error;
  }
});

ipcMain.handle('image:loadPreview', async (event, imagePath) => {
  try {
    let imageBuffer;

    if (isRawFile(imagePath)) {
      imageBuffer = await extractRawPreview(imagePath);
    } else {
      imageBuffer = await fs.readFile(imagePath);
    }

    return {
      data: imageBuffer.toString('base64'),
      width: 0,
      height: 0,
      format: isRawFile(imagePath) ? 'raw' : path.extname(imagePath).substring(1)
    };
  } catch (error) {
    console.error('Error loading image preview:', error);
    throw error;
  }
});

ipcMain.handle('image:loadFullResolution', async (event, imagePath) => {
  try {
    let imageBuffer;

    if (isRawFile(imagePath)) {
      imageBuffer = await extractRawPreview(imagePath);
    } else {
      imageBuffer = await fs.readFile(imagePath);
    }

    return {
      data: imageBuffer.toString('base64'),
      width: 0,
      height: 0,
      format: isRawFile(imagePath) ? 'raw' : path.extname(imagePath).substring(1)
    };
  } catch (error) {
    console.error('Error loading full resolution image:', error);
    throw error;
  }
});

ipcMain.handle('image:saveBlob', async (event, blobBuffer, outputPath, format, quality, rotation = 0) => {
  try {
    await fs.writeFile(outputPath, Buffer.from(blobBuffer));
    return true;
  } catch (error) {
    console.error('Error saving blob as image:', error);
    throw error;
  }
});

app.whenReady().then(async () => {
  await initializePresetDirectory();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', async () => {
  try {
    await exiftool.end();
  } catch (error) {
    console.error('Error closing exiftool:', error);
  }
});
