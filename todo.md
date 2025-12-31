todo:
- [x] The strength slider shows a black image for any value other than 100%
- [x] When pressing "tab" or "p" the zoom is reset. Do not reset the zoom except when pressing the fit/1:1 buttons, this includes when going between images, changing profiles and so on
- [x] Getting this error:
    """
    13359:1231/111856.352537:ERROR:gpu_device.cc(307)] GPUDevice: [Invalid CommandBuffer] is invalid.
    - While calling [Queue].Submit([[Invalid CommandBuffer]])
    """
- [x] Make more color profiles that resemble the most popular filters from instagram, snap chat, and tiktok, but do not reference them by brand names
- [x] In the manage visible profiles, make the categories collapsible, eg. use html <details> <summary>
- [ ] Use the same collapse logic in the color profiles main window, using <details> and <summary> to collapse/show sections
- [ ] allow whole sections to be added/hidden in the manage visible profiles dialog
- [ ] The Strength slider does not work. Any value other than 100% produces a completely black image. It should apply the filter at percentages, so 50% means that the filter is only applied 50%, so black-and-white becomes not fully black and white until it is at 100%. 0% is effectively the same as not enabling the filter.
- [ ] Allow panning even when you start to drag on the black area outside of the picture, but make sure that you cannot pan the image fully outside of the view