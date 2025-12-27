const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const sharp = require('sharp');
const { exiftool } = require('exiftool-vendored');

let mainWindow;

const PRESET_DIR = path.join(os.homedir(), '.snerk', 'presets');
const RAW_EXTENSIONS = ['.raf', '.arw', '.cr3', '.cr2', '.nef', '.dng', '.orf', '.rw2', '.pef', '.srw'];

function isRawFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return RAW_EXTENSIONS.includes(ext);
}

async function extractRawPreview(rawPath) {
  try {
    const tempDir = os.tmpdir();
    const tempPreviewPath = path.join(tempDir, `preview_${Date.now()}.jpg`);

    await exiftool.extractPreview(rawPath, tempPreviewPath);

    const buffer = await fs.readFile(tempPreviewPath);

    await fs.unlink(tempPreviewPath).catch(() => {});

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

ipcMain.handle('image:loadPreview', async (event, imagePath) => {
  try {
    let imageBuffer;
    let metadata;

    if (isRawFile(imagePath)) {
      imageBuffer = await extractRawPreview(imagePath);
      const image = sharp(imageBuffer);
      metadata = await image.metadata();

      const processedBuffer = await image
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      return {
        data: processedBuffer.toString('base64'),
        width: metadata.width,
        height: metadata.height,
        format: 'raw'
      };
    } else {
      const image = sharp(imagePath);
      metadata = await image.metadata();

      const buffer = await image
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      return {
        data: buffer.toString('base64'),
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      };
    }
  } catch (error) {
    console.error('Error loading image preview:', error);
    throw error;
  }
});

ipcMain.handle('image:applyPreset', async (event, imagePath, presetConfig) => {
  try {
    let imageBuffer;
    let image;
    let metadata;

    if (isRawFile(imagePath)) {
      imageBuffer = await extractRawPreview(imagePath);
      image = sharp(imageBuffer);
    } else {
      image = sharp(imagePath);
    }

    metadata = await image.metadata();

    image = image.resize(2000, 2000, { fit: 'inside', withoutEnlargement: true });

    if (presetConfig.adjustments) {
      const adj = presetConfig.adjustments;

      if (adj.exposure !== undefined || adj.brightness !== undefined) {
        const brightnessMultiplier = 1 + (adj.exposure || 0);
        image = image.modulate({ brightness: brightnessMultiplier });
      }

      if (adj.saturation !== undefined) {
        image = image.modulate({ saturation: adj.saturation });
      }

      if (adj.contrast !== undefined && adj.contrast !== 1) {
        const contrastAmount = Math.round((adj.contrast - 1) * 50);
        if (contrastAmount !== 0) {
          image = image.linear(adj.contrast, -(128 * adj.contrast) + 128);
        }
      }

      if (adj.shadows !== undefined || adj.highlights !== undefined) {
        const shadows = (adj.shadows || 0) / 100;
        const highlights = (adj.highlights || 0) / 100;

        image = image.modulate({
          lightness: shadows > 0 ? 1 + shadows * 0.3 : 1,
        });
      }
    }

    if (presetConfig.curves) {
      // Apply curves if needed - simplified version
      // For full implementation, we'd need to apply custom curves
    }

    const buffer = await image.jpeg({ quality: 90 }).toBuffer();

    return {
      data: buffer.toString('base64'),
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    console.error('Error applying preset:', error);
    throw error;
  }
});

ipcMain.handle('image:export', async (event, imagePath, presetConfig, outputPath, format = 'jpeg', quality = 90) => {
  try {
    let image;

    if (isRawFile(imagePath)) {
      const imageBuffer = await extractRawPreview(imagePath);
      image = sharp(imageBuffer);
    } else {
      image = sharp(imagePath);
    }

    if (presetConfig && presetConfig.adjustments) {
      const adj = presetConfig.adjustments;

      if (adj.exposure !== undefined) {
        const brightnessMultiplier = 1 + adj.exposure;
        image = image.modulate({ brightness: brightnessMultiplier });
      }

      if (adj.saturation !== undefined) {
        image = image.modulate({ saturation: adj.saturation });
      }

      if (adj.contrast !== undefined && adj.contrast !== 1) {
        image = image.linear(adj.contrast, -(128 * adj.contrast) + 128);
      }
    }

    const formatOptions = {
      jpeg: { quality },
      jpg: { quality },
      png: { quality },
      tiff: { quality },
      webp: { quality }
    };

    const outputFormat = format.toLowerCase();

    if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
      await image.jpeg(formatOptions[outputFormat]).toFile(outputPath);
    } else if (outputFormat === 'png') {
      await image.png(formatOptions[outputFormat]).toFile(outputPath);
    } else if (outputFormat === 'tiff') {
      await image.tiff(formatOptions[outputFormat]).toFile(outputPath);
    } else if (outputFormat === 'webp') {
      await image.webp(formatOptions[outputFormat]).toFile(outputPath);
    } else {
      await image.jpeg({ quality: 90 }).toFile(outputPath);
    }

    return true;
  } catch (error) {
    console.error('Error exporting image:', error);
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
