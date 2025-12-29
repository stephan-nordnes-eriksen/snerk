# Snerk - Technical Specification

## Overview

Snerk is a minimalistic color studio application built with Electron that supports RAW image formats and provides Lightroom-like preset functionality for batch processing images.

## Core Requirements

### 1. Platform & Technology Stack

- **Runtime**: Electron desktop application
- **UI**: Pure HTML/CSS with Pico.css framework
- **Image Processing**:
  - WebGPU (default) - GPU-accelerated rendering in browser
  - Sharp (fallback) - CPU-based image processing
- **RAW Support**: ExifTool for extracting embedded previews from RAW files
- **Preset Format**: YAML configuration files
- **Supported Platforms**: macOS, Windows, Linux

### 2. Supported File Formats

#### RAW Formats
- Fuji RAF (primary requirement)
- Sony ARW (primary requirement)
- Canon CR3, CR2
- Nikon NEF
- Adobe DNG
- Olympus ORF
- Panasonic RW2
- Pentax PEF
- Samsung SRW

#### Standard Formats
- JPEG/JPG
- PNG
- TIFF/TIF
- WebP

### 3. Core Features

#### Image Viewing
- Open folder and display all supported images
- Navigate between images using:
  - Arrow keys (← →)
  - Previous/Next buttons
  - Keyboard shortcuts
- Display current image index (e.g., "5 / 23")
- Show filename below the image

#### Preset System

##### Preset Storage
- Default presets bundled with application in `presets/` directory
- User presets stored in `~/.snerk/presets/`
- Default presets copied to user directory on first launch (if not already present)
- Organized by category in subdirectories:
  - `classic-film/` - Film emulation presets
  - `modern/` - Contemporary cinematic looks
  - `bw/` - Black and white conversions
  - `basic/` - Simple adjustments
  - Custom categories supported

##### Preset Format (YAML)
```yaml
name: "Preset Name"
category: "category-name"
adjustments:
  exposure: 0.2          # -2 to +2 (brightness multiplier)
  contrast: 1.1          # 0.5 to 2 (linear adjustment)
  saturation: 0.9        # 0 to 2 (color intensity)
  temperature: 100       # -100 to +100 (warm/cool)
  tint: 10               # -100 to +100 (green/magenta)
  highlights: -20        # -100 to +100 (bright area adjustment)
  shadows: 15            # -100 to +100 (dark area adjustment)
  vibrance: 5            # -100 to +100 (smart saturation)
  curves:                # Optional RGB curves
    r: [[0,0], [128,140], [255,255]]
    g: [[0,0], [128,128], [255,255]]
    b: [[0,0], [128,120], [255,255]]
  hsl:                   # Optional HSL adjustments
    - hue: [0, 30]       # Red range
      sat: 10
      lum: 5
  grain: 15              # 0-100 (film grain simulation)
  vignette: 20           # 0-100 (edge darkening)
```

##### Preset Application
- Live preview when selecting preset
- Apply to current image only (non-destructive)
- Original files never modified
- Image caching for performance
- Smooth transitions (no loading flash)

#### Export Functionality

##### Export Settings
- Output format selection: JPEG, PNG, TIFF, WebP
- Quality slider (1-100) for lossy formats
- Default quality: 90

##### Export Process
- Batch export all images in current folder
- Apply selected preset to all images
- Save to user-selected output directory
- Preserve original filenames with new extension
- Progress dialog showing:
  - Progress bar (n / total)
  - Current status text
  - Ability to close dialog

##### Export Behavior
- For RAW files: Extract embedded preview, apply preset, export
- For standard formats: Load image, apply preset, export
- Preserve EXIF metadata where possible
- Handle filename conflicts gracefully

### 4. Rendering Modes

#### WebGPU Mode (Default)
- **Processing**: GPU-accelerated compute shaders (WGSL)
- **Location**: Renderer process
- **Performance**: ~10x faster than Sharp for preview generation
- **Features**: Full feature parity with all 18 preset adjustments
- **Requirement**: Browser with WebGPU support (Chromium 113+)

#### Sharp Mode (Fallback)
- **Processing**: CPU-based image processing
- **Location**: Main process
- **Performance**: ~2000ms per preset application
- **Features**: Full feature parity with all 18 preset adjustments
- **Requirement**: None (always available)

#### Settings System
- **Storage**: `~/.snerk/settings.json`
- **UI**: Settings modal dialog (accessible from header)
- **Options**:
  - Rendering mode selection (WebGPU or Sharp)
  - Automatic fallback toggle
  - WebGPU availability status
- **Defaults**:
  - Mode: WebGPU
  - Fallback to Sharp: Enabled

#### Rendering Pipeline Architecture
```
[Main Process]                    [Renderer Process]
     │                                    │
     ├─ Sharp (RAW extraction)            │
     ├─ Sharp (Export, full-res)          │
     │                                    │
     │                            ┌───────┴────────┐
     │                            │ SettingsManager │
     │                            └────────┬────────┘
     │                                     │
     │                            ┌────────┴─────────┐
     │                            │ ImageProcessor   │
     │                            │  (routes based   │
     │                            │   on mode)       │
     │                            └────────┬─────────┘
     │                                     │
     │                            ┌────────┴─────────┐
     │                            │                  │
     │                    [mode=webgpu]    [mode=sharp]
     │                            │                  │
     │                   WebGPUProcessor    Use IPC result
     │                   - GPU shaders        directly
     │                   - Multi-pass
```

#### WebGPU Shader Pipeline (6 passes)
1. **Basic Adjustments** (compute): exposure, temperature, tint, contrast, saturation, vibrance, shadows, highlights, whites, blacks, dehaze
2. **Curves** (compute): RGB and per-channel tone curves via LUT (placeholder)
3. **HSL Selective** (compute): Color-specific hue/sat/lum adjustments (placeholder)
4. **Split Toning** (compute): Shadow/highlight color grading
5. **Grain** (compute): Film grain effect
6. **Vignette** (compute): Radial gradient darkening/lightening

### 5. User Interface

#### Layout
```
┌──────────────────────────────────────────────────────────┐
│ Header: [Snerk]  [Open Folder] [Export All] [Settings]  │
├─────────┬────────────────────────────────────────────────┤
│ Preset  │                                                │
│ Panel   │        Image Viewer                            │
│         │                                                │
│ - Select│                                                │
│ - Cat 1 │                                                │
│   • Pre1│                                                │
│   • Pre2│                                                │
│ - Cat 2 │                                                │
│ - Export│                                                │
│   Settings                                               │
│         │  [← Prev] [5 / 23] [Next →]                   │
│         │       filename.RAF                             │
└─────────┴────────────────────────────────────────────────┘
│ Status: Ready (webgpu rendering)                         │
└──────────────────────────────────────────────────────────┘
```

#### Preset Panel
- Dropdown select with all presets
- Categorized preset buttons
- "No preset" option to clear
- Export settings (collapsible):
  - Format dropdown
  - Quality slider with value display

#### Image Viewer
- Centered image display
- Max dimensions: contained within viewport
- Empty state message when no folder opened
- No loading indicators (smooth transitions)

#### Controls
- Previous/Next buttons (disabled when no images)
- Image counter
- Filename display

#### Status Bar
- Current operation status
- Error messages
- Success confirmations

### 5. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Previous image |
| `→` | Next image |
| `1-9` | Apply preset by index |
| `0` | Clear preset |
| `Cmd/Ctrl + O` | Open folder |
| `Cmd/Ctrl + E` | Export all |

### 6. Performance Requirements

#### Image Loading
- Preview size: Max 2000x2000px (maintains aspect ratio)
- Preview quality: 90% JPEG
- Caching: In-memory cache for loaded images
- RAW preview extraction: < 2 seconds per file

#### Preset Application
- Preview update time: Target < 500ms
- No UI blocking during processing
- Smooth image transitions

#### Export
- Worker threads for batch processing (future)
- Progress updates every image
- Non-blocking UI

### 7. Technical Implementation Details

#### Project Structure
```
snerk/
├── main.js                 # Electron main process
├── preload.js             # IPC bridge (context isolation)
├── package.json
├── src/
│   ├── index.html         # Main UI
│   ├── styles.css         # Custom styles
│   ├── renderer.js        # UI logic
│   └── lib/
│       ├── fileManager.js      # Directory scanning
│       ├── presetManager.js    # YAML loading
│       ├── imageProcessor.js   # Image processing router
│       ├── settingsManager.js  # Settings persistence
│       ├── webgpuProcessor.js  # WebGPU rendering engine
│       └── shaders/           # WGSL compute shaders
│           ├── utils.wgsl           # Shared utility functions
│           ├── basicAdjustments.wgsl
│           ├── curves.wgsl
│           ├── hsl.wgsl
│           ├── splitToning.wgsl
│           ├── grain.wgsl
│           └── vignette.wgsl
└── presets/              # Default presets
    ├── classic-film/
    ├── modern/
    ├── bw/
    └── basic/
```

#### Main Process Responsibilities
- Window creation and management
- File system operations
- RAW preview extraction (ExifTool)
- Image processing (Sharp - for Sharp mode and all exports)
- IPC handler registration
- Preset directory initialization
- Settings file management

#### Renderer Process Responsibilities
- UI state management
- User input handling
- IPC communication
- Image display
- Preset selection
- Navigation logic
- Settings management
- WebGPU initialization and processing (WebGPU mode only)
- Rendering mode routing

#### IPC Channels
- `dialog:openFolder` - Open folder picker
- `dialog:saveFolder` - Save folder picker
- `file:readDirectory` - List files in directory
- `file:readFile` - Read file as buffer
- `file:writeFile` - Write buffer to file
- `preset:getDirectory` - Get preset directory path
- `preset:findAll` - Find all YAML preset files
- `image:loadPreview` - Load image preview (used by both rendering modes)
- `image:applyPreset` - Apply preset to image (Sharp mode only)
- `image:export` - Export single image (always uses Sharp)
- `settings:getPath` - Get settings file path
- `settings:load` - Load settings from file
- `settings:save` - Save settings to file

#### RAW File Handling
1. Detect RAW file by extension
2. Use ExifTool to extract embedded JPEG preview
3. Save preview to temp file
4. Load preview into Sharp
5. Process with Sharp (resize, presets)
6. Clean up temp file

#### Security
- Context isolation enabled
- No Node integration in renderer
- IPC whitelist via preload script
- No arbitrary code execution

### 8. Error Handling

#### File Errors
- Invalid file formats: Skip silently
- Missing files: Log error, continue
- Permission errors: Show user-friendly message

#### Preset Errors
- Invalid YAML: Skip preset, log error
- Missing required fields: Use defaults
- Category inference from directory structure

#### Processing Errors
- RAW extraction failure: Show error, skip image
- Sharp processing error: Show error, skip image
- Export failure: Continue with remaining images

### 9. Future Enhancements (Not Implemented)

- Real-time preset adjustment sliders
- Custom preset creation UI
- Preset hot-reload on file changes
- Comparison view (before/after)
- Histogram display
- Color picker for selective adjustments
- Undo/redo for preset selection
- Favorite presets
- Recent folders
- Drag-and-drop folder opening
- Full RAW conversion (vs. embedded preview)
- Batch rename on export
- Complete curves and HSL shader implementations

## Default Presets Included

### Classic Film (3 presets)
- **Portra 400**: Warm, low saturation film look
- **Velvia 50**: High saturation, punchy colors
- **Tri-X 400**: Classic black and white film

### Modern (3 presets)
- **Teal & Orange**: Cinematic color grading
- **Moody**: Dark, low-key aesthetic
- **High Contrast**: Bold, dramatic look

### Black & White (3 presets)
- **High Contrast B&W**: Dramatic monochrome
- **Vintage B&W**: Soft, lifted blacks
- **Soft B&W**: Gentle, low-contrast B&W

### Basic (4 presets)
- **Bright**: Lifted exposure, open shadows
- **Warm**: Orange/yellow color shift
- **Cool**: Blue/cyan color shift
- **Vibrant**: Increased saturation and vibrance

## Build & Distribution

### Development
```bash
npm install
npm start
```

### Production Build
```bash
npm run build        # Current platform
npm run build:mac    # macOS DMG
npm run build:win    # Windows NSIS installer
npm run build:linux  # Linux AppImage
```

### Distribution Files
- macOS: `.dmg` installer
- Windows: `.exe` NSIS installer
- Linux: `.AppImage` portable executable

## Dependencies

### Production
- `electron`: Application framework
- `sharp`: Image processing
- `exiftool-vendored`: RAW preview extraction
- `js-yaml`: YAML parsing (renderer only)
- `chokidar`: File watching (future use)

### Development
- `electron-builder`: Application packaging

## Configuration

### User Directory
- Location: `~/.snerk/`
- Contains:
  - `presets/` - User preset files
  - `settings.json` - Application settings
- Populated on first launch with default presets
- Settings created on first settings save

### Settings File Structure
```json
{
  "version": "1.0",
  "rendering": {
    "mode": "webgpu",
    "fallbackToSharp": true
  }
}
```

## Performance Benchmarks (Target)

- Application launch: < 3 seconds
- Folder scan (100 images): < 2 seconds
- RAW preview load: < 2 seconds
- Preset application (WebGPU): < 200ms
- Preset application (Sharp): < 2000ms
- Navigation between images: < 1 second
- Export 100 images: < 5 minutes

## Browser/Electron Version Support

- Electron: v28.0.0+
- Chromium: v120+
- Node.js: v18+
