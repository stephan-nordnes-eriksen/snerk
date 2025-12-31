# Claude Context for Snerk Project

## Project Summary

Snerk is a minimalistic Electron-based color studio with RAW format support and Lightroom-like preset functionality. The application allows users to browse photos, apply presets for quick color grading, and batch export images with filters applied.


## Instructions from developer
- When working on multi-step parts, like processing a todo list, make git commits between each step. eg. between each todo list item
- When making significant changes, update CLAUDE.md and SPEC.md appropriately. Avoid this for things like bugfixing and style changes.
- Avoid adding verbose comments and unnecessary code or abstractions. Aim to be as short an concise as possible
- Avoid altering code / systems that are not part of the immediate task.
- When making any change, always load the DECISIONS.md to ensure that any change does not undo or otherwise goes against previous decisions. This file should only contain direct quotes from prompts from the user. Update DECISIONS.md with direct quotes from the user, nothing else.

## Architecture Overview

### Technology Choices

**Why Electron + Pure HTML/CSS?**
- User requested a desktop app with the simplest possible UI implementation
- No React/Vue/Svelte - just semantic HTML with Pico.css for styling
- Minimalistic approach throughout the codebase

**Why WebGPU for Image Processing?**
- ~10x faster GPU-accelerated processing for all operations
- All preset application happens in GPU shaders in the renderer process
- No CPU-based image processing library needed
- Handles exposure, contrast, saturation, and all other adjustments via compute shaders

**Why ExifTool for RAW Files?**
- RAW files (.RAF, .ARW, .CR3, etc.) cannot be read directly by browsers
- ExifTool extracts embedded JPEG previews from RAW files
- These previews are then processed by WebGPU just like regular images
- Trade-off: Using embedded preview vs. full RAW conversion (faster, good enough for preview/export)

### Process Separation (Electron)

**Main Process (`main.js`)**
- Handles all file I/O operations
- Runs ExifTool for RAW preview extraction
- Reads image files and converts to base64 for IPC transfer
- Writes exported image blobs to disk
- Manages IPC handlers
- Window creation and lifecycle

**Renderer Process (`src/renderer.js`)**
- Pure UI logic
- All image processing via WebGPU compute shaders
- No direct file system access
- Communicates via IPC through preload script
- Manages application state (current image, preset, etc.)

**Preload Script (`preload.js`)**
- Security boundary (context isolation)
- Exposes safe IPC methods via `contextBridge`
- No Node.js APIs exposed directly to renderer

## Critical Implementation Details

### RAW File Handling

RAW files are detected by extension and processed differently:

```javascript
// In main.js
if (isRawFile(imagePath)) {
  // 1. Extract embedded JPEG preview using ExifTool
  const imageBuffer = await extractRawPreview(imagePath);
  // 2. Convert to base64 for IPC transfer
  return { data: imageBuffer.toString('base64'), ... };
}
// In renderer (webgpuProcessor.js)
// 3. Decode base64 → ImageBitmap
// 4. Process with WebGPU shaders
```

**Why embedded preview?**
- Much faster than full RAW conversion (< 2 sec vs. 10+ sec)
- Sufficient quality for preview and export use case
- No external dependencies (dcraw, LibRaw) needed
- Cross-platform consistency

### Preset System

**Design Decision: YAML over JSON**
- User requested YAML for easier manual editing
- Supports comments (useful for preset documentation)
- More readable for non-technical users

**Preset Loading Flow:**
1. Main process scans `~/.snerk/presets/` recursively
2. Returns all `.yaml` file paths to renderer
3. Renderer loads each file and parses YAML
4. Category inferred from directory structure if not specified
5. Presets organized by category in UI

**Custom YAML Parser:**
- Simple regex-based parser (no js-yaml in renderer to keep it light)
- Handles basic key-value pairs and nested sections
- Good enough for the preset schema

### Image Caching Strategy

Images are cached in memory after loading:
- Cache key: `"preview_${imagePath}"` for plain images
- Cache key: `"preset_${imagePath}_${JSON.stringify(presetConfig)}"` for preset applications
- Prevents re-processing when navigating back/forward
- Cleared only manually (not automatic based on memory)

### .snerk Project File System

**Design Decision: Per-folder project files**
- Each opened folder can have a `.snerk` file storing folder-specific state
- Enables resuming work exactly where you left off
- Different folders can have different export settings
- No manual "Save" button - auto-saves on every change

**What's stored in .snerk:**
- File rotations (per image)
- Pinned presets (which preset is applied to which image)
- Export settings (format, quality) - folder-specific overrides
- Version number for future compatibility

**Lifecycle:**
1. When opening a folder, `projectManager.loadProject()` checks for `.snerk` file
2. If found, loads all metadata and applies to current state
3. On any change (rotation, pin preset, export config), auto-saves to `.snerk`
4. Cleanup: References to deleted files are removed on load and save

**Implementation:**
- File: `src/lib/projectManager.js`
- Format: JSON for simplicity and reliability
- Location: `.snerk` in the root of each opened folder
- See `DOT-SNERK.md` for detailed file format specification

**Trade-offs:**
- Files keyed by filename only (not full path) - assumes unique filenames in folder
- No conflict resolution if same image appears in nested folders
- Simple, works for 99% of use cases

### Loading Behavior (Important UX Detail)

**Original Problem:** Loading indicator flashed between image changes, creating jarring experience

**Solution:** Keep current image visible while loading next one
- Don't hide current image when loading starts
- Load new image in background
- Replace image only when new one is fully loaded
- Update counter and filename immediately for responsiveness

### WebGPU Rendering System

**Why WebGPU:**
- ~10x performance improvement over CPU-based processing
- All preset application happens in GPU compute shaders
- Handles all Lightroom-style adjustments: exposure, temperature, tint, contrast, saturation, etc.
- Supports advanced features: split toning, grain, vignette, curves (partial)

**Architecture Decision: WebGPU in Renderer Process**

WebGPU runs in the renderer process because:
- Only renderer has access to `navigator.gpu` API
- Main process only handles file I/O and RAW extraction
- Images transferred via IPC as base64
- All processing happens on GPU in renderer

**Rendering Pipeline Flow:**

```
User loads image with preset
    ↓
[Main Process]
    1. Detect RAW → Extract preview with ExifTool (if RAW)
    2. Read image file as buffer
    3. Encode as base64
    4. Send to renderer via IPC
    ↓
[Renderer Process - WebGPU]
    5. Decode base64 → ImageBitmap
    6. Upload to GPU texture
    7. Run multi-pass shader pipeline:
       - basicAdjustments (11 adjustments: exposure, temp, tint, etc.)
       - splitToning (shadow/highlight colors)
       - grain (film grain effect)
       - vignette (edge darkening/lightening)
       - blend (preset strength 0-100%)
    8. Download from GPU → Canvas
    9. Encode Canvas → Data URL
    10. Display in <img> element
```

**Critical Implementation Details:**

1. **Settings System**
   - File: `~/.snerk/settings.json`
   - Stores user preferences and preset visibility
   - Persisted across sessions

2. **WebGPU Texture Lifecycle Management (CRITICAL)**
   - Textures MUST be destroyed after GPU operations complete
   - Always `await device.queue.onSubmittedWorkDone()` before destroying
   - Pass-through textures (curves, HSL) must NOT be added to destroy list
   - Check: `if (currentTexture !== inputTexture && nextTexture !== currentTexture)`

3. **Uniform Buffer Handling (CRITICAL BUG FIX)**
   - Never use `||` operator for default values with numeric uniforms
   - `saturation: 0 || 1` evaluates to `1`, breaking B&W presets
   - Always use: `adj.saturation !== undefined ? adj.saturation : 1`
   - Affects: saturation, exposure, contrast, vibrance, all numeric adjustments

4. **Shader Implementation Accuracy**
   - Formulas must match Lightroom/photography standards
   - Example: Highlights only process negative values with gamma
   - Example: Saturation uses `rgb = lum + (rgb - lum) * saturation`
   - Example: Contrast midpoint is `128/255`, not `0.5`
   - Any deviation causes visible artifacts or incorrect color rendering

5. **Cache Strategy**
   - Cache key includes: image path, preset config, and strength
   - Prevents unnecessary reprocessing when parameters don't change
   - Cache cleared only manually

**WebGPU Shader Files:**

- `utils.wgsl` - Shared functions (luminance, RGB↔HSL conversion)
- `basicAdjustments.wgsl` - Exposure, temperature, tint, contrast, saturation, vibrance, shadows, highlights, whites, blacks, dehaze
- `splitToning.wgsl` - Shadow/highlight color grading
- `grain.wgsl` - Film grain simulation
- `vignette.wgsl` - Radial gradient effect
- `curves.wgsl` - Placeholder (not fully implemented)
- `hsl.wgsl` - Placeholder (not fully implemented)

**Shader Pipeline Order:**

1. Basic adjustments (exposure → temperature → tint → contrast → saturation → vibrance → shadows → highlights → whites → blacks → dehaze)
2. Curves (if implemented)
3. HSL selective (if implemented)
4. Split toning
5. Grain
6. Vignette
7. Blend (strength mixing)

**Export Process:**

- WebGPU processes images at full resolution
- Processed image sent as blob to main process
- Main process writes blob directly to disk
- Rotation applied in renderer before export (via canvas transform)

**Known Limitations:**

- Curves shader is placeholder (returns input unchanged)
- HSL selective shader is placeholder (returns input unchanged)
- Could be implemented in future if needed

## File Organization

```
main.js              - Electron main, IPC handlers, RAW extraction, file I/O
preload.js           - IPC bridge (security boundary)
src/
  index.html         - UI structure (Pico.css)
  styles.css         - Custom styling
  renderer.js        - UI logic, event handlers, state management
  lib/
    fileManager.js       - Directory scanning, navigation logic
    presetManager.js     - YAML loading and parsing
    imageProcessor.js    - Image loading/caching, calls WebGPU processor
    settingsManager.js   - Settings persistence and WebGPU detection
    projectManager.js    - .snerk project file management
    presetPinManager.js  - Preset pinning to images (legacy, superseded by projectManager)
    exportConfigManager.js - Export configuration management
    webgpuProcessor.js   - WebGPU device, shader compilation, GPU pipeline
    xmpImporter.js       - XMP preset import from Lightroom
    curveEditor.js       - Tone curve editor UI component
    shaders/
      utils.wgsl                - Shared utility functions
      basicAdjustments.wgsl     - 11 basic adjustments (compute shader)
      curves.wgsl               - Tone curves (placeholder)
      hsl.wgsl                  - HSL selective (placeholder)
      splitToning.wgsl          - Shadow/highlight color grading
      grain.wgsl                - Film grain effect
      vignette.wgsl             - Vignette effect
```

**Why this structure?**
- Clear separation of concerns
- Renderer lib/ folder contains client-side business logic
- Main process handles all I/O and heavy processing
- Easy to test individual modules

## Common Issues & Solutions

### Issue: "Unsupported image format" for RAW files

**Cause:** Sharp can't read RAW files directly

**Solution:**
- Check if `isRawFile()` detects the extension properly
- Ensure ExifTool is extracting preview correctly
- Verify temp file cleanup isn't causing issues

### Issue: Presets not loading

**Cause:** Directory scanning not recursive or preset files have syntax errors

**Solution:**
- Use `preset:findAll` IPC to recursively find all `.yaml` files
- Check console for YAML parsing errors
- Verify preset directory exists at `~/.snerk/presets/`

### Issue: Slow preset switching

**Cause:** Re-processing image every time, no caching

**Solution:**
- ImageProcessor maintains cache with composite keys
- Check cache is working: `imageProcessor.getCacheSize()`
- Cache key must include preset config for proper invalidation

### Issue: Export dialog doesn't close

**Cause:** Modal not properly managed

**Solution:**
- Use `elements.exportDialog.showModal()` to open
- Use `elements.exportDialog.close()` to close
- Don't forget `setTimeout()` before auto-close to let user see final status

### Issue: "Destroyed texture used in a submit" (WebGPU)

**Cause:** Textures destroyed before GPU operations complete, or pass-through textures incorrectly added to destroy list

**Solution:**
- Always `await device.queue.onSubmittedWorkDone()` before destroying textures
- Check if texture is pass-through: `if (currentTexture !== inputTexture && nextTexture !== currentTexture)`
- Only add intermediate textures to destroy list, not input or pass-through textures

### Issue: B&W presets not working, saturation: 0 shows full color (WebGPU)

**Cause:** Using `||` operator for default values - `adj.saturation || 1` treats `0` as falsy

**Solution:**
- Use explicit undefined checks: `adj.saturation !== undefined ? adj.saturation : 1`
- Apply to ALL numeric uniform values (exposure, saturation, contrast, etc.)
- This is a critical bug that affects any adjustment where `0` is a valid value

### Issue: Artifacts in dark areas or incorrect colors (WebGPU)

**Cause:** WebGPU shader formulas don't exactly match Sharp's implementation

**Solution:**
- Compare shader code line-by-line with Sharp's implementation in main.js
- Verify operation order matches Sharp (exposure → temperature → tint → contrast → saturation, etc.)
- Check for type mismatches (scalar vs vec3) in shader operations
- Example: Highlights in Sharp only processes negative values, positive values are ignored
- Example: Saturation requires explicit vec3 conversion: `lumVec = vec3<f32>(lum)`

## Important User Requirements

1. **Minimalism is key** - No feature bloat, simple UI, straightforward workflows
2. **Must support Fuji RAF and Sony ARW** - Primary use case is RAW photography
3. **Custom presets via YAML** - Users want to hand-edit preset files
4. **No loading flashes** - Smooth, polished experience
5. **Batch export** - Process entire folders quickly

## Code Style & Patterns

### Consistency Rules

- Use `async/await` (no raw Promises or callbacks)
- Error handling: try/catch with console.error + user-facing status
- No emoji in code/comments (per user preference)
- Use semantic HTML (per user preference)
- Keep functions small and focused
- IPC handlers should be thin wrappers around logic functions

### Naming Conventions

- IPC channels: `category:action` (e.g., `image:loadPreview`)
- Functions: camelCase, descriptive verbs (e.g., `loadCurrentImage`)
- Classes: PascalCase (e.g., `FileManager`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `PRESET_DIR`)

## Testing Approach

Currently no automated tests. For manual testing:

1. **RAW Support:** Test with .RAF and .ARW files minimum
2. **Preset Loading:** Check all default presets appear correctly
3. **Navigation:** Test with 20+ images, verify smooth transitions
4. **Export:** Test batch export with various formats/quality settings
5. **Custom Presets:** Add a .yaml file to `~/.snerk/presets/`, verify it loads
6. **WebGPU Rendering:**
   - Test all presets produce correct visual results
   - Verify B&W presets (saturation: 0) produce true grayscale
   - Check dark areas for artifacts (Modern presets with negative highlights)
   - Test preset strength slider (0-100%)
   - Verify smooth performance at full resolution
7. **Settings Persistence:**
   - Change settings, restart app, verify settings persisted
   - Check `~/.snerk/settings.json` file exists and has correct structure
   - Test preset visibility management

## Future Enhancement Ideas

If asked to extend Snerk, consider:

1. **Real-time adjustments:** Sliders for live preset editing
2. **Full RAW conversion:** Use LibRaw for higher quality (vs. embedded preview)
3. **Comparison mode:** Side-by-side before/after view
4. **Histogram:** Show exposure/color distribution
5. **Preset hot-reload:** Watch preset directory for changes
6. **Favorite presets:** Star frequently used presets
7. **Batch rename:** Auto-rename exported files with patterns
8. **Complete curves and HSL shaders:** Finish placeholder implementations in WebGPU
9. **GPU-accelerated export:** Use WebGPU for full-resolution export (requires chunking for large images)

## Dependencies to Watch

**exiftool-vendored**
- Bundles platform-specific ExifTool binaries
- Large dependency (~50MB)
- Could be replaced with native ExifTool install if size is a concern
- But current approach is more user-friendly (no manual install)

**Pico.css**
- Loaded from CDN in index.html
- Could be bundled locally for offline use
- Version pinned to v2

**No image processing libraries needed**
- All image processing done in WebGPU shaders
- No Sharp, Jimp, or similar dependencies
- Smaller bundle size, no native bindings to rebuild

## Development Workflow

```bash
# Start development
npm start

# The app will:
# 1. Initialize ~/.snerk/presets/ with defaults (first run only)
# 2. Open main window
# 3. Load presets from user directory
# 4. Show empty state until folder opened

# To test with RAW files:
# 1. Click "Open Folder"
# 2. Select folder with .RAF or .ARW files
# 3. Navigate with arrow keys
# 4. Apply presets and verify preview updates
# 5. Export to test batch processing
```

## Build Notes

```bash
# Build for distribution
npm run build:mac    # Creates .dmg
npm run build:win    # Creates .exe installer
npm run build:linux  # Creates .AppImage

# electron-builder configuration in package.json
# Bundles: main.js, preload.js, src/, presets/
# Excludes: node_modules (except production deps), dev files
```

## Key Design Decisions & Rationale

### Why not use a proper RAW library?

**Considered:** dcraw, LibRaw bindings

**Chose:** ExifTool preview extraction

**Reason:**
- Simpler setup, no compilation issues
- Fast enough for this use case
- Embedded previews are usually high quality
- Cross-platform without extra configuration

### Why manual YAML parsing instead of js-yaml?

**Considered:** Using js-yaml library in renderer

**Chose:** Custom regex parser

**Reason:**
- Simpler, fewer dependencies
- Preset schema is very simple
- Easier to debug and modify
- No security concerns with YAML parsing

### Why in-memory cache instead of disk cache?

**Considered:** Caching processed images to disk

**Chose:** In-memory Map cache

**Reason:**
- Simpler implementation
- No disk space concerns
- Fast access
- Cleared on app restart (fresh state)
- Could add disk cache later if needed

### Why not use Workers for batch export?

**Considered:** Web Workers or worker threads

**Chose:** Sequential processing in main event loop

**Reason:**
- Simpler for MVP
- Sharp already uses worker threads internally
- Progress updates easier with sequential
- Could add later if performance is an issue

## When Modifying This Project

### Adding a New Preset Adjustment

1. Update YAML schema in SPEC.md
2. Add parsing in `presetManager.js` parseYAML()
3. **WebGPU implementation:**
   - Add uniform field to appropriate shader struct (usually `basicAdjustments.wgsl`)
   - Update `runBasicAdjustments()` in `webgpuProcessor.js` to include new value
   - Implement shader logic matching photography standards
   - Use `!== undefined` checks, never `||` operator for defaults
4. Test with a sample preset file
5. Verify visual accuracy matches expected photographic behavior
6. Document in README.md

### Adding a New File Format

1. Add extension to `SUPPORTED_EXTENSIONS` in `fileManager.js`
2. If RAW: Add to `RAW_EXTENSIONS` in `main.js`
3. Test that browser can decode it (or add to RAW extraction path)
4. Update SPEC.md and README.md

### Adding a New Keyboard Shortcut

1. Add to event listener in `renderer.js`
2. Update README.md keyboard shortcuts table
3. Update SPEC.md
4. Consider adding to UI as tooltip/hint

### Modifying the UI Layout

1. Edit `src/index.html` structure
2. Update `src/styles.css` for new elements
3. Keep Pico.css classes for consistency
4. Test responsive behavior
5. Maintain minimalistic aesthetic

## Questions to Ask User

If extending functionality, clarify:

- **Performance vs. Quality:** Full RAW conversion or embedded preview?
- **Simplicity vs. Features:** Keep minimal or add advanced controls?
- **Storage:** Disk caching acceptable or memory-only?
- **Preset Format:** Keep YAML or switch to JSON for advanced features?
- **Distribution:** Single-file portable or installer with dependencies?

## Security Considerations

**Already Implemented:**
- Context isolation enabled
- No nodeIntegration in renderer
- Preload script whitelist for IPC
- No eval() or arbitrary code execution

**Watch Out For:**
- User-provided YAML files (potential injection)
- File paths from user (directory traversal)
- Temp file cleanup (avoid filling disk)
- ExifTool command injection (library handles this)

## Performance Profiling

If performance issues arise:

1. **Image loading slow:** Check RAW extraction time, cache hits, IPC overhead
2. **Preset application slow:** Profile GPU operations, optimize shader pipeline
3. **UI unresponsive:** Check for blocking operations, optimize WebGPU texture lifecycle
4. **Memory issues:** Implement cache eviction, limit cache size, check texture cleanup
5. **Export slow:** Consider processing multiple images in parallel on GPU

## Contact & Support

For issues or questions about this codebase, check:
- SPEC.md for technical requirements
- README.md for user documentation
- Code comments for implementation details
- Console logs for runtime errors
