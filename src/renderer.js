const fileManager = new FileManager();
const presetManager = new PresetManager();
const imageProcessor = new ImageProcessor();

const state = {
  currentFolder: null,
  currentPreset: null,
  presets: [],
  zoom: {
    level: 1,
    minLevel: 0.5,
    maxLevel: 5,
    step: 0.1,
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
  presetSelect: document.getElementById('presetSelect'),
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
};

async function initialize() {
  try {
    updateStatus('Loading presets...');
    state.presets = await presetManager.loadPresets();
    renderPresets();
    updateStatus('Ready');
  } catch (error) {
    console.error('Error initializing:', error);
    updateStatus('Error loading presets');
  }
}

function renderPresets() {
  const categories = presetManager.getPresetsByCategory();

  elements.presetSelect.innerHTML = '<option value="">No preset</option>';

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
      const option = document.createElement('option');
      option.value = preset.name;
      option.textContent = preset.name;
      elements.presetSelect.appendChild(option);

      const presetRow = document.createElement('div');
      presetRow.className = 'preset-row';

      const button = document.createElement('button');
      button.className = 'preset-btn secondary';
      button.textContent = preset.name;
      button.dataset.presetName = preset.name;
      button.onclick = () => selectPreset(preset.name);
      presetRow.appendChild(button);

      const renameBtn = document.createElement('button');
      renameBtn.className = 'rename-btn outline secondary';
      renameBtn.textContent = '✎';
      renameBtn.title = 'Rename preset';
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        renamePreset(preset);
      };
      presetRow.appendChild(renameBtn);

      buttonContainer.appendChild(presetRow);
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
    elements.presetSelect.value = '';
    clearActivePresetButtons();
  } else {
    state.currentPreset = preset;
    elements.presetSelect.value = presetName;
    setActivePresetButton(presetName);
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

async function exportImages() {
  try {
    const images = fileManager.getAllImages();

    if (images.length === 0) {
      updateStatus('No images to export');
      return;
    }

    const outputDir = await window.snerkAPI.selectExportFolder();

    if (!outputDir) return;

    const format = elements.exportFormat.value;
    const quality = parseInt(elements.exportQuality.value);

    elements.exportDialog.showModal();
    elements.exportProgress.max = images.length;
    elements.exportProgress.value = 0;
    elements.exportStatus.textContent = `Exporting 0 / ${images.length}...`;

    const results = await imageProcessor.exportBatch(
      images,
      state.currentPreset,
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
      elements.exportDialog.close();
    }, 2000);

    updateStatus(`Export complete: ${successCount} images`);
  } catch (error) {
    console.error('Error exporting images:', error);
    updateStatus('Error exporting images');
    elements.exportDialog.close();
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
    const customName = await showRenameDialog('Import Preset - Enter Name', preset.name);
    if (customName === null) {
      updateStatus('Import cancelled');
      return;
    }

    // Use custom name if provided, otherwise use default
    const desiredName = customName || preset.name;

    // Check for conflicts and get unique name
    const existingNames = state.presets.map(p => p.name);
    preset.name = getUniquePresetName(desiredName, existingNames);

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

elements.openFolderBtn.addEventListener('click', openFolder);
elements.exportBtn.addEventListener('click', exportImages);
elements.importXmpBtn.addEventListener('click', importXmpPreset);
elements.togglePresetPanel.addEventListener('click', togglePresetPanel);
elements.prevBtn.addEventListener('click', navigatePrevious);
elements.nextBtn.addEventListener('click', navigateNext);

elements.presetSelect.addEventListener('change', (e) => {
  selectPreset(e.target.value);
});

elements.exportQuality.addEventListener('input', (e) => {
  elements.qualityValue.textContent = e.target.value;
});

elements.closeExportDialog.addEventListener('click', () => {
  elements.exportDialog.close();
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
  elements.mainImage.style.cursor = level > 1 ? 'grab' : 'default';
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
  if (state.zoom.level <= 1) return;

  state.zoom.isPanning = true;
  state.zoom.startX = e.clientX - state.zoom.panX;
  state.zoom.startY = e.clientY - state.zoom.panY;
  elements.mainImage.style.cursor = 'grabbing';
}

function doPan(e) {
  if (!state.zoom.isPanning) return;

  e.preventDefault();
  state.zoom.panX = e.clientX - state.zoom.startX;
  state.zoom.panY = e.clientY - state.zoom.startY;
  applyZoom();
}

function endPan() {
  if (state.zoom.isPanning) {
    state.zoom.isPanning = false;
    elements.mainImage.style.cursor = 'grab';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
    return;
  }

  switch (e.key) {
    case ' ':
      e.preventDefault();
      toggleUI();
      break;
    case 'r':
    case 'R':
      e.preventDefault();
      resetZoom();
      break;
    case '+':
    case '=':
      e.preventDefault();
      zoomIn();
      break;
    case '-':
    case '_':
      e.preventDefault();
      zoomOut();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      navigatePrevious();
      resetZoom();
      break;
    case 'ArrowRight':
      e.preventDefault();
      navigateNext();
      resetZoom();
      break;
    case '0':
      e.preventDefault();
      selectPreset('');
      break;
    default:
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const presets = state.presets;
        if (index < presets.length) {
          selectPreset(presets[index].name);
        }
      }
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
    e.preventDefault();
    openFolder();
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
    e.preventDefault();
    if (!elements.exportBtn.disabled) {
      exportImages();
    }
  }
});

elements.mainImage.addEventListener('wheel', handleWheel, { passive: false });
elements.mainImage.addEventListener('mousedown', startPan);
elements.mainImage.addEventListener('mousemove', doPan);
elements.mainImage.addEventListener('mouseup', endPan);
elements.mainImage.addEventListener('mouseleave', endPan);
elements.mainImage.addEventListener('dblclick', resetZoom);

initialize();
