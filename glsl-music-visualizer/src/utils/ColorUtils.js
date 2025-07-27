/**
 * Color Space Utilities
 * Provides comprehensive color manipulation, conversion, and generation functions
 * for the advanced GLSL music visualizer with audio-reactive color systems
 */

import { MathUtils } from './MathUtils.js';

export class ColorUtils {
    // Predefined color palettes for music visualization
    static PALETTES = {
        NEON: [
            [1.0, 0.0, 1.0, 1.0], // Magenta
            [0.0, 1.0, 1.0, 1.0], // Cyan
            [1.0, 0.2, 0.8, 1.0], // Hot Pink
            [0.2, 1.0, 0.2, 1.0], // Lime Green
            [1.0, 0.5, 0.0, 1.0]  // Orange
        ],
        PLASMA: [
            [0.05, 0.03, 0.53, 1.0], // Deep Blue
            [0.54, 0.17, 0.89, 1.0], // Purple
            [0.98, 0.27, 0.52, 1.0], // Pink
            [0.99, 0.64, 0.20, 1.0], // Orange
            [0.94, 0.98, 0.13, 1.0]  // Yellow
        ],
        FIRE: [
            [0.1, 0.0, 0.1, 1.0],   // Dark Purple
            [0.8, 0.0, 0.0, 1.0],   // Deep Red
            [1.0, 0.3, 0.0, 1.0],   // Red-Orange
            [1.0, 0.8, 0.0, 1.0],   // Yellow-Orange
            [1.0, 1.0, 0.8, 1.0]    // Bright Yellow
        ],
        OCEAN: [
            [0.0, 0.1, 0.3, 1.0],   // Deep Ocean
            [0.0, 0.3, 0.6, 1.0],   // Ocean Blue
            [0.0, 0.6, 0.8, 1.0],   // Light Blue
            [0.4, 0.9, 1.0, 1.0],   // Cyan
            [0.8, 1.0, 1.0, 1.0]    // Light Cyan
        ],
        AURORA: [
            [0.1, 0.0, 0.3, 1.0],   // Deep Purple
            [0.0, 0.5, 0.2, 1.0],   // Green
            [0.2, 0.8, 0.6, 1.0],   // Teal
            [0.5, 0.9, 0.8, 1.0],   // Light Teal
            [0.8, 1.0, 0.9, 1.0]    // Pale Green
        ]
    };
    
    // Standard illuminants for color space conversions
    static ILLUMINANTS = {
        D65: [0.95047, 1.00000, 1.08883], // Standard daylight
        D50: [0.96422, 1.00000, 0.82521], // Horizon light
        A: [1.09850, 1.00000, 0.35585]     // Incandescent light
    };
    
    /**
     * Create a color from RGBA values (0-1 range)
     * @param {number} r - Red component (0-1)
     * @param {number} g - Green component (0-1)
     * @param {number} b - Blue component (0-1)
     * @param {number} a - Alpha component (0-1)
     * @returns {Float32Array} RGBA color array
     */
    static rgba(r, g, b, a = 1.0) {
        return new Float32Array([
            MathUtils.clamp(r, 0, 1),
            MathUtils.clamp(g, 0, 1),
            MathUtils.clamp(b, 0, 1),
            MathUtils.clamp(a, 0, 1)
        ]);
    }
    
    /**
     * Create a color from HSV values
     * @param {number} h - Hue (0-360 degrees)
     * @param {number} s - Saturation (0-1)
     * @param {number} v - Value/Brightness (0-1)
     * @param {number} a - Alpha (0-1)
     * @returns {Float32Array} RGBA color array
     */
    static hsva(h, s, v, a = 1.0) {
        return this.hsvToRgb(h, s, v, a);
    }
    
    /**
     * Convert HSV to RGB color space
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-1)
     * @param {number} v - Value (0-1)
     * @param {number} a - Alpha (0-1)
     * @returns {Float32Array} RGBA color array
     */
    static hsvToRgb(h, s, v, a = 1.0) {
        h = ((h % 360) + 360) % 360; // Normalize hue to 0-360
        s = MathUtils.clamp(s, 0, 1);
        v = MathUtils.clamp(v, 0, 1);
        
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        
        let r, g, b;
        
        if (h < 60) {
            [r, g, b] = [c, x, 0];
        } else if (h < 120) {
            [r, g, b] = [x, c, 0];
        } else if (h < 180) {
            [r, g, b] = [0, c, x];
        } else if (h < 240) {
            [r, g, b] = [0, x, c];
        } else if (h < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }
        
        return this.rgba(r + m, g + m, b + m, a);
    }
    
    /**
     * Convert RGB to HSV color space
     * @param {Float32Array|Array} rgba - RGBA color array
     * @returns {Array} [h, s, v, a] array
     */
    static rgbToHsv(rgba) {
        const [r, g, b, a = 1] = rgba;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let h = 0;
        const s = max === 0 ? 0 : delta / max;
        const v = max;
        
        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta) % 6;
            } else if (max === g) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }
            h *= 60;
            if (h < 0) h += 360;
        }
        
        return [h, s, v, a];
    }
    
    /**
     * Convert HSL to RGB color space
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-1)
     * @param {number} l - Lightness (0-1)
     * @param {number} a - Alpha (0-1)
     * @returns {Float32Array} RGBA color array
     */
    static hslToRgb(h, s, l, a = 1.0) {
        h = ((h % 360) + 360) % 360 / 360; // Normalize to 0-1
        s = MathUtils.clamp(s, 0, 1);
        l = MathUtils.clamp(l, 0, 1);
        
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l; // Achromatic
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return this.rgba(r, g, b, a);
    }
    
    /**
     * Convert RGB to XYZ color space (CIE 1931)
     * @param {Float32Array|Array} rgba - RGBA color array
     * @returns {Array} [X, Y, Z] array
     */
    static rgbToXyz(rgba) {
        let [r, g, b] = rgba;
        
        // Apply gamma correction
        r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
        
        // Convert to XYZ using sRGB matrix
        const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
        const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
        const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
        
        return [x, y, z];
    }
    
    /**
     * Convert XYZ to LAB color space
     * @param {Array} xyz - [X, Y, Z] array
     * @param {Array} illuminant - Reference white point
     * @returns {Array} [L, A, B] array
     */
    static xyzToLab(xyz, illuminant = this.ILLUMINANTS.D65) {
        const [x, y, z] = xyz;
        const [xn, yn, zn] = illuminant;
        
        const fx = this.labFunction(x / xn);
        const fy = this.labFunction(y / yn);
        const fz = this.labFunction(z / zn);
        
        const l = 116 * fy - 16;
        const a = 500 * (fx - fy);
        const b = 200 * (fy - fz);
        
        return [l, a, b];
    }
    
    /**
     * LAB color space helper function
     * @param {number} t - Input value
     * @returns {number} Transformed value
     */
    static labFunction(t) {
        const delta = 6 / 29;
        return t > delta ** 3 ? Math.pow(t, 1/3) : t / (3 * delta ** 2) + 4/29;
    }
    
    /**
     * Calculate color temperature from RGB
     * @param {Float32Array|Array} rgba - RGBA color array
     * @returns {number} Color temperature in Kelvin
     */
    static rgbToTemperature(rgba) {
        const [r, g, b] = rgba;
        
        // Approximation using McCamy's formula
        const x = (-0.14282743 * r + 1.54924120 * g + -0.95641400 * b) / 
                  (-0.32466090 * r + 1.57837810 * g + -0.73191920 * b);
        const y = (-0.68202470 * r + 0.77073140 * g + 0.56332950 * b) / 
                  (-0.32466090 * r + 1.57837810 * g + -0.73191920 * b);
        
        const n = (x - 0.3320) / (0.1858 - y);
        return 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
    }
    
    /**
     * Generate color from temperature (blackbody radiation)
     * @param {number} temperature - Temperature in Kelvin (1000-40000)
     * @param {number} a - Alpha component
     * @returns {Float32Array} RGBA color array
     */
    static temperatureToRgb(temperature, a = 1.0) {
        temperature = MathUtils.clamp(temperature, 1000, 40000);
        temperature /= 100;
        
        let r, g, b;
        
        // Red component
        if (temperature <= 66) {
            r = 1.0;
        } else {
            r = temperature - 60;
            r = 329.698727446 * Math.pow(r, -0.1332047592);
            r = MathUtils.clamp(r / 255, 0, 1);
        }
        
        // Green component
        if (temperature <= 66) {
            g = temperature;
            g = 99.4708025861 * Math.log(g) - 161.1195681661;
        } else {
            g = temperature - 60;
            g = 288.1221695283 * Math.pow(g, -0.0755148492);
        }
        g = MathUtils.clamp(g / 255, 0, 1);
        
        // Blue component
        if (temperature >= 66) {
            b = 1.0;
        } else if (temperature <= 19) {
            b = 0.0;
        } else {
            b = temperature - 10;
            b = 138.5177312231 * Math.log(b) - 305.0447927307;
            b = MathUtils.clamp(b / 255, 0, 1);
        }
        
        return this.rgba(r, g, b, a);
    }
    
    /**
     * Linear interpolation between two colors
     * @param {Float32Array|Array} colorA - First color
     * @param {Float32Array|Array} colorB - Second color
     * @param {number} t - Interpolation factor (0-1)
     * @returns {Float32Array} Interpolated color
     */
    static lerp(colorA, colorB, t) {
        t = MathUtils.clamp(t, 0, 1);
        return this.rgba(
            MathUtils.lerp(colorA[0], colorB[0], t),
            MathUtils.lerp(colorA[1], colorB[1], t),
            MathUtils.lerp(colorA[2], colorB[2], t),
            MathUtils.lerp(colorA[3] || 1, colorB[3] || 1, t)
        );
    }
    
    /**
     * Smooth color interpolation using HSV space
     * @param {Float32Array|Array} colorA - First color
     * @param {Float32Array|Array} colorB - Second color
     * @param {number} t - Interpolation factor (0-1)
     * @returns {Float32Array} Interpolated color
     */
    static lerpHsv(colorA, colorB, t) {
        const hsvA = this.rgbToHsv(colorA);
        const hsvB = this.rgbToHsv(colorB);
        
        // Handle hue wraparound
        let hueA = hsvA[0];
        let hueB = hsvB[0];
        
        if (Math.abs(hueB - hueA) > 180) {
            if (hueB > hueA) {
                hueA += 360;
            } else {
                hueB += 360;
            }
        }
        
        const h = MathUtils.lerp(hueA, hueB, t) % 360;
        const s = MathUtils.lerp(hsvA[1], hsvB[1], t);
        const v = MathUtils.lerp(hsvA[2], hsvB[2], t);
        const a = MathUtils.lerp(hsvA[3] || 1, hsvB[3] || 1, t);
        
        return this.hsvToRgb(h, s, v, a);
    }
    
    /**
     * Generate complementary color
     * @param {Float32Array|Array} rgba - Input color
     * @returns {Float32Array} Complementary color
     */
    static complement(rgba) {
        const [h, s, v, a] = this.rgbToHsv(rgba);
        return this.hsvToRgb((h + 180) % 360, s, v, a);
    }
    
    /**
     * Generate triadic color scheme
     * @param {Float32Array|Array} rgba - Base color
     * @returns {Array} Array of three triadic colors
     */
    static triadic(rgba) {
        const [h, s, v, a] = this.rgbToHsv(rgba);
        return [
            this.hsvToRgb(h, s, v, a),
            this.hsvToRgb((h + 120) % 360, s, v, a),
            this.hsvToRgb((h + 240) % 360, s, v, a)
        ];
    }
    
    /**
     * Generate analogous color scheme
     * @param {Float32Array|Array} rgba - Base color
     * @param {number} angle - Angle between colors (default 30°)
     * @returns {Array} Array of analogous colors
     */
    static analogous(rgba, angle = 30) {
        const [h, s, v, a] = this.rgbToHsv(rgba);
        return [
            this.hsvToRgb((h - angle + 360) % 360, s, v, a),
            this.hsvToRgb(h, s, v, a),
            this.hsvToRgb((h + angle) % 360, s, v, a)
        ];
    }
    
    /**
     * Generate color from frequency (audio-reactive)
     * @param {number} frequency - Frequency in Hz
     * @param {number} minFreq - Minimum frequency
     * @param {number} maxFreq - Maximum frequency
     * @param {string} palette - Palette name
     * @returns {Float32Array} Generated color
     */
    static frequencyToColor(frequency, minFreq = 20, maxFreq = 20000, palette = 'PLASMA') {
        const t = MathUtils.map(Math.log(frequency), Math.log(minFreq), Math.log(maxFreq), 0, 1);
        return this.samplePalette(palette, t);
    }
    
    /**
     * Sample color from palette
     * @param {string} paletteName - Name of the palette
     * @param {number} t - Sample position (0-1)
     * @returns {Float32Array} Sampled color
     */
    static samplePalette(paletteName, t) {
        const palette = this.PALETTES[paletteName] || this.PALETTES.PLASMA;
        t = MathUtils.clamp(t, 0, 1);
        
        if (t >= 1) return new Float32Array(palette[palette.length - 1]);
        if (t <= 0) return new Float32Array(palette[0]);
        
        const scaledT = t * (palette.length - 1);
        const index = Math.floor(scaledT);
        const localT = scaledT - index;
        
        const colorA = palette[index];
        const colorB = palette[Math.min(index + 1, palette.length - 1)];
        
        return this.lerp(colorA, colorB, localT);
    }
    
    /**
     * Generate gradient from palette
     * @param {string} paletteName - Name of the palette
     * @param {number} steps - Number of gradient steps
     * @returns {Array} Array of gradient colors
     */
    static generateGradient(paletteName, steps = 256) {
        const gradient = [];
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            gradient.push(this.samplePalette(paletteName, t));
        }
        return gradient;
    }
    
    /**
     * Adjust color brightness
     * @param {Float32Array|Array} rgba - Input color
     * @param {number} factor - Brightness factor (0-2, 1 = no change)
     * @returns {Float32Array} Adjusted color
     */
    static brightness(rgba, factor) {
        return this.rgba(
            rgba[0] * factor,
            rgba[1] * factor,
            rgba[2] * factor,
            rgba[3] || 1
        );
    }
    
    /**
     * Adjust color saturation
     * @param {Float32Array|Array} rgba - Input color
     * @param {number} factor - Saturation factor (0-2, 1 = no change)
     * @returns {Float32Array} Adjusted color
     */
    static saturation(rgba, factor) {
        const [h, s, v, a] = this.rgbToHsv(rgba);
        return this.hsvToRgb(h, s * factor, v, a);
    }
    
    /**
     * Apply gamma correction to color
     * @param {Float32Array|Array} rgba - Input color
     * @param {number} gamma - Gamma value (default 2.2)
     * @returns {Float32Array} Gamma-corrected color
     */
    static gamma(rgba, gamma = 2.2) {
        return this.rgba(
            Math.pow(rgba[0], 1 / gamma),
            Math.pow(rgba[1], 1 / gamma),
            Math.pow(rgba[2], 1 / gamma),
            rgba[3] || 1
        );
    }
    
    /**
     * Convert color to hexadecimal string
     * @param {Float32Array|Array} rgba - RGBA color
     * @returns {string} Hex color string (#RRGGBB)
     */
    static toHex(rgba) {
        const r = Math.round(MathUtils.clamp(rgba[0], 0, 1) * 255);
        const g = Math.round(MathUtils.clamp(rgba[1], 0, 1) * 255);
        const b = Math.round(MathUtils.clamp(rgba[2], 0, 1) * 255);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    /**
     * Parse hexadecimal color string
     * @param {string} hex - Hex color string (#RGB or #RRGGBB)
     * @param {number} a - Alpha component
     * @returns {Float32Array} RGBA color array
     */
    static fromHex(hex, a = 1.0) {
        hex = hex.replace('#', '');
        
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        
        return this.rgba(r, g, b, a);
    }
    
    /**
     * Calculate perceptual color difference (Delta E CIE76)
     * @param {Float32Array|Array} colorA - First color
     * @param {Float32Array|Array} colorB - Second color
     * @returns {number} Color difference value
     */
    static deltaE(colorA, colorB) {
        const xyzA = this.rgbToXyz(colorA);
        const xyzB = this.rgbToXyz(colorB);
        const labA = this.xyzToLab(xyzA);
        const labB = this.xyzToLab(xyzB);
        
        const deltaL = labA[0] - labB[0];
        const deltaA = labA[1] - labB[1];
        const deltaB = labA[2] - labB[2];
        
        return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
    }
    
    /**
     * Generate harmonious color based on audio features
     * @param {Object} audioData - Audio analysis data
     * @param {string} palette - Base palette
     * @returns {Float32Array} Generated color
     */
    static audioReactiveColor(audioData, palette = 'PLASMA') {
        const { 
            bass = 0, 
            mid = 0, 
            treble = 0, 
            energy = 0, 
            spectralCentroid = 0 
        } = audioData;
        
        // Map audio features to color properties
        const hue = MathUtils.map(spectralCentroid, 0, 1, 0, 360);
        const saturation = MathUtils.clamp(energy * 1.5, 0.3, 1.0);
        const brightness = MathUtils.clamp(0.4 + (bass + mid + treble) / 3 * 0.6, 0.2, 1.0);
        
        // Blend with palette color
        const paletteColor = this.samplePalette(palette, energy);
        const audioColor = this.hsvToRgb(hue, saturation, brightness);
        
        return this.lerp(paletteColor, audioColor, 0.3);
    }
}

// Export singleton instance for convenience
export const colorUtils = new ColorUtils();