class WebGPUProcessor {
  constructor(canvas) {
    this.device = null;
    this.pipelines = {};
    this.shaderModules = {};
    this.currentInputTexture = null;
    this.currentImageKey = null;
    this.currentImageWidth = 0;
    this.currentImageHeight = 0;
    this.canvas = canvas;
    this.canvasContext = null;
    this.renderPipeline = null;
  }

  async initialize() {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('No GPU adapter found');
      }

      this.device = await adapter.requestDevice();
      console.log('WebGPU device initialized successfully');

      this.canvasContext = this.canvas.getContext('webgpu');
      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.canvasContext.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: 'opaque'
      });

      await this.loadShaders();
      await this.createRenderPipeline(canvasFormat);
      return true;
    } catch (error) {
      console.error('WebGPU initialization failed:', error);
      throw error;
    }
  }

  async loadShader(filename) {
    const response = await fetch(`lib/shaders/${filename}`);
    return await response.text();
  }

  async loadShaders() {
    try {
      const utilsCode = await this.loadShader('utils.wgsl');
      console.log('Utils shader loaded, length:', utilsCode.length);

      const shaderFiles = [
        'basicAdjustments.wgsl',
        'curves.wgsl',
        'hsl.wgsl',
        'splitToning.wgsl',
        'grain.wgsl',
        'vignette.wgsl',
        'blend.wgsl'
      ];

      for (const file of shaderFiles) {
        const name = file.replace('.wgsl', '');
        const shaderCode = await this.loadShader(file);
        const code = utilsCode + '\n' + shaderCode;
        console.log(`Loading shader ${name}, total length:`, code.length);

        this.shaderModules[name] = this.device.createShaderModule({
          code,
          label: name
        });

        // Check for compilation errors
        const compilationInfo = await this.shaderModules[name].getCompilationInfo();
        for (const message of compilationInfo.messages) {
          if (message.type === 'error') {
            console.error(`Shader compilation error in ${name}:`, message.message);
            console.error(`  Line ${message.lineNum}: ${message.linePos}`);
          } else if (message.type === 'warning') {
            console.warn(`Shader warning in ${name}:`, message.message);
          }
        }

        this.pipelines[name] = this.device.createComputePipeline({
          layout: 'auto',
          compute: {
            module: this.shaderModules[name],
            entryPoint: 'main'
          },
          label: `${name}_pipeline`
        });
      }

      console.log('All shaders loaded successfully');
    } catch (error) {
      console.error('Failed to load shaders:', error);
      throw error;
    }
  }

  async createRenderPipeline(canvasFormat) {
    const shaderCode = `
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) texCoord: vec2<f32>,
      };

      @vertex
      fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var pos = array<vec2<f32>, 6>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>(1.0, -1.0),
          vec2<f32>(-1.0, 1.0),
          vec2<f32>(-1.0, 1.0),
          vec2<f32>(1.0, -1.0),
          vec2<f32>(1.0, 1.0)
        );
        var texCoord = array<vec2<f32>, 6>(
          vec2<f32>(0.0, 1.0),
          vec2<f32>(1.0, 1.0),
          vec2<f32>(0.0, 0.0),
          vec2<f32>(0.0, 0.0),
          vec2<f32>(1.0, 1.0),
          vec2<f32>(1.0, 0.0)
        );
        var output: VertexOutput;
        output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        output.texCoord = texCoord[vertexIndex];
        return output;
      }

      @group(0) @binding(0) var textureSampler: sampler;
      @group(0) @binding(1) var inputTexture: texture_2d<f32>;

      @fragment
      fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
        return textureSample(inputTexture, textureSampler, input.texCoord);
      }
    `;

    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
      label: 'display_shader'
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: canvasFormat
        }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });
  }

  async processImage(base64Data, presetConfig, strength = 1.0) {
    if (!this.device || !this.renderPipeline) {
      throw new Error('WebGPU not initialized. Call initialize() first.');
    }

    try {
      const imageKey = base64Data.substring(0, 100);
      let width, height;

      if (this.currentImageKey !== imageKey) {
        await this.device.queue.onSubmittedWorkDone();

        if (this.currentInputTexture) {
          this.currentInputTexture.destroy();
        }

        const imageBlob = this.base64ToBlob(base64Data);
        const imageBitmap = await createImageBitmap(imageBlob, {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none'
        });

        if (!imageBitmap || imageBitmap.width === 0 || imageBitmap.height === 0) {
          throw new Error(`Failed to create valid ImageBitmap: ${imageBitmap?.width}x${imageBitmap?.height}`);
        }

        this.currentInputTexture = this.createTextureFromBitmap(imageBitmap);
        this.currentImageKey = imageKey;
        this.currentImageWidth = imageBitmap.width;
        this.currentImageHeight = imageBitmap.height;
      }

      width = this.currentImageWidth;
      height = this.currentImageHeight;

      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvasContext.configure({
          device: this.device,
          format: navigator.gpu.getPreferredCanvasFormat(),
          alphaMode: 'opaque'
        });
      }

      let textureToRender;

      if (!presetConfig || !presetConfig.adjustments) {
        textureToRender = this.currentInputTexture;
      } else {
        textureToRender = await this.applyPreset(this.currentInputTexture, presetConfig, width, height, strength);
      }

      this.renderTextureToCanvas(textureToRender);

      await this.device.queue.onSubmittedWorkDone();

      if (textureToRender !== this.currentInputTexture) {
        textureToRender.destroy();
      }

      return {
        width: width,
        height: height
      };
    } catch (error) {
      console.error('Error in WebGPU processing:', error);
      throw error;
    }
  }

  async exportImage(base64Data, presetConfig, strength = 1.0) {
    try {
      const imageBlob = this.base64ToBlob(base64Data);
      const imageBitmap = await createImageBitmap(imageBlob, {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none'
      });

      if (!imageBitmap || imageBitmap.width === 0 || imageBitmap.height === 0) {
        throw new Error(`Failed to create valid ImageBitmap for export: ${imageBitmap?.width}x${imageBitmap?.height}`);
      }

      const inputTexture = this.createTextureFromBitmap(imageBitmap);
      const width = imageBitmap.width;
      const height = imageBitmap.height;

      // Let GC handle bitmap cleanup

      let outputTexture;

      if (!presetConfig || !presetConfig.adjustments) {
        outputTexture = inputTexture;
      } else {
        outputTexture = await this.applyPreset(inputTexture, presetConfig, width, height, strength);
      }

      const canvas = await this.textureToCanvas(outputTexture, width, height);
      const dataURL = canvas.toDataURL('image/jpeg', 0.9);

      await this.device.queue.onSubmittedWorkDone();

      inputTexture.destroy();
      if (outputTexture !== inputTexture) {
        outputTexture.destroy();
      }

      return {
        src: dataURL,
        width: width,
        height: height
      };
    } catch (error) {
      console.error('Error in WebGPU export:', error);
      throw error;
    }
  }

  renderTextureToCanvas(texture) {
    const sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
    });

    const bindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.canvasContext.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  async applyPreset(inputTexture, config, width, height, strength = 1.0) {
    let currentTexture = inputTexture;
    const adj = config.adjustments || {};
    const texturesToDestroy = [];

    // Pass 1: Basic Adjustments
    if (this.needsBasicAdjustments(adj)) {
      const nextTexture = await this.runBasicAdjustments(currentTexture, adj, width, height);
      if (currentTexture !== inputTexture && nextTexture !== currentTexture) {
        texturesToDestroy.push(currentTexture);
      }
      currentTexture = nextTexture;
    }

    // Pass 2: Curves (if implemented in preset)
    if (config.curves) {
      const nextTexture = await this.runCurves(currentTexture, config.curves, width, height);
      if (currentTexture !== inputTexture && nextTexture !== currentTexture) {
        texturesToDestroy.push(currentTexture);
      }
      currentTexture = nextTexture;
    }

    // Pass 3: HSL Selective Color
    if (config.hsl && config.hsl.length > 0) {
      const nextTexture = await this.runHSL(currentTexture, config.hsl, width, height);
      if (currentTexture !== inputTexture && nextTexture !== currentTexture) {
        texturesToDestroy.push(currentTexture);
      }
      currentTexture = nextTexture;
    }

    // Pass 4: Split Toning
    if (config.splitToning) {
      const nextTexture = await this.runSplitToning(currentTexture, config.splitToning, width, height);
      if (currentTexture !== inputTexture && nextTexture !== currentTexture) {
        texturesToDestroy.push(currentTexture);
      }
      currentTexture = nextTexture;
    }

    // Pass 5: Grain
    if (config.grain) {
      const nextTexture = await this.runGrain(currentTexture, config.grain, width, height);
      if (currentTexture !== inputTexture && nextTexture !== currentTexture) {
        texturesToDestroy.push(currentTexture);
      }
      currentTexture = nextTexture;
    }

    // Pass 6: Vignette
    if (config.vignette) {
      const nextTexture = await this.runVignette(currentTexture, config.vignette, width, height);
      if (currentTexture !== inputTexture && nextTexture !== currentTexture) {
        texturesToDestroy.push(currentTexture);
      }
      currentTexture = nextTexture;
    }

    // Wait for all processing passes to complete before blending
    await this.device.queue.onSubmittedWorkDone();

    // Pass 7: Blend with original based on strength
    if (strength < 1.0) {
      const nextTexture = await this.runBlend(inputTexture, currentTexture, strength, width, height);
      if (currentTexture !== inputTexture && nextTexture !== currentTexture) {
        texturesToDestroy.push(currentTexture);
      }
      currentTexture = nextTexture;
    }

    // Wait for all GPU operations to complete before destroying intermediate textures
    await this.device.queue.onSubmittedWorkDone();

    // Now safe to destroy intermediate textures
    for (const texture of texturesToDestroy) {
      texture.destroy();
    }

    return currentTexture;
  }

  needsBasicAdjustments(adj) {
    const exposure = adj.exposure !== undefined ? adj.exposure : 0;
    const temperature = adj.temperature !== undefined ? adj.temperature : 0;
    const tint = adj.tint !== undefined ? adj.tint : 0;
    const contrast = adj.contrast !== undefined ? (adj.contrast === 0 ? 1 : adj.contrast) : 1;
    const saturation = adj.saturation !== undefined ? adj.saturation : 1;
    const vibrance = adj.vibrance !== undefined ? adj.vibrance : 0;
    const shadows = adj.shadows !== undefined ? adj.shadows : 0;
    const highlights = adj.highlights !== undefined ? adj.highlights : 0;
    const whites = adj.whites !== undefined ? adj.whites : 0;
    const blacks = adj.blacks !== undefined ? adj.blacks : 0;
    const clarity = adj.clarity !== undefined ? adj.clarity : 0;
    const texture = adj.texture !== undefined ? adj.texture : 0;
    const dehaze = adj.dehaze !== undefined ? adj.dehaze : 0;

    return Math.abs(exposure) > 0.001 ||
           Math.abs(temperature) > 0.001 ||
           Math.abs(tint) > 0.001 ||
           Math.abs(contrast - 1) > 0.001 ||
           Math.abs(saturation - 1) > 0.001 ||
           Math.abs(vibrance) > 0.001 ||
           Math.abs(shadows) > 0.001 ||
           Math.abs(highlights) > 0.001 ||
           Math.abs(whites) > 0.001 ||
           Math.abs(blacks) > 0.001 ||
           Math.abs(clarity) > 0.001 ||
           Math.abs(texture) > 0.001 ||
           Math.abs(dehaze) > 0.001;
  }

  async runBasicAdjustments(inputTexture, adj, width, height) {
    const outputTexture = this.createTexture(width, height, GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

    const contrast = adj.contrast !== undefined ? (adj.contrast === 0 ? 1 : adj.contrast) : 1;

    const uniformData = new Float32Array([
      adj.exposure !== undefined ? adj.exposure : 0,
      adj.temperature !== undefined ? adj.temperature : 0,
      adj.tint !== undefined ? adj.tint : 0,
      contrast,
      adj.saturation !== undefined ? adj.saturation : 1,
      adj.vibrance !== undefined ? adj.vibrance : 0,
      adj.shadows !== undefined ? adj.shadows : 0,
      adj.highlights !== undefined ? adj.highlights : 0,
      adj.whites !== undefined ? adj.whites : 0,
      adj.blacks !== undefined ? adj.blacks : 0,
      adj.clarity !== undefined ? adj.clarity : 0,
      adj.texture !== undefined ? adj.texture : 0,
      adj.dehaze !== undefined ? adj.dehaze : 0,
      0 // padding
    ]);

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipelines.basicAdjustments.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: uniformBuffer } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipelines.basicAdjustments);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    uniformBuffer.destroy();

    return outputTexture;
  }

  async runGrain(inputTexture, grainConfig, width, height) {
    const outputTexture = this.createTexture(width, height, GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

    const uniformData = new Float32Array([
      grainConfig.amount !== undefined ? grainConfig.amount : 0,
      grainConfig.size !== undefined ? grainConfig.size : 50,
      grainConfig.roughness !== undefined ? grainConfig.roughness : 50,
      0 // padding
    ]);

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipelines.grain.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: uniformBuffer } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipelines.grain);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    uniformBuffer.destroy();

    return outputTexture;
  }

  async runVignette(inputTexture, vignetteConfig, width, height) {
    const outputTexture = this.createTexture(width, height, GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

    const uniformData = new Float32Array([
      vignetteConfig.amount !== undefined ? vignetteConfig.amount : 0,
      vignetteConfig.midpoint !== undefined ? vignetteConfig.midpoint : 0,
      vignetteConfig.roundness !== undefined ? vignetteConfig.roundness : 0,
      vignetteConfig.feather !== undefined ? vignetteConfig.feather : 50
    ]);

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipelines.vignette.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: uniformBuffer } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipelines.vignette);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    uniformBuffer.destroy();

    return outputTexture;
  }

  async runBlend(originalTexture, processedTexture, strength, width, height) {
    if (!this.pipelines.blend) {
      throw new Error('Blend pipeline not initialized');
    }
    const outputTexture = this.createTexture(width, height, GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

    const uniformData = new Float32Array([
      strength,
      0, 0, 0 // padding
    ]);

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipelines.blend.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: originalTexture.createView() },
        { binding: 1, resource: processedTexture.createView() },
        { binding: 2, resource: outputTexture.createView() },
        { binding: 3, resource: { buffer: uniformBuffer } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipelines.blend);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    await this.device.queue.onSubmittedWorkDone();

    uniformBuffer.destroy();

    return outputTexture;
  }

  async runSplitToning(inputTexture, splitConfig, width, height) {
    const outputTexture = this.createTexture(width, height, GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

    const uniformData = new Float32Array([
      splitConfig.shadowHue !== undefined ? splitConfig.shadowHue : 0,
      splitConfig.shadowSat !== undefined ? splitConfig.shadowSat : 0,
      splitConfig.highlightHue !== undefined ? splitConfig.highlightHue : 0,
      splitConfig.highlightSat !== undefined ? splitConfig.highlightSat : 0,
      splitConfig.balance !== undefined ? splitConfig.balance : 0,
      0, 0, 0 // padding
    ]);

    const uniformBuffer = this.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipelines.splitToning.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: uniformBuffer } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipelines.splitToning);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    uniformBuffer.destroy();

    return outputTexture;
  }

  async runCurves(inputTexture, curves, width, height) {
    const outputTexture = this.createTexture(width, height, GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

    // Build LUTs from curve points
    const rgbLUT = this.buildCurveLUT(curves.rgb || [[0, 0], [255, 255]]);
    const rLUT = this.buildCurveLUT(curves.r || [[0, 0], [255, 255]]);
    const gLUT = this.buildCurveLUT(curves.g || [[0, 0], [255, 255]]);
    const bLUT = this.buildCurveLUT(curves.b || [[0, 0], [255, 255]]);

    // Create storage buffers
    const rgbBuffer = this.device.createBuffer({
      size: rgbLUT.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    const rBuffer = this.device.createBuffer({
      size: rLUT.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    const gBuffer = this.device.createBuffer({
      size: gLUT.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    const bBuffer = this.device.createBuffer({
      size: bLUT.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.device.queue.writeBuffer(rgbBuffer, 0, rgbLUT);
    this.device.queue.writeBuffer(rBuffer, 0, rLUT);
    this.device.queue.writeBuffer(gBuffer, 0, gLUT);
    this.device.queue.writeBuffer(bBuffer, 0, bLUT);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipelines.curves.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: rgbBuffer } },
        { binding: 3, resource: { buffer: rBuffer } },
        { binding: 4, resource: { buffer: gBuffer } },
        { binding: 5, resource: { buffer: bBuffer } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipelines.curves);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    rgbBuffer.destroy();
    rBuffer.destroy();
    gBuffer.destroy();
    bBuffer.destroy();

    return outputTexture;
  }

  buildCurveLUT(points) {
    const lut = new Float32Array(256);

    // Sort points by x coordinate
    const sortedPoints = [...points].sort((a, b) => a[0] - b[0]);

    // Build LUT using linear interpolation between points
    for (let i = 0; i < 256; i++) {
      // Find the two points that bracket this input value
      let beforeIdx = 0;
      let afterIdx = sortedPoints.length - 1;

      for (let j = 0; j < sortedPoints.length - 1; j++) {
        if (i >= sortedPoints[j][0] && i <= sortedPoints[j + 1][0]) {
          beforeIdx = j;
          afterIdx = j + 1;
          break;
        }
      }

      const [x0, y0] = sortedPoints[beforeIdx];
      const [x1, y1] = sortedPoints[afterIdx];

      if (x1 === x0) {
        lut[i] = y0;
      } else {
        // Linear interpolation
        const t = (i - x0) / (x1 - x0);
        lut[i] = y0 + t * (y1 - y0);
      }
    }

    return lut;
  }

  async runHSL(inputTexture, hsl, width, height) {
    const outputTexture = this.createTexture(width, height, GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

    // Build HSL adjustments array (8 colors: red, orange, yellow, green, aqua/cyan, blue, purple, magenta)
    const colorOrder = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
    const adjustmentsData = new Float32Array(8 * 4); // 8 colors, 4 floats each (hue, sat, lum, padding)

    colorOrder.forEach((color, index) => {
      const adj = hsl.find(h => h.color === color);
      if (adj) {
        adjustmentsData[index * 4 + 0] = adj.hue || 0;
        adjustmentsData[index * 4 + 1] = adj.sat || 0;
        adjustmentsData[index * 4 + 2] = adj.lum || 0;
        adjustmentsData[index * 4 + 3] = 0; // padding
      } else {
        adjustmentsData[index * 4 + 0] = 0;
        adjustmentsData[index * 4 + 1] = 0;
        adjustmentsData[index * 4 + 2] = 0;
        adjustmentsData[index * 4 + 3] = 0;
      }
    });

    const adjustmentsBuffer = this.device.createBuffer({
      size: adjustmentsData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(adjustmentsBuffer, 0, adjustmentsData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipelines.hsl.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: adjustmentsBuffer } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipelines.hsl);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    adjustmentsBuffer.destroy();

    return outputTexture;
  }

  createTextureFromBitmap(bitmap) {
    if (!bitmap || bitmap.width === 0 || bitmap.height === 0) {
      throw new Error(`Invalid bitmap dimensions: ${bitmap?.width}x${bitmap?.height}`);
    }

    const texture = this.device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.COPY_SRC |
             GPUTextureUsage.RENDER_ATTACHMENT
    });

    this.device.queue.copyExternalImageToTexture(
      { source: bitmap, flipY: false },
      { texture: texture },
      [bitmap.width, bitmap.height]
    );

    return texture;
  }

  createTexture(width, height, usage) {
    return this.device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage: usage
    });
  }

  async textureToCanvas(texture, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
    const bufferSize = bytesPerRow * height;

    const buffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
      { texture: texture },
      { buffer: buffer, bytesPerRow: bytesPerRow },
      [width, height]
    );

    this.device.queue.submit([commandEncoder.finish()]);

    // Wait for the copy operation to complete
    await this.device.queue.onSubmittedWorkDone();
    await buffer.mapAsync(GPUMapMode.READ);

    const arrayBuffer = buffer.getMappedRange();
    const data = new Uint8ClampedArray(arrayBuffer);

    const imageData = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const srcOffset = y * bytesPerRow;
      const dstOffset = y * width * 4;
      imageData.set(data.subarray(srcOffset, srcOffset + width * 4), dstOffset);
    }

    buffer.unmap();
    buffer.destroy();

    const ctx = canvas.getContext('2d');
    const imgData = new ImageData(imageData, width, height);
    ctx.putImageData(imgData, 0, 0);

    return canvas;
  }

  base64ToBlob(base64) {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    // Don't specify type - let createImageBitmap auto-detect from file header
    return new Blob([ab]);
  }

  cleanup() {
    if (this.currentInputTexture) {
      this.currentInputTexture.destroy();
      this.currentInputTexture = null;
      this.currentImageKey = null;
    }
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}

window.WebGPUProcessor = WebGPUProcessor;
