class ImageProcessor {
  constructor(canvas) {
    this.cache = new Map();
    this.webgpuProcessor = null;
    this.canvas = canvas;
  }

  async initialize() {
    try {
      this.webgpuProcessor = new WebGPUProcessor(this.canvas);
      await this.webgpuProcessor.initialize();
      console.log('WebGPU processor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebGPU processor:', error);
      throw new Error('WebGPU is required but not available. Please use a browser that supports WebGPU.');
    }
  }

  async loadImage(imagePath) {
    try {
      const base64Data = await this.getBase64Data(imagePath);
      return await this.webgpuProcessor.processImage(base64Data, null, 1.0);
    } catch (error) {
      console.error('Error loading image:', error);
      throw error;
    }
  }

  async applyPresetToImage(imagePath, presetConfig, strength = 1.0) {
    try {
      if (!presetConfig || !presetConfig.adjustments) {
        return await this.loadImage(imagePath);
      }

      const base64Data = await this.getBase64Data(imagePath);
      return await this.webgpuProcessor.processImage(base64Data, presetConfig, strength);
    } catch (error) {
      console.error('Error applying preset:', error);
      throw error;
    }
  }

  async getBase64Data(imagePath) {
    const cacheKey = `base64_${imagePath}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = await window.snerkAPI.loadImagePreview(imagePath);
    this.cache.set(cacheKey, result.data);
    return result.data;
  }

  async exportImage(imagePath, presetConfig, outputPath, format = 'jpeg', quality = 90, rotation = 0) {
    try {
      const result = await window.snerkAPI.loadFullResolutionImage(imagePath);

      let imageData;
      if (this.webgpuProcessor) {
        imageData = await this.webgpuProcessor.exportImage(result.data, presetConfig);
      } else {
        throw new Error('WebGPU processor not initialized');
      }

      const blob = await this.dataURLToBlob(imageData.src);
      await window.snerkAPI.saveBlobAsImage(blob, outputPath, format, quality, rotation);

      return true;
    } catch (error) {
      console.error('Error exporting image:', error);
      throw error;
    }
  }

  async dataURLToBlob(dataURL) {
    const response = await fetch(dataURL);
    return await response.blob();
  }

  async exportBatch(imagePaths, presetConfig, rotationConfig, outputDir, format = 'jpeg', quality = 90, includeRaw = false, onProgress = null) {
    const results = [];
    let completed = 0;

    for (const imagePath of imagePaths) {
      try {
        const fileName = imagePath.split('/').pop().split('\\').pop();
        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
        const outputPath = `${outputDir}/${baseName}.${format}`;

        const preset = typeof presetConfig === 'function'
          ? presetConfig(imagePath)
          : presetConfig;

        const rotation = typeof rotationConfig === 'function'
          ? rotationConfig(imagePath)
          : (rotationConfig || 0);

        await this.exportImage(imagePath, preset, outputPath, format, quality, rotation);

        if (includeRaw) {
          const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
          const rawExtensions = ['.raf', '.arw', '.cr2', '.cr3', '.nef', '.dng', '.orf', '.rw2'];
          if (rawExtensions.includes(extension)) {
            const rawOutputPath = `${outputDir}/${fileName}`;
            await window.snerkAPI.copyFile(imagePath, rawOutputPath);
          }
        }

        results.push({ success: true, path: outputPath });
        completed++;

        if (onProgress) {
          onProgress(completed, imagePaths.length);
        }
      } catch (error) {
        results.push({ success: false, path: imagePath, error: error.message });
        completed++;

        if (onProgress) {
          onProgress(completed, imagePaths.length);
        }
      }
    }

    return results;
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheSize() {
    return this.cache.size;
  }
}

window.ImageProcessor = ImageProcessor;
