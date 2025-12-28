struct SplitToningUniforms {
    shadowHue: f32,
    shadowSat: f32,
    highlightHue: f32,
    highlightSat: f32,
    balance: f32,
    padding1: f32,
    padding2: f32,
    padding3: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: SplitToningUniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(inputTexture);
    let coords = vec2<i32>(global_id.xy);

    if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) {
        return;
    }

    let rgb = textureLoad(inputTexture, coords, 0).rgb;
    let lum = luminance(rgb);

    let threshold = 0.5 + (uniforms.balance / 100.0) * 0.3;

    var tintColor: vec3<f32>;
    var strength: f32;

    if (lum < threshold) {
        // Shadow toning
        let blendFactor = (threshold - lum) / threshold;
        let shadowHsl = vec3<f32>(
            uniforms.shadowHue / 360.0,
            uniforms.shadowSat / 100.0,
            0.5
        );
        tintColor = hslToRgb(shadowHsl);
        strength = (uniforms.shadowSat / 100.0) * blendFactor * 0.3;
    } else {
        // Highlight toning
        let blendFactor = (lum - threshold) / (1.0 - threshold);
        let highlightHsl = vec3<f32>(
            uniforms.highlightHue / 360.0,
            uniforms.highlightSat / 100.0,
            0.5
        );
        tintColor = hslToRgb(highlightHsl);
        strength = (uniforms.highlightSat / 100.0) * blendFactor * 0.3;
    }

    let result = rgb + (tintColor - 0.5) * strength;
    let finalRgb = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));

    textureStore(outputTexture, coords, vec4<f32>(finalRgb, 1.0));
}
