# Architectural Decisions

This document records key architectural and design decisions for Snerk. These decisions were made deliberately and should **not be changed** without careful consideration and updating this document.

## Purpose

- Prevent future changes from violating core design principles
- Explain the "why" behind non-obvious choices
- Save time by documenting trade-offs that were already considered
- Maintain consistency across the codebase

---

## Core Technology Decisions

### ✓ Decision: Electron + Pure HTML/CSS (No Framework)

**Status**: LOCKED

**What**:
- Use Electron for desktop app
- No React, Vue, Svelte, or any UI framework
- Pure semantic HTML + Pico.css for styling
- Vanilla JavaScript only

**Why**:
- User explicitly requested simplest possible UI implementation
- Minimalism is a core value of this project
- Faster startup, smaller bundle, fewer dependencies
- Easier to understand and maintain for newcomers

**Do NOT**:
- ❌ Add React, Vue, Angular, Svelte, or any UI framework
- ❌ Add build tools like Webpack, Vite, or Rollup (beyond Electron's built-in)
- ❌ Add TypeScript (stay vanilla JS)
- ❌ Replace Pico.css with a component library like Bootstrap or Material UI

**Exceptions**:
- None. This is fundamental to the project's identity.

---

### ✓ Decision: Dual Rendering Mode (WebGPU + Sharp)

**Status**: LOCKED

**What**:
- WebGPU for GPU-accelerated preview rendering (default)
- Sharp for CPU-based fallback and all exports
- Full feature parity between both modes
- Automatic fallback if WebGPU unavailable

**Why**:
- WebGPU is ~10x faster for previews
- Sharp handles RAW file extraction (via ExifTool)
- Sharp is battle-tested and always available
- Separation allows GPU failures to fall back gracefully

**Do NOT**:
- ❌ Remove Sharp rendering mode (it's the safety net)
- ❌ Make WebGPU mandatory (not all systems support it)
- ❌ Use different algorithms between WebGPU and Sharp (must match visually)
- ❌ Use WebGPU for exports (Sharp handles this reliably)

**Allowed**:
- ✓ Add new adjustments to both modes (must maintain parity)
- ✓ Optimize WebGPU shaders
- ✓ Add user toggle to force Sharp mode

---

### ✓ Decision: ExifTool for RAW Preview Extraction

**Status**: LOCKED

**What**:
- Use ExifTool to extract embedded JPEG previews from RAW files
- Process the extracted preview through Sharp
- Do NOT perform full RAW conversion

**Why**:
- Embedded preview extraction: ~2 seconds
- Full RAW conversion: 10+ seconds
- Embedded previews are high quality (usually 1920px+)
- No platform-specific RAW libraries needed
- Consistent behavior across Windows/Mac/Linux

**Do NOT**:
- ❌ Replace with LibRaw, dcraw, or full RAW conversion
- ❌ Try to process RAW files directly through Sharp
- ❌ Use different RAW handling per platform

**Allowed**:
- ✓ Add option for full RAW conversion (as opt-in feature)
- ✓ Add support for more RAW formats via ExifTool

---

## File Format Decisions

### ✓ Decision: YAML for Presets

**Status**: LOCKED

**What**:
- Preset files stored as `.yaml`
- Located in `~/.snerk/presets/` (recursive scan)
- Custom regex-based parser (no js-yaml dependency)

**Why**:
- User explicitly requested YAML over JSON
- YAML supports comments (useful for preset documentation)
- More human-friendly for manual editing
- Simpler than JSON for non-technical users

**Do NOT**:
- ❌ Change preset format to JSON
- ❌ Add js-yaml or yaml npm package (keep lightweight parser)
- ❌ Store presets in database or binary format

**Allowed**:
- ✓ Improve YAML parser to handle edge cases
- ✓ Add preset validation

---

### ✓ Decision: JSON for .snerk Project Files

**Status**: LOCKED

**What**:
- `.snerk` files are JSON (not YAML)
- Located in root of each opened folder
- Auto-saved on every change

**Why**:
- JSON is more reliable for programmatic read/write
- Smaller file size than YAML
- Built-in JavaScript support (no parser needed)
- Less likely to be corrupted by manual edits
- Users shouldn't manually edit project files

**Do NOT**:
- ❌ Change .snerk format to YAML
- ❌ Use binary format
- ❌ Store .snerk files outside the folder
- ❌ Add manual save button (defeats auto-save UX)

**Allowed**:
- ✓ Add new fields to .snerk (maintain version compatibility)
- ✓ Compress .snerk if it gets large (rare)

---

### ✓ Decision: Filename-Only Keys in .snerk

**Status**: ACCEPTED

**What**:
- Files in `.snerk` are keyed by filename only (no path)
- Example: `"IMG_001.RAF"` not `"/path/to/IMG_001.RAF"`

**Why**:
- Simpler implementation
- Works for 99% of use cases (most users don't have duplicate filenames)
- Avoids cross-platform path issues
- Smaller file size

**Trade-offs**:
- If same filename appears in nested folders, only one can be tracked
- User must ensure unique filenames within working folder

**Do NOT**:
- ❌ Change to full paths (breaks existing .snerk files)
- ❌ Use relative paths (fragile)

**Allowed**:
- ✓ Add migration to path-based keys in v2 (with migration script)
- ✓ Warn user about duplicate filenames

---

## State Management Decisions

### ✓ Decision: Auto-Save Everything

**Status**: LOCKED

**What**:
- No "Save" button anywhere in the UI
- Changes to rotations, pinned presets, export settings auto-save immediately
- Applies to both global settings (~/.snerk/settings.json) and project files (.snerk)

**Why**:
- Modern UX expectation (like Google Docs, Notion)
- Prevents data loss from crashes or force-quit
- Simpler mental model for users
- One less thing to remember

**Do NOT**:
- ❌ Add manual save buttons
- ❌ Add "unsaved changes" warnings
- ❌ Batch saves or delay saves

**Allowed**:
- ✓ Show "Saving..." indicator during save
- ✓ Add undo/redo system (independent of save)

---

### ✓ Decision: In-Memory Image Cache Only

**Status**: ACCEPTED

**What**:
- Processed images cached in memory (JavaScript Map)
- Cache keys: `preview_${path}` or `preset_${path}_${config}`
- No disk-based cache
- Cache cleared on app restart

**Why**:
- Simpler implementation
- No disk space concerns
- No cache invalidation complexity
- Fast enough for typical use (10-50 images)

**Trade-offs**:
- Memory usage grows with number of images viewed
- Cache lost on restart

**Do NOT**:
- ❌ Add automatic disk cache (unless memory issues proven)

**Allowed**:
- ✓ Add disk cache as opt-in feature
- ✓ Add cache size limit with LRU eviction
- ✓ Add "clear cache" button

---

## UI/UX Decisions

### ✓ Decision: No Loading Flash

**Status**: LOCKED

**What**:
- Keep current image visible while loading next image
- Don't show loading spinner that hides content
- Replace image only when new one is fully loaded
- Update metadata (counter, filename) immediately

**Why**:
- Prevents jarring flash when navigating quickly
- More polished, professional feel
- Users can still see previous image while waiting

**Do NOT**:
- ❌ Show loading spinner that hides current image
- ❌ Clear image before next one loads

**Allowed**:
- ✓ Add subtle loading indicator (spinner in corner)
- ✓ Add progress bar for slow operations

---

### ✓ Decision: Minimal UI, Maximum Shortcuts

**Status**: LOCKED

**What**:
- Comprehensive keyboard shortcuts for all actions
- UI can be hidden (Space bar)
- No confirmation dialogs unless destructive
- Direct manipulation (click to select, drag to pan)

**Why**:
- Faster workflow for power users
- Cleaner, less cluttered interface
- Inspired by Lightroom's speed-focused UI

**Do NOT**:
- ❌ Add confirmation dialogs for non-destructive actions
- ❌ Remove keyboard shortcuts
- ❌ Make UI permanently visible

**Allowed**:
- ✓ Add more keyboard shortcuts
- ✓ Add customizable shortcuts

---

### ✓ Decision: Pico.css for Styling

**Status**: LOCKED

**What**:
- Use Pico.css as base stylesheet
- Minimal custom CSS in `styles.css`
- Semantic HTML class names

**Why**:
- User requested minimal styling approach
- Pico provides good defaults without heavy customization
- Small CSS footprint (~10KB)
- Works well with semantic HTML

**Do NOT**:
- ❌ Replace with Bootstrap, Material UI, Tailwind, etc.
- ❌ Add CSS-in-JS libraries
- ❌ Use CSS frameworks that require build steps

**Allowed**:
- ✓ Override Pico styles in styles.css when needed
- ✓ Upgrade Pico.css version
- ✓ Add custom CSS for new features

---

## Security Decisions

### ✓ Decision: Electron Context Isolation

**Status**: LOCKED

**What**:
- Context isolation enabled
- No nodeIntegration in renderer
- Preload script whitelists IPC methods via contextBridge
- No direct Node.js access from renderer

**Why**:
- Security best practice
- Prevents XSS attacks from escalating to RCE
- Sandboxes renderer process
- Required for modern Electron apps

**Do NOT**:
- ❌ Enable nodeIntegration in renderer
- ❌ Disable context isolation
- ❌ Expose Node.js APIs directly to renderer

**Allowed**:
- ✓ Add new IPC handlers (in main.js)
- ✓ Expose new methods via contextBridge (in preload.js)

---

### ✓ Decision: No Remote Code Execution

**Status**: LOCKED

**What**:
- No eval() or Function() constructor
- No dynamic script loading
- No arbitrary code execution from user input

**Why**:
- Security vulnerability
- Users could inject malicious code via YAML or settings

**Do NOT**:
- ❌ Use eval() anywhere
- ❌ Execute code from preset files
- ❌ Load external JavaScript at runtime

**Allowed**:
- ✓ Use safe parsers (JSON.parse, custom YAML parser)

---

## Performance Decisions

### ✓ Decision: Lazy Loading for Presets

**Status**: ACCEPTED

**What**:
- Load preset file paths on startup
- Load preset contents only when needed (on first use)
- Cache parsed presets in memory

**Why**:
- Faster startup with 100+ presets
- Most presets never used in a session
- Memory-efficient

**Do NOT**:
- ❌ Load all preset contents on startup

**Allowed**:
- ✓ Preload commonly-used presets
- ✓ Add preset search/indexing

---

### ✓ Decision: Single-threaded Image Processing

**Status**: ACCEPTED

**What**:
- Process one image at a time
- Sequential batch export (not parallel)
- Sharp uses internal worker threads

**Why**:
- Simpler implementation
- Avoids thread coordination complexity
- Sharp already parallelizes internally
- Good enough for typical use (10-50 images)

**Trade-offs**:
- Batch export slower than theoretical maximum
- Can't cancel individual exports

**Do NOT**:
- ❌ Add Web Workers without benchmarking
- ❌ Add multi-threading without proven need

**Allowed**:
- ✓ Add parallel export if users request it
- ✓ Add export cancellation

---

## Code Style Decisions

### ✓ Decision: Minimalism and Brevity

**Status**: LOCKED

**What**:
- Keep code concise
- No verbose comments unless complex
- No unnecessary abstractions
- No code that isn't used

**Why**:
- User explicitly requested minimal code
- Easier to understand
- Less to maintain
- Avoid premature optimization

**Do NOT**:
- ❌ Add helpers/utilities for one-time use
- ❌ Add comments explaining obvious code
- ❌ Create abstractions "for the future"
- ❌ Add feature flags or backwards compatibility shims

**Allowed**:
- ✓ Add comments for non-obvious logic
- ✓ Extract functions when code is duplicated 3+ times
- ✓ Add utilities if used in 3+ places

---

### ✓ Decision: No Emoji in Code/Docs (Except Commits)

**Status**: LOCKED

**What**:
- No emoji in code comments
- No emoji in UI labels (unless user requests)
- Emoji allowed in commit messages (🤖 for bot, ✨ for features, etc.)

**Why**:
- User preference
- More professional appearance
- Avoids encoding issues

**Do NOT**:
- ❌ Add emoji to code comments
- ❌ Use emoji in UI without user request

**Allowed**:
- ✓ Emoji in commit messages (following convention)
- ✓ Emoji if user specifically requests it

---

## Anti-Decisions (Things Explicitly NOT Done)

### ❌ Not Using TypeScript

**Why**: User wants minimal, simple codebase. TypeScript adds build step and complexity.

**Do NOT**: Convert to TypeScript unless user explicitly requests it.

---

### ❌ Not Using a State Management Library

**Why**: Simple global `state` object is sufficient. Redux/MobX/Zustand would be overkill.

**Do NOT**: Add Redux, MobX, Zustand, or similar.

---

### ❌ Not Using a Testing Framework

**Why**: Manual testing is sufficient for this project size. No automated tests exist.

**Do NOT**: Add Jest/Mocha/Vitest unless user requests it.

---

### ❌ Not Using a Component System

**Why**: Pure HTML/CSS, no component abstraction needed.

**Do NOT**: Create custom component system or use Web Components.

---

### ❌ Not Using CSS Modules or CSS-in-JS

**Why**: Plain CSS is sufficient. No build step needed.

**Do NOT**: Add styled-components, emotion, CSS modules, etc.

---

## Version Compatibility

### ✓ Decision: Semantic Versioning

**Status**: LOCKED

**What**:
- Follow semver (MAJOR.MINOR.PATCH)
- .snerk file version field tracks format changes
- Settings.json version field tracks format changes

**Why**:
- Standard practice
- Users understand semver
- Migration strategy is clear

**Do NOT**:
- ❌ Break .snerk or settings.json format without version bump
- ❌ Remove features without major version bump

**Allowed**:
- ✓ Add fields to .snerk/settings.json (minor version)
- ✓ Fix bugs (patch version)

---

## Updating This Document

When making architectural changes:

1. **Update this document FIRST** before implementing
2. Mark old decision as [SUPERSEDED] if changing
3. Explain why the change is necessary
4. Update related docs (CLAUDE.md, SPEC.md)
5. Consider migration path for existing users

### Format for New Decisions

```markdown
### ✓ Decision: [Short Title]

**Status**: LOCKED | ACCEPTED | EXPERIMENTAL

**What**:
[What is being decided]

**Why**:
[Rationale and context]

**Do NOT**:
- ❌ [Things that should never be done]

**Allowed**:
- ✓ [Acceptable variations or extensions]
```

---

## Status Definitions

- **LOCKED**: Cannot be changed without breaking core identity of project
- **ACCEPTED**: Strong preference, change only with good reason and documentation
- **EXPERIMENTAL**: New, may be revised based on feedback
- **SUPERSEDED**: No longer valid, kept for historical context

---

## Philosophy

The guiding principle for all decisions in Snerk is:

> **Simplicity over features. Speed over polish. Working over perfect.**

When in doubt, choose the simpler option. This project values:
1. Minimalism
2. Performance
3. User control
4. No surprises

Avoid:
1. Over-engineering
2. Premature optimization
3. Feature creep
4. Complex abstractions
