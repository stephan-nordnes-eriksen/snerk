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
        if (tintAmount > 0.0) {
            rgb.g = rgb.g * (1.0 + tintAmount * 0.1);
        } else {
            rgb.g = rgb.g * (1.0 + tintAmount * 0.1);
        }
    }

    // 4. Contrast
    if (abs(uniforms.contrast - 1.0) > 0.001) {
        rgb = (rgb - 0.5) * uniforms.contrast + 0.5;
    }

    // 5. Saturation
    if (abs(uniforms.saturation - 1.0) > 0.001) {
        let lum = luminance(rgb);
        rgb = mix(vec3<f32>(lum), rgb, uniforms.saturation);
    }

    // 6. Vibrance (smart saturation)
    if (abs(uniforms.vibrance) > 0.001) {
        let lum = luminance(rgb);
        let maxChannel = max(max(rgb.r, rgb.g), rgb.b);
        let minChannel = min(min(rgb.r, rgb.g), rgb.b);
        let sat = select(0.0, (maxChannel - minChannel) / maxChannel, maxChannel > 0.0);

        let vibranceAmount = uniforms.vibrance / 100.0;
        let adjustment = (1.0 - sat) * vibranceAmount;
        rgb = mix(vec3<f32>(lum), rgb, 1.0 + adjustment);
    }

    // 7. Shadows (tone-selective brightness for dark areas)
    if (abs(uniforms.shadows) > 0.001) {
        let lum = luminance(rgb);
        let shadowMask = 1.0 - smoothstep(0.0, 0.5, lum);
        rgb = rgb + shadowMask * (uniforms.shadows / 100.0) * 0.3;
    }

    // 8. Highlights (tone-selective brightness for bright areas)
    if (abs(uniforms.highlights) > 0.001) {
        let lum = luminance(rgb);
        let highlightMask = smoothstep(0.5, 1.0, lum);
        rgb = rgb + highlightMask * (uniforms.highlights / 100.0) * 0.3;
    }

    // 9. Whites (bright tone adjustment)
    if (abs(uniforms.whites) > 0.001) {
        let amount = uniforms.whites / 100.0;
        let adjusted = pow(rgb, vec3<f32>(1.0 / (1.0 + amount * 0.5)));
        let mask = vec3<f32>(
            smoothstep(0.5, 1.0, rgb.r),
            smoothstep(0.5, 1.0, rgb.g),
            smoothstep(0.5, 1.0, rgb.b)
        );
        rgb = mix(rgb, adjusted, mask);
    }

    // 10. Blacks (dark tone adjustment)
    if (abs(uniforms.blacks) > 0.001) {
        let amount = uniforms.blacks / 100.0;
        let adjusted = pow(rgb, vec3<f32>(1.0 + amount * 0.5));
        let mask = vec3<f32>(
            smoothstep(0.0, 0.5, rgb.r),
            smoothstep(0.0, 0.5, rgb.g),
            smoothstep(0.0, 0.5, rgb.b)
        );
        rgb = mix(adjusted, rgb, mask);
    }

    // 11. Dehaze (contrast + saturation boost)
    if (abs(uniforms.dehaze) > 0.001) {
        let amount = uniforms.dehaze / 100.0;
        rgb = (rgb - 0.5) * (1.0 + amount * 0.3) + 0.5;
        let lum = luminance(rgb);
        rgb = mix(vec3<f32>(lum), rgb, 1.0 + amount * 0.2);
    }

    // Clamp to valid range
    rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));

    textureStore(outputTexture, coords, vec4<f32>(rgb, 1.0));
}
