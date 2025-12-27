const fileManager = new FileManager();
const presetManager = new PresetManager();
const imageProcessor = new ImageProcessor();

const state = {
  currentFolder: null,
  currentPreset: null,
  presets: [],
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

    updateStatus('Converting preset...');
    const xmpImporter = new XmpImporter();
    const preset = xmpImporter.parseXmpToPreset(xmpContent);
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

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
    return;
  }

  switch (e.key) {
    case ' ':
      e.preventDefault();
      toggleUI();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      navigatePrevious();
      break;
    case 'ArrowRight':
      e.preventDefault();
      navigateNext();
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

initialize();
