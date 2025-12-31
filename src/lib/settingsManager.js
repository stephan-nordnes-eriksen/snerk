class SettingsManager {
  constructor() {
    this.webgpuAvailable = false;
    this.effectiveMode = 'sharp';
    this.settings = {
      lastExportConfig: {
        format: 'jpeg',
        quality: 95,
        applyPreset: true,
        includeRaw: false
      },
      zoomSensitivity: 0.3
    };
  }

  async initialize() {
    await this.loadSettings();

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

  async loadSettings() {
    try {
      const buffer = await window.snerkAPI.loadSettings();
      if (buffer) {
        const text = new TextDecoder().decode(buffer);
        const loaded = JSON.parse(text);
        this.settings = { ...this.settings, ...loaded };
      }
    } catch (error) {
      console.log('No saved settings, using defaults');
    }
  }

  async saveSettings() {
    try {
      const json = JSON.stringify(this.settings, null, 2);
      await window.snerkAPI.saveSettings(json);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  getLastExportConfig() {
    return { ...this.settings.lastExportConfig };
  }

  async setLastExportConfig(config) {
    this.settings.lastExportConfig = { ...config };
    await this.saveSettings();
  }

  getZoomSensitivity() {
    return this.settings.zoomSensitivity !== undefined ? this.settings.zoomSensitivity : 0.3;
  }

  async setZoomSensitivity(sensitivity) {
    this.settings.zoomSensitivity = sensitivity;
    await this.saveSettings();
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
