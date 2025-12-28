class ImageProcessor {
  constructor() {
    this.cache = new Map();
    this.settingsManager = null;
    this.webgpuProcessor = null;
  }

  async initialize(settingsManager) {
    this.settingsManager = settingsManager;

    if (settingsManager.getRenderingMode() === 'webgpu') {
      try {
        this.webgpuProcessor = new WebGPUProcessor();
        await this.webgpuProcessor.initialize();
        console.log('WebGPU processor initialized successfully');
      } catch (error) {
        console.error('Failed to initialize WebGPU processor:', error);
        console.log('Falling back to Sharp mode');
        this.webgpuProcessor = null;
        // Update settings to reflect the fallback
        if (settingsManager.settings.rendering.fallbackToSharp) {
          settingsManager.effectiveMode = 'sharp';
        }
      }
    }
  }

  async loadImage(imagePath) {
    try {
      const mode = this.settingsManager ? this.settingsManager.getRenderingMode() : 'sharp';
      const cacheKey = `${mode}_preview_${imagePath}`;

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const result = await window.snerkAPI.loadImagePreview(imagePath);

      let imageData;
      if (mode === 'webgpu' && this.webgpuProcessor) {
        imageData = await this.webgpuProcessor.processImage(result.data, null);
      } else {
        imageData = {
          src: `data:image/jpeg;base64,${result.data}`,
          width: result.width,
          height: result.height,
          format: result.format
        };
      }

      this.cache.set(cacheKey, imageData);

      return imageData;
    } catch (error) {
      console.error('Error loading image:', error);
      throw error;
    }
  }

  async applyPresetToImage(imagePath, presetConfig) {
    try {
      if (!presetConfig || !presetConfig.adjustments) {
        return await this.loadImage(imagePath);
      }

      const mode = this.settingsManager ? this.settingsManager.getRenderingMode() : 'sharp';
      const cacheKey = `${mode}_preset_${imagePath}_${JSON.stringify(presetConfig)}`;

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      let imageData;
      if (mode === 'webgpu' && this.webgpuProcessor) {
        const result = await window.snerkAPI.loadImagePreview(imagePath);
        imageData = await this.webgpuProcessor.processImage(result.data, presetConfig);
      } else {
        const result = await window.snerkAPI.applyPreset(imagePath, presetConfig);
        imageData = {
          src: `data:image/jpeg;base64,${result.data}`,
          width: result.width,
          height: result.height
        };
      }

      this.cache.set(cacheKey, imageData);

      return imageData;
    } catch (error) {
      console.error('Error applying preset:', error);
      throw error;
    }
  }

  async exportImage(imagePath, presetConfig, outputPath, format = 'jpeg', quality = 90) {
    try {
      await window.snerkAPI.exportImage(imagePath, presetConfig, outputPath, format, quality);
      return true;
    } catch (error) {
      console.error('Error exporting image:', error);
      throw error;
    }
  }

  async exportBatch(imagePaths, presetConfig, outputDir, format = 'jpeg', quality = 90, onProgress = null) {
    const results = [];
    let completed = 0;

    for (const imagePath of imagePaths) {
      try {
        const fileName = imagePath.split('/').pop().split('\\').pop();
        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
        const outputPath = `${outputDir}/${baseName}.${format}`;

        await this.exportImage(imagePath, presetConfig, outputPath, format, quality);

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
