struct GrainUniforms {
    amount: f32,
    size: f32,
    roughness: f32,
    padding: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> uniforms: GrainUniforms;

fn hash(p: vec2<u32>) -> f32 {
    var n = p.x * 374761393u + p.y * 668265263u;
    n = (n ^ (n >> 13u)) * 1274126177u;
    return f32(n) / 4294967296.0;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(inputTexture);
    let coords = vec2<i32>(global_id.xy);

    if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) {
        return;
    }

    let rgb = textureLoad(inputTexture, coords, 0).rgb;

    // Scale coordinates based on grain size
    let sizeFactor = 0.5 + (uniforms.size / 100.0) * 1.5;
    let noiseCoords = vec2<u32>(
        u32(f32(coords.x) / sizeFactor),
        u32(f32(coords.y) / sizeFactor)
    );

    // Generate noise
    let noise = (hash(noiseCoords) - 0.5) * 2.0;
    let intensity = (uniforms.amount / 100.0) * 0.3;
    let roughnessFactor = 0.5 + (uniforms.roughness / 100.0) * 1.5;

    let grain = noise * intensity * roughnessFactor;
    let result = rgb + vec3<f32>(grain);
    let finalRgb = clamp(result, vec3<f32>(0.0), vec3<f32>(1.0));

    textureStore(outputTexture, coords, vec4<f32>(finalRgb, 1.0));
}
