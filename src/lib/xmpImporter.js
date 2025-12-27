class XmpImporter {
  constructor() {
    this.crsNamespace = 'http://ns.adobe.com/camera-raw-settings/1.0/';
    this.dcNamespace = 'http://purl.org/dc/elements/1.1/';
    this.rdfNamespace = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  }

  /**
   * Parse XMP file and convert to Snerk preset format
   * @param {string} xmpContent - Raw XMP file content
   * @param {string} filename - Original filename (optional)
   * @returns {Object} Snerk preset object with name, category, and adjustments
   */
  parseXmpToPreset(xmpContent, filename = null) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmpContent, 'text/xml');

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid XMP file: XML parsing failed');
    }

    // Extract preset name from filename or XMP metadata
    const name = this.extractPresetName(doc, filename);

    // Extract all crs parameters
    const crsParams = this.extractCrsParameters(doc);

    if (Object.keys(crsParams).length === 0) {
      throw new Error('No Camera Raw Settings found in XMP file');
    }

    // Convert to Snerk format
    const preset = {
      name: name,
      category: 'imported',
      adjustments: this.convertAdjustments(crsParams),
    };

    // Add tone curves if present
    const curves = this.convertToneCurves(crsParams);
    if (curves) {
      preset.curves = curves;
    }

    // Add HSL adjustments if present
    const hsl = this.convertHsl(crsParams);
    if (hsl && hsl.length > 0) {
      preset.hsl = hsl;
    }

    // Add split toning if present
    const splitToning = this.convertSplitToning(crsParams);
    if (splitToning) {
      preset.splitToning = splitToning;
    }

    // Add sharpening if present
    const sharpening = this.convertSharpening(crsParams);
    if (sharpening) {
      preset.sharpening = sharpening;
    }

    // Add grain if present
    const grain = this.convertGrain(crsParams);
    if (grain) {
      preset.grain = grain;
    }

    // Add vignette if present
    const vignette = this.convertVignette(crsParams);
    if (vignette) {
      preset.vignette = vignette;
    }

    return preset;
  }

  /**
   * Extract preset name from XMP metadata or filename
   * @param {Document} doc - Parsed XML document
   * @param {string} filename - Original filename (optional)
   * @returns {string} Preset name
   */
  extractPresetName(doc, filename = null) {
    // If filename provided, use it (without extension)
    if (filename) {
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      return nameWithoutExt.replace(/[-_]/g, ' ');
    }

    // Try to find dc:title
    const titleElements = doc.getElementsByTagNameNS(this.dcNamespace, 'title');
    if (titleElements.length > 0) {
      const altElement = titleElements[0].getElementsByTagNameNS(this.rdfNamespace, 'Alt')[0];
      if (altElement) {
        const liElement = altElement.getElementsByTagNameNS(this.rdfNamespace, 'li')[0];
        if (liElement && liElement.textContent.trim()) {
          return liElement.textContent.trim();
        }
      }
    }

    // Fallback: generate name from timestamp
    return `Imported Preset ${new Date().toISOString().slice(0, 10)}`;
  }

  /**
   * Extract all Camera Raw Settings parameters from XMP
   * @param {Document} doc - Parsed XML document
   * @returns {Object} Object with crs parameter names and values
   */
  extractCrsParameters(doc) {
    const params = {};

    // Get Description element (where crs attributes usually are)
    const descriptions = doc.getElementsByTagNameNS(this.rdfNamespace, 'Description');

    for (const desc of descriptions) {
      // Extract all attributes with crs namespace
      const attributes = desc.attributes;
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];
        if (attr.namespaceURI === this.crsNamespace || attr.name.startsWith('crs:')) {
          // Remove 'crs:' prefix
          const paramName = attr.localName || attr.name.replace('crs:', '');
          params[paramName] = attr.value;
        }
      }

      // Also check for child elements with crs namespace
      const children = desc.children;
      for (const child of children) {
        if (child.namespaceURI === this.crsNamespace || child.tagName.startsWith('crs:')) {
          const paramName = child.localName || child.tagName.replace('crs:', '');

          // Check if it's a sequence (array)
          const seqElement = child.getElementsByTagNameNS(this.rdfNamespace, 'Seq')[0];
          if (seqElement) {
            const liElements = seqElement.getElementsByTagNameNS(this.rdfNamespace, 'li');
            params[paramName] = Array.from(liElements).map(li => li.textContent);
          } else {
            params[paramName] = child.textContent;
          }
        }
      }
    }

    return params;
  }

  /**
   * Convert Lightroom adjustment values to Snerk equivalents
   * @param {Object} crsParams - Raw crs parameters
   * @returns {Object} Snerk adjustments object
   */
  convertAdjustments(crsParams) {
    const adjustments = {};

    // Exposure (-4 to +4 in LR, -2 to +2 in Snerk)
    if (crsParams.Exposure2012 !== undefined || crsParams.Exposure !== undefined) {
      const lrExposure = parseFloat(crsParams.Exposure2012 || crsParams.Exposure);
      // Clamp to Snerk range
      adjustments.exposure = Math.max(-2, Math.min(2, lrExposure));
    }

    // Contrast (-100 to +100 in LR, 0.5 to 2 in Snerk)
    if (crsParams.Contrast2012 !== undefined || crsParams.Contrast !== undefined) {
      const lrContrast = parseFloat(crsParams.Contrast2012 || crsParams.Contrast);
      adjustments.contrast = 1 + (lrContrast / 100);
    }

    // Saturation (-100 to +100 in LR, 0 to 2 in Snerk)
    if (crsParams.Saturation !== undefined) {
      const lrSaturation = parseFloat(crsParams.Saturation);
      adjustments.saturation = 1 + (lrSaturation / 100);
    }

    // Shadows (-100 to +100, direct copy)
    if (crsParams.Shadows2012 !== undefined || crsParams.Shadows !== undefined) {
      adjustments.shadows = parseFloat(crsParams.Shadows2012 || crsParams.Shadows);
    }

    // Highlights (-100 to +100, direct copy)
    if (crsParams.Highlights2012 !== undefined || crsParams.Highlights !== undefined) {
      adjustments.highlights = parseFloat(crsParams.Highlights2012 || crsParams.Highlights);
    }

    // Temperature (2000-50000 Kelvin in LR, convert to -100 to +100)
    if (crsParams.Temperature !== undefined) {
      const kelvin = parseFloat(crsParams.Temperature);
      // 5500K is neutral, map to -100 to +100 range
      // This is a simplified mapping
      const normalized = ((kelvin - 5500) / 5000) * 100;
      adjustments.temperature = Math.max(-100, Math.min(100, normalized));
    }

    // Tint (-150 to +150, direct copy)
    if (crsParams.Tint !== undefined) {
      adjustments.tint = parseFloat(crsParams.Tint);
    }

    // Vibrance (-100 to +100, direct copy)
    if (crsParams.Vibrance !== undefined) {
      adjustments.vibrance = parseFloat(crsParams.Vibrance);
    }

    // Clarity (-100 to +100, direct copy)
    if (crsParams.Clarity2012 !== undefined || crsParams.Clarity !== undefined) {
      adjustments.clarity = parseFloat(crsParams.Clarity2012 || crsParams.Clarity);
    }

    // Texture (-100 to +100, direct copy)
    if (crsParams.Texture !== undefined) {
      adjustments.texture = parseFloat(crsParams.Texture);
    }

    // Dehaze (-100 to +100, direct copy)
    if (crsParams.Dehaze !== undefined) {
      adjustments.dehaze = parseFloat(crsParams.Dehaze);
    }

    // Whites (-100 to +100, store but note it's not fully implemented)
    if (crsParams.Whites2012 !== undefined || crsParams.Whites !== undefined) {
      adjustments.whites = parseFloat(crsParams.Whites2012 || crsParams.Whites);
    }

    // Blacks (-100 to +100, store but note it's not fully implemented)
    if (crsParams.Blacks2012 !== undefined || crsParams.Blacks !== undefined) {
      adjustments.blacks = parseFloat(crsParams.Blacks2012 || crsParams.Blacks);
    }

    return adjustments;
  }

  /**
   * Convert tone curves from Lightroom to Snerk format
   * @param {Object} crsParams - Raw crs parameters
   * @returns {Object|null} Curves object or null if no curves
   */
  convertToneCurves(crsParams) {
    const curves = {};

    // Parse RGB curve
    if (crsParams.ToneCurvePV2012 !== undefined) {
      curves.rgb = this.parseCurveArray(crsParams.ToneCurvePV2012);
    }

    // Parse individual channel curves
    if (crsParams.ToneCurvePV2012Red !== undefined) {
      curves.r = this.parseCurveArray(crsParams.ToneCurvePV2012Red);
    }

    if (crsParams.ToneCurvePV2012Green !== undefined) {
      curves.g = this.parseCurveArray(crsParams.ToneCurvePV2012Green);
    }

    if (crsParams.ToneCurvePV2012Blue !== undefined) {
      curves.b = this.parseCurveArray(crsParams.ToneCurvePV2012Blue);
    }

    return Object.keys(curves).length > 0 ? curves : null;
  }

  /**
   * Parse a curve array from XMP format to Snerk format
   * @param {Array|string} curveData - Curve data from XMP
   * @returns {Array} Array of [x, y] coordinate pairs
   */
  parseCurveArray(curveData) {
    if (Array.isArray(curveData)) {
      // Already an array of point strings like "0, 0", "128, 140", etc.
      return curveData.map(point => {
        const [x, y] = point.split(',').map(v => parseInt(v.trim()));
        return [x, y];
      });
    } else if (typeof curveData === 'string') {
      // Single string, split by commas
      const values = curveData.split(',').map(v => parseInt(v.trim()));
      const points = [];
      for (let i = 0; i < values.length; i += 2) {
        points.push([values[i], values[i + 1]]);
      }
      return points;
    }
    return [];
  }

  /**
   * Convert HSL adjustments from Lightroom to Snerk format
   * @param {Object} crsParams - Raw crs parameters
   * @returns {Array} Array of HSL adjustment objects
   */
  convertHsl(crsParams) {
    const hslAdjustments = [];

    // Lightroom has 8 color ranges: Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta
    const colors = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'];

    colors.forEach(color => {
      const hue = crsParams[`HueAdjustment${color}`];
      const sat = crsParams[`SaturationAdjustment${color}`];
      const lum = crsParams[`LuminanceAdjustment${color}`];

      // Only add if at least one adjustment is present
      if (hue !== undefined || sat !== undefined || lum !== undefined) {
        const adjustment = { color: color.toLowerCase() };

        if (hue !== undefined) adjustment.hue = parseFloat(hue);
        if (sat !== undefined) adjustment.sat = parseFloat(sat);
        if (lum !== undefined) adjustment.lum = parseFloat(lum);

        hslAdjustments.push(adjustment);
      }
    });

    return hslAdjustments;
  }

  /**
   * Convert split toning parameters
   * @param {Object} crsParams - Raw crs parameters
   * @returns {Object} Split toning object or null
   */
  convertSplitToning(crsParams) {
    const splitToning = {};

    // Shadow tint (older format)
    if (crsParams.ShadowTint !== undefined) {
      const tintValue = parseFloat(crsParams.ShadowTint);
      // Shadow tint is usually -100 to +100, convert to hue (0-360) and saturation
      if (tintValue < 0) {
        // Green tint
        splitToning.shadowHue = 120;
        splitToning.shadowSaturation = Math.abs(tintValue);
      } else if (tintValue > 0) {
        // Magenta tint
        splitToning.shadowHue = 300;
        splitToning.shadowSaturation = tintValue;
      }
    }

    // Split toning (newer format)
    if (crsParams.SplitToningShadowHue !== undefined) {
      splitToning.shadowHue = parseFloat(crsParams.SplitToningShadowHue);
    }
    if (crsParams.SplitToningShadowSaturation !== undefined) {
      splitToning.shadowSaturation = parseFloat(crsParams.SplitToningShadowSaturation);
    }
    if (crsParams.SplitToningHighlightHue !== undefined) {
      splitToning.highlightHue = parseFloat(crsParams.SplitToningHighlightHue);
    }
    if (crsParams.SplitToningHighlightSaturation !== undefined) {
      splitToning.highlightSaturation = parseFloat(crsParams.SplitToningHighlightSaturation);
    }
    if (crsParams.SplitToningBalance !== undefined) {
      splitToning.balance = parseFloat(crsParams.SplitToningBalance);
    }

    // Only return if at least one parameter is present
    return Object.keys(splitToning).length > 0 ? splitToning : null;
  }

  /**
   * Convert sharpening parameters
   * @param {Object} crsParams - Raw crs parameters
   * @returns {Object} Sharpening object or null
   */
  convertSharpening(crsParams) {
    const sharpening = {};

    // Amount (0-150)
    if (crsParams.Sharpness !== undefined) {
      sharpening.amount = parseFloat(crsParams.Sharpness);
    }

    // Radius (0.5-3.0)
    if (crsParams.SharpenRadius !== undefined) {
      sharpening.radius = parseFloat(crsParams.SharpenRadius);
    }

    // Detail (0-100)
    if (crsParams.SharpenDetail !== undefined) {
      sharpening.detail = parseFloat(crsParams.SharpenDetail);
    }

    // Masking (0-100)
    if (crsParams.SharpenEdgeMasking !== undefined) {
      sharpening.masking = parseFloat(crsParams.SharpenEdgeMasking);
    }

    // Only return if at least one parameter is present
    return Object.keys(sharpening).length > 0 ? sharpening : null;
  }

  /**
   * Convert vignette parameters
   * @param {Object} crsParams - Raw crs parameters
   * @returns {Object|number} Vignette object or simple amount for backward compatibility
   */
  convertVignette(crsParams) {
    const vignette = {};

    // Amount (try PostCrop first, then regular Vignette)
    if (crsParams.PostCropVignetteAmount !== undefined) {
      vignette.amount = parseFloat(crsParams.PostCropVignetteAmount);
    } else if (crsParams.VignetteAmount !== undefined) {
      vignette.amount = parseFloat(crsParams.VignetteAmount);
    }

    // Midpoint
    if (crsParams.VignetteMidpoint !== undefined) {
      vignette.midpoint = parseFloat(crsParams.VignetteMidpoint);
    }

    // Roundness
    if (crsParams.PostCropVignetteRoundness !== undefined) {
      vignette.roundness = parseFloat(crsParams.PostCropVignetteRoundness);
    }

    // Feather
    if (crsParams.PostCropVignetteFeather !== undefined) {
      vignette.feather = parseFloat(crsParams.PostCropVignetteFeather);
    }

    // Highlights (highlight contrast protection)
    if (crsParams.PostCropVignetteHighlightContrast !== undefined) {
      vignette.highlights = parseFloat(crsParams.PostCropVignetteHighlightContrast);
    }

    // If only amount is present, return just the number for backward compatibility
    const keys = Object.keys(vignette);
    if (keys.length === 0) {
      return null;
    } else if (keys.length === 1 && keys[0] === 'amount') {
      return vignette.amount;
    } else {
      return vignette;
    }
  }

  /**
   * Convert grain parameters
   * @param {Object} crsParams - Raw crs parameters
   * @returns {Object|number} Grain object or simple amount for backward compatibility
   */
  convertGrain(crsParams) {
    const grain = {};

    // Amount (0-100)
    if (crsParams.GrainAmount !== undefined) {
      grain.amount = parseFloat(crsParams.GrainAmount);
    }

    // Size (0-100) - grain particle size
    if (crsParams.GrainSize !== undefined) {
      grain.size = parseFloat(crsParams.GrainSize);
    }

    // Roughness (0-100) - grain roughness/frequency
    if (crsParams.GrainFrequency !== undefined) {
      grain.roughness = parseFloat(crsParams.GrainFrequency);
    }

    // If only amount is present, return just the number for backward compatibility
    const keys = Object.keys(grain);
    if (keys.length === 0) {
      return null;
    } else if (keys.length === 1 && keys[0] === 'amount') {
      return grain.amount;
    } else {
      return grain;
    }
  }

  /**
   * Generate YAML string from preset object
   * @param {Object} preset - Snerk preset object
   * @returns {string} YAML formatted string
   */
  generateYaml(preset) {
    let yaml = '';

    // Name and category
    yaml += `name: "${preset.name}"\n`;
    yaml += `category: "${preset.category}"\n`;
    yaml += '\n';

    // Adjustments
    if (preset.adjustments && Object.keys(preset.adjustments).length > 0) {
      yaml += 'adjustments:\n';

      const adj = preset.adjustments;

      if (adj.exposure !== undefined) yaml += `  exposure: ${adj.exposure}\n`;
      if (adj.contrast !== undefined) yaml += `  contrast: ${adj.contrast}\n`;
      if (adj.saturation !== undefined) yaml += `  saturation: ${adj.saturation}\n`;
      if (adj.temperature !== undefined) yaml += `  temperature: ${adj.temperature}\n`;
      if (adj.tint !== undefined) yaml += `  tint: ${adj.tint}\n`;
      if (adj.vibrance !== undefined) yaml += `  vibrance: ${adj.vibrance}\n`;
      if (adj.clarity !== undefined) yaml += `  clarity: ${adj.clarity}\n`;
      if (adj.texture !== undefined) yaml += `  texture: ${adj.texture}\n`;
      if (adj.highlights !== undefined) yaml += `  highlights: ${adj.highlights}\n`;
      if (adj.shadows !== undefined) yaml += `  shadows: ${adj.shadows}\n`;
      if (adj.whites !== undefined) yaml += `  whites: ${adj.whites}\n`;
      if (adj.blacks !== undefined) yaml += `  blacks: ${adj.blacks}\n`;
      if (adj.dehaze !== undefined) yaml += `  dehaze: ${adj.dehaze}\n`;

      yaml += '\n';
    }

    // Tone curves
    if (preset.curves) {
      yaml += 'curves:\n';

      if (preset.curves.rgb) {
        yaml += `  rgb: ${JSON.stringify(preset.curves.rgb)}\n`;
      }
      if (preset.curves.r) {
        yaml += `  r: ${JSON.stringify(preset.curves.r)}\n`;
      }
      if (preset.curves.g) {
        yaml += `  g: ${JSON.stringify(preset.curves.g)}\n`;
      }
      if (preset.curves.b) {
        yaml += `  b: ${JSON.stringify(preset.curves.b)}\n`;
      }

      yaml += '\n';
    }

    // HSL selective color adjustments
    if (preset.hsl && preset.hsl.length > 0) {
      yaml += 'hsl:\n';

      preset.hsl.forEach(adjustment => {
        yaml += `  - color: ${adjustment.color}\n`;
        if (adjustment.hue !== undefined) yaml += `    hue: ${adjustment.hue}\n`;
        if (adjustment.sat !== undefined) yaml += `    sat: ${adjustment.sat}\n`;
        if (adjustment.lum !== undefined) yaml += `    lum: ${adjustment.lum}\n`;
      });

      yaml += '\n';
    }

    // Split toning
    if (preset.splitToning) {
      yaml += 'splitToning:\n';
      if (preset.splitToning.shadowHue !== undefined) {
        yaml += `  shadowHue: ${preset.splitToning.shadowHue}\n`;
      }
      if (preset.splitToning.shadowSaturation !== undefined) {
        yaml += `  shadowSaturation: ${preset.splitToning.shadowSaturation}\n`;
      }
      if (preset.splitToning.highlightHue !== undefined) {
        yaml += `  highlightHue: ${preset.splitToning.highlightHue}\n`;
      }
      if (preset.splitToning.highlightSaturation !== undefined) {
        yaml += `  highlightSaturation: ${preset.splitToning.highlightSaturation}\n`;
      }
      if (preset.splitToning.balance !== undefined) {
        yaml += `  balance: ${preset.splitToning.balance}\n`;
      }
      yaml += '\n';
    }

    // Sharpening
    if (preset.sharpening) {
      yaml += 'sharpening:\n';
      if (preset.sharpening.amount !== undefined) {
        yaml += `  amount: ${preset.sharpening.amount}\n`;
      }
      if (preset.sharpening.radius !== undefined) {
        yaml += `  radius: ${preset.sharpening.radius}\n`;
      }
      if (preset.sharpening.detail !== undefined) {
        yaml += `  detail: ${preset.sharpening.detail}\n`;
      }
      if (preset.sharpening.masking !== undefined) {
        yaml += `  masking: ${preset.sharpening.masking}\n`;
      }
      yaml += '\n';
    }

    // Film grain
    if (preset.grain !== undefined) {
      if (typeof preset.grain === 'number') {
        // Legacy format: just amount
        yaml += `grain: ${preset.grain}\n`;
        yaml += '\n';
      } else if (typeof preset.grain === 'object') {
        // Full grain control
        yaml += 'grain:\n';
        if (preset.grain.amount !== undefined) {
          yaml += `  amount: ${preset.grain.amount}\n`;
        }
        if (preset.grain.size !== undefined) {
          yaml += `  size: ${preset.grain.size}\n`;
        }
        if (preset.grain.roughness !== undefined) {
          yaml += `  roughness: ${preset.grain.roughness}\n`;
        }
        yaml += '\n';
      }
    }

    // Vignette
    if (preset.vignette !== undefined) {
      if (typeof preset.vignette === 'number') {
        // Legacy format: just amount
        yaml += `vignette: ${preset.vignette}\n`;
      } else if (typeof preset.vignette === 'object') {
        // Full vignette control
        yaml += 'vignette:\n';
        if (preset.vignette.amount !== undefined) {
          yaml += `  amount: ${preset.vignette.amount}\n`;
        }
        if (preset.vignette.midpoint !== undefined) {
          yaml += `  midpoint: ${preset.vignette.midpoint}\n`;
        }
        if (preset.vignette.roundness !== undefined) {
          yaml += `  roundness: ${preset.vignette.roundness}\n`;
        }
        if (preset.vignette.feather !== undefined) {
          yaml += `  feather: ${preset.vignette.feather}\n`;
        }
        if (preset.vignette.highlights !== undefined) {
          yaml += `  highlights: ${preset.vignette.highlights}\n`;
        }
        yaml += '\n';
      }
    }

    return yaml;
  }
}
