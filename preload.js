const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snerkAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  selectExportFolder: () => ipcRenderer.invoke('dialog:saveFolder'),

  readDirectory: (dirPath) => ipcRenderer.invoke('file:readDirectory', dirPath),

  readFile: (filePath) => ipcRenderer.invoke('file:readFile', filePath),

  writeFile: (filePath, data) => ipcRenderer.invoke('file:writeFile', filePath, data),

  getPresetDirectory: () => ipcRenderer.invoke('preset:getDirectory'),

  findAllPresets: () => ipcRenderer.invoke('preset:findAll'),

  loadImagePreview: (imagePath) => ipcRenderer.invoke('image:loadPreview', imagePath),

  applyPreset: (imagePath, presetConfig) => ipcRenderer.invoke('image:applyPreset', imagePath, presetConfig),

  exportImage: (imagePath, presetConfig, outputPath, format, quality) =>
    ipcRenderer.invoke('image:export', imagePath, presetConfig, outputPath, format, quality),
});
