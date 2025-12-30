class ProjectManager {
  constructor() {
    this.projectPath = null;
    this.projectData = {
      version: 1,
      files: {},
      exportConfig: {
        format: 'jpeg',
        quality: 95
      }
    };
  }

  async loadProject(folderPath) {
    this.projectPath = `${folderPath}/.snerk`;

    try {
      const buffer = await window.snerkAPI.readFile(this.projectPath);
      const text = new TextDecoder().decode(buffer);
      const loaded = JSON.parse(text);

      if (loaded.version === 1) {
        this.projectData = loaded;
        return true;
      }
    } catch (error) {
      console.log('No project file found, creating new project');
    }

    return false;
  }

  async saveProject() {
    if (!this.projectPath) return;

    try {
      const json = JSON.stringify(this.projectData, null, 2);
      await window.snerkAPI.writeFile(this.projectPath, json);
    } catch (error) {
      console.error('Error saving project file:', error);
    }
  }

  cleanupMissingFiles(currentFiles) {
    const currentFilenames = new Set(currentFiles.map(f => {
      const parts = f.split(/[\\/]/);
      return parts[parts.length - 1];
    }));

    const fileKeys = Object.keys(this.projectData.files);
    for (const filename of fileKeys) {
      if (!currentFilenames.has(filename)) {
        delete this.projectData.files[filename];
      }
    }
  }

  getFileMetadata(filePath) {
    const filename = filePath.split(/[\\/]/).pop();
    return this.projectData.files[filename] || {};
  }

  setFileMetadata(filePath, metadata) {
    const filename = filePath.split(/[\\/]/).pop();

    if (!this.projectData.files[filename]) {
      this.projectData.files[filename] = {};
    }

    this.projectData.files[filename] = {
      ...this.projectData.files[filename],
      ...metadata
    };

    this.saveProject();
  }

  getRotation(filePath) {
    const meta = this.getFileMetadata(filePath);
    return meta.rotation || 0;
  }

  setRotation(filePath, rotation) {
    this.setFileMetadata(filePath, { rotation });
  }

  getPinnedPreset(filePath) {
    const meta = this.getFileMetadata(filePath);
    return meta.pinnedPreset || null;
  }

  setPinnedPreset(filePath, presetName) {
    this.setFileMetadata(filePath, { pinnedPreset: presetName });
  }

  removePinnedPreset(filePath) {
    const filename = filePath.split(/[\\/]/).pop();
    if (this.projectData.files[filename]) {
      delete this.projectData.files[filename].pinnedPreset;
      this.saveProject();
    }
  }

  getExportConfig() {
    return { ...this.projectData.exportConfig };
  }

  setExportConfig(config) {
    this.projectData.exportConfig = { ...config };
    this.saveProject();
  }

  getAllFileMetadata() {
    return { ...this.projectData.files };
  }
}

window.ProjectManager = ProjectManager;
