# Claude Context for Snerk Project

## Project Summary

Snerk is a minimalistic Electron-based photo viewer with RAW format support and Lightroom-like preset functionality. The application allows users to browse photos, apply presets for quick color grading, and batch export images with filters applied.

## Architecture Overview

### Technology Choices

**Why Electron + Pure HTML/CSS?**
- User requested a desktop app with the simplest possible UI implementation
- No React/Vue/Svelte - just semantic HTML with Pico.css for styling
- Minimalistic approach throughout the codebase

**Why Sharp for Image Processing?**
- Fast, production-grade image processing library
- Cross-platform native bindings
- Supports resize, color adjustments, and format conversion
- Does NOT support RAW formats natively

**Why ExifTool for RAW Files?**
- Sharp cannot read RAW files directly (.RAF, .ARW, .CR3, etc.)
- ExifTool extracts embedded JPEG previews from RAW files
- This preview is then processed by Sharp
- Trade-off: Using embedded preview vs. full RAW conversion (faster, good enough for preview/export)

### Process Separation (Electron)

**Main Process (`main.js`)**
- Handles all file I/O operations
- Runs ExifTool for RAW preview extraction
- Runs Sharp for image processing
- Manages IPC handlers
- Window creation and lifecycle

**Renderer Process (`src/renderer.js`)**
- Pure UI logic
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
  // 2. Load preview into Sharp
  const image = sharp(imageBuffer);
  // 3. Process normally with Sharp
}
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

### Loading Behavior (Important UX Detail)

**Original Problem:** Loading indicator flashed between image changes, creating jarring experience

**Solution:** Keep current image visible while loading next one
- Don't hide current image when loading starts
- Load new image in background
- Replace image only when new one is fully loaded
- Update counter and filename immediately for responsiveness

### Preset Application with Sharp

Sharp doesn't have direct "exposure" or "temperature" controls like Lightroom. Here's how adjustments map:

```javascript
// Exposure -> Brightness modulate
image.modulate({ brightness: 1 + exposure })

// Saturation -> Saturation modulate
image.modulate({ saturation: saturationValue })

// Contrast -> Linear transformation
image.linear(contrast, -(128 * contrast) + 128)

// Shadows/Highlights -> Simplified via lightness modulate
// Note: This is a simplified approximation
image.modulate({ lightness: 1 + (shadows / 100) * 0.3 })
```

**Known Limitations:**
- Temperature/tint not fully implemented (would need complex color matrix)
- Curves not implemented (would need custom pixel manipulation)
- HSL selective adjustments not implemented
- Grain/vignette not implemented

These could be added in the future but weren't required for MVP.

## File Organization

```
main.js              - Electron main, IPC handlers, RAW extraction, Sharp processing
preload.js           - IPC bridge (security boundary)
src/
  index.html         - UI structure (Pico.css)
  styles.css         - Custom styling
  renderer.js        - UI logic, event handlers, state management
  lib/
    fileManager.js      - Directory scanning, navigation logic
    presetManager.js    - YAML loading and parsing
    imageProcessor.js   - Image loading/caching interface
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

## Future Enhancement Ideas

If asked to extend Snerk, consider:

1. **Real-time adjustments:** Sliders for live preset editing
2. **Full RAW conversion:** Use LibRaw for higher quality (vs. embedded preview)
3. **Comparison mode:** Side-by-side before/after view
4. **Histogram:** Show exposure/color distribution
5. **Preset hot-reload:** Watch preset directory for changes
6. **GPU acceleration:** Use GPU.js or WebGL for faster processing
7. **Favorite presets:** Star frequently used presets
8. **Batch rename:** Auto-rename exported files with patterns

## Dependencies to Watch

**exiftool-vendored**
- Bundles platform-specific ExifTool binaries
- Large dependency (~50MB)
- Could be replaced with native ExifTool install if size is a concern
- But current approach is more user-friendly (no manual install)

**sharp**
- Native bindings, platform-specific
- Rebuild required if changing Node.js version
- Usually works out of the box with electron-builder

**Pico.css**
- Loaded from CDN in index.html
- Could be bundled locally for offline use
- Version pinned to v2

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
3. Implement in Sharp processing in `main.js` image:applyPreset
4. Test with a sample preset file
5. Document in README.md

### Adding a New File Format

1. Add extension to `SUPPORTED_EXTENSIONS` in `fileManager.js`
2. If RAW: Add to `RAW_EXTENSIONS` in `main.js`
3. Test that Sharp can handle it (or add to RAW extraction path)
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

1. **Image loading slow:** Check RAW extraction time, cache hits
2. **Preset application slow:** Profile Sharp operations, simplify adjustments
3. **UI unresponsive:** Check for blocking operations, add worker threads
4. **Memory issues:** Implement cache eviction, limit cache size
5. **Export slow:** Consider parallel processing, optimize Sharp pipeline

## Contact & Support

For issues or questions about this codebase, check:
- SPEC.md for technical requirements
- README.md for user documentation
- Code comments for implementation details
- Console logs for runtime errors
