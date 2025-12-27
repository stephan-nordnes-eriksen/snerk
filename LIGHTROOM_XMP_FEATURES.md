# Lightroom XMP Features Implementation Checklist

This document lists all Adobe Lightroom features available in XMP preset files and their implementation status in Snerk.

## Basic Adjustments

### Exposure & Tone
- [x] **Exposure** (`crs:Exposure2012`) - Basic exposure adjustment (-5 to +5)
- [x] **Contrast** (`crs:Contrast2012`) - Overall contrast (-100 to +100)
- [x] **Highlights** (`crs:Highlights2012`) - Highlight recovery (-100 to +100)
- [x] **Shadows** (`crs:Shadows2012`) - Shadow lift (-100 to +100)
- [x] **Whites** (`crs:Whites2012`) - White point adjustment (-100 to +100)
- [x] **Blacks** (`crs:Blacks2012`) - Black point adjustment (-100 to +100)

### Color
- [x] **Temperature** (`crs:Temperature`) - White balance temperature (2000-50000K)
- [x] **Tint** (`crs:Tint`) - White balance tint (-150 to +150)
- [x] **Saturation** (`crs:Saturation`) - Overall saturation (-100 to +100)
- [x] **Vibrance** (`crs:Vibrance`) - Smart saturation (-100 to +100)

### Presence
- [x] **Clarity** (`crs:Clarity2012`) - Mid-tone contrast (-100 to +100)
- [x] **Dehaze** (`crs:Dehaze`) - Haze removal (-100 to +100)
- [x] **Texture** (`crs:Texture`) - Fine detail enhancement (-100 to +100)

## Tone Curve

- [x] **Parametric Curve** (`crs:ParametricShadows`, `crs:ParametricDarks`, `crs:ParametricLights`, `crs:ParametricHighlights`)
- [x] **Point Curve RGB** (`crs:ToneCurvePV2012`)
- [x] **Point Curve Red** (`crs:ToneCurvePV2012Red`)
- [x] **Point Curve Green** (`crs:ToneCurvePV2012Green`)
- [x] **Point Curve Blue** (`crs:ToneCurvePV2012Blue`)

## HSL / Color Mixer

### Hue
- [x] **Red Hue** (`crs:HueAdjustmentRed`) - Shift red colors (-100 to +100)
- [x] **Orange Hue** (`crs:HueAdjustmentOrange`)
- [x] **Yellow Hue** (`crs:HueAdjustmentYellow`)
- [x] **Green Hue** (`crs:HueAdjustmentGreen`)
- [x] **Aqua Hue** (`crs:HueAdjustmentAqua`)
- [x] **Blue Hue** (`crs:HueAdjustmentBlue`)
- [x] **Purple Hue** (`crs:HueAdjustmentPurple`)
- [x] **Magenta Hue** (`crs:HueAdjustmentMagenta`)

### Saturation
- [x] **Red Saturation** (`crs:SaturationAdjustmentRed`)
- [x] **Orange Saturation** (`crs:SaturationAdjustmentOrange`)
- [x] **Yellow Saturation** (`crs:SaturationAdjustmentYellow`)
- [x] **Green Saturation** (`crs:SaturationAdjustmentGreen`)
- [x] **Aqua Saturation** (`crs:SaturationAdjustmentAqua`)
- [x] **Blue Saturation** (`crs:SaturationAdjustmentBlue`)
- [x] **Purple Saturation** (`crs:SaturationAdjustmentPurple`)
- [x] **Magenta Saturation** (`crs:SaturationAdjustmentMagenta`)

### Luminance
- [x] **Red Luminance** (`crs:LuminanceAdjustmentRed`)
- [x] **Orange Luminance** (`crs:LuminanceAdjustmentOrange`)
- [x] **Yellow Luminance** (`crs:LuminanceAdjustmentYellow`)
- [x] **Green Luminance** (`crs:LuminanceAdjustmentGreen`)
- [x] **Aqua Luminance** (`crs:LuminanceAdjustmentAqua`)
- [x] **Blue Luminance** (`crs:LuminanceAdjustmentBlue`)
- [x] **Purple Luminance** (`crs:LuminanceAdjustmentPurple`)
- [x] **Magenta Luminance** (`crs:LuminanceAdjustmentMagenta`)

## Color Grading (Split Toning)

### Shadows
- [ ] **Shadow Hue** (`crs:ShadowTint`)
- [ ] **Shadow Saturation** - Stored in same field

### Midtones
- [ ] **Midtone Hue** - Lightroom CC feature
- [ ] **Midtone Saturation** - Lightroom CC feature

### Highlights
- [ ] **Highlight Hue** (`crs:SplitToningShadowHue`)
- [ ] **Highlight Saturation** (`crs:SplitToningShadowSaturation`)

### Global
- [ ] **Balance** (`crs:SplitToningBalance`) - Shadow/Highlight balance

## Detail

### Sharpening
- [ ] **Amount** (`crs:Sharpness`) - Sharpening amount (0-150)
- [ ] **Radius** (`crs:SharpenRadius`) - Sharpening radius (0.5-3.0)
- [ ] **Detail** (`crs:SharpenDetail`) - Detail preservation (0-100)
- [ ] **Masking** (`crs:SharpenEdgeMasking`) - Edge masking (0-100)

### Noise Reduction
- [ ] **Luminance** (`crs:LuminanceSmoothing`) - Luminance NR (0-100)
- [ ] **Luminance Detail** (`crs:LuminanceNoiseReductionDetail`)
- [ ] **Luminance Contrast** (`crs:LuminanceNoiseReductionContrast`)
- [ ] **Color** (`crs:ColorNoiseReduction`) - Color NR (0-100)
- [ ] **Color Detail** (`crs:ColorNoiseReductionDetail`)
- [ ] **Color Smoothness** (`crs:ColorNoiseReductionSmoothness`)

## Lens Corrections

### Chromatic Aberration
- [ ] **Remove Chromatic Aberration** (`crs:RemoveChromaticAberration`)

### Distortion
- [ ] **Distortion** (`crs:LensManualDistortionAmount`)

### Vignette
- [x] **Amount** (`crs:VignetteAmount` or `crs:PostCropVignetteAmount`)
- [ ] **Midpoint** (`crs:VignetteMidpoint`)
- [ ] **Roundness** (`crs:PostCropVignetteRoundness`)
- [ ] **Feather** (`crs:PostCropVignetteFeather`)
- [ ] **Highlights** (`crs:PostCropVignetteHighlightContrast`)

### Profile Corrections
- [ ] **Enable Profile Corrections** (`crs:LensProfileEnable`)
- [ ] **Lens Profile** (Various `crs:LensProfile*` fields)

## Effects

### Grain
- [x] **Amount** (`crs:GrainAmount`) - Film grain amount (0-100)
- [ ] **Size** (`crs:GrainSize`) - Grain particle size
- [ ] **Roughness** (`crs:GrainFrequency`) - Grain roughness

### Post-Crop Vignette (see Lens Corrections above)

### Dehaze (see Presence above)

## Calibration

### Camera Calibration
- [ ] **Process Version** (`crs:ProcessVersion`) - Processing version
- [ ] **Red Primary Hue** (`crs:CameraProfileRedHue`)
- [ ] **Red Primary Saturation** (`crs:CameraProfileRedSaturation`)
- [ ] **Green Primary Hue** (`crs:CameraProfileGreenHue`)
- [ ] **Green Primary Saturation** (`crs:CameraProfileGreenSaturation`)
- [ ] **Blue Primary Hue** (`crs:CameraProfileBlueHue`)
- [ ] **Blue Primary Saturation** (`crs:CameraProfileBlueSaturation`)

## Transform

### Geometry
- [ ] **Upright** (`crs:PerspectiveUpright`)
- [ ] **Vertical** (`crs:PerspectiveVertical`)
- [ ] **Horizontal** (`crs:PerspectiveHorizontal`)
- [ ] **Rotate** (`crs:PerspectiveRotate`)
- [ ] **Aspect** (`crs:PerspectiveAspect`)
- [ ] **Scale** (`crs:PerspectiveScale`)
- [ ] **X Offset** (`crs:PerspectiveX`)
- [ ] **Y Offset** (`crs:PerspectiveY`)

### Crop
- [ ] **Crop** (`crs:HasCrop`, `crs:CropTop`, `crs:CropLeft`, `crs:CropBottom`, `crs:CropRight`)
- [ ] **Crop Angle** (`crs:CropAngle`)
- [ ] **Crop Constrain to Warp** (`crs:CropConstrainToWarp`)

## Local Adjustments (Advanced)

### Graduated Filter
- [ ] **Graduated Filter** (`crs:GradientBasedCorrections`) - Multiple filters with position, angle, and adjustments

### Radial Filter
- [ ] **Radial Filter** (`crs:CircularGradientBasedCorrections`) - Multiple filters with position, size, and adjustments

### Adjustment Brush
- [ ] **Adjustment Brush** (`crs:PaintBasedCorrections`) - Mask-based local adjustments

## Implementation Priority

### High Priority (Core Features)
1. ✅ Basic tone adjustments (exposure, contrast, highlights, shadows, whites, blacks)
2. ✅ Color adjustments (temperature, tint, saturation, vibrance)
3. ✅ Presence (clarity, texture, dehaze)
4. ✅ Tone curves (all channels)
5. ✅ HSL adjustments (all colors)

### Medium Priority (Common Features)
1. ✅ Texture (new Lightroom feature)
2. ❌ Color grading / Split toning
3. ❌ Sharpening
4. ❌ Noise reduction
5. ❌ Complete vignette controls (currently only amount)
6. ❌ Complete grain controls (currently only amount)

### Low Priority (Advanced Features)
1. ❌ Lens corrections (distortion, chromatic aberration)
2. ❌ Transform / geometry corrections
3. ❌ Crop adjustments
4. ❌ Camera calibration
5. ❌ Local adjustments (graduated filter, radial filter, adjustment brush)

## Notes

### Already Implemented
All core tone and color adjustments are fully implemented and working. HSL selective color adjustments are implemented via RGB↔HSL conversion with per-pixel processing.

### Partially Implemented
- **Grain**: Amount is preserved but size and roughness are not implemented
- **Vignette**: Amount is preserved but midpoint, roundness, feather are not implemented

### Not Yet Implemented
Many advanced features require significant additional work:
- **Sharpening**: Requires convolution kernels
- **Noise Reduction**: Requires advanced filtering algorithms
- **Lens Corrections**: Would benefit from lens profile database
- **Local Adjustments**: Requires mask system and gradient/radial filter implementation
- **Transform/Crop**: Requires geometric transformation pipeline

### Technical Limitations
Some features may be difficult to implement with Sharp alone:
- Local adjustments require a masking system
- Some lens corrections require lens profiles
- Camera calibration requires color science expertise
- Advanced noise reduction requires specialized algorithms

## Future Work

To complete the XMP feature set:
1. Implement texture enhancement
2. Add split toning / color grading
3. Improve sharpening with proper masking
4. Add basic noise reduction
5. Complete vignette and grain controls
6. Consider lens correction basics (distortion, CA)
7. Evaluate feasibility of local adjustments
