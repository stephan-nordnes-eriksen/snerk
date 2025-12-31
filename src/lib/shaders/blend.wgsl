struct BlendUniforms {
  strength: f32,
  padding: vec3<f32>
}

@group(0) @binding(0) var originalTexture: texture_2d<f32>;
@group(0) @binding(1) var processedTexture: texture_2d<f32>;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> uniforms: BlendUniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dims = textureDimensions(originalTexture);
  let coords = vec2<i32>(global_id.xy);

  if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) {
    return;
  }

  let original = textureLoad(originalTexture, coords, 0);
  let processed = textureLoad(processedTexture, coords, 0);

  let result = mix(original, processed, vec4<f32>(uniforms.strength, uniforms.strength, uniforms.strength, uniforms.strength));

  textureStore(outputTexture, coords, result);
}
