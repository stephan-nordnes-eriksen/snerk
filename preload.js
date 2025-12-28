const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snerkAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  selectExportFolder: () => ipcRenderer.invoke('dialog:saveFolder'),

  selectXmpFile: () => ipcRenderer.invoke('dialog:openXmpFile'),

  readDirectory: (dirPath) => ipcRenderer.invoke('file:readDirectory', dirPath),

  readFile: (filePath) => ipcRenderer.invoke('file:readFile', filePath),

  writeFile: (filePath, data) => ipcRenderer.invoke('file:writeFile', filePath, data),

  deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),

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

  loadPresetPins: () => ipcRenderer.invoke('presetPins:load'),

  savePresetPins: (pinsObj) => ipcRenderer.invoke('presetPins:save', pinsObj),

  openSnerkFolder: () => ipcRenderer.invoke('folder:openSnerkFolder'),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  loadImagePreview: (imagePath) => ipcRenderer.invoke('image:loadPreview', imagePath),

  loadFullResolutionImage: (imagePath) => ipcRenderer.invoke('image:loadFullResolution', imagePath),

  getImageExifData: (imagePath) => ipcRenderer.invoke('image:getExifData', imagePath),

  applyPreset: (imagePath, presetConfig) => ipcRenderer.invoke('image:applyPreset', imagePath, presetConfig),

  saveBlobAsImage: async (blob, outputPath, format, quality) => {
    const arrayBuffer = await blob.arrayBuffer();
    return ipcRenderer.invoke('image:saveBlob', arrayBuffer, outputPath, format, quality);
  },
});
