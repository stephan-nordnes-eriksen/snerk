class PresetVisibilityManager {
  constructor() {
    this.visibilityMap = new Map();
  }

  async initialize() {
    await this.loadVisibility();
  }

  async loadVisibility() {
    try {
      const buffer = await window.snerkAPI.loadSettings();
      if (buffer) {
        const text = new TextDecoder().decode(buffer);
        const settings = JSON.parse(text);
        if (settings.presetVisibility) {
          this.visibilityMap = new Map(Object.entries(settings.presetVisibility));
        }
      }
    } catch (error) {
      console.log('No saved preset visibility settings, using defaults');
    }
  }

  async saveVisibility() {
    try {
      const buffer = await window.snerkAPI.loadSettings();
      let settings = {};
      if (buffer) {
        const text = new TextDecoder().decode(buffer);
        settings = JSON.parse(text);
      }

      settings.presetVisibility = Object.fromEntries(this.visibilityMap);

      const json = JSON.stringify(settings, null, 2);
      await window.snerkAPI.saveSettings(json);
    } catch (error) {
      console.error('Error saving preset visibility:', error);
    }
  }

  isVisible(preset) {
    const presetName = typeof preset === 'string' ? preset : preset.name;
    const defaultVisible = typeof preset === 'object' && preset.visible !== undefined ? preset.visible : true;

    if (!this.visibilityMap.has(presetName)) {
      return defaultVisible;
    }
    return this.visibilityMap.get(presetName);
  }

  async setVisibility(presetName, visible) {
    this.visibilityMap.set(presetName, visible);
    await this.saveVisibility();
  }

  async toggleVisibility(presetName) {
    const currentVisibility = this.isVisible(presetName);
    await this.setVisibility(presetName, !currentVisibility);
    return !currentVisibility;
  }

  getVisibilityMap() {
    return new Map(this.visibilityMap);
  }
}

window.PresetVisibilityManager = PresetVisibilityManager;
