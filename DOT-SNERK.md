# .snerk Project File Format

## Overview

The `.snerk` file is a JSON file stored in the root of each folder opened in Snerk. It contains folder-specific metadata about images, including rotations, pinned presets, and export settings.

## Purpose

- **Session Persistence**: Resume work exactly where you left off when reopening a folder
- **Per-folder Settings**: Different folders can have different export configurations
- **Auto-save**: No manual save button - changes are automatically written to disk
- **Portability**: The `.snerk` file can be committed to version control or shared with others

## File Location

```
/path/to/your/photos/
  ├── IMG_001.RAF
  ├── IMG_002.ARW
  ├── IMG_003.JPG
  └── .snerk          ← Project file
```

## File Structure

```json
{
  "version": 1,
  "files": {
    "IMG_001.RAF": {
      "rotation": 90,
      "pinnedPreset": "Cinematic"
    },
    "IMG_002.ARW": {
      "rotation": 0,
      "pinnedPreset": "Black & White"
    },
    "IMG_003.JPG": {
      "rotation": 270
    }
  },
  "exportConfig": {
    "format": "jpeg",
    "quality": 95
  }
}
```

## Schema

### Root Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | Yes | File format version (currently `1`) |
| `files` | object | Yes | Per-file metadata, keyed by filename |
| `exportConfig` | object | Yes | Folder-specific export settings |

### File Metadata Object

Each key in `files` is a filename (without path), and the value is an object with:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rotation` | number | No | Rotation in degrees: `0`, `90`, `180`, or `270` |
| `pinnedPreset` | string | No | Name of preset pinned to this image |

**Note:** Files with no metadata (no rotation, no pinned preset) are omitted from the `files` object.

### Export Config Object

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `format` | string | Yes | `"jpeg"` | Export format: `"jpeg"`, `"png"`, or `"webp"` |
| `quality` | number | Yes | `95` | Quality setting (1-100 for JPEG/WebP, ignored for PNG) |

## Behavior

### On Folder Open

1. Snerk scans the folder for image files
2. Checks if `.snerk` file exists
3. If exists:
   - Loads file metadata
   - Applies rotations to matching images
   - Loads pinned presets
   - Loads export config
4. If doesn't exist:
   - Uses default export config from global settings
   - No rotations or pinned presets applied

### On Changes

Changes are auto-saved immediately when:
- User rotates an image (`↑` or `↓` arrow keys)
- User pins a preset to an image (📌 button)
- User changes export settings and confirms export dialog

### Cleanup

When loading or saving, the `.snerk` file is cleaned up:
- Entries for files that no longer exist in the folder are removed
- This prevents the file from growing with stale data

## Example Use Cases

### Resuming Work

1. Open a folder with 100 RAW files
2. Rotate some images, pin presets to others
3. Close Snerk
4. Reopen the same folder later
5. All rotations and pinned presets are restored

### Per-folder Export Settings

1. Folder A: High-quality JPEGs (quality 95) for printing
2. Folder B: Web-optimized JPEGs (quality 80) for upload
3. Each folder remembers its export settings via `.snerk`

### Version Control

1. Add `.snerk` to git repository
2. Share with collaborators
3. Everyone sees the same rotations and preset assignments
4. Useful for team photo editing workflows

## Implementation Details

### File I/O

- **Read**: On folder open via `projectManager.loadProject(folderPath)`
- **Write**: On every metadata change via `projectManager.saveProject()`
- **Location**: `${folderPath}/.snerk`

### Key Functions

```javascript
// Load project file
await projectManager.loadProject(folderPath)

// Get rotation for an image
const rotation = projectManager.getRotation(imagePath)

// Set rotation for an image (auto-saves)
projectManager.setRotation(imagePath, 90)

// Get pinned preset for an image
const presetName = projectManager.getPinnedPreset(imagePath)

// Pin preset to image (auto-saves)
projectManager.setPinnedPreset(imagePath, "Cinematic")

// Get export config
const config = projectManager.getExportConfig()

// Set export config (auto-saves)
projectManager.setExportConfig({ format: "jpeg", quality: 95 })
```

### Filename-based Keys

Files are keyed by filename only (not full path):
- **Why**: Simpler implementation, works for typical use cases
- **Limitation**: If the same filename appears in nested folders, only one can be tracked
- **Assumption**: Users typically don't have duplicate filenames in the same working folder

## Migration & Versioning

### Version 1 (Current)

Initial implementation with basic rotation, preset pinning, and export config.

### Future Versions

If the file format changes:
1. Increment `version` number
2. Add migration logic in `projectManager.loadProject()`
3. Support reading old versions and upgrading on save
4. Document changes in this file

## Error Handling

### Missing .snerk File

- Not an error - simply start with empty state
- File will be created on first metadata change

### Corrupt .snerk File

- Log error to console
- Start with empty state (don't crash)
- File will be overwritten on next save

### Permission Errors

- Log error to console
- Metadata changes work in-memory but won't persist
- User can still use Snerk, just without persistence

## Best Practices

### For Users

- Add `.snerk` to `.gitignore` if you don't want to share your work state
- Or commit `.snerk` to share preset assignments with team
- Don't manually edit - use Snerk UI to make changes

### For Developers

- Always call `cleanupMissingFiles()` after loading
- Auto-save on every change (no pending state)
- Use filename-only keys (no path prefix)
- Handle missing file gracefully (don't crash)

## Related Files

- `src/lib/projectManager.js` - Implementation
- `CLAUDE.md` - Architecture documentation
- `SPEC.md` - Feature specification
