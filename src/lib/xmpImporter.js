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

    // Add grain if present
    if (crsParams.GrainAmount !== undefined) {
      preset.grain = parseFloat(crsParams.GrainAmount);
    }

    // Add vignette if present
    if (crsParams.PostCropVignetteAmount !== undefined) {
      preset.vignette = parseFloat(crsParams.PostCropVignetteAmount);
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

    // Film grain
    if (preset.grain !== undefined) {
      yaml += `grain: ${preset.grain}\n`;
      yaml += '\n';
    }

    // Vignette
    if (preset.vignette !== undefined) {
      yaml += `vignette: ${preset.vignette}\n`;
    }

    return yaml;
  }
}
