/**
 * Common Utility Functions for GLSL Shaders
 * Provides fundamental mathematical and graphical operations
 * for the advanced GLSL music visualizer
 */

#ifndef UTILS_GLSL
#define UTILS_GLSL

// Mathematical constants
#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define HALF_PI 1.57079632679
#define GOLDEN_RATIO 1.61803398875
#define EPSILON 1e-6

// Common macros for better readability
#define saturate(x) clamp(x, 0.0, 1.0)
#define remap(value, oldMin, oldMax, newMin, newMax) (newMin + (newMax - newMin) * ((value - oldMin) / (oldMax - oldMin)))

// ===== BASIC MATHEMATICAL FUNCTIONS =====

/**
 * Smooth step function with custom edge control
 * More flexible than built-in smoothstep
 */
float smootherstep(float edge0, float edge1, float x) {
    float t = saturate((x - edge0) / (edge1 - edge0));
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/**
 * Cubic interpolation (more natural than linear)
 */
float cubicInterp(float a, float b, float t) {
    float t2 = t * t;
    float t3 = t2 * t;
    return a + (b - a) * (3.0 * t2 - 2.0 * t3);
}

/**
 * Quintic interpolation (extremely smooth)
 */
float quinticInterp(float a, float b, float t) {
    return mix(a, b, t * t * t * (t * (t * 6.0 - 15.0) + 10.0));
}

/**
 * Safe division with fallback
 */
float safeDivide(float a, float b, float fallback) {
    return abs(b) > EPSILON ? a / b : fallback;
}

/**
 * Wrap value to range [0, 1]
 */
float wrap01(float x) {
    return fract(x);
}

/**
 * Wrap value to range [-1, 1]
 */
float wrap11(float x) {
    return fract(x * 0.5 + 0.5) * 2.0 - 1.0;
}

/**
 * Smooth minimum function (creates organic blending)
 */
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

/**
 * Smooth maximum function
 */
float smax(float a, float b, float k) {
    return -smin(-a, -b, k);
}

/**
 * Exponential ease functions for animations
 */
float easeInExpo(float t) {
    return t == 0.0 ? 0.0 : pow(2.0, 10.0 * (t - 1.0));
}

float easeOutExpo(float t) {
    return t == 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t);
}

float easeInOutExpo(float t) {
    if (t == 0.0) return 0.0;
    if (t == 1.0) return 1.0;
    if (t < 0.5) return 0.5 * pow(2.0, 20.0 * t - 10.0);
    return 1.0 - 0.5 * pow(2.0, -20.0 * t + 10.0);
}

/**
 * Elastic ease functions for bouncy animations
 */
float easeOutElastic(float t) {
    const float c4 = TWO_PI / 3.0;
    return t == 0.0 ? 0.0 : t == 1.0 ? 1.0 : 
           pow(2.0, -10.0 * t) * sin((t * 10.0 - 0.75) * c4) + 1.0;
}

// ===== VECTOR OPERATIONS =====

/**
 * Normalize vector with safe fallback
 */
vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > EPSILON ? v / len : fallback;
}

vec3 safeNormalize(vec3 v, vec3 fallback) {
    float len = length(v);
    return len > EPSILON ? v / len : fallback;
}

/**
 * Rotate 2D vector by angle
 */
vec2 rotate2D(vec2 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

/**
 * Create rotation matrix for 2D
 */
mat2 rotation2D(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
}

/**
 * Spherical coordinates conversion
 */
vec3 sphericalToCartesian(float radius, float theta, float phi) {
    float sinPhi = sin(phi);
    return vec3(
        radius * sinPhi * cos(theta),
        radius * cos(phi),
        radius * sinPhi * sin(theta)
    );
}

vec3 cartesianToSpherical(vec3 pos) {
    float radius = length(pos);
    float theta = atan(pos.z, pos.x);
    float phi = acos(pos.y / radius);
    return vec3(radius, theta, phi);
}

/**
 * Reflect vector across normal (useful for lighting)
 */
vec3 reflect3D(vec3 incident, vec3 normal) {
    return incident - 2.0 * dot(normal, incident) * normal;
}

// ===== COLOR UTILITIES =====

/**
 * RGB to HSV conversion
 */
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

/**
 * HSV to RGB conversion
 */
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

/**
 * Luminance calculation (perceptually accurate)
 */
float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

/**
 * Gamma correction
 */
vec3 gammaCorrect(vec3 color, float gamma) {
    return pow(color, vec3(1.0 / gamma));
}

vec3 linearToSRGB(vec3 color) {
    return mix(
        color * 12.92,
        pow(color, vec3(1.0/2.4)) * 1.055 - 0.055,
        step(0.0031308, color)
    );
}

vec3 sRGBToLinear(vec3 color) {
    return mix(
        color / 12.92,
        pow((color + 0.055) / 1.055, vec3(2.4)),
        step(0.04045, color)
    );
}

/**
 * Color temperature to RGB (approximate blackbody radiation)
 */
vec3 temperatureToRGB(float temperature) {
    temperature = clamp(temperature, 1000.0, 40000.0) / 100.0;
    
    vec3 color;
    
    // Red component
    if (temperature <= 66.0) {
        color.r = 1.0;
    } else {
        color.r = temperature - 60.0;
        color.r = 329.698727446 * pow(color.r, -0.1332047592);
        color.r = clamp(color.r / 255.0, 0.0, 1.0);
    }
    
    // Green component
    if (temperature <= 66.0) {
        color.g = temperature;
        color.g = 99.4708025861 * log(color.g) - 161.1195681661;
    } else {
        color.g = temperature - 60.0;
        color.g = 288.1221695283 * pow(color.g, -0.0755148492);
    }
    color.g = clamp(color.g / 255.0, 0.0, 1.0);
    
    // Blue component
    if (temperature >= 66.0) {
        color.b = 1.0;
    } else if (temperature <= 19.0) {
        color.b = 0.0;
    } else {
        color.b = temperature - 10.0;
        color.b = 138.5177312231 * log(color.b) - 305.0447927307;
        color.b = clamp(color.b / 255.0, 0.0, 1.0);
    }
    
    return color;
}

// ===== AUDIO-REACTIVE UTILITIES =====

/**
 * Audio-reactive smooth step with beat emphasis
 */
float audioSmoothstep(float edge0, float edge1, float x, float beatStrength) {
    float t = smoothstep(edge0, edge1, x);
    return t + beatStrength * t * (1.0 - t) * 4.0; // Emphasize during beats
}

/**
 * Frequency-based color mapping
 */
vec3 frequencyToColor(float frequency, float minFreq, float maxFreq) {
    float t = clamp((log(frequency) - log(minFreq)) / (log(maxFreq) - log(minFreq)), 0.0, 1.0);
    
    // Create a spectrum-like color mapping
    if (t < 0.25) {
        return mix(vec3(0.5, 0.0, 1.0), vec3(0.0, 0.0, 1.0), t * 4.0); // Purple to Blue
    } else if (t < 0.5) {
        return mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), (t - 0.25) * 4.0); // Blue to Cyan
    } else if (t < 0.75) {
        return mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (t - 0.5) * 4.0); // Cyan to Green
    } else {
        return mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.75) * 4.0); // Green to Yellow
    }
}

/**
 * Energy-based scaling for audio-reactive effects
 */
float energyScale(float baseValue, float energy, float sensitivity) {
    return baseValue * (1.0 + energy * sensitivity);
}

// ===== NOISE HELPERS =====

/**
 * Hash functions for pseudo-random generation
 */
float hash(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash3(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.xxy + p.yzz) * p.zyx);
}

/**
 * Simple value noise
 */
float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// ===== UTILITY MACROS AND CONSTANTS =====

/**
 * Check if point is inside unit circle
 */
bool insideUnitCircle(vec2 p) {
    return dot(p, p) < 1.0;
}

/**
 * Check if point is inside unit sphere
 */
bool insideUnitSphere(vec3 p) {
    return dot(p, p) < 1.0;
}

/**
 * Map value from [0,1] to [-1,1]
 */
float unpack(float x) {
    return x * 2.0 - 1.0;
}

/**
 * Map value from [-1,1] to [0,1]
 */
float pack(float x) {
    return x * 0.5 + 0.5;
}

/**
 * Create checker pattern
 */
float checker(vec2 uv, float scale) {
    vec2 c = floor(uv * scale);
    return mod(c.x + c.y, 2.0);
}

/**
 * Distance to line segment
 */
float distanceToLineSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

/**
 * Bias function for remapping curves
 */
float bias(float x, float b) {
    return pow(x, log(b) / log(0.5));
}

/**
 * Gain function for contrast adjustment
 */
float gain(float x, float g) {
    return x < 0.5 ? bias(x * 2.0, g) * 0.5 : 1.0 - bias(2.0 - x * 2.0, g) * 0.5;
}

/**
 * Oscillation functions for animation
 */
float oscillate(float t, float frequency, float amplitude) {
    return sin(t * frequency * TWO_PI) * amplitude;
}

float triangle(float t) {
    return abs(fract(t + 0.5) * 2.0 - 1.0);
}

float sawtooth(float t) {
    return fract(t);
}

float square(float t, float duty) {
    return step(duty, fract(t));
}

// ===== PERFORMANCE HELPERS =====

/**
 * Fast approximate functions (use when precision isn't critical)
 */
float fastSin(float x) {
    x = x * 0.159155 + 0.5; // Normalize to [0,1]
    x = fract(x);
    return sin(x * TWO_PI);
}

float fastCos(float x) {
    return fastSin(x + HALF_PI);
}

float fastSqrt(float x) {
    return pow(x, 0.5);
}

float fastInverseSqrt(float x) {
    return pow(x, -0.5);
}

// ===== DEBUGGING UTILITIES =====

/**
 * Visualize value as grayscale
 */
vec3 debugValue(float value) {
    return vec3(value);
}

/**
 * Visualize vector as color
 */
vec3 debugVector(vec3 v) {
    return v * 0.5 + 0.5;
}

/**
 * Create grid pattern for debugging
 */
float debugGrid(vec2 uv, float scale, float width) {
    vec2 grid = abs(fract(uv * scale) - 0.5);
    return smoothstep(0.0, width, min(grid.x, grid.y));
}

#endif // UTILS_GLSL