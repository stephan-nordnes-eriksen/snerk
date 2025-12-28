struct VignetteUniforms {
    amount: f32,
    midpoint: f32,
    roundness: f32,
    feather: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: VignetteUniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(inputTexture);
    let coords = vec2<i32>(global_id.xy);

    if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) {
        return;
    }

    let rgb = textureLoad(inputTexture, coords, 0).rgb;

    // Calculate normalized texture coordinates (0-1)
    let texCoord = vec2<f32>(f32(coords.x) / f32(dims.x), f32(coords.y) / f32(dims.y));

    // Calculate distance from center
    let center = vec2<f32>(0.5, 0.5);
    let aspect = f32(dims.x) / f32(dims.y);

    var delta = texCoord - center;
    delta.x = delta.x * (1.0 + (uniforms.roundness / 100.0));

    let dist = length(delta * vec2<f32>(aspect, 1.0));

    // Calculate vignette strength
    let radiusPercent = (50.0 + uniforms.midpoint / 2.0) / 100.0;
    let featherStart = max(0.0, radiusPercent - uniforms.feather / 200.0);

    let vignette = smoothstep(featherStart, radiusPercent, dist);
    let intensity = abs(uniforms.amount) / 100.0;

    var result: vec3<f32>;
    if (uniforms.amount < 0.0) {
        // Darken
        result = rgb * (1.0 - vignette * intensity);
    } else {
        // Lighten
        result = rgb + (vec3<f32>(1.0) - rgb) * vignette * intensity;
    }

    let finalRgb = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));

    textureStore(outputTexture, coords, vec4<f32>(finalRgb, 1.0));
}
