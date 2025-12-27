class ExportConfigManager {
  constructor() {
    this.configs = [];
    this.defaultConfigs = [
      { name: 'High Quality JPEG', format: 'jpeg', quality: 95 },
      { name: 'Web Optimized JPEG', format: 'jpeg', quality: 80 },
      { name: 'PNG Lossless', format: 'png', quality: 100 },
      { name: 'WebP High Quality', format: 'webp', quality: 90 },
    ];
  }

  async loadConfigs() {
    try {
      const configDir = await window.snerkAPI.getPresetDirectory();
      const exportConfigDir = configDir.replace(/presets$/, 'export-configs');

      // Try to read export configs directory
      try {
        const files = await window.snerkAPI.readDirectory(exportConfigDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        for (const file of jsonFiles) {
          const filePath = `${exportConfigDir}/${file}`;
          try {
            const buffer = await window.snerkAPI.readFile(filePath);
            const text = new TextDecoder().decode(buffer);
            const config = JSON.parse(text);
            if (config.name && config.format) {
              config.filePath = filePath;
              this.configs.push(config);
            }
          } catch (error) {
            console.error(`Error loading export config ${file}:`, error);
          }
        }
      } catch (error) {
        // Directory doesn't exist, use defaults only
        console.log('Export configs directory not found, using defaults');
      }

      // Always add default configs (they won't have filePath)
      this.configs = [...this.defaultConfigs, ...this.configs];
      return this.configs;
    } catch (error) {
      console.error('Error loading export configs:', error);
      return this.defaultConfigs;
    }
  }

  async saveConfig(config) {
    try {
      const configDir = await window.snerkAPI.getPresetDirectory();
      const exportConfigDir = configDir.replace(/presets$/, 'export-configs');

      // Create directory if it doesn't exist (will be handled by main process)
      const filename = config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
      await window.snerkAPI.saveExportConfig(exportConfigDir, filename, JSON.stringify(config, null, 2));

      return true;
    } catch (error) {
      console.error('Error saving export config:', error);
      throw error;
    }
  }

  getConfigs() {
    return this.configs;
  }

  findConfig(name) {
    return this.configs.find(c => c.name === name);
  }
}
