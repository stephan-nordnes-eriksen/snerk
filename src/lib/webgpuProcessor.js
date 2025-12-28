class WebGPUProcessor {
  constructor() {
    this.device = null;
    this.pipelines = {};
    this.shaderModules = {};
  }

  async initialize() {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('No GPU adapter found');
      }

      this.device = await adapter.requestDevice();
      console.log('WebGPU device initialized successfully');

      await this.loadShaders();
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
        'vignette.wgsl'
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

  async processImage(base64Data, presetConfig) {
    try {
      const imageBlob = this.base64ToBlob(base64Data);
      const imageBitmap = await createImageBitmap(imageBlob);

      if (!presetConfig || !presetConfig.adjustments) {
        const canvas = this.bitmapToCanvas(imageBitmap);
        const dataURL = canvas.toDataURL('image/jpeg', 0.9);

        return {
          src: dataURL,
          width: imageBitmap.width,
          height: imageBitmap.height
        };
      }

      const inputTexture = this.createTextureFromBitmap(imageBitmap);
      const outputTexture = await this.applyPreset(inputTexture, presetConfig, imageBitmap.width, imageBitmap.height);
      const canvas = await this.textureToCanvas(outputTexture, imageBitmap.width, imageBitmap.height);
      const dataURL = canvas.toDataURL('image/jpeg', 0.9);

      // Wait for all GPU operations to complete before destroying textures
      await this.device.queue.onSubmittedWorkDone();

      inputTexture.destroy();
      outputTexture.destroy();

      return {
        src: dataURL,
        width: imageBitmap.width,
        height: imageBitmap.height
      };
    } catch (error) {
      console.error('Error in WebGPU processing:', error);
      throw error;
    }
  }

  async applyPreset(inputTexture, config, width, height) {
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

    // Wait for all GPU operations to complete before destroying intermediate textures
    await this.device.queue.onSubmittedWorkDone();

    // Now safe to destroy intermediate textures
    for (const texture of texturesToDestroy) {
      texture.destroy();
    }

    return currentTexture;
  }

  needsBasicAdjustments(adj) {
    return Math.abs(adj.exposure || 0) > 0.001 ||
           Math.abs(adj.temperature || 0) > 0.001 ||
           Math.abs(adj.tint || 0) > 0.001 ||
           Math.abs((adj.contrast || 1) - 1) > 0.001 ||
           Math.abs((adj.saturation || 1) - 1) > 0.001 ||
           Math.abs(adj.vibrance || 0) > 0.001 ||
           Math.abs(adj.shadows || 0) > 0.001 ||
           Math.abs(adj.highlights || 0) > 0.001 ||
           Math.abs(adj.whites || 0) > 0.001 ||
           Math.abs(adj.blacks || 0) > 0.001 ||
           Math.abs(adj.dehaze || 0) > 0.001;
  }

  async runBasicAdjustments(inputTexture, adj, width, height) {
    const outputTexture = this.createTexture(width, height, GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

    const uniformData = new Float32Array([
      adj.exposure !== undefined ? adj.exposure : 0,
      adj.temperature !== undefined ? adj.temperature : 0,
      adj.tint !== undefined ? adj.tint : 0,
      adj.contrast !== undefined ? adj.contrast : 1,
      adj.saturation !== undefined ? adj.saturation : 1,
      adj.vibrance !== undefined ? adj.vibrance : 0,
      adj.shadows !== undefined ? adj.shadows : 0,
      adj.highlights !== undefined ? adj.highlights : 0,
      adj.whites !== undefined ? adj.whites : 0,
      adj.blacks !== undefined ? adj.blacks : 0,
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
    console.log('Curves not yet implemented, passing through');
    return inputTexture;
  }

  async runHSL(inputTexture, hsl, width, height) {
    console.log('HSL not yet implemented, passing through');
    return inputTexture;
  }

  createTextureFromBitmap(bitmap) {
    const texture = this.device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT
    });

    this.device.queue.copyExternalImageToTexture(
      { source: bitmap },
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
    return new Blob([ab], { type: 'image/jpeg' });
  }

  bitmapToCanvas(bitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return canvas;
  }

  cleanup() {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}

window.WebGPUProcessor = WebGPUProcessor;
