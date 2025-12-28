@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage, read> rgbLUT: array<f32, 256>;
@group(0) @binding(3) var<storage, read> rLUT: array<f32, 256>;
@group(0) @binding(4) var<storage, read> gLUT: array<f32, 256>;
@group(0) @binding(5) var<storage, read> bLUT: array<f32, 256>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(inputTexture);
    let coords = vec2<i32>(global_id.xy);

    if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) {
        return;
    }

    var rgb = textureLoad(inputTexture, coords, 0).rgb;

    // Apply RGB master curve
    let r_idx = u32(clamp(rgb.r * 255.0, 0.0, 255.0));
    let g_idx = u32(clamp(rgb.g * 255.0, 0.0, 255.0));
    let b_idx = u32(clamp(rgb.b * 255.0, 0.0, 255.0));

    rgb.r = rgbLUT[r_idx] / 255.0;
    rgb.g = rgbLUT[g_idx] / 255.0;
    rgb.b = rgbLUT[b_idx] / 255.0;

    // Apply per-channel curves
    let r_idx2 = u32(clamp(rgb.r * 255.0, 0.0, 255.0));
    let g_idx2 = u32(clamp(rgb.g * 255.0, 0.0, 255.0));
    let b_idx2 = u32(clamp(rgb.b * 255.0, 0.0, 255.0));

    rgb.r = rLUT[r_idx2] / 255.0;
    rgb.g = gLUT[g_idx2] / 255.0;
    rgb.b = bLUT[b_idx2] / 255.0;

    rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));

    textureStore(outputTexture, coords, vec4<f32>(rgb, 1.0));
}
