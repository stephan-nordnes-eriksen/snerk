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

function applyTemperature(image, temperature) {
  // Temperature adjustment using color balance (rechannel)
  // Positive = warm (more red/yellow), Negative = cool (more blue)
  if (temperature === 0) return image;

  const amount = temperature / 100;

  if (amount > 0) {
    // Warm: boost red, reduce blue
    const redMultiplier = 1 + (amount * 0.15);
    const blueMultiplier = 1 - (amount * 0.15);
    return image.recomb([
      [redMultiplier, 0, 0],
      [0, 1, 0],
      [0, 0, blueMultiplier]
    ]);
  } else {
    // Cool: reduce red, boost blue
    const redMultiplier = 1 + (amount * 0.15);  // amount is negative, so this reduces
    const blueMultiplier = 1 - (amount * 0.15);  // amount is negative, so this boosts
    return image.recomb([
      [redMultiplier, 0, 0],
      [0, 1, 0],
      [0, 0, blueMultiplier]
    ]);
  }
}

function applyTint(image, tint) {
  // Tint adjustment: green/magenta balance
  // Positive = magenta, Negative = green
  if (tint === 0) return image;

  const amount = tint / 150;

  if (amount > 0) {
    // Magenta: boost red and blue, reduce green
    const greenMultiplier = 1 - (amount * 0.1);
    return image.recomb([
      [1, 0, 0],
      [0, greenMultiplier, 0],
      [0, 0, 1]
    ]);
  } else {
    // Green: boost green, reduce red and blue slightly
    const greenMultiplier = 1 - (amount * 0.1);  // amount is negative, so this boosts
    return image.recomb([
      [1, 0, 0],
      [0, greenMultiplier, 0],
      [0, 0, 1]
    ]);
  }
}

function applyVibrance(image, vibrance) {
  // Smart saturation (approximation): half the effect of regular saturation
  const vibranceFactor = 1 + (vibrance / 200);
  return image.modulate({ saturation: vibranceFactor });
}

function applyClarity(image, clarity) {
  // Clarity: mid-tone contrast enhancement
  const clarityAmount = Math.abs(clarity) / 100;
  if (clarity > 0) {
    // Positive: sharpen + increase mid-tone contrast
    return image
      .sharpen({ sigma: 0.5 + clarityAmount })
      .linear(1 + (clarityAmount * 0.2), -(clarityAmount * 10));
  } else {
    // Negative: slight blur
    return image.blur(clarityAmount * 2);
  }
}

function applyTexture(image, texture) {
  // Texture: fine detail enhancement (like clarity but smaller radius)
  const textureAmount = Math.abs(texture) / 100;
  if (texture > 0) {
    // Positive: sharpen fine details
    return image.sharpen({ sigma: 0.3 + (textureAmount * 0.3), m1: 1.0, m2: 2.0 });
  } else {
    // Negative: soften fine details while preserving edges
    return image.blur(textureAmount * 0.5);
  }
}

async function applySplitToning(image, splitToning) {
  // Split Toning: Apply different color tints to shadows and highlights
  // shadowHue: 0-360, shadowSaturation: 0-100
  // highlightHue: 0-360, highlightSaturation: 0-100
  // balance: -100 to +100 (controls shadow/highlight transition point)

  if (!splitToning || (!splitToning.shadowHue && !splitToning.highlightHue)) {
    return image;
  }

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Helper to convert HSL to RGB
  function hslToRgb(h, s, l) {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // Calculate shadow and highlight colors
  const shadowSat = splitToning.shadowSaturation || 0;
  const highlightSat = splitToning.highlightSaturation || 0;
  const shadowHue = splitToning.shadowHue || 0;
  const highlightHue = splitToning.highlightHue || 0;
  const balance = (splitToning.balance || 0) / 100; // -1 to +1

  const shadowColor = hslToRgb(shadowHue, shadowSat, 50);
  const highlightColor = hslToRgb(highlightHue, highlightSat, 50);

  // Process each pixel
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Calculate luminance
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Determine if pixel is shadow or highlight based on luminance and balance
    const threshold = 0.5 + (balance * 0.3);

    let blendFactor;
    if (lum < threshold) {
      // Shadow area
      blendFactor = (threshold - lum) / threshold;
      const shadowStrength = (shadowSat / 100) * blendFactor * 0.3;

      data[i] = Math.min(255, Math.max(0, r + (shadowColor[0] - 128) * shadowStrength));
      data[i + 1] = Math.min(255, Math.max(0, g + (shadowColor[1] - 128) * shadowStrength));
      data[i + 2] = Math.min(255, Math.max(0, b + (shadowColor[2] - 128) * shadowStrength));
    } else {
      // Highlight area
      blendFactor = (lum - threshold) / (1 - threshold);
      const highlightStrength = (highlightSat / 100) * blendFactor * 0.3;

      data[i] = Math.min(255, Math.max(0, r + (highlightColor[0] - 128) * highlightStrength));
      data[i + 1] = Math.min(255, Math.max(0, g + (highlightColor[1] - 128) * highlightStrength));
      data[i + 2] = Math.min(255, Math.max(0, b + (highlightColor[2] - 128) * highlightStrength));
    }
  }

  return sharp(data, {
    raw: {
      width: width,
      height: height,
      channels: channels
    }
  });
}

function applyDehaze(image, dehaze) {
  // Dehaze: increase contrast and saturation
  const amount = dehaze / 100;
  if (amount > 0) {
    return image
      .linear(1 + (amount * 0.5), -(amount * 20))
      .modulate({ saturation: 1 + (amount * 0.3) });
  }
  return image;
}

function applyWhites(image, whites) {
  // Whites: adjust bright tones using gamma
  // Positive values brighten, negative values darken
  // Note: gamma must be between 1.0 and 3.0
  if (whites > 0) {
    // Brighten highlights - use linear instead since gamma can't go below 1.0
    const amount = whites / 100;
    return image.linear(1 + amount * 0.15, amount * 10);
  } else if (whites < 0) {
    // Darken highlights using gamma (values > 1.0 darken)
    const amount = Math.abs(whites) / 100;
    const gammaValue = Math.min(1 + amount * 0.5, 3.0);
    return image.gamma(gammaValue);
  }
  return image;
}

function applyBlacks(image, blacks) {
  // Blacks: adjust dark tones
  // Positive values lighten, negative values darken
  const amount = blacks / 100;
  // Use linear adjustment with offset to primarily affect dark areas
  return image.linear(1, amount * 20);
}

function applySharpening(image, sharpening) {
  // Sharpening with configurable parameters
  // amount: 0-150 (Lightroom scale)
  // radius: 0.5-3.0 (sharpening radius)
  // detail: 0-100 (detail preservation, not directly supported by Sharp)
  // masking: 0-100 (edge masking, not directly supported by Sharp)

  if (!sharpening || !sharpening.amount || sharpening.amount === 0) {
    return image;
  }

  const amount = sharpening.amount || 0;
  const radius = sharpening.radius || 1.0;

  // Convert Lightroom amount (0-150) to Sharp sigma
  // Lightroom's amount is more aggressive, so we scale it down
  const sigma = (amount / 150) * (radius * 2);

  // Sharp's sharpen parameters:
  // sigma: level of sharpening (higher = more blur in the mask)
  // flat: level of sharpening for flat areas (default 1.0)
  // jagged: level of sharpening for jagged areas (default 2.0)

  if (sigma > 0) {
    return image.sharpen({ sigma: Math.max(0.5, sigma) });
  }

  return image;
}

async function applyCurves(image, curves) {
  // Apply tone curves using raw pixel manipulation
  // This creates a lookup table from the curve points and applies it to each channel

  if (!curves) return image;

  // Build lookup tables for each channel
  const rgbLut = curves.rgb ? buildLookupTable(curves.rgb) : null;
  const rLut = curves.r ? buildLookupTable(curves.r) : null;
  const gLut = curves.g ? buildLookupTable(curves.g) : null;
  const bLut = curves.b ? buildLookupTable(curves.b) : null;

  // If we have curve data, apply via raw buffer manipulation
  if (rgbLut || rLut || gLut || bLut) {
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;

    for (let i = 0; i < data.length; i += channels) {
      // Apply RGB curve to all channels
      if (rgbLut) {
        data[i] = rgbLut[data[i]];         // R
        data[i + 1] = rgbLut[data[i + 1]]; // G
        data[i + 2] = rgbLut[data[i + 2]]; // B
      }

      // Apply individual channel curves
      if (rLut) data[i] = rLut[data[i]];
      if (gLut) data[i + 1] = gLut[data[i + 1]];
      if (bLut) data[i + 2] = bLut[data[i + 2]];
    }

    return sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: channels
      }
    });
  }

  return image;
}

function buildLookupTable(curvePoints) {
  // Build a 256-element lookup table from curve points
  // curvePoints is an array of [x, y] pairs like [[0, 0], [128, 140], [255, 255]]

  const lut = new Uint8Array(256);

  // Sort points by x value
  const sorted = curvePoints.sort((a, b) => a[0] - b[0]);

  for (let i = 0; i < 256; i++) {
    // Find the two points that bracket this input value
    let x1 = 0, y1 = 0, x2 = 255, y2 = 255;

    for (let j = 0; j < sorted.length - 1; j++) {
      if (sorted[j][0] <= i && sorted[j + 1][0] >= i) {
        x1 = sorted[j][0];
        y1 = sorted[j][1];
        x2 = sorted[j + 1][0];
        y2 = sorted[j + 1][1];
        break;
      }
    }

    // Linear interpolation between the two points
    if (x2 - x1 !== 0) {
      const t = (i - x1) / (x2 - x1);
      lut[i] = Math.round(y1 + t * (y2 - y1));
    } else {
      lut[i] = y1;
    }

    // Clamp to valid range
    lut[i] = Math.max(0, Math.min(255, lut[i]));
  }

  return lut;
}

async function applyHsl(image, hslAdjustments) {
  // Apply HSL selective color adjustments
  // This is a simplified implementation that approximates Lightroom's HSL

  if (!hslAdjustments || hslAdjustments.length === 0) return image;

  // Define hue ranges for each color (in degrees, 0-360)
  const hueRanges = {
    red: [0, 30, 330, 360],      // Wraps around
    orange: [30, 60],
    yellow: [60, 90],
    green: [90, 150],
    aqua: [150, 210],
    blue: [210, 270],
    purple: [270, 300],
    magenta: [300, 330]
  };

  // Convert to raw buffer for pixel-level manipulation
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    // Convert RGB to HSL
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    // Convert hue to degrees
    h = h * 360;

    // Apply HSL adjustments for matching hue ranges
    for (const adj of hslAdjustments) {
      const range = hueRanges[adj.color];
      if (!range) continue;

      let inRange = false;
      if (range.length === 4) {
        // Wrapping range (red)
        inRange = (h >= range[0] && h <= range[1]) || (h >= range[2] && h <= range[3]);
      } else {
        inRange = h >= range[0] && h <= range[1];
      }

      if (inRange) {
        // Apply hue shift
        if (adj.hue !== undefined) {
          h = (h + adj.hue) % 360;
          if (h < 0) h += 360;
        }

        // Apply saturation adjustment
        if (adj.sat !== undefined) {
          s = Math.max(0, Math.min(1, s * (1 + adj.sat / 100)));
        }

        // Apply luminance adjustment
        if (adj.lum !== undefined) {
          l = Math.max(0, Math.min(1, l + (adj.lum / 100) * 0.5));
        }
      }
    }

    // Convert HSL back to RGB
    h = h / 360;
    let r2, g2, b2;

    if (s === 0) {
      r2 = g2 = b2 = l; // achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r2 = hue2rgb(p, q, h + 1/3);
      g2 = hue2rgb(p, q, h);
      b2 = hue2rgb(p, q, h - 1/3);
    }

    // Write back to buffer
    data[i] = Math.round(r2 * 255);
    data[i + 1] = Math.round(g2 * 255);
    data[i + 2] = Math.round(b2 * 255);
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: channels
    }
  });
}

async function applyGrain(image, grain) {
  // Apply film grain effect with full control
  // grain can be a number (legacy) or object with {amount, size, roughness}

  let amount, size, roughness;

  if (typeof grain === 'number') {
    // Legacy support: just amount
    amount = grain;
    size = 25; // default medium grain size
    roughness = 50; // default medium roughness
  } else if (typeof grain === 'object') {
    amount = grain.amount || 0;
    size = grain.size !== undefined ? grain.size : 25;
    roughness = grain.roughness !== undefined ? grain.roughness : 50;
  } else {
    return image;
  }

  if (!amount || amount <= 0) return image;

  const metadata = await image.metadata();
  const { width, height } = metadata;

  // Size affects grain particle size (0-100, where larger = bigger particles)
  // We simulate this by creating noise at a lower resolution and scaling up
  const sizeFactor = 0.5 + (size / 100) * 1.5; // 0.5x to 2x
  const noiseWidth = Math.round(width / sizeFactor);
  const noiseHeight = Math.round(height / sizeFactor);

  // Roughness affects the intensity variation (0-100)
  // Higher roughness = more contrast in grain pattern
  const roughnessFactor = 0.5 + (roughness / 100) * 1.5; // 0.5x to 2x

  // Calculate noise intensity based on amount and roughness
  const baseIntensity = (amount / 100) * 30;
  const noiseIntensity = Math.round(baseIntensity * roughnessFactor);

  // Generate random noise buffer at grain size resolution
  const noiseSize = noiseWidth * noiseHeight * 4; // RGBA
  const noiseBuffer = Buffer.alloc(noiseSize);

  for (let i = 0; i < noiseSize; i += 4) {
    // Random grayscale value centered around 128
    const noise = 128 + (Math.random() - 0.5) * noiseIntensity * 2;
    const value = Math.max(0, Math.min(255, noise));
    noiseBuffer[i] = value;     // R
    noiseBuffer[i + 1] = value; // G
    noiseBuffer[i + 2] = value; // B
    noiseBuffer[i + 3] = 255;   // A
  }

  // Create noise image at grain resolution
  let noiseImage = sharp(noiseBuffer, {
    raw: {
      width: noiseWidth,
      height: noiseHeight,
      channels: 4
    }
  });

  // Scale noise to match image dimensions (creates grain particle size effect)
  if (noiseWidth !== width || noiseHeight !== height) {
    noiseImage = noiseImage.resize(width, height, { kernel: 'nearest' });
  }

  // Composite the noise with overlay blend mode
  return image.composite([{
    input: await noiseImage.png().toBuffer(),
    blend: 'overlay',
    opacity: (amount / 100) * 0.3 // Scale opacity based on amount
  }]);
}

async function applyVignette(image, vignette) {
  // Apply vignette effect with full control
  // vignette can be a number (legacy) or object with {amount, midpoint, roundness, feather, highlights}

  let amount, midpoint, roundness, feather, highlights;

  if (typeof vignette === 'number') {
    // Legacy support: just amount
    amount = vignette;
    midpoint = 50; // default
    roundness = 0; // default circular
    feather = 50; // default feather
    highlights = 0; // default no highlight protection
  } else if (typeof vignette === 'object') {
    amount = vignette.amount || 0;
    midpoint = vignette.midpoint !== undefined ? vignette.midpoint : 50;
    roundness = vignette.roundness !== undefined ? vignette.roundness : 0;
    feather = vignette.feather !== undefined ? vignette.feather : 50;
    highlights = vignette.highlights !== undefined ? vignette.highlights : 0;
  } else {
    return image;
  }

  if (!amount || amount === 0) return image;

  const metadata = await image.metadata();
  const { width, height } = metadata;

  // Calculate radius based on midpoint (0-100, where 100 is center)
  const radiusPercent = 50 + (midpoint / 2);

  // Feather determines the gradient transition smoothness
  const featherStart = Math.max(0, radiusPercent - (feather / 2));

  // Roundness affects the aspect ratio of the gradient
  // 0 = circular, negative = horizontal oval, positive = vertical oval
  const aspectRatio = width / height;
  const rx = roundness < 0 ? (100 + Math.abs(roundness)) : 100;
  const ry = roundness > 0 ? (100 + roundness) : 100;

  const intensity = Math.abs(amount) / 100;
  const brightness = amount < 0 ? 0 : 255; // Negative = darken, positive = lighten

  // SVG with elliptical gradient for roundness control
  const svgGradient = `
    <svg width="${width}" height="${height}">
      <defs>
        <radialGradient id="vignette" cx="50%" cy="50%" rx="${rx}%" ry="${ry}%">
          <stop offset="0%" style="stop-color:rgb(128,128,128);stop-opacity:0" />
          <stop offset="${featherStart}%" style="stop-color:rgb(128,128,128);stop-opacity:0" />
          <stop offset="${radiusPercent}%" style="stop-color:rgb(${brightness},${brightness},${brightness});stop-opacity:${intensity}" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#vignette)" />
    </svg>
  `;

  const vignetteBuffer = Buffer.from(svgGradient);

  // Composite vignette
  const blendMode = amount < 0 ? 'multiply' : 'screen';

  let result = image.composite([{
    input: vignetteBuffer,
    blend: blendMode
  }]);

  // Apply highlight protection if specified
  // This lightens highlights to preserve detail in vignetted areas
  if (highlights !== 0 && amount < 0) {
    const highlightBoost = highlights / 100;
    result = result.modulate({ brightness: 1 + (highlightBoost * 0.2) });
  }

  return result;
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

      if (adj.temperature !== undefined && adj.temperature !== 0) {
        image = applyTemperature(image, adj.temperature);
      }

      if (adj.tint !== undefined && adj.tint !== 0) {
        image = applyTint(image, adj.tint);
      }

      if (adj.saturation !== undefined) {
        image = image.modulate({ saturation: adj.saturation });
      }

      if (adj.vibrance !== undefined && adj.vibrance !== 0) {
        image = applyVibrance(image, adj.vibrance);
      }

      if (adj.contrast !== undefined && adj.contrast !== 1) {
        const contrastAmount = Math.round((adj.contrast - 1) * 50);
        if (contrastAmount !== 0) {
          image = image.linear(adj.contrast, -(128 * adj.contrast) + 128);
        }
      }

      if (adj.clarity !== undefined && adj.clarity !== 0) {
        image = applyClarity(image, adj.clarity);
      }

      if (adj.texture !== undefined && adj.texture !== 0) {
        image = applyTexture(image, adj.texture);
      }

      if (adj.shadows !== undefined || adj.highlights !== undefined) {
        const shadows = (adj.shadows || 0) / 100;
        const highlights = (adj.highlights || 0) / 100;

        if (shadows !== 0) {
          image = image.modulate({
            lightness: 1 + shadows * 0.3,
          });
        }

        if (highlights !== 0) {
          if (highlights < 0) {
            image = image.gamma(1 + Math.abs(highlights) * 0.02);
          }
        }
      }

      if (adj.whites !== undefined && adj.whites !== 0) {
        image = applyWhites(image, adj.whites);
      }

      if (adj.blacks !== undefined && adj.blacks !== 0) {
        image = applyBlacks(image, adj.blacks);
      }

      if (adj.dehaze !== undefined && adj.dehaze !== 0) {
        image = applyDehaze(image, adj.dehaze);
      }
    }

    // Apply split toning / color grading
    if (presetConfig.splitToning) {
      image = await applySplitToning(image, presetConfig.splitToning);
    }

    // Apply tone curves
    if (presetConfig.curves) {
      image = await applyCurves(image, presetConfig.curves);
    }

    // Apply HSL selective color adjustments
    if (presetConfig.hsl) {
      image = await applyHsl(image, presetConfig.hsl);
    }

    // Apply sharpening
    if (presetConfig.sharpening) {
      image = applySharpening(image, presetConfig.sharpening);
    }

    // Apply grain
    if (presetConfig.grain) {
      image = await applyGrain(image, presetConfig.grain);
    }

    // Apply vignette
    if (presetConfig.vignette) {
      image = await applyVignette(image, presetConfig.vignette);
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

      if (adj.temperature !== undefined && adj.temperature !== 0) {
        image = applyTemperature(image, adj.temperature);
      }

      if (adj.tint !== undefined && adj.tint !== 0) {
        image = applyTint(image, adj.tint);
      }

      if (adj.saturation !== undefined) {
        image = image.modulate({ saturation: adj.saturation });
      }

      if (adj.vibrance !== undefined && adj.vibrance !== 0) {
        image = applyVibrance(image, adj.vibrance);
      }

      if (adj.contrast !== undefined && adj.contrast !== 1) {
        image = image.linear(adj.contrast, -(128 * adj.contrast) + 128);
      }

      if (adj.clarity !== undefined && adj.clarity !== 0) {
        image = applyClarity(image, adj.clarity);
      }

      if (adj.texture !== undefined && adj.texture !== 0) {
        image = applyTexture(image, adj.texture);
      }

      if (adj.shadows !== undefined || adj.highlights !== undefined) {
        const shadows = (adj.shadows || 0) / 100;
        const highlights = (adj.highlights || 0) / 100;

        if (shadows !== 0) {
          image = image.modulate({
            lightness: 1 + shadows * 0.3,
          });
        }

        if (highlights !== 0) {
          if (highlights < 0) {
            image = image.gamma(1 + Math.abs(highlights) * 0.02);
          }
        }
      }

      if (adj.whites !== undefined && adj.whites !== 0) {
        image = applyWhites(image, adj.whites);
      }

      if (adj.blacks !== undefined && adj.blacks !== 0) {
        image = applyBlacks(image, adj.blacks);
      }

      if (adj.dehaze !== undefined && adj.dehaze !== 0) {
        image = applyDehaze(image, adj.dehaze);
      }
    }

    // Apply split toning / color grading
    if (presetConfig.splitToning) {
      image = await applySplitToning(image, presetConfig.splitToning);
    }

    // Apply tone curves
    if (presetConfig && presetConfig.curves) {
      image = await applyCurves(image, presetConfig.curves);
    }

    // Apply HSL selective color adjustments
    if (presetConfig && presetConfig.hsl) {
      image = await applyHsl(image, presetConfig.hsl);
    }

    // Apply grain
    if (presetConfig && presetConfig.grain) {
      image = await applyGrain(image, presetConfig.grain);
    }

    // Apply vignette
    if (presetConfig && presetConfig.vignette) {
      image = await applyVignette(image, presetConfig.vignette);
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
