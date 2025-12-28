class SettingsManager {
  constructor() {
    this.settings = null;
    this.webgpuAvailable = false;
    this.effectiveMode = 'sharp';
  }

  async loadSettings() {
    try {
      const settingsPath = await window.snerkAPI.getSettingsPath();
      const buffer = await window.snerkAPI.loadSettings();

      if (!buffer) {
        console.log('Settings file not found, using defaults');
        return this.getDefaultSettings();
      }

      const text = new TextDecoder().decode(buffer);
      return JSON.parse(text);
    } catch (error) {
      console.error('Error loading settings:', error);
      return this.getDefaultSettings();
    }
  }

  async saveSettings() {
    try {
      const json = JSON.stringify(this.settings, null, 2);
      await window.snerkAPI.saveSettings(json);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  getDefaultSettings() {
    return {
      version: "1.0",
      rendering: {
        mode: "sharp",
        fallbackToSharp: true
      }
    };
  }

  async initialize() {
    this.settings = await this.loadSettings();
    this.webgpuAvailable = await this.detectWebGPU();

    const requestedMode = this.settings.rendering.mode;

    if (requestedMode === 'webgpu' && !this.webgpuAvailable) {
      if (this.settings.rendering.fallbackToSharp) {
        console.warn('WebGPU unavailable, falling back to Sharp');
        this.effectiveMode = 'sharp';
        this.showFallbackNotification();
      } else {
        throw new Error('WebGPU requested but not available. Please enable fallback or use Sharp mode.');
      }
    } else {
      this.effectiveMode = requestedMode;
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

  async updateSetting(path, value) {
    const keys = path.split('.');
    let current = this.settings;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    await this.saveSettings();
  }
}

window.SettingsManager = SettingsManager;
