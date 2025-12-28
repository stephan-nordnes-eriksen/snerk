struct HSLAdjustment {
    hueShift: f32,
    satShift: f32,
    lumShift: f32,
    padding: f32,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage, read> adjustments: array<HSLAdjustment, 8>;

fn getColorWeight(hue: f32, colorIndex: u32) -> f32 {
    let hue360 = hue * 360.0;

    var centerHue: f32;
    var rangeStart: f32;
    var rangeEnd: f32;

    // Color ranges: red, orange, yellow, green, cyan, blue, purple, magenta
    switch (colorIndex) {
        case 0u: { // Red
            centerHue = 0.0;
            rangeStart = 330.0;
            rangeEnd = 30.0;
        }
        case 1u: { // Orange
            centerHue = 30.0;
            rangeStart = 0.0;
            rangeEnd = 60.0;
        }
        case 2u: { // Yellow
            centerHue = 60.0;
            rangeStart = 30.0;
            rangeEnd = 90.0;
        }
        case 3u: { // Green
            centerHue = 120.0;
            rangeStart = 90.0;
            rangeEnd = 150.0;
        }
        case 4u: { // Cyan
            centerHue = 180.0;
            rangeStart = 150.0;
            rangeEnd = 210.0;
        }
        case 5u: { // Blue
            centerHue = 240.0;
            rangeStart = 210.0;
            rangeEnd = 270.0;
        }
        case 6u: { // Purple
            centerHue = 300.0;
            rangeStart = 270.0;
            rangeEnd = 330.0;
        }
        case 7u: { // Magenta
            centerHue = 330.0;
            rangeStart = 300.0;
            rangeEnd = 360.0;
        }
        default: {
            return 0.0;
        }
    }

    // Handle wrapping for red
    var dist: f32;
    if (colorIndex == 0u) {
        if (hue360 >= rangeStart || hue360 <= rangeEnd) {
            if (hue360 >= rangeStart) {
                dist = min(abs(hue360 - rangeStart), abs(hue360 - 360.0));
            } else {
                dist = min(abs(hue360 - 0.0), abs(hue360 - rangeEnd));
            }
        } else {
            return 0.0;
        }
    } else {
        if (hue360 >= rangeStart && hue360 <= rangeEnd) {
            dist = min(abs(hue360 - rangeStart), abs(hue360 - rangeEnd));
        } else {
            return 0.0;
        }
    }

    return smoothstep(30.0, 0.0, dist);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(inputTexture);
    let coords = vec2<i32>(global_id.xy);

    if (coords.x >= i32(dims.x) || coords.y >= i32(dims.y)) {
        return;
    }

    let rgb = textureLoad(inputTexture, coords, 0).rgb;
    var hsl = rgbToHsl(rgb);

    // Apply adjustments for each color range
    for (var i = 0u; i < 8u; i = i + 1u) {
        let adj = adjustments[i];

        if (abs(adj.hueShift) > 0.001 || abs(adj.satShift) > 0.001 || abs(adj.lumShift) > 0.001) {
            let weight = getColorWeight(hsl.x, i);

            if (weight > 0.0) {
                hsl.x = hsl.x + (adj.hueShift / 360.0) * weight;
                hsl.y = hsl.y * (1.0 + (adj.satShift / 100.0) * weight);
                hsl.z = hsl.z + (adj.lumShift / 100.0) * 0.5 * weight;
            }
        }
    }

    // Wrap hue
    if (hsl.x < 0.0) { hsl.x = hsl.x + 1.0; }
    if (hsl.x > 1.0) { hsl.x = hsl.x - 1.0; }

    // Clamp saturation and lightness
    hsl.y = clamp(hsl.y, 0.0, 1.0);
    hsl.z = clamp(hsl.z, 0.0, 1.0);

    let finalRgb = hslToRgb(hsl);

    textureStore(outputTexture, coords, vec4<f32>(finalRgb, 1.0));
}
