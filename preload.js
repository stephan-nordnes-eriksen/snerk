const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snerkAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  selectExportFolder: () => ipcRenderer.invoke('dialog:saveFolder'),

  selectXmpFile: () => ipcRenderer.invoke('dialog:openXmpFile'),

  readDirectory: (dirPath) => ipcRenderer.invoke('file:readDirectory', dirPath),

  readFile: (filePath) => ipcRenderer.invoke('file:readFile', filePath),

  writeFile: (filePath, data) => ipcRenderer.invoke('file:writeFile', filePath, data),

  getPresetDirectory: () => ipcRenderer.invoke('preset:getDirectory'),

  findAllPresets: () => ipcRenderer.invoke('preset:findAll'),

  saveImportedPreset: (presetName, yamlContent) =>
    ipcRenderer.invoke('preset:saveImported', presetName, yamlContent),

  renamePreset: (oldFilePath, newName) =>
    ipcRenderer.invoke('preset:rename', oldFilePath, newName),

  saveExportConfig: (dirPath, filename, content) =>
    ipcRenderer.invoke('exportConfig:save', dirPath, filename, content),

  getSettingsPath: () => ipcRenderer.invoke('settings:getPath'),

  loadSettings: () => ipcRenderer.invoke('settings:load'),

  saveSettings: (settingsJson) => ipcRenderer.invoke('settings:save', settingsJson),

  openSnerkFolder: () => ipcRenderer.invoke('folder:openSnerkFolder'),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  loadImagePreview: (imagePath) => ipcRenderer.invoke('image:loadPreview', imagePath),

  applyPreset: (imagePath, presetConfig) => ipcRenderer.invoke('image:applyPreset', imagePath, presetConfig),

  exportImage: (imagePath, presetConfig, outputPath, format, quality) =>
    ipcRenderer.invoke('image:export', imagePath, presetConfig, outputPath, format, quality),
});
