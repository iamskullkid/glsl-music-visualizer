/**
 * Advanced Noise Functions for GLSL Shaders
 * Comprehensive collection of noise algorithms optimized for real-time rendering
 * Includes Perlin, Simplex, Worley, and specialized audio-reactive noise variants
 */

#ifndef NOISE_GLSL
#define NOISE_GLSL

#include "utils.glsl"

// ===== GRADIENT NOISE (PERLIN-STYLE) =====

/**
 * 2D Perlin noise - Classic gradient noise
 * Returns values in approximately [-1, 1] range
 */
float perlinNoise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    // Generate gradient vectors at grid corners
    vec2 g00 = normalize(hash2(i) * 2.0 - 1.0);
    vec2 g10 = normalize(hash2(i + vec2(1.0, 0.0)) * 2.0 - 1.0);
    vec2 g01 = normalize(hash2(i + vec2(0.0, 1.0)) * 2.0 - 1.0);
    vec2 g11 = normalize(hash2(i + vec2(1.0, 1.0)) * 2.0 - 1.0);
    
    // Calculate dot products
    float n00 = dot(g00, f);
    float n10 = dot(g10, f - vec2(1.0, 0.0));
    float n01 = dot(g01, f - vec2(0.0, 1.0));
    float n11 = dot(g11, f - vec2(1.0, 1.0));
    
    // Smooth interpolation (quintic)
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    // Bilinear interpolation
    return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

/**
 * 3D Perlin noise
 */
float perlinNoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    
    // Generate gradients at cube corners
    vec3 g000 = normalize(hash3(i) * 2.0 - 1.0);
    vec3 g100 = normalize(hash3(i + vec3(1.0, 0.0, 0.0)) * 2.0 - 1.0);
    vec3 g010 = normalize(hash3(i + vec3(0.0, 1.0, 0.0)) * 2.0 - 1.0);
    vec3 g110 = normalize(hash3(i + vec3(1.0, 1.0, 0.0)) * 2.0 - 1.0);
    vec3 g001 = normalize(hash3(i + vec3(0.0, 0.0, 1.0)) * 2.0 - 1.0);
    vec3 g101 = normalize(hash3(i + vec3(1.0, 0.0, 1.0)) * 2.0 - 1.0);
    vec3 g011 = normalize(hash3(i + vec3(0.0, 1.0, 1.0)) * 2.0 - 1.0);
    vec3 g111 = normalize(hash3(i + vec3(1.0, 1.0, 1.0)) * 2.0 - 1.0);
    
    // Calculate dot products
    float n000 = dot(g000, f);
    float n100 = dot(g100, f - vec3(1.0, 0.0, 0.0));
    float n010 = dot(g010, f - vec3(0.0, 1.0, 0.0));
    float n110 = dot(g110, f - vec3(1.0, 1.0, 0.0));
    float n001 = dot(g001, f - vec3(0.0, 0.0, 1.0));
    float n101 = dot(g101, f - vec3(1.0, 0.0, 1.0));
    float n011 = dot(g011, f - vec3(0.0, 1.0, 1.0));
    float n111 = dot(g111, f - vec3(1.0, 1.0, 1.0));
    
    // Smooth interpolation
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    // Trilinear interpolation
    return mix(
        mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
        mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
        u.z
    );
}

// ===== SIMPLEX NOISE =====

/**
 * 2D Simplex noise - More efficient than Perlin, better visual quality
 * Returns values in approximately [-1, 1] range
 */
float simplexNoise2D(vec2 p) {
    const float F2 = 0.3660254037844386; // (sqrt(3) - 1) / 2
    const float G2 = 0.21132486540518713; // (3 - sqrt(3)) / 6
    
    // Skew input space to determine simplex cell
    vec2 s = (p.x + p.y) * F2;
    vec2 i = floor(p + s);
    vec2 t = (i.x + i.y) * G2;
    vec2 P0 = i - t; // Unskew back to (x,y) space
    vec2 p0 = p - P0; // The x,y distances from the cell origin
    
    // Determine which simplex we are in
    vec2 i1 = (p0.x > p0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    
    // Calculate the three corners of the simplex
    vec2 p1 = p0 - i1 + G2;
    vec2 p2 = p0 - 1.0 + 2.0 * G2;
    
    // Calculate gradients for the three corners
    vec3 h = max(0.5 - vec3(dot(p0, p0), dot(p1, p1), dot(p2, p2)), 0.0);
    vec3 h2 = h * h;
    vec3 h4 = h2 * h2;
    
    // Calculate gradient contributions
    vec2 g0 = hash2(i) * 2.0 - 1.0;
    vec2 g1 = hash2(i + i1) * 2.0 - 1.0;
    vec2 g2 = hash2(i + 1.0) * 2.0 - 1.0;
    
    vec3 gv = vec3(dot(g0, p0), dot(g1, p1), dot(g2, p2));
    
    return 70.0 * dot(h4, gv);
}

/**
 * 3D Simplex noise
 */
float simplexNoise3D(vec3 p) {
    const float F3 = 1.0 / 3.0;
    const float G3 = 1.0 / 6.0;
    
    // Skew input space
    vec3 s = (p.x + p.y + p.z) * F3;
    vec3 i = floor(p + s);
    vec3 t = (i.x + i.y + i.z) * G3;
    vec3 P0 = i - t;
    vec3 p0 = p - P0;
    
    // Determine simplex
    vec3 i1, i2;
    if (p0.x >= p0.y) {
        if (p0.y >= p0.z) { i1 = vec3(1.0, 0.0, 0.0); i2 = vec3(1.0, 1.0, 0.0); }
        else if (p0.x >= p0.z) { i1 = vec3(1.0, 0.0, 0.0); i2 = vec3(1.0, 0.0, 1.0); }
        else { i1 = vec3(0.0, 0.0, 1.0); i2 = vec3(1.0, 0.0, 1.0); }
    } else {
        if (p0.y < p0.z) { i1 = vec3(0.0, 0.0, 1.0); i2 = vec3(0.0, 1.0, 1.0); }
        else if (p0.x < p0.z) { i1 = vec3(0.0, 1.0, 0.0); i2 = vec3(0.0, 1.0, 1.0); }
        else { i1 = vec3(0.0, 1.0, 0.0); i2 = vec3(1.0, 1.0, 0.0); }
    }
    
    // Calculate simplex corners
    vec3 p1 = p0 - i1 + G3;
    vec3 p2 = p0 - i2 + 2.0 * G3;
    vec3 p3 = p0 - 1.0 + 3.0 * G3;
    
    // Calculate contributions
    vec4 h = max(0.6 - vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)), 0.0);
    vec4 h2 = h * h;
    vec4 h4 = h2 * h2;
    
    // Gradients
    vec3 g0 = hash3(i) * 2.0 - 1.0;
    vec3 g1 = hash3(i + i1) * 2.0 - 1.0;
    vec3 g2 = hash3(i + i2) * 2.0 - 1.0;
    vec3 g3 = hash3(i + 1.0) * 2.0 - 1.0;
    
    vec4 gv = vec4(dot(g0, p0), dot(g1, p1), dot(g2, p2), dot(g3, p3));
    
    return 32.0 * dot(h4, gv);
}

// ===== WORLEY NOISE (CELLULAR) =====

/**
 * 2D Worley noise - Creates cellular patterns
 * Returns distance to nearest feature point
 */
float worleyNoise2D(vec2 p, out vec2 cellCenter) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    float minDist = 8.0;
    cellCenter = vec2(0.0);
    
    // Check 3x3 neighborhood
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash2(i + neighbor);
            vec2 diff = neighbor + point - f;
            float dist = length(diff);
            
            if (dist < minDist) {
                minDist = dist;
                cellCenter = i + neighbor + point;
            }
        }
    }
    
    return minDist;
}

/**
 * 3D Worley noise
 */
float worleyNoise3D(vec3 p, out vec3 cellCenter) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    
    float minDist = 8.0;
    cellCenter = vec3(0.0);
    
    // Check 3x3x3 neighborhood
    for (int z = -1; z <= 1; z++) {
        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec3 neighbor = vec3(float(x), float(y), float(z));
                vec3 point = hash3(i + neighbor);
                vec3 diff = neighbor + point - f;
                float dist = length(diff);
                
                if (dist < minDist) {
                    minDist = dist;
                    cellCenter = i + neighbor + point;
                }
            }
        }
    }
    
    return minDist;
}

/**
 * Worley noise with multiple distance metrics
 */
float worleyNoiseF1F2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    float F1 = 8.0; // First closest distance
    float F2 = 8.0; // Second closest distance
    
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash2(i + neighbor);
            vec2 diff = neighbor + point - f;
            float dist = length(diff);
            
            if (dist < F1) {
                F2 = F1;
                F1 = dist;
            } else if (dist < F2) {
                F2 = dist;
            }
        }
    }
    
    return F2 - F1; // Creates ridge-like patterns
}

// ===== FRACTAL NOISE FUNCTIONS =====

/**
 * Fractional Brownian Motion (fBm) - Multiple octaves of noise
 */
float fbm2D(vec2 p, int octaves, float lacunarity, float gain) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < octaves; i++) {
        value += amplitude * perlinNoise2D(p * frequency);
        frequency *= lacunarity;
        amplitude *= gain;
    }
    
    return value;
}

float fbm3D(vec3 p, int octaves, float lacunarity, float gain) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < octaves; i++) {
        value += amplitude * perlinNoise3D(p * frequency);
        frequency *= lacunarity;
        amplitude *= gain;
    }
    
    return value;
}

/**
 * Ridged noise - Creates mountain-like ridges
 */
float ridgedNoise2D(vec2 p, int octaves, float lacunarity, float gain) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < octaves; i++) {
        float n = perlinNoise2D(p * frequency);
        n = abs(n);
        n = 1.0 - n;
        n = n * n;
        value += amplitude * n;
        frequency *= lacunarity;
        amplitude *= gain;
    }
    
    return value;
}

/**
 * Turbulence - Absolute value creates sharp features
 */
float turbulence2D(vec2 p, int octaves, float lacunarity, float gain) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < octaves; i++) {
        value += amplitude * abs(perlinNoise2D(p * frequency));
        frequency *= lacunarity;
        amplitude *= gain;
    }
    
    return value;
}

// ===== DOMAIN WARPING =====

/**
 * Domain warping - Distorts the coordinate space itself
 */
float domainWarpedNoise2D(vec2 p, float warpStrength) {
    vec2 q = vec2(fbm2D(p + vec2(0.0, 0.0), 4, 2.0, 0.5),
                  fbm2D(p + vec2(5.2, 1.3), 4, 2.0, 0.5));
    
    vec2 r = vec2(fbm2D(p + 4.0 * q + vec2(1.7, 9.2), 4, 2.0, 0.5),
                  fbm2D(p + 4.0 * q + vec2(8.3, 2.8), 4, 2.0, 0.5));
    
    return fbm2D(p + warpStrength * r, 4, 2.0, 0.5);
}

// ===== AUDIO-REACTIVE NOISE =====

/**
 * Beat-synchronized noise - Noise that pulses with music
 */
float beatNoise2D(vec2 p, float time, float beatStrength, float bpm) {
    float beatPhase = mod(time * bpm / 60.0, 1.0);
    float beatMod = 1.0 + beatStrength * sin(beatPhase * TWO_PI);
    
    return perlinNoise2D(p * beatMod) * (1.0 + beatStrength * 0.5);
}

/**
 * Frequency-reactive noise - Different frequencies affect different octaves
 */
float frequencyNoise2D(vec2 p, float bassLevel, float midLevel, float trebleLevel) {
    float bass = perlinNoise2D(p * 0.5) * bassLevel;
    float mid = perlinNoise2D(p * 2.0) * midLevel * 0.5;
    float treble = perlinNoise2D(p * 8.0) * trebleLevel * 0.25;
    
    return bass + mid + treble;
}

/**
 * Energy-modulated noise - Overall audio energy affects noise characteristics
 */
float energyNoise2D(vec2 p, float energy, float time) {
    float frequency = 1.0 + energy * 4.0;
    float amplitude = 0.5 + energy * 0.5;
    float speed = 1.0 + energy * 2.0;
    
    return perlinNoise2D(p * frequency + time * speed) * amplitude;
}

// ===== SPECIALIZED NOISE FOR MATERIALS =====

/**
 * Fire noise - Creates flame-like patterns
 */
float fireNoise3D(vec3 p, float time) {
    // Rising motion
    p.y += time * 2.0;
    
    // Multiple octaves with increasing frequency upward
    float n1 = perlinNoise3D(p * 1.0) * 1.0;
    float n2 = perlinNoise3D(p * 2.0 + vec3(0.0, time * 3.0, 0.0)) * 0.5;
    float n3 = perlinNoise3D(p * 4.0 + vec3(0.0, time * 5.0, 0.0)) * 0.25;
    
    // Combine with bias toward positive values (flames rise)
    float noise = n1 + n2 + n3;
    return max(0.0, noise + 0.2);
}

/**
 * Water noise - Creates flowing water patterns
 */
float waterNoise3D(vec3 p, float time) {
    // Horizontal flow
    p.x += time * 0.5;
    p.z += sin(time * 0.3) * 0.2;
    
    // Multiple octaves with wave-like motion
    float n1 = perlinNoise3D(p * 1.0) * 1.0;
    float n2 = perlinNoise3D(p * 2.0 + vec3(time * 1.0, 0.0, time * 0.7)) * 0.5;
    float n3 = perlinNoise3D(p * 4.0 + vec3(time * 1.5, 0.0, time * 1.2)) * 0.25;
    
    return (n1 + n2 + n3) * 0.5;
}

/**
 * Cloud noise - Volumetric cloud-like patterns
 */
float cloudNoise3D(vec3 p, float time) {
    // Slow drift
    p += vec3(time * 0.1, time * 0.05, time * 0.08);
    
    // Multiple octaves for cloud detail
    float n1 = perlinNoise3D(p * 0.5) * 1.0;
    float n2 = perlinNoise3D(p * 1.0) * 0.5;
    float n3 = perlinNoise3D(p * 2.0) * 0.25;
    float n4 = perlinNoise3D(p * 4.0) * 0.125;
    
    float noise = n1 + n2 + n3 + n4;
    
    // Create cloud-like density falloff
    return max(0.0, noise - 0.2) * 1.25;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Smooth noise - Extra smoothing for gentle transitions
 */
float smoothNoise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    float a = valueNoise(i);
    float b = valueNoise(i + vec2(1.0, 0.0));
    float c = valueNoise(i + vec2(0.0, 1.0));
    float d = valueNoise(i + vec2(1.0, 1.0));
    
    // Use smootherstep for extra smoothness
    vec2 u = smoothstep(0.0, 1.0, f);
    u = u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

/**
 * Tiled noise - Seamlessly tileable noise
 */
float tiledNoise2D(vec2 p, vec2 tileSize) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    // Tile the integer coordinates
    i = mod(i, tileSize);
    
    return perlinNoise2D(i + f);
}

/**
 * Animated noise - Time-varying noise
 */
float animatedNoise3D(vec2 p, float time, float speed) {
    return perlinNoise3D(vec3(p, time * speed));
}

#endif // NOISE_GLSL