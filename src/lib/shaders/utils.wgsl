// Shared utility functions for all shaders

fn luminance(rgb: vec3<f32>) -> f32 {
    return dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
}

fn clamp01(v: vec3<f32>) -> vec3<f32> {
    return clamp(v, vec3<f32>(0.0), vec3<f32>(1.0));
}

fn rgbToHsl(rgb: vec3<f32>) -> vec3<f32> {
    let maxVal = max(max(rgb.r, rgb.g), rgb.b);
    let minVal = min(min(rgb.r, rgb.g), rgb.b);
    let delta = maxVal - minVal;

    var h: f32 = 0.0;
    var s: f32 = 0.0;
    let l: f32 = (maxVal + minVal) / 2.0;

    if (delta > 0.0001) {
        if (l < 0.5) {
            s = delta / (maxVal + minVal);
        } else {
            s = delta / (2.0 - maxVal - minVal);
        }

        if (maxVal == rgb.r) {
            h = (rgb.g - rgb.b) / delta + select(0.0, 6.0, rgb.g < rgb.b);
        } else if (maxVal == rgb.g) {
            h = (rgb.b - rgb.r) / delta + 2.0;
        } else {
            h = (rgb.r - rgb.g) / delta + 4.0;
        }

        h = h / 6.0;
    }

    return vec3<f32>(h, s, l);
}

fn hslToRgb(hsl: vec3<f32>) -> vec3<f32> {
    let h = hsl.x;
    let s = hsl.y;
    let l = hsl.z;

    if (s < 0.0001) {
        return vec3<f32>(l, l, l);
    }

    var q: f32;
    if (l < 0.5) {
        q = l * (1.0 + s);
    } else {
        q = l + s - l * s;
    }

    let p = 2.0 * l - q;

    var r = hueToRgb(p, q, h + 1.0/3.0);
    var g = hueToRgb(p, q, h);
    var b = hueToRgb(p, q, h - 1.0/3.0);

    return vec3<f32>(r, g, b);
}

fn hueToRgb(p: f32, q: f32, t_in: f32) -> f32 {
    var t = t_in;
    if (t < 0.0) { t = t + 1.0; }
    if (t > 1.0) { t = t - 1.0; }
    if (t < 1.0/6.0) { return p + (q - p) * 6.0 * t; }
    if (t < 1.0/2.0) { return q; }
    if (t < 2.0/3.0) { return p + (q - p) * (2.0/3.0 - t) * 6.0; }
    return p;
}
