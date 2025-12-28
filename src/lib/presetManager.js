class PresetManager {
  constructor() {
    this.presets = [];
    this.presetsByCategory = {};
  }

  async loadPresets() {
    try {
      this.presets = [];
      const presetFiles = await window.snerkAPI.findAllPresets();

      for (const filePath of presetFiles) {
        await this.loadPresetFile(filePath);
      }

      this.organizePresetsByCategory();
      return this.presets;
    } catch (error) {
      console.error('Error loading presets:', error);
      return [];
    }
  }

  async loadPresetFile(filePath) {
    try {
      const buffer = await window.snerkAPI.readFile(filePath);
      const text = new TextDecoder().decode(buffer);
      const preset = this.parseYAML(text);

      if (preset && preset.name) {
        preset.filePath = filePath;

        if (!preset.category) {
          const pathParts = filePath.split('/');
          const presetDirIndex = pathParts.findIndex(part => part === 'presets');
          if (presetDirIndex >= 0 && pathParts.length > presetDirIndex + 2) {
            preset.category = pathParts[presetDirIndex + 1];
          } else {
            preset.category = 'uncategorized';
          }
        }

        this.presets.push(preset);
      }
    } catch (error) {
      console.error(`Error loading preset ${filePath}:`, error);
    }
  }

  parseYAML(text) {
    const lines = text.split('\n');
    const preset = {
      adjustments: {},
      curves: {},
      hsl: []
    };

    let currentSection = null;
    let currentCurveChannel = null;
    let indent = 0;

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
      } else if (key === 'sharpening') {
        currentSection = 'sharpening';
        preset.sharpening = {};
      } else if (key === 'grain') {
        currentSection = 'grain';
        preset.grain = {};
      } else if (key === 'vignette') {
        currentSection = 'vignette';
        preset.vignette = {};
      } else if (currentSection === 'adjustments') {
        preset.adjustments[key] = parseFloat(value) || 0;
      } else if (currentSection === 'curves' && (key === 'r' || key === 'g' || key === 'b')) {
        try {
          preset.curves[key] = JSON.parse(value);
        } catch (e) {
          console.error('Error parsing curve:', e);
        }
      } else if (currentSection === 'splitToning') {
        preset.splitToning[key] = parseFloat(value) || 0;
      } else if (currentSection === 'sharpening') {
        preset.sharpening[key] = parseFloat(value) || 0;
      } else if (currentSection === 'grain') {
        preset.grain[key] = parseFloat(value) || 0;
      } else if (currentSection === 'vignette') {
        preset.vignette[key] = parseFloat(value) || 0;
      }
    }

    return preset;
  }

  organizePresetsByCategory() {
    this.presetsByCategory = {};
    for (const preset of this.presets) {
      const category = preset.category || 'uncategorized';
      if (!this.presetsByCategory[category]) {
        this.presetsByCategory[category] = [];
      }
      this.presetsByCategory[category].push(preset);
    }
  }

  getPresetByName(name) {
    return this.presets.find(p => p.name === name);
  }

  getAllPresets() {
    return this.presets;
  }

  getPresetsByCategory() {
    return this.presetsByCategory;
  }

  getCategories() {
    return Object.keys(this.presetsByCategory).sort();
  }

  validatePreset(preset) {
    if (!preset || typeof preset !== 'object') return false;
    if (!preset.name || typeof preset.name !== 'string') return false;
    return true;
  }

  async deletePreset(name) {
    const preset = this.getPresetByName(name);
    if (!preset) {
      throw new Error(`Preset "${name}" not found`);
    }

    if (!preset.filePath) {
      throw new Error(`Cannot delete preset "${name}" - no file path`);
    }

    // Don't allow deletion of default presets
    const defaultCategories = ['basic', 'bw', 'classic-film', 'modern'];
    if (preset.category && defaultCategories.includes(preset.category)) {
      throw new Error(`Cannot delete default preset "${name}"`);
    }

    try {
      await window.snerkAPI.deleteFile(preset.filePath);
      this.presets = this.presets.filter(p => p.name !== name);
      this.organizePresetsByCategory();
      return true;
    } catch (error) {
      console.error('Error deleting preset:', error);
      throw error;
    }
  }
}

window.PresetManager = PresetManager;
