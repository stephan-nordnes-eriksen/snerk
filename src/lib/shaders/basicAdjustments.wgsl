struct Uniforms {
    exposure: f32,
    temperature: f32,
    tint: f32,
    contrast: f32,
    saturation: f32,
    vibrance: f32,
    shadows: f32,
    highlights: f32,
    whites: f32,
    blacks: f32,
    clarity: f32,
    texture: f32,
    dehaze: f32,
    padding: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(inputTexture);
    let coords = vec2<i32>(global_id.xy);

    if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) {
        return;
    }

    var rgb = textureLoad(inputTexture, coords, 0).rgb;

    // 1. Exposure (brightness multiplier)
    if (abs(uniforms.exposure) > 0.001) {
        rgb = rgb * (1.0 + uniforms.exposure);
    }

    // 2. Temperature (warm/cool)
    if (abs(uniforms.temperature) > 0.001) {
        let temp = uniforms.temperature / 100.0;
        if (temp > 0.0) {
            rgb.r = rgb.r * (1.0 + temp * 0.15);
            rgb.b = rgb.b * (1.0 - temp * 0.15);
        } else {
            rgb.r = rgb.r * (1.0 + temp * 0.15);
            rgb.b = rgb.b * (1.0 - temp * 0.15);
        }
    }

    // 3. Tint (green/magenta)
    if (abs(uniforms.tint) > 0.001) {
        let tintAmount = uniforms.tint / 150.0;
        // Matches Sharp's formula: 1 - (amount * 0.1)
        // Positive tint = magenta (reduce green)
        // Negative tint = green (boost green, since amount is negative)
        rgb.g = rgb.g * (1.0 - tintAmount * 0.1);
    }

    // 4. Contrast (matches Sharp's linear formula)
    if (abs(uniforms.contrast - 1.0) > 0.001) {
        let midpoint = 128.0 / 255.0;
        rgb = (rgb - midpoint) * uniforms.contrast + midpoint;
    }

    // 5. Saturation
    if (abs(uniforms.saturation - 1.0) > 0.001) {
        let lum = luminance(rgb);
        let lumVec = vec3<f32>(lum);
        rgb = lumVec + (rgb - lumVec) * uniforms.saturation;
    }

    // 6. Vibrance (matches Sharp's modulate with half saturation effect)
    if (abs(uniforms.vibrance) > 0.001) {
        let lum = luminance(rgb);
        let lumVec = vec3<f32>(lum);
        let vibranceFactor = 1.0 + (uniforms.vibrance / 200.0);
        rgb = lumVec + (rgb - lumVec) * vibranceFactor;
    }

    // 7. Shadows (lightness modulation - matches Sharp)
    if (abs(uniforms.shadows) > 0.001) {
        let shadows = uniforms.shadows / 100.0;
        rgb = rgb * (1.0 + shadows * 0.3);
    }

    // 8. Highlights (matches Sharp - only process negative values with gamma)
    if (uniforms.highlights < -0.001) {
        let highlights = uniforms.highlights / 100.0;
        let gammaValue = 1.0 + abs(highlights) * 0.02;
        rgb = pow(rgb, vec3<f32>(1.0 / gammaValue));
    }

    // 9. Whites (matches Sharp's implementation)
    if (abs(uniforms.whites) > 0.001) {
        let amount = uniforms.whites / 100.0;
        if (uniforms.whites > 0.0) {
            // Positive: linear(1 + amount * 0.15, amount * 10)
            rgb = rgb * (1.0 + amount * 0.15) + amount * 10.0 / 255.0;
        } else {
            // Negative: gamma(1 + abs(amount) * 0.5)
            let gammaValue = 1.0 + abs(amount) * 0.5;
            rgb = pow(rgb, vec3<f32>(gammaValue));
        }
    }

    // 10. Blacks (matches Sharp's linear(1, amount * 20))
    if (abs(uniforms.blacks) > 0.001) {
        let amount = uniforms.blacks / 100.0;
        rgb = rgb + amount * 20.0 / 255.0;
    }

    // 11. Clarity (simplified local contrast enhancement)
    if (abs(uniforms.clarity) > 0.001) {
        let clarityAmount = uniforms.clarity / 100.0;

        // Simple edge detection using neighboring pixels
        let center = rgb;
        var edge = vec3<f32>(0.0);

        // Sample a 3x3 grid
        for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0) { continue; }
                let sampleCoords = coords + vec2<i32>(dx, dy);
                if (sampleCoords.x >= 0 && sampleCoords.x < i32(dims.x) &&
                    sampleCoords.y >= 0 && sampleCoords.y < i32(dims.y)) {
                    let sample = textureLoad(inputTexture, sampleCoords, 0).rgb;
                    edge = edge + (center - sample);
                }
            }
        }

        // Apply clarity as edge enhancement
        rgb = rgb + edge * clarityAmount * 0.3;
    }

    // 12. Texture (similar to clarity but more subtle)
    if (abs(uniforms.texture) > 0.001) {
        let textureAmount = uniforms.texture / 100.0;

        // Similar edge detection but with less intensity
        let center = rgb;
        var edge = vec3<f32>(0.0);

        for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0) { continue; }
                let sampleCoords = coords + vec2<i32>(dx, dy);
                if (sampleCoords.x >= 0 && sampleCoords.x < i32(dims.x) &&
                    sampleCoords.y >= 0 && sampleCoords.y < i32(dims.y)) {
                    let sample = textureLoad(inputTexture, sampleCoords, 0).rgb;
                    edge = edge + (center - sample);
                }
            }
        }

        // Apply texture with less intensity than clarity
        rgb = rgb + edge * textureAmount * 0.15;
    }

    // 13. Dehaze (matches Sharp's linear + saturation)
    if (uniforms.dehaze > 0.001) {
        let amount = uniforms.dehaze / 100.0;
        // Linear: multiply by (1 + amount * 0.5), subtract (amount * 20 / 255)
        rgb = rgb * (1.0 + amount * 0.5) - amount * 20.0 / 255.0;
        // Saturation boost
        let lum = luminance(rgb);
        let lumVec = vec3<f32>(lum);
        let saturationFactor = 1.0 + amount * 0.3;
        rgb = lumVec + (rgb - lumVec) * saturationFactor;
    }

    // Clamp to valid range
    rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));

    textureStore(outputTexture, coords, vec4<f32>(rgb, 1.0));
}
