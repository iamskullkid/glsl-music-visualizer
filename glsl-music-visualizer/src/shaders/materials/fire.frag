/**
 * Fire Material Fragment Shader
 * Realistic fire and flame rendering with volumetric effects,
 * blackbody radiation, particle emission, and audio reactivity
 * Location: src/shaders/materials/fire.frag
 */

// Precision qualifiers (required for fragment shaders)
precision highp float;
precision highp int;

// ===== CONSTANTS =====
#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define EPSILON 0.0001

// ===== UTILITY FUNCTIONS =====

/**
 * Safe normalize function
 */
vec3 safeNormalize(vec3 v) {
    float len = length(v);
    return len > EPSILON ? v / len : vec3(0.0, 0.0, 1.0);
}

/**
 * Hash function for noise
 */
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

/**
 * 3D hash function
 */
vec3 hash3(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.xxy + p.yzz) * p.zyx);
}

/**
 * Simple 3D noise function
 */
float noise3D(vec3 p) {
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
    
    // Smooth interpolation (quintic)
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    // Trilinear interpolation
    return mix(
        mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
        mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
        u.z
    );
}

/**
 * Fire noise - Creates flame-like patterns
 */
float fireNoise3D(vec3 p, float time) {
    // Rising motion
    p.y += time * 2.0;
    
    // Multiple octaves with increasing frequency upward
    float n1 = noise3D(p * 1.0) * 1.0;
    float n2 = noise3D(p * 2.0 + vec3(0.0, time * 3.0, 0.0)) * 0.5;
    float n3 = noise3D(p * 4.0 + vec3(0.0, time * 5.0, 0.0)) * 0.25;
    
    // Combine with bias toward positive values (flames rise)
    float noise = n1 + n2 + n3;
    return max(0.0, noise + 0.2);
}

/**
 * Fractional Brownian Motion for complex fire patterns
 */
float fbm3D(vec3 p, int octaves, float frequency, float amplitude) {
    float value = 0.0;
    float totalAmplitude = 0.0;
    
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        
        value += noise3D(p * frequency) * amplitude;
        totalAmplitude += amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value / totalAmplitude;
}

/**
 * Convert temperature to RGB (blackbody radiation)
 */
vec3 temperatureToRGB(float temperature) {
    // Simplified blackbody radiation approximation
    temperature = clamp(temperature, 1000.0, 6500.0);
    
    float x = temperature / 1000.0;
    
    vec3 color;
    
    // Red component
    if (temperature < 3300.0) {
        color.r = 1.0;
    } else {
        color.r = 1.292936 * pow(x - 0.1332047, -0.1332047);
        color.r = clamp(color.r, 0.0, 1.0);
    }
    
    // Green component
    if (temperature < 1000.0) {
        color.g = 0.0;
    } else if (temperature < 6600.0) {
        color.g = -155.25485 + 99.4708025 * log(x) - 161.1195681 * pow(log(x), 2.0) + 92.00322974 * pow(log(x), 3.0);
        color.g = clamp(color.g / 255.0, 0.0, 1.0);
    } else {
        color.g = 1.0;
    }
    
    // Blue component
    if (temperature > 6500.0) {
        color.b = 1.0;
    } else if (temperature < 1900.0) {
        color.b = 0.0;
    } else {
        color.b = -254.76935 + 0.8274096 * x;
        color.b = clamp(color.b, 0.0, 1.0);
    }
    
    return color;
}

// ===== INPUT VARYINGS =====

varying vec3 v_worldPosition;
varying vec3 v_viewPosition;
varying vec3 v_worldNormal;
varying vec3 v_viewNormal;
varying vec2 v_uv;
varying vec3 v_tangent;
varying vec3 v_bitangent;

varying float v_audioInfluence;
varying float v_energyLevel;
varying float v_beatStrength;

varying float v_displacement;
varying float v_metaballInfluence;
varying vec3 v_materialVelocity;
varying float v_surfaceDetail;

varying vec3 v_viewDirection;
varying float v_fresnel;
varying float v_depth;

varying float v_emission;
varying vec3 v_flowDirection;
varying float v_turbulence;

// ===== UNIFORMS =====

// Camera and view
uniform vec3 u_cameraPosition;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform float u_time;

// Audio analysis
uniform float u_audioEnergy;
uniform float u_bassLevel;
uniform float u_midLevel;
uniform float u_trebleLevel;
uniform float u_beatDetected;
uniform sampler2D u_frequencyData;

// Fire material properties
uniform float u_temperature;         // Fire temperature [1000-6500K]
uniform float u_intensity;           // Fire intensity [0-1]
uniform vec3 u_fireColor;            // Base fire color
uniform float u_density;             // Fire density/opacity
uniform float u_turbulence;          // Turbulence strength
uniform float u_flickerRate;         // Flicker animation rate
uniform float u_burnRate;            // Consumption rate
uniform vec3 u_emberColor;           // Ember/spark color
uniform float u_emberDensity;        // Ember particle density

// Lighting
uniform vec3 u_lightPosition;
uniform vec3 u_lightColor;
uniform vec3 u_ambientLight;
uniform float u_lightIntensity;

// Audio reactivity
uniform float u_audioReactivity;     // Audio response strength
uniform float u_colorResponse;       // Color response to audio
uniform float u_intensityResponse;   // Intensity response
uniform float u_flickerResponse;     // Flicker response to beats

// Quality settings
uniform float u_qualityLevel;        // Rendering quality [0.1-1.0]
uniform bool u_enableVolumetrics;    // Enable volumetric rendering
uniform bool u_enableEmbers;         // Enable ember particles
uniform bool u_enableDistortion;     // Enable heat distortion
uniform int u_volumeSteps;           // Ray marching steps

// ===== MAIN FUNCTIONS =====

/**
 * Calculate volumetric fire density
 */
float calculateFireDensity(vec3 position, float time) {
    // Audio-reactive time modulation
    float audioTime = time + v_energyLevel * u_audioReactivity * 2.0;
    
    // Fire shape with rising motion
    vec3 firePos = position;
    firePos.y -= audioTime * 1.5; // Rising flames
    
    // Multi-scale turbulence
    float turbulence1 = fireNoise3D(firePos * 0.8, audioTime) * 1.0;
    float turbulence2 = fireNoise3D(firePos * 1.6, audioTime * 1.3) * 0.6;
    float turbulence3 = fireNoise3D(firePos * 3.2, audioTime * 1.7) * 0.3;
    
    float totalTurbulence = (turbulence1 + turbulence2 + turbulence3) * u_turbulence;
    
    // Audio-reactive turbulence enhancement
    totalTurbulence *= (1.0 + v_energyLevel * u_audioReactivity);
    
    // Fire shape - higher density at bottom, dispersing upward
    float heightFalloff = exp(-position.y * 0.3);
    
    // Radial falloff from center
    float radialDistance = length(position.xz);
    float radialFalloff = exp(-radialDistance * 0.5);
    
    // Combine all factors
    float density = totalTurbulence * heightFalloff * radialFalloff * u_density;
    
    // Beat-synchronized flicker
    float beatFlicker = 1.0 + u_beatDetected * u_flickerResponse * 0.3;
    density *= beatFlicker;
    
    return clamp(density, 0.0, 1.0);
}

/**
 * Calculate fire temperature based on position and audio
 */
float calculateFireTemperature(vec3 position, float density) {
    // Base temperature variation
    float baseTemp = u_temperature;
    
    // Higher temperature at the base of flames
    float heightTemp = mix(baseTemp + 500.0, baseTemp - 300.0, position.y * 0.1 + 0.5);
    
    // Audio-reactive temperature modulation
    float audioTemp = v_energyLevel * u_audioReactivity * 800.0;
    float bassTemp = u_bassLevel * u_audioReactivity * 400.0;
    
    // Density affects temperature (denser regions are hotter)
    float densityTemp = density * 600.0;
    
    float finalTemp = heightTemp + audioTemp + bassTemp + densityTemp;
    
    return clamp(finalTemp, 800.0, 6500.0);
}

/**
 * Calculate ember particles
 */
vec3 calculateEmbers(vec3 position, float time) {
    if (!u_enableEmbers || u_qualityLevel < 0.4) {
        return vec3(0.0);
    }
    
    // Audio-reactive ember generation
    float audioEmbers = v_energyLevel * u_audioReactivity * u_emberDensity;
    
    // Particle positions using noise
    vec3 emberPos = position + vec3(
        noise3D(position * 2.0 + time * 0.5) * 2.0,
        time * 3.0, // Rising motion
        noise3D(position * 2.0 + time * 0.3 + 100.0) * 2.0
    );
    
    // Ember density based on noise
    float emberNoise = noise3D(emberPos * 8.0);
    float emberDensity = smoothstep(0.6, 0.8, emberNoise) * audioEmbers;
    
    // Ember color with temperature variation
    float emberTemp = 2000.0 + emberNoise * 1500.0;
    vec3 emberColor = temperatureToRGB(emberTemp) * u_emberColor;
    
    return emberColor * emberDensity * 0.5;
}

/**
 * Volumetric ray marching for fire rendering
 */
vec4 volumetricFireMarch(vec3 rayOrigin, vec3 rayDirection, float maxDistance) {
    if (!u_enableVolumetrics || u_qualityLevel < 0.3) {
        // Fallback to simple fire approximation
        float simpleFire = calculateFireDensity(v_worldPosition, u_time);
        float simpleTemp = calculateFireTemperature(v_worldPosition, simpleFire);
        vec3 simpleColor = temperatureToRGB(simpleTemp) * u_fireColor;
        return vec4(simpleColor, simpleFire);
    }
    
    int steps = int(float(u_volumeSteps) * u_qualityLevel);
    if (steps < 8) steps = 8;
    if (steps > 64) steps = 64;
    
    float stepSize = maxDistance / float(steps);
    vec3 currentPos = rayOrigin;
    
    vec4 accumulation = vec4(0.0);
    
    for (int i = 0; i < 64; i++) {
        if (i >= steps || i >= u_volumeSteps) break;
        
        // Sample fire density at current position
        float density = calculateFireDensity(currentPos, u_time);
        
        if (density > 0.01) {
            // Calculate temperature and color
            float temperature = calculateFireTemperature(currentPos, density);
            vec3 fireColor = temperatureToRGB(temperature) * u_fireColor;
            
            // Add ember effects
            fireColor += calculateEmbers(currentPos, u_time);
            
            // Apply audio-reactive intensity modulation
            float audioIntensity = 1.0 + v_energyLevel * u_intensityResponse * 0.5;
            fireColor *= audioIntensity;
            
            // Volumetric integration
            float stepDensity = density * stepSize;
            vec3 stepColor = fireColor * stepDensity;
            
            // Alpha blending
            accumulation.rgb += stepColor * (1.0 - accumulation.a);
            accumulation.a += stepDensity * (1.0 - accumulation.a);
            
            // Early termination for performance
            if (accumulation.a > 0.95) break;
        }
        
        currentPos += rayDirection * stepSize;
    }
    
    return accumulation;
}

/**
 * Calculate heat distortion effect
 */
vec2 calculateHeatDistortion(vec3 position, float temperature, float time) {
    if (!u_enableDistortion || u_qualityLevel < 0.5) {
        return vec2(0.0);
    }
    
    // Heat shimmer based on temperature and turbulence
    float distortionStrength = (temperature - 1000.0) / 5500.0 * 0.02;
    
    // Audio-reactive distortion
    distortionStrength *= (1.0 + v_energyLevel * u_audioReactivity * 0.5);
    
    // Animated distortion using noise
    vec2 distortion = vec2(
        noise3D(position * 4.0 + time * 2.0),
        noise3D(position * 4.0 + time * 2.5 + 100.0)
    ) * 2.0 - 1.0;
    
    return distortion * distortionStrength;
}

/**
 * Main fragment shader
 */
void main() {
    // Calculate view ray for volumetric rendering
    vec3 rayOrigin = u_cameraPosition;
    vec3 rayDirection = safeNormalize(v_worldPosition - rayOrigin);
    float rayDistance = length(v_worldPosition - rayOrigin);
    
    // Volumetric fire rendering
    vec4 fireResult = volumetricFireMarch(rayOrigin, rayDirection, rayDistance);
    
    vec3 finalColor = fireResult.rgb;
    float finalAlpha = fireResult.a;
    
    // Add self-illumination
    float selfIllumination = u_intensity * (1.0 + v_emission);
    finalColor *= selfIllumination;
    
    // Audio-reactive color enhancement
    if (u_colorResponse > 0.0) {
        vec3 audioColor = vec3(
            u_bassLevel * 0.3,    // Red enhancement for bass
            u_midLevel * 0.2,     // Green for mids
            u_trebleLevel * 0.1   // Blue for treble
        );
        finalColor += audioColor * u_colorResponse * u_audioReactivity;
    }
    
    // Beat-synchronized flicker
    float beatFlicker = 1.0 + u_beatDetected * u_flickerResponse * 
                       sin(u_time * u_flickerRate * 10.0) * 0.15;
    finalColor *= beatFlicker;
    
    // Heat distortion (affects screen coordinates, simplified here)
    vec2 distortion = calculateHeatDistortion(v_worldPosition, 
                                             calculateFireTemperature(v_worldPosition, fireResult.a), 
                                             u_time);
    // Note: Full heat distortion would require screen-space effects
    
    // Add ambient contribution (minimal for fire)
    finalColor += u_ambientLight * u_fireColor * 0.02;
    
    // Apply tone mapping for HDR
    finalColor = finalColor / (finalColor + vec3(1.0));
    
    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));
    
    // Final output
    gl_FragColor = vec4(finalColor, finalAlpha);
}