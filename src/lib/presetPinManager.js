class PresetPinManager {
  constructor() {
    this.pins = new Map();
  }

  async loadPins() {
    try {
      const pins = await window.snerkAPI.loadPresetPins();
      this.pins = new Map(Object.entries(pins));
      return this.pins;
    } catch (error) {
      console.error('Error loading preset pins:', error);
      this.pins = new Map();
      return this.pins;
    }
  }

  async savePins() {
    try {
      const pinsObj = Object.fromEntries(this.pins);
      await window.snerkAPI.savePresetPins(pinsObj);
      return true;
    } catch (error) {
      console.error('Error saving preset pins:', error);
      throw error;
    }
  }

  async pinPreset(imagePath, presetName) {
    this.pins.set(imagePath, presetName);
    await this.savePins();
  }

  async unpinPreset(imagePath) {
    this.pins.delete(imagePath);
    await this.savePins();
  }

  getPinnedPreset(imagePath) {
    return this.pins.get(imagePath);
  }

  isPinned(imagePath) {
    return this.pins.has(imagePath);
  }
}
