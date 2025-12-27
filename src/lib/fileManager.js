const SUPPORTED_EXTENSIONS = [
  '.raf',
  '.arw',
  '.cr3',
  '.cr2',
  '.nef',
  '.dng',
  '.orf',
  '.rw2',
  '.pef',
  '.srw',
  '.jpg',
  '.jpeg',
  '.png',
  '.tiff',
  '.tif',
  '.webp',
];

class FileManager {
  constructor() {
    this.images = [];
    this.currentIndex = 0;
  }

  async scanDirectory(dirPath) {
    try {
      const files = await window.snerkAPI.readDirectory(dirPath);
      this.images = this.getSupportedFiles(files);
      this.currentIndex = 0;
      return this.images;
    } catch (error) {
      console.error('Error scanning directory:', error);
      return [];
    }
  }

  getSupportedFiles(files) {
    return files.filter(file => {
      const ext = file.substring(file.lastIndexOf('.')).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext);
    }).sort();
  }

  getCurrentImage() {
    if (this.images.length === 0) return null;
    return this.images[this.currentIndex];
  }

  getNextImage() {
    if (this.images.length === 0) return null;
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    return this.getCurrentImage();
  }

  getPreviousImage() {
    if (this.images.length === 0) return null;
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
    return this.getCurrentImage();
  }

  getImageAtIndex(index) {
    if (index < 0 || index >= this.images.length) return null;
    this.currentIndex = index;
    return this.getCurrentImage();
  }

  getImageCount() {
    return this.images.length;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  getAllImages() {
    return this.images;
  }

  isRawFile(filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    const rawExtensions = ['.raf', '.arw', '.cr3', '.cr2', '.nef', '.dng', '.orf', '.rw2', '.pef', '.srw'];
    return rawExtensions.includes(ext);
  }
}

window.FileManager = FileManager;
