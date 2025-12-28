#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { exiftool } = require('exiftool-vendored');
const os = require('os');

// RAW file extensions that need preview extraction
const RAW_EXTENSIONS = ['.raf', '.arw', '.cr3', '.cr2', '.nef', '.dng', '.rw2', '.orf'];

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', ...RAW_EXTENSIONS];

function isRawFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return RAW_EXTENSIONS.includes(ext);
}

async function extractRawPreview(imagePath) {
  try {
    const metadata = await exiftool.read(imagePath);

    if (metadata.PreviewImage) {
      return Buffer.from(metadata.PreviewImage, 'binary');
    }

    if (metadata.JpgFromRaw) {
      return Buffer.from(metadata.JpgFromRaw, 'binary');
    }

    if (metadata.ThumbnailImage) {
      return Buffer.from(metadata.ThumbnailImage, 'binary');
    }

    throw new Error('No preview image found in RAW file');
  } catch (error) {
    throw new Error(`Failed to extract RAW preview: ${error.message}`);
  }
}

async function loadPresetFromFile(presetPath) {
  try {
    const content = await fs.readFile(presetPath, 'utf8');
    return parseYAML(content);
  } catch (error) {
    throw new Error(`Failed to load preset: ${error.message}`);
  }
}

async function loadPresetByName(presetName) {
  const presetDir = path.join(os.homedir(), '.snerk', 'presets');

  // Search for preset file recursively
  async function findPreset(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const result = await findPreset(fullPath);
        if (result) return result;
      } else if (entry.name.endsWith('.yaml')) {
        const content = await fs.readFile(fullPath, 'utf8');
        const preset = parseYAML(content);
        if (preset.name === presetName) {
          return preset;
        }
      }
    }
    return null;
  }

  const preset = await findPreset(presetDir);
  if (!preset) {
    throw new Error(`Preset "${presetName}" not found`);
  }
  return preset;
}

function parseYAML(text) {
  const lines = text.split('\n');
  const preset = {
    adjustments: {},
    curves: {},
    hsl: []
  };

  let currentSection = null;

  for (let line of lines) {
    line = line.replace(/#.*$/, '').trim();
    if (!line) continue;

    const keyValue = line.match(/^([^:]+):\s*(.*)$/);
    if (!keyValue) continue;

    let [, key, value] = keyValue;
    key = key.trim();
    value = value.trim();

    if (key === 'name') {
      preset.name = value.replace(/['"]/g, '');
    } else if (key === 'category') {
      preset.category = value.replace(/['"]/g, '');
    } else if (key === 'adjustments') {
      currentSection = 'adjustments';
    } else if (key === 'curves') {
      currentSection = 'curves';
    } else if (key === 'hsl') {
      currentSection = 'hsl';
    } else if (key === 'splitToning') {
      currentSection = 'splitToning';
      preset.splitToning = {};
    } else if (key === 'grain') {
      currentSection = 'grain';
      preset.grain = {};
    } else if (key === 'vignette') {
      currentSection = 'vignette';
      preset.vignette = {};
    } else if (currentSection === 'adjustments') {
      preset.adjustments[key] = parseFloat(value) || 0;
    } else if (currentSection === 'curves' && (key === 'r' || key === 'g' || key === 'b')) {
      preset.curves[key] = JSON.parse(value);
    } else if (currentSection === 'splitToning') {
      if (key === 'shadowHue' || key === 'shadowSaturation' || key === 'highlightHue' || key === 'highlightSaturation' || key === 'balance') {
        preset.splitToning[key] = parseFloat(value) || 0;
      }
    } else if (currentSection === 'grain') {
      if (key === 'amount' || key === 'size' || key === 'roughness') {
        preset.grain[key] = parseFloat(value) || 0;
      }
    } else if (currentSection === 'vignette') {
      if (key === 'amount' || key === 'midpoint' || key === 'roundness' || key === 'feather') {
        preset.vignette[key] = parseFloat(value) || 0;
      }
    }
  }

  return preset;
}

async function applyPreset(imagePath, presetConfig, outputPath, format = 'jpeg', quality = 90) {
  let imageBuffer;
  let image;

  // Load image
  if (isRawFile(imagePath)) {
    imageBuffer = await extractRawPreview(imagePath);
    image = sharp(imageBuffer);
  } else {
    image = sharp(imagePath);
  }

  const adj = presetConfig.adjustments || {};

  // Apply adjustments in correct order
  if (adj.exposure !== undefined && Math.abs(adj.exposure) > 0.001) {
    image.modulate({ brightness: 1 + adj.exposure });
  }

  if (adj.temperature !== undefined && Math.abs(adj.temperature) > 0.001) {
    const tempFactor = adj.temperature / 100;
    if (tempFactor > 0) {
      image.tint({ r: Math.min(255, 255 * (1 + tempFactor * 0.3)), g: 255, b: Math.max(0, 255 * (1 - tempFactor * 0.3)) });
    } else {
      image.tint({ r: Math.max(0, 255 * (1 + tempFactor * 0.3)), g: 255, b: Math.min(255, 255 * (1 - tempFactor * 0.3)) });
    }
  }

  if (adj.tint !== undefined && Math.abs(adj.tint) > 0.001) {
    const tintFactor = adj.tint / 150;
    if (tintFactor > 0) {
      image.tint({ r: 255, g: Math.max(0, 255 * (1 - tintFactor * 0.3)), b: 255 });
    } else {
      image.tint({ r: 255, g: Math.min(255, 255 * (1 - tintFactor * 0.3)), b: 255 });
    }
  }

  if (adj.contrast !== undefined && Math.abs(adj.contrast - 1) > 0.001) {
    image.linear(adj.contrast, -(128 * adj.contrast) + 128);
  }

  if (adj.saturation !== undefined && Math.abs(adj.saturation - 1) > 0.001) {
    image.modulate({ saturation: adj.saturation });
  }

  if (adj.vibrance !== undefined && Math.abs(adj.vibrance) > 0.001) {
    const vibFactor = 1 + (adj.vibrance / 100) * 0.5;
    image.modulate({ saturation: vibFactor });
  }

  if (adj.shadows !== undefined && Math.abs(adj.shadows) > 0.001) {
    const shadowFactor = 1 + (adj.shadows / 100) * 0.3;
    image.gamma(1 / shadowFactor);
  }

  if (adj.highlights !== undefined && Math.abs(adj.highlights) > 0.001) {
    const highlightFactor = 1 - (adj.highlights / 100) * 0.3;
    if (highlightFactor > 0) {
      image.gamma(highlightFactor);
    }
  }

  if (adj.whites !== undefined && Math.abs(adj.whites) > 0.001) {
    const whiteFactor = adj.whites / 100;
    image.linear(1, whiteFactor * 30);
  }

  if (adj.blacks !== undefined && Math.abs(adj.blacks) > 0.001) {
    const blackFactor = adj.blacks / 100;
    image.linear(1, -blackFactor * 30);
  }

  if (adj.clarity !== undefined && Math.abs(adj.clarity) > 0.001) {
    const clarityAmount = Math.abs(adj.clarity) / 100;
    if (adj.clarity > 0) {
      image.sharpen({ sigma: 1, m1: 0.5 * clarityAmount, m2: 0.5 * clarityAmount });
    } else {
      image.blur(clarityAmount);
    }
  }

  if (adj.texture !== undefined && Math.abs(adj.texture) > 0.001) {
    const textureAmount = Math.abs(adj.texture) / 100;
    if (adj.texture > 0) {
      image.sharpen({ sigma: 0.5, m1: 0.3 * textureAmount, m2: 0.3 * textureAmount });
    }
  }

  if (adj.dehaze !== undefined && Math.abs(adj.dehaze) > 0.001) {
    const dehazeFactor = 1 + (adj.dehaze / 100) * 0.4;
    image.modulate({ saturation: dehazeFactor });
    image.linear(dehazeFactor, 0);
  }

  // Export
  const outputFormat = format.toLowerCase();

  if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
    await image.jpeg({ quality: parseInt(quality) }).toFile(outputPath);
  } else if (outputFormat === 'png') {
    await image.png({ quality: parseInt(quality) }).toFile(outputPath);
  } else if (outputFormat === 'webp') {
    await image.webp({ quality: parseInt(quality) }).toFile(outputPath);
  } else if (outputFormat === 'tiff' || outputFormat === 'tif') {
    await image.tiff({ quality: parseInt(quality) }).toFile(outputPath);
  } else {
    throw new Error(`Unsupported output format: ${format}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log(`
Snerk CLI - Batch image processing with presets

Usage:
  snerk-cli <preset-name-or-path> <input-files-or-dir> <output-dir> [options]

Options:
  --format <format>    Output format (jpeg, png, webp, tiff). Default: jpeg
  --quality <1-100>    Output quality. Default: 90

Examples:
  snerk-cli "Modern" ./photos ./output
  snerk-cli ./my-preset.yaml ./photos ./output --format png --quality 95
  snerk-cli "Classic Film" photo1.jpg ./output
    `);
    process.exit(1);
  }

  const presetArg = args[0];
  const inputArg = args[1];
  const outputDir = args[2];

  let format = 'jpeg';
  let quality = 90;

  // Parse options
  for (let i = 3; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      format = args[i + 1];
      i++;
    } else if (args[i] === '--quality' && args[i + 1]) {
      quality = parseInt(args[i + 1]);
      i++;
    }
  }

  try {
    // Load preset
    console.log(`Loading preset: ${presetArg}`);
    let preset;
    if (presetArg.endsWith('.yaml')) {
      preset = await loadPresetFromFile(presetArg);
    } else {
      preset = await loadPresetByName(presetArg);
    }
    console.log(`Loaded preset: ${preset.name}`);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Get input files
    let inputFiles = [];
    const inputStat = await fs.stat(inputArg);

    if (inputStat.isDirectory()) {
      const entries = await fs.readdir(inputArg);
      inputFiles = entries
        .filter(file => IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
        .map(file => path.join(inputArg, file));
    } else {
      inputFiles = [inputArg];
    }

    console.log(`Processing ${inputFiles.length} files...`);

    // Process each file
    let processed = 0;
    let failed = 0;

    for (const inputFile of inputFiles) {
      try {
        const basename = path.basename(inputFile, path.extname(inputFile));
        const outputFile = path.join(outputDir, `${basename}.${format}`);

        process.stdout.write(`Processing ${path.basename(inputFile)}... `);
        await applyPreset(inputFile, preset, outputFile, format, quality);
        console.log('✓');
        processed++;
      } catch (error) {
        console.log(`✗ ${error.message}`);
        failed++;
      }
    }

    console.log(`\nDone! Processed: ${processed}, Failed: ${failed}`);

    // Cleanup exiftool
    await exiftool.end();

  } catch (error) {
    console.error(`Error: ${error.message}`);
    await exiftool.end();
    process.exit(1);
  }
}

main();
