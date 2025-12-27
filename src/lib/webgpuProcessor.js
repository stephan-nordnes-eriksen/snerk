class WebGPUProcessor {
  constructor() {
    this.device = null;
    this.pipelines = {};
  }

  async initialize() {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('No GPU adapter found');
      }

      this.device = await adapter.requestDevice();
      console.log('WebGPU device initialized successfully');

      return true;
    } catch (error) {
      console.error('WebGPU initialization failed:', error);
      throw error;
    }
  }

  async processImage(base64Data, presetConfig) {
    try {
      const imageBlob = this.base64ToBlob(base64Data);
      const imageBitmap = await createImageBitmap(imageBlob);

      if (!presetConfig || !presetConfig.adjustments) {
        const canvas = this.bitmapToCanvas(imageBitmap);
        const dataURL = canvas.toDataURL('image/jpeg', 0.9);

        return {
          src: dataURL,
          width: imageBitmap.width,
          height: imageBitmap.height
        };
      }

      console.log('WebGPU preset processing not yet implemented, returning original image');
      const canvas = this.bitmapToCanvas(imageBitmap);
      const dataURL = canvas.toDataURL('image/jpeg', 0.9);

      return {
        src: dataURL,
        width: imageBitmap.width,
        height: imageBitmap.height
      };
    } catch (error) {
      console.error('Error in WebGPU processing:', error);
      throw error;
    }
  }

  base64ToBlob(base64) {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: 'image/jpeg' });
  }

  bitmapToCanvas(bitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return canvas;
  }

  cleanup() {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}

window.WebGPUProcessor = WebGPUProcessor;
