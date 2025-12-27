class PresetManager {
  constructor() {
    this.presets = [];
    this.presetsByCategory = {};
  }

  async loadPresets() {
    try {
      const presetDir = await window.snerkAPI.getPresetDirectory();
      await this.scanPresetsRecursive(presetDir);
      this.organizePresetsByCategory();
      return this.presets;
    } catch (error) {
      console.error('Error loading presets:', error);
      return [];
    }
  }

  async scanPresetsRecursive(dirPath, category = '') {
    try {
      const files = await window.snerkAPI.readDirectory(dirPath);

      for (const filePath of files) {
        const fileName = filePath.split('/').pop();

        if (fileName.endsWith('.yaml')) {
          await this.loadPresetFile(filePath, category);
        }
      }
    } catch (error) {
      console.error('Error scanning presets:', error);
    }
  }

  async loadPresetFile(filePath, category) {
    try {
      const buffer = await window.snerkAPI.readFile(filePath);
      const text = new TextDecoder().decode(buffer);
      const preset = this.parseYAML(text);

      if (preset && preset.name) {
        preset.filePath = filePath;
        preset.category = preset.category || category || 'uncategorized';
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
      } else if (currentSection === 'adjustments') {
        preset.adjustments[key] = parseFloat(value) || 0;
      } else if (currentSection === 'curves' && (key === 'r' || key === 'g' || key === 'b')) {
        try {
          preset.curves[key] = JSON.parse(value);
        } catch (e) {
          console.error('Error parsing curve:', e);
        }
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
}

window.PresetManager = PresetManager;
