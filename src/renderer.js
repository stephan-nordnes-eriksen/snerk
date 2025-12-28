const fileManager = new FileManager();
const presetManager = new PresetManager();
const imageProcessor = new ImageProcessor();
const exportConfigManager = new ExportConfigManager();

const state = {
  currentFolder: null,
  currentPreset: null,
  presets: [],
  zoom: {
    level: 1,
    minLevel: 0.05,
    maxLevel: 30,
    step: 0.05,
    panX: 0,
    panY: 0,
    isPanning: false,
    startX: 0,
    startY: 0,
  },
};

const elements = {
  openFolderBtn: document.getElementById('openFolder'),
  exportBtn: document.getElementById('exportBtn'),
  importXmpBtn: document.getElementById('importXmpBtn'),
  mainImage: document.getElementById('mainImage'),
  imageCounter: document.getElementById('imageCounter'),
  imagePath: document.getElementById('imagePath'),
  prevBtn: document.getElementById('prevImage'),
  nextBtn: document.getElementById('nextImage'),
  presetCategories: document.getElementById('presetCategories'),
  status: document.getElementById('status'),
  emptyState: document.getElementById('emptyState'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  exportDialog: document.getElementById('exportDialog'),
  exportProgress: document.getElementById('exportProgress'),
  exportStatus: document.getElementById('exportStatus'),
  closeExportDialog: document.getElementById('closeExportDialog'),
  exportFormat: document.getElementById('exportFormat'),
  exportQuality: document.getElementById('exportQuality'),
  qualityValue: document.getElementById('qualityValue'),
  uiOverlay: document.getElementById('uiOverlay'),
  presetPanel: document.getElementById('presetPanel'),
  togglePresetPanel: document.getElementById('togglePresetPanel'),
  renameDialog: document.getElementById('renameDialog'),
  renameDialogTitle: document.getElementById('renameDialogTitle'),
  renameInput: document.getElementById('renameInput'),
  renameConfirmBtn: document.getElementById('renameConfirmBtn'),
  renameCancelBtn: document.getElementById('renameCancelBtn'),
  exportConfigDialog: document.getElementById('exportConfigDialog'),
  exportConfigSelect: document.getElementById('exportConfigSelect'),
  exportApplyPreset: document.getElementById('exportApplyPreset'),
  saveExportConfigBtn: document.getElementById('saveExportConfigBtn'),
  deleteExportConfigBtn: document.getElementById('deleteExportConfigBtn'),
  cancelExportConfigBtn: document.getElementById('cancelExportConfigBtn'),
  confirmExportBtn: document.getElementById('confirmExportBtn'),
  exportProgressDialog: document.getElementById('exportProgressDialog'),
  manageExportConfigsBtn: document.getElementById('manageExportConfigsBtn'),
  createPresetBtn: document.getElementById('createPresetBtn'),
  noFilterBtn: document.getElementById('noFilterBtn'),
  openSnerkFolderBtn: document.getElementById('openSnerkFolderBtn'),
  githubLink: document.getElementById('githubLink'),
  showConfigBtn: document.getElementById('showConfigBtn'),
  presetEditorPanel: document.getElementById('presetEditorPanel'),
  closePresetEditor: document.getElementById('closePresetEditor'),
  editorExposure: document.getElementById('editorExposure'),
  editorExposureValue: document.getElementById('editorExposureValue'),
  editorContrast: document.getElementById('editorContrast'),
  editorContrastValue: document.getElementById('editorContrastValue'),
  editorSaturation: document.getElementById('editorSaturation'),
  editorSaturationValue: document.getElementById('editorSaturationValue'),
  editorShadows: document.getElementById('editorShadows'),
  editorShadowsValue: document.getElementById('editorShadowsValue'),
  editorHighlights: document.getElementById('editorHighlights'),
  editorHighlightsValue: document.getElementById('editorHighlightsValue'),
  editorTemperature: document.getElementById('editorTemperature'),
  editorTemperatureValue: document.getElementById('editorTemperatureValue'),
  editorTint: document.getElementById('editorTint'),
  editorTintValue: document.getElementById('editorTintValue'),
  editorVibrance: document.getElementById('editorVibrance'),
  editorVibranceValue: document.getElementById('editorVibranceValue'),
  editorClarity: document.getElementById('editorClarity'),
  editorClarityValue: document.getElementById('editorClarityValue'),
  editorTexture: document.getElementById('editorTexture'),
  editorTextureValue: document.getElementById('editorTextureValue'),
  editorDehaze: document.getElementById('editorDehaze'),
  editorDehazeValue: document.getElementById('editorDehazeValue'),
  resetPresetEditorBtn: document.getElementById('resetPresetEditorBtn'),
  renamePresetBtn: document.getElementById('renamePresetBtn'),
  deletePresetBtn: document.getElementById('deletePresetBtn'),
  cancelPresetEditorBtn: document.getElementById('cancelPresetEditorBtn'),
  copyToCustomBtn: document.getElementById('copyToCustomBtn'),
  updatePresetBtn: document.getElementById('updatePresetBtn'),
  savePresetEditorBtn: document.getElementById('savePresetEditorBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsRenderingMode: document.getElementById('settingsRenderingMode'),
  settingsFallbackToSharp: document.getElementById('settingsFallbackToSharp'),
  webgpuStatusText: document.getElementById('webgpuStatusText'),
  settingsSaveBtn: document.getElementById('settingsSaveBtn'),
  settingsCancelBtn: document.getElementById('settingsCancelBtn'),
  zoomFitBtn: document.getElementById('zoomFitBtn'),
  zoom100Btn: document.getElementById('zoom100Btn'),
};

async function initialize() {
  try {
    updateStatus('Initializing WebGPU...');
    await imageProcessor.initialize();

    updateStatus('Loading presets...');
    state.presets = await presetManager.loadPresets();
    renderPresets();
    await loadExportConfigs();

    updateStatus('Ready');
  } catch (error) {
    console.error('Error initializing:', error);
    updateStatus('Error during initialization');
  }
}

function renderPresets() {
  const categories = presetManager.getPresetsByCategory();

  elements.presetCategories.innerHTML = '';

  for (const [category, presets] of Object.entries(categories)) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'preset-category';

    const categoryTitle = document.createElement('h4');
    categoryTitle.textContent = category.replace(/-/g, ' ');
    categoryDiv.appendChild(categoryTitle);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'preset-buttons';

    for (const preset of presets) {
      const button = document.createElement('button');
      button.className = 'preset-btn secondary';
      button.textContent = preset.name;
      button.dataset.presetName = preset.name;
      button.onclick = () => selectPreset(preset.name);
      buttonContainer.appendChild(button);
    }

    categoryDiv.appendChild(buttonContainer);
    elements.presetCategories.appendChild(categoryDiv);
  }
}

async function openFolder() {
  try {
    const folderPath = await window.snerkAPI.selectFolder();

    if (!folderPath) return;

    state.currentFolder = folderPath;
    updateStatus('Scanning folder...');

    const images = await fileManager.scanDirectory(folderPath);

    if (images.length === 0) {
      updateStatus('No supported images found in folder');
      return;
    }

    elements.emptyState.classList.add('hidden');
    elements.exportBtn.disabled = false;

    updateStatus(`Loaded ${images.length} images`);
    updateImageCounter();

    await loadCurrentImage();
  } catch (error) {
    console.error('Error opening folder:', error);
    updateStatus('Error opening folder');
  }
}

async function loadCurrentImage() {
  const currentImage = fileManager.getCurrentImage();

  if (!currentImage) return;

  try {
    updateImageCounter();
    updateImagePath(currentImage);

    const imageData = state.currentPreset
      ? await imageProcessor.applyPresetToImage(currentImage, state.currentPreset)
      : await imageProcessor.loadImage(currentImage);

    elements.mainImage.src = imageData.src;
    elements.mainImage.classList.add('loaded');

    updateNavigationButtons();
  } catch (error) {
    console.error('Error loading image:', error);
    updateStatus('Error loading image');
  }
}

function showLoading(show) {
  if (show) {
    elements.loadingIndicator.classList.remove('hidden');
  } else {
    elements.loadingIndicator.classList.add('hidden');
  }
}

function updateImageCounter() {
  const count = fileManager.getImageCount();
  const index = fileManager.getCurrentIndex();

  if (count === 0) {
    elements.imageCounter.textContent = 'No images loaded';
  } else {
    elements.imageCounter.textContent = `${index + 1} / ${count}`;
  }
}

function updateImagePath(path) {
  const fileName = path.split('/').pop().split('\\').pop();
  elements.imagePath.textContent = fileName;
}

function updateNavigationButtons() {
  const count = fileManager.getImageCount();
  elements.prevBtn.disabled = count === 0;
  elements.nextBtn.disabled = count === 0;
}

function updateStatus(message) {
  elements.status.textContent = message;
}

async function navigateNext() {
  fileManager.getNextImage();
  await loadCurrentImage();
}

async function navigatePrevious() {
  fileManager.getPreviousImage();
  await loadCurrentImage();
}

async function selectPreset(presetName) {
  const preset = presetManager.getPresetByName(presetName);

  if (!preset) {
    state.currentPreset = null;
    clearActivePresetButtons();
    elements.showConfigBtn.disabled = true;
  } else if (state.currentPreset && state.currentPreset.name === presetName) {
    state.currentPreset = null;
    clearActivePresetButtons();
    elements.showConfigBtn.disabled = true;
  } else {
    state.currentPreset = preset;
    setActivePresetButton(presetName);
    elements.showConfigBtn.disabled = false;
  }

  if (fileManager.getCurrentImage()) {
    await loadCurrentImage();
  }
}

function setActivePresetButton(presetName) {
  clearActivePresetButtons();

  const button = document.querySelector(`button[data-preset-name="${presetName}"]`);
  if (button) {
    button.classList.add('active');
  }
}

function clearActivePresetButtons() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('active');
  });
}

async function loadExportConfigs() {
  try {
    const configs = await exportConfigManager.loadConfigs();

    elements.exportConfigSelect.innerHTML = '<option value="">Custom...</option>';

    for (const config of configs) {
      const option = document.createElement('option');
      option.value = config.name;
      option.textContent = config.name;
      elements.exportConfigSelect.appendChild(option);
    }
  } catch (error) {
    console.error('Error loading export configs:', error);
  }
}

async function showExportConfigDialog() {
  const images = fileManager.getAllImages();

  if (images.length === 0) {
    updateStatus('No images to export');
    return;
  }

  return new Promise((resolve) => {
    const handleConfigSelect = () => {
      const configName = elements.exportConfigSelect.value;
      if (configName) {
        const config = exportConfigManager.findConfig(configName);
        if (config) {
          elements.exportFormat.value = config.format;
          elements.exportQuality.value = config.quality;
          elements.qualityValue.textContent = config.quality;

          // Show delete button only for custom configs (those with filePath)
          if (config.filePath) {
            elements.deleteExportConfigBtn.classList.remove('hidden');
          } else {
            elements.deleteExportConfigBtn.classList.add('hidden');
          }
        }
      } else {
        elements.deleteExportConfigBtn.classList.add('hidden');
      }
    };

    const handleSaveConfig = async () => {
      const configName = await showRenameDialog('Save Export Config', 'My Export Config');
      if (!configName) return;

      const config = {
        name: configName,
        format: elements.exportFormat.value,
        quality: parseInt(elements.exportQuality.value),
      };

      try {
        await exportConfigManager.saveConfig(config);
        await loadExportConfigs();
        updateStatus(`Saved export config "${configName}"`);
      } catch (error) {
        console.error('Error saving export config:', error);
        await showAlert('Error saving export config: ' + error.message);
      }
    };

    const handleDeleteConfig = async () => {
      const configName = elements.exportConfigSelect.value;
      if (!configName) return;

      const confirmed = await showConfirmDialog(
        'Delete Export Config',
        `Are you sure you want to delete the export config "${configName}"? This cannot be undone.`
      );

      if (!confirmed) return;

      try {
        await exportConfigManager.deleteConfig(configName);
        await loadExportConfigs();
        elements.exportConfigSelect.value = '';
        elements.deleteExportConfigBtn.classList.add('hidden');
        updateStatus(`Deleted export config "${configName}"`);
      } catch (error) {
        console.error('Error deleting export config:', error);
        await showAlert('Error deleting export config: ' + error.message);
      }
    };

    const handleConfirm = async () => {
      cleanup();
      elements.exportConfigDialog.close();
      await performExport();
      resolve();
    };

    const handleCancel = () => {
      cleanup();
      elements.exportConfigDialog.close();
      resolve();
    };

    const cleanup = () => {
      elements.exportConfigSelect.removeEventListener('change', handleConfigSelect);
      elements.saveExportConfigBtn.removeEventListener('click', handleSaveConfig);
      elements.deleteExportConfigBtn.removeEventListener('click', handleDeleteConfig);
      elements.confirmExportBtn.removeEventListener('click', handleConfirm);
      elements.cancelExportConfigBtn.removeEventListener('click', handleCancel);
    };

    elements.exportConfigSelect.addEventListener('change', handleConfigSelect);
    elements.saveExportConfigBtn.addEventListener('click', handleSaveConfig);
    elements.deleteExportConfigBtn.addEventListener('click', handleDeleteConfig);
    elements.confirmExportBtn.addEventListener('click', handleConfirm);
    elements.cancelExportConfigBtn.addEventListener('click', handleCancel);

    elements.exportConfigDialog.showModal();
  });
}

async function performExport() {
  try {
    const images = fileManager.getAllImages();

    const outputDir = await window.snerkAPI.selectExportFolder();

    if (!outputDir) return;

    const format = elements.exportFormat.value;
    const quality = parseInt(elements.exportQuality.value);
    const applyPreset = elements.exportApplyPreset.checked;
    const preset = applyPreset ? state.currentPreset : null;

    elements.exportProgressDialog.showModal();
    elements.exportProgress.max = images.length;
    elements.exportProgress.value = 0;
    elements.exportStatus.textContent = `Exporting 0 / ${images.length}...`;

    const results = await imageProcessor.exportBatch(
      images,
      preset,
      outputDir,
      format,
      quality,
      (completed, total) => {
        elements.exportProgress.value = completed;
        elements.exportStatus.textContent = `Exported ${completed} / ${total}...`;
      }
    );

    const successCount = results.filter(r => r.success).length;

    elements.exportStatus.textContent = `Exported ${successCount} / ${images.length} images successfully`;

    setTimeout(() => {
      elements.exportProgressDialog.close();
    }, 2000);

    updateStatus(`Export complete: ${successCount} images`);
  } catch (error) {
    console.error('Error exporting images:', error);
    updateStatus('Error exporting images');
    elements.exportProgressDialog.close();
  }
}

function getUniquePresetName(baseName, existingNames) {
  let name = baseName;
  let copyNumber = 1;

  while (existingNames.includes(name)) {
    name = `${baseName} (copy ${copyNumber})`;
    copyNumber++;
  }

  return name;
}

function showRenameDialog(title, defaultValue = '') {
  return new Promise((resolve) => {
    elements.renameDialogTitle.textContent = title;
    elements.renameInput.value = defaultValue;

    const handleConfirm = () => {
      const value = elements.renameInput.value.trim();
      cleanup();
      resolve(value);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    const cleanup = () => {
      elements.renameConfirmBtn.removeEventListener('click', handleConfirm);
      elements.renameCancelBtn.removeEventListener('click', handleCancel);
      elements.renameInput.removeEventListener('keydown', handleKeydown);
      elements.renameDialog.close();
    };

    elements.renameConfirmBtn.addEventListener('click', handleConfirm);
    elements.renameCancelBtn.addEventListener('click', handleCancel);
    elements.renameInput.addEventListener('keydown', handleKeydown);

    elements.renameDialog.showModal();
    elements.renameInput.focus();
    elements.renameInput.select();
  });
}

function showAlert(message) {
  // Use the rename dialog for alerts too
  return new Promise((resolve) => {
    elements.renameDialogTitle.textContent = 'Alert';
    elements.renameInput.style.display = 'none';

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.margin = '1rem 0';

    const contentDiv = elements.renameDialog.querySelector('div');
    const originalContent = contentDiv.innerHTML;
    contentDiv.innerHTML = '';
    contentDiv.appendChild(messageEl);

    elements.renameConfirmBtn.textContent = 'OK';
    elements.renameCancelBtn.style.display = 'none';

    const handleConfirm = () => {
      cleanup();
      resolve();
    };

    const handleKeydown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleConfirm();
      }
    };

    const cleanup = () => {
      elements.renameConfirmBtn.removeEventListener('click', handleConfirm);
      document.removeEventListener('keydown', handleKeydown);
      elements.renameDialog.close();

      // Restore original content
      contentDiv.innerHTML = originalContent;
      elements.renameInput.style.display = '';
      elements.renameConfirmBtn.textContent = 'OK';
      elements.renameCancelBtn.style.display = '';
    };

    elements.renameConfirmBtn.addEventListener('click', handleConfirm);
    document.addEventListener('keydown', handleKeydown);

    elements.renameDialog.showModal();
  });
}

function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    elements.renameDialogTitle.textContent = title;
    elements.renameInput.style.display = 'none';

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.margin = '1rem 0';

    const contentDiv = elements.renameDialog.querySelector('div');
    const originalContent = contentDiv.innerHTML;
    contentDiv.innerHTML = '';
    contentDiv.appendChild(messageEl);

    elements.renameConfirmBtn.textContent = 'Yes';
    elements.renameCancelBtn.textContent = 'No';
    elements.renameCancelBtn.style.display = '';

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    const cleanup = () => {
      elements.renameConfirmBtn.removeEventListener('click', handleConfirm);
      elements.renameCancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeydown);
      elements.renameDialog.close();

      // Restore original content
      contentDiv.innerHTML = originalContent;
      elements.renameInput.style.display = '';
      elements.renameConfirmBtn.textContent = 'OK';
      elements.renameCancelBtn.textContent = 'Cancel';
      elements.renameCancelBtn.style.display = '';
    };

    elements.renameConfirmBtn.addEventListener('click', handleConfirm);
    elements.renameCancelBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeydown);

    elements.renameDialog.showModal();
  });
}

async function openSettings() {
  elements.settingsDialog.showModal();
}

async function saveSettings() {
  elements.settingsDialog.close();
}

async function renamePreset(preset) {
  try {
    const newName = await showRenameDialog('Rename Preset', preset.name);
    if (!newName || newName === '') {
      return;
    }

    if (newName === preset.name) {
      return; // No change
    }

    // Check for conflicts
    const existingNames = state.presets.map(p => p.name).filter(n => n !== preset.name);
    if (existingNames.includes(newName)) {
      await showAlert('A preset with this name already exists');
      return;
    }

    updateStatus('Renaming preset...');

    await window.snerkAPI.renamePreset(preset.filePath, newName);

    updateStatus(`Renamed to "${newName}" successfully`);

    // Reload presets
    await initialize();
  } catch (error) {
    console.error('Error renaming preset:', error);
    updateStatus('Error renaming preset: ' + error.message);
    await showAlert('Error renaming preset: ' + error.message);
  }
}

async function importXmpPreset() {
  try {
    updateStatus('Select XMP preset file...');
    const xmpPath = await window.snerkAPI.selectXmpFile();

    if (!xmpPath) {
      updateStatus('Import cancelled');
      return;
    }

    updateStatus('Reading XMP file...');
    const buffer = await window.snerkAPI.readFile(xmpPath);
    const xmpContent = new TextDecoder().decode(buffer);

    // Extract filename from path
    const filename = xmpPath.split(/[\\/]/).pop();

    updateStatus('Converting preset...');
    const xmpImporter = new XmpImporter();
    const preset = xmpImporter.parseXmpToPreset(xmpContent, filename);

    // Prompt user to customize the name
    let desiredName = preset.name;
    let shouldOverwrite = false;

    while (true) {
      const customName = await showRenameDialog('Import Preset - Enter Name', desiredName);
      if (customName === null) {
        updateStatus('Import cancelled');
        return;
      }

      const finalName = customName.trim() || preset.name;

      // Check if preset with this name already exists
      const existingPreset = state.presets.find(p => p.name === finalName);
      if (existingPreset) {
        const shouldReplace = await showConfirmDialog(
          'Preset Already Exists',
          `A preset named "${finalName}" already exists. Do you want to replace it?`
        );

        if (shouldReplace) {
          // Delete the existing preset before importing
          try {
            await presetManager.deletePreset(finalName);
            shouldOverwrite = true;
            desiredName = finalName;
            break;
          } catch (error) {
            // If we can't delete it (e.g., it's a default preset), suggest a new name
            await showAlert(`Cannot replace preset "${finalName}". Please choose a different name.`);
            desiredName = getUniquePresetName(finalName, state.presets.map(p => p.name));
            continue;
          }
        } else {
          // User chose not to replace, suggest a unique name
          desiredName = getUniquePresetName(finalName, state.presets.map(p => p.name));
          continue;
        }
      } else {
        desiredName = finalName;
        break;
      }
    }

    preset.name = desiredName;

    const yamlContent = xmpImporter.generateYaml(preset);

    updateStatus('Saving preset...');
    await window.snerkAPI.saveImportedPreset(preset.name, yamlContent);

    updateStatus(`Imported "${preset.name}" successfully`);

    // Reload presets to include the new one
    await initialize();
  } catch (error) {
    console.error('Error importing XMP preset:', error);
    updateStatus('Error importing XMP preset: ' + error.message);
  }
}

function getEditorPresetConfig() {
  const config = {
    name: 'Live Preview',
    adjustments: {},
  };

  const exposure = parseFloat(elements.editorExposure.value);
  const contrast = parseInt(elements.editorContrast.value);
  const saturation = parseInt(elements.editorSaturation.value);
  const shadows = parseInt(elements.editorShadows.value);
  const highlights = parseInt(elements.editorHighlights.value);
  const temperature = parseInt(elements.editorTemperature.value);
  const tint = parseInt(elements.editorTint.value);
  const vibrance = parseInt(elements.editorVibrance.value);
  const clarity = parseInt(elements.editorClarity.value);
  const texture = parseInt(elements.editorTexture.value);
  const dehaze = parseInt(elements.editorDehaze.value);

  if (exposure !== 0) config.adjustments.exposure = exposure;
  if (contrast !== 0) config.adjustments.contrast = 1 + (contrast / 100);
  if (saturation !== 0) config.adjustments.saturation = 1 + (saturation / 100);
  if (shadows !== 0) config.adjustments.shadows = shadows;
  if (highlights !== 0) config.adjustments.highlights = highlights;
  if (temperature !== 0) config.adjustments.temperature = temperature;
  if (tint !== 0) config.adjustments.tint = tint;
  if (vibrance !== 0) config.adjustments.vibrance = vibrance;
  if (clarity !== 0) config.adjustments.clarity = clarity;
  if (texture !== 0) config.adjustments.texture = texture;
  if (dehaze !== 0) config.adjustments.dehaze = dehaze;

  const curves = {};

  if (curveEditors.rgb) {
    const rgbPoints = curveEditors.rgb.getPoints();
    if (rgbPoints.length > 2 || (rgbPoints.length === 2 && (rgbPoints[0][1] !== 0 || rgbPoints[1][1] !== 255))) {
      curves.rgb = rgbPoints;
    }
  }

  if (curveEditors.r) {
    const rPoints = curveEditors.r.getPoints();
    if (rPoints.length > 2 || (rPoints.length === 2 && (rPoints[0][1] !== 0 || rPoints[1][1] !== 255))) {
      curves.r = rPoints;
    }
  }

  if (curveEditors.g) {
    const gPoints = curveEditors.g.getPoints();
    if (gPoints.length > 2 || (gPoints.length === 2 && (gPoints[0][1] !== 0 || gPoints[1][1] !== 255))) {
      curves.g = gPoints;
    }
  }

  if (curveEditors.b) {
    const bPoints = curveEditors.b.getPoints();
    if (bPoints.length > 2 || (bPoints.length === 2 && (bPoints[0][1] !== 0 || bPoints[1][1] !== 255))) {
      curves.b = bPoints;
    }
  }

  if (Object.keys(curves).length > 0) {
    config.curves = curves;
  }

  return config;
}

async function updateEditorPreview() {
  if (!fileManager.getCurrentImage()) return;

  const config = getEditorPresetConfig();

  try {
    const imageData = await imageProcessor.applyPresetToImage(
      fileManager.getCurrentImage(),
      config
    );
    elements.mainImage.src = imageData.src;
  } catch (error) {
    console.error('Error updating editor preview:', error);
  }
}

function resetPresetEditor() {
  elements.editorExposure.value = 0;
  elements.editorExposureValue.textContent = 0;
  elements.editorContrast.value = 0;
  elements.editorContrastValue.textContent = 0;
  elements.editorSaturation.value = 0;
  elements.editorSaturationValue.textContent = 0;
  elements.editorShadows.value = 0;
  elements.editorShadowsValue.textContent = 0;
  elements.editorHighlights.value = 0;
  elements.editorHighlightsValue.textContent = 0;
  elements.editorTemperature.value = 0;
  elements.editorTemperatureValue.textContent = 0;
  elements.editorTint.value = 0;
  elements.editorTintValue.textContent = 0;
  elements.editorVibrance.value = 0;
  elements.editorVibranceValue.textContent = 0;
  elements.editorClarity.value = 0;
  elements.editorClarityValue.textContent = 0;
  elements.editorTexture.value = 0;
  elements.editorTextureValue.textContent = 0;
  elements.editorDehaze.value = 0;
  elements.editorDehazeValue.textContent = 0;

  if (curveEditors.rgb) curveEditors.rgb.reset();
  if (curveEditors.r) curveEditors.r.reset();
  if (curveEditors.g) curveEditors.g.reset();
  if (curveEditors.b) curveEditors.b.reset();

  updateEditorPreview();
}

function setupEditorSliders() {
  const sliders = [
    { slider: elements.editorExposure, value: elements.editorExposureValue },
    { slider: elements.editorContrast, value: elements.editorContrastValue },
    { slider: elements.editorSaturation, value: elements.editorSaturationValue },
    { slider: elements.editorShadows, value: elements.editorShadowsValue },
    { slider: elements.editorHighlights, value: elements.editorHighlightsValue },
    { slider: elements.editorTemperature, value: elements.editorTemperatureValue },
    { slider: elements.editorTint, value: elements.editorTintValue },
    { slider: elements.editorVibrance, value: elements.editorVibranceValue },
    { slider: elements.editorClarity, value: elements.editorClarityValue },
    { slider: elements.editorTexture, value: elements.editorTextureValue },
    { slider: elements.editorDehaze, value: elements.editorDehazeValue },
  ];

  for (const { slider, value } of sliders) {
    slider.addEventListener('input', () => {
      value.textContent = slider.value;
      updateEditorPreview();
    });
  }

}

const curveEditors = {
  rgb: null,
  r: null,
  g: null,
  b: null
};

let activeCurve = 'rgb';

function setupCurveEditors() {
  curveEditors.rgb = new CurveEditor('curveEditorRGB');
  curveEditors.r = new CurveEditor('curveEditorR');
  curveEditors.g = new CurveEditor('curveEditorG');
  curveEditors.b = new CurveEditor('curveEditorB');

  Object.values(curveEditors).forEach(editor => {
    editor.onChange = () => updateEditorPreview();
  });

  document.querySelectorAll('.curve-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const curveType = tab.dataset.curve;
      switchCurveTab(curveType);
    });
  });

  const resetCurveBtn = document.getElementById('resetCurrentCurve');
  if (resetCurveBtn) {
    resetCurveBtn.addEventListener('click', () => {
      curveEditors[activeCurve].reset();
    });
  }
}

function switchCurveTab(curveType) {
  activeCurve = curveType;

  document.querySelectorAll('.curve-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.curve === curveType);
  });

  document.querySelectorAll('.curve-canvas').forEach(canvas => {
    canvas.classList.toggle('active', canvas.id === `curveEditor${curveType.toUpperCase()}`);
  });
}

async function openPresetEditor() {
  if (!fileManager.getCurrentImage()) {
    await showAlert('Please open a folder with images first');
    return;
  }

  resetPresetEditor();

  // Reset button visibility for new preset creation
  elements.savePresetEditorBtn.classList.remove('hidden');
  elements.copyToCustomBtn.classList.add('hidden');
  elements.updatePresetBtn.classList.add('hidden');
  elements.renamePresetBtn.classList.add('hidden');
  elements.deletePresetBtn.classList.add('hidden');

  // Show the panel
  const panel = document.getElementById('presetEditorPanel');
  panel.classList.remove('hidden');
}

async function savePresetFromEditor() {
  const presetName = await showRenameDialog('Save Preset', 'My Custom Preset');
  if (!presetName) return;

  const config = getEditorPresetConfig();
  config.name = presetName;
  config.category = 'custom';

  // Build YAML content
  let yamlContent = `name: ${config.name}\ncategory: ${config.category}\nadjustments:\n`;

  if (config.adjustments.exposure !== undefined) {
    yamlContent += `  exposure: ${config.adjustments.exposure}\n`;
  }
  if (config.adjustments.contrast !== undefined) {
    yamlContent += `  contrast: ${config.adjustments.contrast}\n`;
  }
  if (config.adjustments.saturation !== undefined) {
    yamlContent += `  saturation: ${config.adjustments.saturation}\n`;
  }
  if (config.adjustments.shadows !== undefined) {
    yamlContent += `  shadows: ${config.adjustments.shadows}\n`;
  }
  if (config.adjustments.highlights !== undefined) {
    yamlContent += `  highlights: ${config.adjustments.highlights}\n`;
  }
  if (config.adjustments.temperature !== undefined) {
    yamlContent += `  temperature: ${config.adjustments.temperature}\n`;
  }
  if (config.adjustments.tint !== undefined) {
    yamlContent += `  tint: ${config.adjustments.tint}\n`;
  }
  if (config.adjustments.vibrance !== undefined) {
    yamlContent += `  vibrance: ${config.adjustments.vibrance}\n`;
  }
  if (config.adjustments.clarity !== undefined) {
    yamlContent += `  clarity: ${config.adjustments.clarity}\n`;
  }
  if (config.adjustments.texture !== undefined) {
    yamlContent += `  texture: ${config.adjustments.texture}\n`;
  }
  if (config.adjustments.dehaze !== undefined) {
    yamlContent += `  dehaze: ${config.adjustments.dehaze}\n`;
  }

  if (config.curves && Object.keys(config.curves).length > 0) {
    yamlContent += `curves:\n`;
    if (config.curves.r) {
      yamlContent += `  r: ${JSON.stringify(config.curves.r)}\n`;
    }
    if (config.curves.g) {
      yamlContent += `  g: ${JSON.stringify(config.curves.g)}\n`;
    }
    if (config.curves.b) {
      yamlContent += `  b: ${JSON.stringify(config.curves.b)}\n`;
    }
  }

  try {
    await window.snerkAPI.saveImportedPreset(presetName, yamlContent);
    updateStatus(`Saved preset "${presetName}"`);
    elements.presetEditorPanel.classList.add('hidden');
    await initialize();
  } catch (error) {
    console.error('Error saving preset:', error);
    await showAlert('Error saving preset: ' + error.message);
  }
}

function populateEditorWithPreset(preset) {
  if (!preset || !preset.adjustments) {
    resetPresetEditor();
    return;
  }

  const adj = preset.adjustments;

  // Populate all sliders with preset values or defaults
  elements.editorExposure.value = adj.exposure || 0;
  elements.editorExposureValue.textContent = adj.exposure || 0;

  // Contrast needs conversion from multiplier to slider range
  const contrastValue = adj.contrast !== undefined ? (adj.contrast - 1) * 100 : 0;
  elements.editorContrast.value = contrastValue;
  elements.editorContrastValue.textContent = contrastValue;

  // Saturation needs conversion from multiplier to slider range
  const saturationValue = adj.saturation !== undefined ? (adj.saturation - 1) * 100 : 0;
  elements.editorSaturation.value = saturationValue;
  elements.editorSaturationValue.textContent = saturationValue;

  elements.editorShadows.value = adj.shadows || 0;
  elements.editorShadowsValue.textContent = adj.shadows || 0;

  elements.editorHighlights.value = adj.highlights || 0;
  elements.editorHighlightsValue.textContent = adj.highlights || 0;

  elements.editorTemperature.value = adj.temperature || 0;
  elements.editorTemperatureValue.textContent = adj.temperature || 0;

  elements.editorTint.value = adj.tint || 0;
  elements.editorTintValue.textContent = adj.tint || 0;

  elements.editorVibrance.value = adj.vibrance || 0;
  elements.editorVibranceValue.textContent = adj.vibrance || 0;

  elements.editorClarity.value = adj.clarity || 0;
  elements.editorClarityValue.textContent = adj.clarity || 0;

  elements.editorTexture.value = adj.texture || 0;
  elements.editorTextureValue.textContent = adj.texture || 0;

  elements.editorDehaze.value = adj.dehaze || 0;
  elements.editorDehazeValue.textContent = adj.dehaze || 0;

  if (preset.curves) {
    if (curveEditors.rgb && preset.curves.rgb) curveEditors.rgb.setPoints(preset.curves.rgb);
    if (curveEditors.r && preset.curves.r) curveEditors.r.setPoints(preset.curves.r);
    if (curveEditors.g && preset.curves.g) curveEditors.g.setPoints(preset.curves.g);
    if (curveEditors.b && preset.curves.b) curveEditors.b.setPoints(preset.curves.b);
  } else {
    if (curveEditors.rgb) curveEditors.rgb.reset();
    if (curveEditors.r) curveEditors.r.reset();
    if (curveEditors.g) curveEditors.g.reset();
    if (curveEditors.b) curveEditors.b.reset();
  }
}

async function showCurrentPresetConfig() {
  if (!state.currentPreset) {
    await showAlert('No preset selected');
    return;
  }

  if (!fileManager.getCurrentImage()) {
    await showAlert('Please open a folder with images first');
    return;
  }

  const preset = state.currentPreset;
  const isCustom = preset.category === 'custom' || preset.category === 'imported';

  // Populate editor with current preset values
  populateEditorWithPreset(preset);

  // Show appropriate buttons based on preset type
  if (isCustom) {
    // For custom/imported presets, show Update, Rename and Delete buttons
    elements.savePresetEditorBtn.classList.add('hidden');
    elements.copyToCustomBtn.classList.add('hidden');
    elements.updatePresetBtn.classList.remove('hidden');
    elements.renamePresetBtn.classList.remove('hidden');
    elements.deletePresetBtn.classList.remove('hidden');
  } else {
    // For default presets, show Copy to Custom button, hide Delete and Rename
    elements.savePresetEditorBtn.classList.add('hidden');
    elements.copyToCustomBtn.classList.remove('hidden');
    elements.updatePresetBtn.classList.add('hidden');
    elements.renamePresetBtn.classList.add('hidden');
    elements.deletePresetBtn.classList.add('hidden');
  }

  elements.presetEditorPanel.classList.remove('hidden');
}

async function copyToCustomPreset() {
  const presetName = await showRenameDialog('Save as Custom Preset', state.currentPreset.name + ' (Copy)');
  if (!presetName) return;

  await savePresetFromEditorWithName(presetName);
}

async function updateCurrentPreset() {
  if (!state.currentPreset) return;

  await savePresetFromEditorWithName(state.currentPreset.name);
}

async function deleteCurrentPreset() {
  if (!state.currentPreset) return;

  const confirmed = await showConfirmDialog(
    'Delete Preset',
    `Are you sure you want to delete the preset "${state.currentPreset.name}"? This cannot be undone.`
  );

  if (!confirmed) return;

  try {
    await presetManager.deletePreset(state.currentPreset.name);
    updateStatus(`Deleted preset "${state.currentPreset.name}"`);

    // Close the editor panel
    elements.presetEditorPanel.classList.add('hidden');

    // Clear current preset selection
    state.currentPreset = null;

    // Reload presets and UI
    await initialize();
  } catch (error) {
    console.error('Error deleting preset:', error);
    await showAlert('Error deleting preset: ' + error.message);
  }
}

async function savePresetFromEditorWithName(presetName) {
  const config = getEditorPresetConfig();
  config.name = presetName;
  config.category = 'custom';

  // Build YAML content (same as savePresetFromEditor)
  let yamlContent = `name: ${config.name}\ncategory: ${config.category}\nadjustments:\n`;

  if (config.adjustments.exposure !== undefined) {
    yamlContent += `  exposure: ${config.adjustments.exposure}\n`;
  }
  if (config.adjustments.contrast !== undefined) {
    yamlContent += `  contrast: ${config.adjustments.contrast}\n`;
  }
  if (config.adjustments.saturation !== undefined) {
    yamlContent += `  saturation: ${config.adjustments.saturation}\n`;
  }
  if (config.adjustments.shadows !== undefined) {
    yamlContent += `  shadows: ${config.adjustments.shadows}\n`;
  }
  if (config.adjustments.highlights !== undefined) {
    yamlContent += `  highlights: ${config.adjustments.highlights}\n`;
  }
  if (config.adjustments.temperature !== undefined) {
    yamlContent += `  temperature: ${config.adjustments.temperature}\n`;
  }
  if (config.adjustments.tint !== undefined) {
    yamlContent += `  tint: ${config.adjustments.tint}\n`;
  }
  if (config.adjustments.vibrance !== undefined) {
    yamlContent += `  vibrance: ${config.adjustments.vibrance}\n`;
  }
  if (config.adjustments.clarity !== undefined) {
    yamlContent += `  clarity: ${config.adjustments.clarity}\n`;
  }
  if (config.adjustments.texture !== undefined) {
    yamlContent += `  texture: ${config.adjustments.texture}\n`;
  }
  if (config.adjustments.dehaze !== undefined) {
    yamlContent += `  dehaze: ${config.adjustments.dehaze}\n`;
  }

  if (config.curves && Object.keys(config.curves).length > 0) {
    yamlContent += `curves:\n`;
    if (config.curves.r) {
      yamlContent += `  r: ${JSON.stringify(config.curves.r)}\n`;
    }
    if (config.curves.g) {
      yamlContent += `  g: ${JSON.stringify(config.curves.g)}\n`;
    }
    if (config.curves.b) {
      yamlContent += `  b: ${JSON.stringify(config.curves.b)}\n`;
    }
  }

  try {
    await window.snerkAPI.saveImportedPreset(presetName, yamlContent);
    updateStatus(`Saved preset "${presetName}"`);
    elements.presetEditorPanel.classList.add('hidden');
    await initialize();
    // Select the newly saved/updated preset
    await selectPreset(presetName);
  } catch (error) {
    console.error('Error saving preset:', error);
    await showAlert('Error saving preset: ' + error.message);
  }
}

elements.openFolderBtn.addEventListener('click', openFolder);
elements.exportBtn.addEventListener('click', showExportConfigDialog);
elements.importXmpBtn.addEventListener('click', importXmpPreset);
elements.createPresetBtn.addEventListener('click', openPresetEditor);
elements.noFilterBtn.addEventListener('click', () => selectPreset(''));
elements.openSnerkFolderBtn.addEventListener('click', async () => {
  try {
    await window.snerkAPI.openSnerkFolder();
    updateStatus('Opened Snerk folder');
  } catch (error) {
    console.error('Error opening Snerk folder:', error);
    updateStatus('Error opening folder');
  }
});
elements.githubLink.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await window.snerkAPI.openExternal('https://github.com/stephan-nordnes-eriksen/snerk');
  } catch (error) {
    console.error('Error opening GitHub link:', error);
  }
});
elements.settingsBtn.addEventListener('click', openSettings);
elements.settingsSaveBtn.addEventListener('click', saveSettings);
elements.settingsCancelBtn.addEventListener('click', () => {
  elements.settingsDialog.close();
});
elements.togglePresetPanel.addEventListener('click', togglePresetPanel);
elements.manageExportConfigsBtn.addEventListener('click', showExportConfigDialog);
elements.prevBtn.addEventListener('click', navigatePrevious);
elements.nextBtn.addEventListener('click', navigateNext);
elements.resetPresetEditorBtn.addEventListener('click', resetPresetEditor);
elements.cancelPresetEditorBtn.addEventListener('click', () => {
  elements.presetEditorPanel.classList.add('hidden');
  loadCurrentImage();
});
elements.savePresetEditorBtn.addEventListener('click', savePresetFromEditor);
elements.copyToCustomBtn.addEventListener('click', copyToCustomPreset);
elements.updatePresetBtn.addEventListener('click', updateCurrentPreset);
elements.renamePresetBtn.addEventListener('click', () => {
  if (state.currentPreset) {
    renamePreset(state.currentPreset);
  }
});
elements.deletePresetBtn.addEventListener('click', deleteCurrentPreset);
elements.showConfigBtn.addEventListener('click', showCurrentPresetConfig);
elements.closePresetEditor.addEventListener('click', () => {
  elements.presetEditorPanel.classList.add('hidden');
  loadCurrentImage();
});
elements.zoomFitBtn.addEventListener('click', zoomFitToWindow);
elements.zoom100Btn.addEventListener('click', zoom100Percent);

elements.exportQuality.addEventListener('input', (e) => {
  elements.qualityValue.textContent = e.target.value;
});

// Real-time preview for preset editor sliders with smart state checking
let currentEditorState = null;
let isProcessing = false;
let needsUpdate = false;

function getEditorState() {
  // Capture current slider values as a comparable state object
  return {
    exposure: parseFloat(elements.editorExposure.value),
    contrast: parseFloat(elements.editorContrast.value),
    saturation: parseFloat(elements.editorSaturation.value),
    shadows: parseFloat(elements.editorShadows.value),
    highlights: parseFloat(elements.editorHighlights.value),
    temperature: parseFloat(elements.editorTemperature.value),
    tint: parseFloat(elements.editorTint.value),
    vibrance: parseFloat(elements.editorVibrance.value),
    clarity: parseFloat(elements.editorClarity.value),
    texture: parseFloat(elements.editorTexture.value),
    dehaze: parseFloat(elements.editorDehaze.value)
  };
}

function statesAreEqual(state1, state2) {
  if (!state1 || !state2) return false;
  return Object.keys(state1).every(key => state1[key] === state2[key]);
}

async function applyEditorPreview() {
  if (!fileManager.getCurrentImage() || elements.presetEditorPanel.classList.contains('hidden')) {
    return;
  }

  // If already processing, just flag that we need another update
  if (isProcessing) {
    needsUpdate = true;
    return;
  }

  isProcessing = true;

  try {
    // Keep processing until settings stabilize
    while (true) {
      // Snapshot the current settings
      const settingsSnapshot = getEditorState();
      currentEditorState = settingsSnapshot;
      needsUpdate = false;

      const config = getEditorPresetConfig();

      // Create a temporary preset with current editor values
      const tempPreset = {
        name: 'Preview',
        category: 'temp',
        adjustments: config.adjustments
      };

      // Store the current preset temporarily
      const previousPreset = state.currentPreset;
      state.currentPreset = tempPreset;

      // Load the image with the preview
      await loadCurrentImage();

      // Restore the previous preset reference
      state.currentPreset = previousPreset;

      // Check if settings changed during processing
      const currentSettings = getEditorState();

      // If settings haven't changed and no update was requested, we're done
      if (statesAreEqual(settingsSnapshot, currentSettings) && !needsUpdate) {
        break;
      }

      // Otherwise, loop and process again with new settings
    }
  } finally {
    isProcessing = false;
  }
}

function requestPreviewUpdate() {
  // Simply trigger the preview - it will handle queueing internally
  applyEditorPreview();
}

// Add real-time preview to all editor sliders
[
  elements.editorExposure,
  elements.editorContrast,
  elements.editorSaturation,
  elements.editorShadows,
  elements.editorHighlights,
  elements.editorTemperature,
  elements.editorTint,
  elements.editorVibrance,
  elements.editorClarity,
  elements.editorTexture,
  elements.editorDehaze
].forEach(slider => {
  slider.addEventListener('input', (e) => {
    // Update the value display immediately
    const valueElement = document.getElementById(slider.id + 'Value');
    if (valueElement) {
      valueElement.textContent = e.target.value;
    }
    // Request preview update - it will handle smart queueing
    requestPreviewUpdate();
  });
});

elements.closeExportDialog.addEventListener('click', () => {
  elements.exportProgressDialog.close();
});

function toggleUI() {
  elements.uiOverlay.classList.toggle('hidden');
}

function togglePresetPanel() {
  const isCollapsed = elements.presetPanel.classList.toggle('collapsed');
  elements.togglePresetPanel.textContent = isCollapsed ? '▶' : '◀';
}

function applyZoom() {
  const { level, panX, panY } = state.zoom;
  elements.mainImage.style.transform = `scale(${level}) translate(${panX}px, ${panY}px)`;
  elements.mainImage.style.cursor = 'grab';
}

function zoomIn() {
  state.zoom.level = Math.min(state.zoom.level + state.zoom.step, state.zoom.maxLevel);
  applyZoom();
}

function zoomOut() {
  state.zoom.level = Math.max(state.zoom.level - state.zoom.step, state.zoom.minLevel);
  if (state.zoom.level === 1) {
    state.zoom.panX = 0;
    state.zoom.panY = 0;
  }
  applyZoom();
}

function resetZoom() {
  state.zoom.level = 1;
  state.zoom.panX = 0;
  state.zoom.panY = 0;
  applyZoom();
}

function zoomFitToWindow() {
  state.zoom.level = 1;
  state.zoom.panX = 0;
  state.zoom.panY = 0;
  applyZoom();
}

function zoom100Percent() {
  if (!elements.mainImage.classList.contains('loaded')) return;

  const img = elements.mainImage;
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  const displayedWidth = img.clientWidth;
  const displayedHeight = img.clientHeight;

  if (displayedWidth === 0 || displayedHeight === 0) return;

  const scaleX = naturalWidth / displayedWidth;
  const scaleY = naturalHeight / displayedHeight;
  const scale = Math.max(scaleX, scaleY);

  state.zoom.level = scale;
  state.zoom.panX = 0;
  state.zoom.panY = 0;
  applyZoom();
}

function handleWheel(e) {
  if (!elements.mainImage.classList.contains('loaded')) return;

  e.preventDefault();

  if (e.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
}

function startPan(e) {
  state.zoom.isPanning = true;
  state.zoom.startX = e.clientX - state.zoom.panX * state.zoom.level;
  state.zoom.startY = e.clientY - state.zoom.panY * state.zoom.level;
  elements.mainImage.style.cursor = 'grabbing';
}

function doPan(e) {
  if (!state.zoom.isPanning) return;

  e.preventDefault();
  state.zoom.panX = (e.clientX - state.zoom.startX) / state.zoom.level;
  state.zoom.panY = (e.clientY - state.zoom.startY) / state.zoom.level;
  applyZoom();
}

function endPan() {
  if (state.zoom.isPanning) {
    state.zoom.isPanning = false;
    elements.mainImage.style.cursor = 'grab';
  }
}

document.addEventListener('keydown', (e) => {
  // Don't handle shortcuts when in input fields or dialogs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // Check if any dialog is open
  const isDialogOpen =
    elements.exportConfigDialog.open ||
    elements.exportProgressDialog.open ||
    elements.renameDialog.open ||
    !elements.presetEditorPanel.classList.contains('hidden') ||
    elements.settingsDialog.open;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      // Only toggle UI if no dialog is open
      if (!isDialogOpen) {
        toggleUI();
      }
      break;
    case 'r':
    case 'R':
      if (!isDialogOpen) {
        e.preventDefault();
        resetZoom();
      }
      break;
    case '+':
    case '=':
      if (!isDialogOpen) {
        e.preventDefault();
        zoomIn();
      }
      break;
    case '-':
    case '_':
      if (!isDialogOpen) {
        e.preventDefault();
        zoomOut();
      }
      break;
    case 'ArrowLeft':
      if (!isDialogOpen) {
        e.preventDefault();
        navigatePrevious();
        resetZoom();
      }
      break;
    case 'ArrowRight':
      if (!isDialogOpen) {
        e.preventDefault();
        navigateNext();
        resetZoom();
      }
      break;
    case '0':
      if (!isDialogOpen) {
        e.preventDefault();
        selectPreset('');
      }
      break;
    default:
      if (e.key >= '1' && e.key <= '9') {
        if (!isDialogOpen) {
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          const presets = state.presets;
          if (index < presets.length) {
            selectPreset(presets[index].name);
          }
        }
      }
  }

  if (!isDialogOpen) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
      e.preventDefault();
      openFolder();
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
      e.preventDefault();
      if (!elements.exportBtn.disabled) {
        showExportConfigDialog();
      }
    }
  }
});

elements.mainImage.addEventListener('wheel', handleWheel, { passive: false });
elements.mainImage.addEventListener('mousedown', startPan);
elements.mainImage.addEventListener('mousemove', doPan);
elements.mainImage.addEventListener('mouseup', endPan);
elements.mainImage.addEventListener('mouseleave', endPan);
elements.mainImage.addEventListener('dblclick', resetZoom);

setupEditorSliders();
setupCurveEditors();
initialize();
