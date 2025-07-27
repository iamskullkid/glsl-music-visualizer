/**
 * Water Material Fragment Shader
 * Physically-accurate water rendering with subsurface scattering,
 * refraction, surface tension effects, and audio-reactive properties
 * Location: src/shaders/materials/water.frag
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
 * Fresnel-Schlick approximation
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/**
 * Simple 2D noise function
 */
float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
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

// Water material properties
uniform vec3 u_waterColor;          // Base water color
uniform float u_transparency;       // Water transparency [0-1]
uniform float u_refractionIndex;    // Index of refraction (1.33 for water)
uniform float u_surfaceTension;     // Surface tension strength
uniform float u_viscosity;          // Water viscosity
uniform float u_depth;              // Water depth factor
uniform float u_foamThreshold;      // Foam generation threshold
uniform vec3 u_foamColor;           // Foam color
uniform float u_causticStrength;    // Caustic light strength

// Lighting
uniform vec3 u_lightPosition;
uniform vec3 u_lightColor;
uniform vec3 u_ambientLight;
uniform float u_lightIntensity;

// Environment
uniform samplerCube u_environmentMap;  // Environment cubemap
uniform sampler2D u_normalMap;         // Water normal map
uniform float u_normalMapStrength;     // Normal map intensity
uniform float u_waveScale;             // Wave scale factor
uniform float u_waveSpeed;             // Wave animation speed

// Audio reactivity
uniform float u_audioReactivity;    // Audio response strength
uniform float u_colorResponse;      // Color response to audio
uniform float u_waveResponse;       // Wave response to audio

// Quality settings
uniform float u_qualityLevel;       // Rendering quality [0.1-1.0]
uniform bool u_enableReflections;   // Enable reflections
uniform bool u_enableRefractions;   // Enable refractions
uniform bool u_enableCaustics;      // Enable caustic effects
uniform bool u_enableFoam;          // Enable foam effects

// ===== MAIN FUNCTIONS =====

/**
 * Calculate enhanced water normal with audio-reactive waves
 */
vec3 calculateWaterNormal() {
    vec3 baseNormal = safeNormalize(v_worldNormal);
    
    if (u_qualityLevel < 0.3) {
        return baseNormal; // Skip expensive normal calculation for low quality
    }
    
    // Sample time with audio modulation
    float audioTime = u_time + v_energyLevel * u_waveResponse * 2.0;
    
    // Multi-scale wave simulation
    vec2 uv1 = v_uv * u_waveScale + audioTime * u_waveSpeed * vec2(0.03, 0.02);
    vec2 uv2 = v_uv * u_waveScale * 2.3 + audioTime * u_waveSpeed * vec2(-0.02, 0.04);
    vec2 uv3 = v_uv * u_waveScale * 4.7 + audioTime * u_waveSpeed * vec2(0.01, -0.03);
    
    // Sample normal map with different scales
    vec3 normal1 = normalize(texture2D(u_normalMap, uv1).rgb * 2.0 - 1.0);
    vec3 normal2 = normalize(texture2D(u_normalMap, uv2).rgb * 2.0 - 1.0);
    vec3 normal3 = normalize(texture2D(u_normalMap, uv3).rgb * 2.0 - 1.0);
    
    // Combine normals with audio-reactive weights
    float bassWeight = 0.6 + u_bassLevel * u_audioReactivity * 0.4;
    float midWeight = 0.3 + u_midLevel * u_audioReactivity * 0.3;
    float trebleWeight = 0.1 + u_trebleLevel * u_audioReactivity * 0.2;
    
    vec3 combinedNormal = normal1 * bassWeight + normal2 * midWeight + normal3 * trebleWeight;
    combinedNormal = normalize(combinedNormal);
    
    // Apply normal map strength
    combinedNormal = mix(vec3(0.0, 0.0, 1.0), combinedNormal, u_normalMapStrength);
    
    // Transform to world space using TBN matrix
    vec3 T = safeNormalize(v_tangent);
    vec3 B = safeNormalize(v_bitangent);
    vec3 N = baseNormal;
    mat3 TBN = mat3(T, B, N);
    
    return safeNormalize(TBN * combinedNormal);
}

/**
 * Calculate subsurface scattering
 */
vec3 calculateSubsurfaceScattering(vec3 normal, vec3 lightDir, vec3 viewDir) {
    // Approximate subsurface scattering using back-lighting
    float backlight = max(0.0, dot(-lightDir, viewDir));
    float subsurface = pow(backlight, 4.0);
    
    // Audio-reactive subsurface intensity
    float audioSubsurface = v_energyLevel * u_audioReactivity * 0.5;
    subsurface *= (1.0 + audioSubsurface);
    
    // Depth-based attenuation
    float depthAttenuation = exp(-v_depth * u_depth * 0.5);
    subsurface *= depthAttenuation;
    
    return u_waterColor * subsurface * u_lightColor * u_lightIntensity;
}

/**
 * Calculate caustic light patterns
 */
float calculateCaustics(vec2 position, float time) {
    if (!u_enableCaustics || u_qualityLevel < 0.5) {
        return 1.0;
    }
    
    // Multi-scale caustic patterns
    float caustic1 = noise2D(position * 8.0 + time * 0.5);
    float caustic2 = noise2D(position * 16.0 + time * 0.3);
    float caustic3 = noise2D(position * 32.0 + time * 0.7);
    
    float caustics = (caustic1 + caustic2 * 0.5 + caustic3 * 0.25) / 1.75;
    
    // Audio-reactive caustic intensity
    float audioCaustics = u_beatDetected * u_audioReactivity * 0.3;
    caustics = mix(caustics, 1.0, audioCaustics);
    
    // Focus caustics into bright patches
    caustics = pow(caustics, 3.0) * u_causticStrength;
    
    return 1.0 + caustics;
}

/**
 * Calculate foam generation
 */
float calculateFoam() {
    if (!u_enableFoam || u_qualityLevel < 0.4) {
        return 0.0;
    }
    
    // Foam based on surface disturbance
    float foam = 0.0;
    
    // Displacement-based foam
    if (v_displacement > u_foamThreshold) {
        foam += (v_displacement - u_foamThreshold) * 2.0;
    }
    
    // Velocity-based foam
    float velocity = length(v_materialVelocity);
    if (velocity > 0.1) {
        foam += (velocity - 0.1) * 1.5;
    }
    
    // Audio-reactive foam
    float audioFoam = u_beatDetected * u_audioReactivity * v_energyLevel;
    foam += audioFoam * 0.5;
    
    // Edge-based foam using fresnel
    foam += pow(v_fresnel, 2.0) * 0.3;
    
    return clamp(foam, 0.0, 1.0);
}

/**
 * Calculate reflections
 */
vec3 calculateReflections(vec3 normal, vec3 viewDir) {
    if (!u_enableReflections || u_qualityLevel < 0.6) {
        return vec3(0.1, 0.15, 0.2); // Default sky color
    }
    
    // Calculate reflection direction
    vec3 reflectionDir = reflect(-viewDir, normal);
    
    // Sample environment map
    vec3 reflection = textureCube(u_environmentMap, reflectionDir).rgb;
    
    // Audio-reactive reflection intensity
    float audioReflection = u_midLevel * u_audioReactivity * 0.3;
    reflection *= (1.0 + audioReflection);
    
    return reflection;
}

/**
 * Calculate refractions
 */
vec3 calculateRefractions(vec3 normal, vec3 viewDir) {
    if (!u_enableRefractions || u_qualityLevel < 0.7) {
        return u_waterColor * 0.8;
    }
    
    // Calculate refraction direction
    float eta = 1.0 / u_refractionIndex;
    vec3 refractionDir = refract(-viewDir, normal, eta);
    
    if (length(refractionDir) > 0.0) {
        // Sample environment map for refraction
        vec3 refraction = textureCube(u_environmentMap, refractionDir).rgb;
        
        // Apply water color tint
        refraction *= u_waterColor;
        
        // Depth-based color absorption
        vec3 absorption = exp(-v_depth * vec3(0.45, 0.74, 4.62) * u_depth);
        refraction *= absorption;
        
        return refraction;
    }
    
    return u_waterColor * 0.8;
}

/**
 * Main fragment shader
 */
void main() {
    // Calculate enhanced normal with audio-reactive waves
    vec3 normal = calculateWaterNormal();
    
    // Normalize input vectors
    vec3 viewDir = safeNormalize(v_viewDirection);
    vec3 lightDir = safeNormalize(u_lightPosition - v_worldPosition);
    
    // Calculate basic lighting factors
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotV = max(dot(normal, viewDir), 0.0);
    
    // Fresnel calculation for water (F0 = 0.02 for water)
    vec3 F0 = vec3(0.02);
    vec3 fresnel = fresnelSchlick(NdotV, F0);
    
    // Calculate reflections
    vec3 reflections = calculateReflections(normal, viewDir);
    
    // Calculate refractions
    vec3 refractions = calculateRefractions(normal, viewDir);
    
    // Calculate subsurface scattering
    vec3 subsurface = calculateSubsurfaceScattering(normal, lightDir, viewDir);
    
    // Calculate caustic lighting
    float caustics = calculateCaustics(v_uv, u_time);
    
    // Calculate foam
    float foam = calculateFoam();
    
    // Combine reflection and refraction based on Fresnel
    vec3 waterColor = mix(refractions, reflections, fresnel.x);
    
    // Add subsurface scattering
    waterColor += subsurface;
    
    // Apply caustic lighting
    waterColor *= caustics;
    
    // Mix in foam
    waterColor = mix(waterColor, u_foamColor, foam);
    
    // Audio-reactive color modulation
    if (u_colorResponse > 0.0) {
        vec3 audioColor = vec3(
            u_bassLevel * 0.2,
            u_midLevel * 0.3,
            u_trebleLevel * 0.5
        );
        waterColor += audioColor * u_colorResponse * u_audioReactivity;
    }
    
    // Apply ambient lighting
    waterColor += u_ambientLight * u_waterColor * 0.1;
    
    // Apply transparency
    float alpha = u_transparency;
    
    // Audio-reactive transparency modulation
    float audioAlpha = v_energyLevel * u_audioReactivity * 0.2;
    alpha = clamp(alpha + audioAlpha, 0.0, 1.0);
    
    // Foam affects transparency
    alpha = mix(alpha, 1.0, foam * 0.8);
    
    // Distance-based transparency falloff
    float distanceFactor = 1.0 - clamp(length(v_viewPosition) / 50.0, 0.0, 1.0);
    alpha *= distanceFactor;
    
    // Final color output
    gl_FragColor = vec4(waterColor, alpha);
    
    // Apply tone mapping for HDR
    gl_FragColor.rgb = gl_FragColor.rgb / (gl_FragColor.rgb + vec3(1.0));
    
    // Gamma correction
    gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0 / 2.2));
}