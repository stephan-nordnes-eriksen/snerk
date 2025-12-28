class ImageProcessor {
  constructor() {
    this.cache = new Map();
    this.webgpuProcessor = null;
  }

  async initialize() {
    try {
      this.webgpuProcessor = new WebGPUProcessor();
      await this.webgpuProcessor.initialize();
      console.log('WebGPU processor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebGPU processor:', error);
      throw new Error('WebGPU is required but not available. Please use a browser that supports WebGPU.');
    }
  }

  async loadImage(imagePath) {
    try {
      const cacheKey = `preview_${imagePath}`;

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const result = await window.snerkAPI.loadImagePreview(imagePath);
      const imageData = await this.webgpuProcessor.processImage(result.data, null);

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

      const cacheKey = `preset_${imagePath}_${JSON.stringify(presetConfig)}`;

      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const result = await window.snerkAPI.loadImagePreview(imagePath);
      const imageData = await this.webgpuProcessor.processImage(result.data, presetConfig);

      this.cache.set(cacheKey, imageData);

      return imageData;
    } catch (error) {
      console.error('Error applying preset:', error);
      throw error;
    }
  }

  async exportImage(imagePath, presetConfig, outputPath, format = 'jpeg', quality = 90) {
    try {
      const result = await window.snerkAPI.loadFullResolutionImage(imagePath);

      let imageData;
      if (this.webgpuProcessor) {
        imageData = await this.webgpuProcessor.processImage(result.data, presetConfig);
      } else {
        throw new Error('WebGPU processor not initialized');
      }

      const blob = await this.dataURLToBlob(imageData.src);
      await window.snerkAPI.saveBlobAsImage(blob, outputPath, format, quality);

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
