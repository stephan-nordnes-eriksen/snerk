todo:
- [x] All the black backgrounds in the UI should be opaque and with a blur filter
- [x] Support for rotating the images, and have that rotation be applied to the exports
- [x] Add a shortcut-overview when pressing "?" as well as adding a "?"-button in the bottom right which opens the same dialog
- [x] when setting rating, eg. ctrl+3, the filter also changes
- [x] alt+1-5 (setting zoom level) does not seem to work
- [x] The shortcut overview modal is larger than the window, so it is possible to scroll so that the header is out of the view or the footer. The header and footer should be stuck to the top/bottom of the window, and it should not be possible to scroll in that view
- [x] When clicking outside of a modal, the modal should close
- [x] Add a shortcut for 1:1 zoom level
- [x] Up and down arrows should rotate the photo
- [x] if all properties are "0" for a new color profile, then the image becomes completely black
- [x] Changing the tone curve is very slow. Make sure it does not do double-work, but triggering an update to the image, and reading the current values of the filters, and not queuing up multiple edits.
- [x] Reset zoom after a rotate is incorrect. It probably resets to the previous dimensions
- [x] Pan is incorrect after rotate, it seems linked to the old dimensions
- [x] Pan is still not correct for all orientations
- [x] Resetting zoom "Fit" is not correct. Regardless of rotation, it is too zoomed out. It is perhaps 0.5x in stead of 1x
- [x] Getting this error:
    """
        Error reading directory: [Error: ENOENT: no such file or directory, scandir '/Users/stephaneriksen/.snerk/export-configs'] {
            errno: -2,
            code: 'ENOENT',
            syscall: 'scandir',
            path: '/Users/stephaneriksen/.snerk/export-configs'
        }
    """
- [x] Getting this error when running:
    """
        [90019:1230/000459.004866:ERROR:gpu_device.cc(307)] GPUDevice: [Texture] usage (TextureUsage::(CopyDst|TextureBinding|RenderAttachment)) doesn't include TextureUsage::CopySrc.
        - While validating source [Texture] usage.
        - While encoding [CommandEncoder].CopyTextureToBuffer([Texture], [Buffer], [Extent3D width:4416, height:2944, depthOrArrayLayers:1]).

        [90019:1230/000459.004915:ERROR:gpu_device.cc(307)] GPUDevice: [Invalid CommandBuffer] is invalid.
        - While calling [Queue].Submit([[Invalid CommandBuffer]])

        ^C/Users/stephaneriksen/github/snerk/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron exited with signal SIGINT
    """
- [x] There should be a setting for zoom sensitivity
- [x] Create a .snerk file in the folder that is opened with metadata about the current state of the files that are being processed. Upon opening a folder, if it has a .snerk file, it should load that. The .snerk file stores which filters are stored to which files, what rotation, and so on. It is effectively a project-file for a folder. If a picture file, which is referenced in the .snerk file, is no longer in the folder, just ignore it. When saving, remove references which no longer exists. Every time a change is made, save the .snerk file, so there should not be a "Save" button anywhere. It is simply implicitly saved whenever a change is done. Also store the export-settings here, so two folders can have separate export settings.
- [x] Add a slider for the strength of the whole filter. Eg 0% = no filter, 100% is the full filter
- [x] when applying a profile, the zoom is reset. It should not do that
- [x] Make a large library of different color profiles, but they are not visible by default. You have to open a modal and then check the ones you want to be available in the ui. This UI also allows you to hide previously imported styles. The styles should not be removed by this, simply hidden in the main list in the app
- [x] The default zoom sensitivity should be 0.3