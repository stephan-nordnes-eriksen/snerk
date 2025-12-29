class SettingsManager {
  constructor() {
    this.webgpuAvailable = false;
    this.effectiveMode = 'sharp';
  }

  async initialize() {
    this.webgpuAvailable = await this.detectWebGPU();

    if (this.webgpuAvailable) {
      this.effectiveMode = 'webgpu';
    } else {
      console.warn('WebGPU unavailable, falling back to Sharp');
      this.effectiveMode = 'sharp';
      this.showFallbackNotification();
    }

    return this.effectiveMode;
  }

  async detectWebGPU() {
    if (!navigator.gpu) {
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;

      const device = await adapter.requestDevice();
      if (!device) return false;

      device.destroy();
      return true;
    } catch (e) {
      console.error('WebGPU detection failed:', e);
      return false;
    }
  }

  getRenderingMode() {
    return this.effectiveMode;
  }

  isWebGPUAvailable() {
    return this.webgpuAvailable;
  }

  showFallbackNotification() {
    const status = document.getElementById('status');
    if (status) {
      const originalText = status.textContent;
      status.textContent = 'WebGPU not available, using Sharp (CPU) mode';
      status.style.color = 'orange';

      setTimeout(() => {
        status.textContent = originalText;
        status.style.color = '';
      }, 5000);
    }
  }
}

window.SettingsManager = SettingsManager;
