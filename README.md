# Snerk

A minimalistic photo viewer with RAW support and Lightroom-like presets.

## Documentation

- **[SPEC.md](SPEC.md)** - Complete technical specification and requirements
- **[CLAUDE.md](CLAUDE.md)** - Development context and architecture notes for Claude Code

## Features

- Support for RAW formats from various vendors (Fuji RAF, Sony ARW, Canon CR3, Nikon NEF, DNG, and more)
- Apply Lightroom-like presets to your photos
- Live preview of presets
- Batch export with filters applied
- Custom preset system via YAML files
- Clean, minimalistic interface

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

## Custom Presets

Create custom presets by adding YAML files to `~/.snerk/presets/`. Presets can be organized in subdirectories by category.

Example preset (`~/.snerk/presets/my-preset.yaml`):

```yaml
name: "My Custom Preset"
category: "custom"
adjustments:
  exposure: 0.3
  contrast: 1.2
  saturation: 1.1
  temperature: 50
  highlights: -10
  shadows: 20
  vibrance: 15
```

See the included presets in the `presets/` directory for more examples.

## Building

Build for your platform:

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## Keyboard Shortcuts

- `←` / `→` - Navigate between photos
- `1-9` - Apply preset by number
- `0` - Clear preset
- `Cmd/Ctrl + O` - Open folder
- `Cmd/Ctrl + E` - Export all

## License

MIT
