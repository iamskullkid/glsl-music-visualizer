/**
 * Metal Material Fragment Shader
 * Physically-accurate metallic rendering with conductivity effects,
 * anisotropic reflections, and electromagnetic audio reactivity
 * Location: src/shaders/materials/metal.frag
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
 * Fresnel-Schlick approximation for metals
 */
vec3 fresnelSchlickMetal(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/**
 * GGX Distribution function
 */
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    
    float nom = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    
    return nom / denom;
}

/**
 * Anisotropic GGX distribution
 */
float distributionGGXAnisotropic(vec3 N, vec3 H, vec3 T, vec3 B, float roughnessX, float roughnessY) {
    float NdotH = dot(N, H);
    if (NdotH <= 0.0) return 0.0;
    
    float TdotH = dot(T, H);
    float BdotH = dot(B, H);
    
    float ax = roughnessX * roughnessX;
    float ay = roughnessY * roughnessY;
    
    float denom = TdotH * TdotH / (ax * ax) + BdotH * BdotH / (ay * ay) + NdotH * NdotH;
    return 1.0 / (PI * ax * ay * denom * denom);
}

/**
 * Schlick-GGX geometry function
 */
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    
    float nom = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    
    return nom / denom;
}

/**
 * Smith's method for geometry function
 */
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = geometrySchlickGGX(NdotV, roughness);
    float ggx1 = geometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
}

/**
 * Simple noise function
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

// Metal material properties
uniform vec3 u_metalColor;          // Base metal color (F0)
uniform float u_roughness;          // Surface roughness [0-1]
uniform float u_anisotropy;         // Anisotropic factor [0-1]
uniform float u_conductivity;       // Electrical conductivity
uniform float u_magneticPermeability; // Magnetic permeability
uniform float u_oxidationLevel;     // Surface oxidation [0-1]
uniform vec3 u_oxidationColor;      // Oxidation color
uniform float u_patinaTickness;     // Patina layer thickness

// Lighting
uniform vec3 u_lightPosition;
uniform vec3 u_lightColor;
uniform vec3 u_ambientLight;
uniform float u_lightIntensity;

// Environment
uniform samplerCube u_environmentMap;  // Environment cubemap
uniform sampler2D u_roughnessMap;      // Roughness variation map
uniform sampler2D u_normalMap;         // Surface normal map
uniform float u_normalMapStrength;     // Normal map intensity

// Audio reactivity
uniform float u_audioReactivity;       // Audio response strength
uniform float u_colorResponse;         // Color response to audio
uniform float u_conductivityResponse;  // Conductivity response
uniform float u_magneticResponse;      // Magnetic field response

// Quality settings
uniform float u_qualityLevel;          // Rendering quality [0.1-1.0]
uniform bool u_enableReflections;      // Enable reflections
uniform bool u_enableAnisotropy;       // Enable anisotropic effects
uniform bool u_enableOxidation;        // Enable oxidation effects
uniform bool u_enableMagnetics;        // Enable magnetic field effects

// ===== MAIN FUNCTIONS =====

/**
 * Calculate enhanced metal normal with surface detail
 */
vec3 calculateMetalNormal() {
    vec3 baseNormal = safeNormalize(v_worldNormal);
    
    if (u_qualityLevel < 0.3) {
        return baseNormal;
    }
    
    // Sample normal map
    vec3 normalSample = texture2D(u_normalMap, v_uv).rgb * 2.0 - 1.0;
    
    // Audio-reactive surface roughening
    float audioRoughening = v_energyLevel * u_audioReactivity * 0.3;
    normalSample.xy *= (1.0 + audioRoughening);
    
    // Apply normal map strength
    normalSample = mix(vec3(0.0, 0.0, 1.0), normalSample, u_normalMapStrength);
    
    // Transform to world space using TBN matrix
    vec3 T = safeNormalize(v_tangent);
    vec3 B = safeNormalize(v_bitangent);
    vec3 N = baseNormal;
    mat3 TBN = mat3(T, B, N);
    
    return safeNormalize(TBN * normalSample);
}

/**
 * Calculate metal reflections with environment mapping
 */
vec3 calculateMetalReflections(vec3 normal, vec3 viewDir, float roughness) {
    if (!u_enableReflections || u_qualityLevel < 0.5) {
        return u_metalColor * 0.1;
    }
    
    // Calculate reflection direction
    vec3 reflectionDir = reflect(-viewDir, normal);
    
    // Sample environment map with roughness-based mip level
    float mipLevel = roughness * 8.0; // Assuming 8 mip levels
    vec3 reflection = textureCube(u_environmentMap, reflectionDir).rgb;
    
    // Audio-reactive reflection intensity
    float audioReflection = v_energyLevel * u_audioReactivity * 0.4;
    reflection *= (1.0 + audioReflection);
    
    return reflection;
}

/**
 * Calculate oxidation effects
 */
vec3 calculateOxidation(vec3 baseColor) {
    if (!u_enableOxidation || u_oxidationLevel <= 0.0) {
        return baseColor;
    }
    
    // Audio-reactive oxidation
    float audioOxidation = u_beatDetected * u_audioReactivity * 0.2;
    float totalOxidation = clamp(u_oxidationLevel + audioOxidation, 0.0, 1.0);
    
    // Patina formation based on surface detail
    float patinaFactor = v_surfaceDetail * totalOxidation;
    
    return mix(baseColor, u_oxidationColor, patinaFactor);
}

/**
 * Calculate electromagnetic effects
 */
vec3 calculateElectromagneticEffects(vec3 normal, vec3 viewDir) {
    if (!u_enableMagnetics || u_qualityLevel < 0.6) {
        return vec3(0.0);
    }
    
    // Simulate magnetic field lines
    float magneticStrength = u_magneticPermeability * u_magneticResponse;
    
    // Audio-reactive magnetic field
    float audioMagnetic = u_bassLevel * u_audioReactivity * magneticStrength;
    
    // Create field line patterns
    vec2 fieldUV = v_uv * 10.0 + u_time * 0.5;
    float fieldPattern = sin(fieldUV.x) * cos(fieldUV.y) * audioMagnetic;
    
    // Magnetic field color (blue-white)
    vec3 magneticColor = vec3(0.3, 0.6, 1.0) * fieldPattern * 0.1;
    
    return magneticColor;
}

/**
 * Calculate conductivity effects
 */
vec3 calculateConductivityEffects() {
    // Electrical current visualization
    float conductivity = u_conductivity * u_conductivityResponse;
    
    // Audio-reactive current flow
    float audioCurrent = v_energyLevel * u_audioReactivity * conductivity * 0.001;
    
    // Current flow along surface
    vec3 flowDir = normalize(v_flowDirection);
    float flowPattern = dot(flowDir, vec3(sin(u_time * 5.0), cos(u_time * 3.0), 0.0));
    
    // Electrical glow effect
    vec3 currentColor = vec3(1.0, 0.8, 0.2) * audioCurrent * abs(flowPattern);
    
    return currentColor;
}

/**
 * Calculate Cook-Torrance BRDF for metals
 */
vec3 calculateMetalBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 F0, float roughness) {
    vec3 halfVector = normalize(viewDir + lightDir);
    
    float NdotL = max(dot(normal, lightDir), 0.0);
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotH = max(dot(normal, halfVector), 0.0);
    float VdotH = max(dot(viewDir, halfVector), 0.0);
    
    // Distribution term
    float D;
    if (u_enableAnisotropy && u_anisotropy > 0.1) {
        vec3 T = safeNormalize(v_tangent);
        vec3 B = safeNormalize(v_bitangent);
        float roughnessX = roughness;
        float roughnessY = roughness * (1.0 - u_anisotropy);
        D = distributionGGXAnisotropic(normal, halfVector, T, B, roughnessX, roughnessY);
    } else {
        D = distributionGGX(normal, halfVector, roughness);
    }
    
    // Geometry term
    float G = geometrySmith(normal, viewDir, lightDir, roughness);
    
    // Fresnel term
    vec3 F = fresnelSchlickMetal(VdotH, F0);
    
    // BRDF calculation
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + EPSILON;
    
    return numerator / denominator;
}

/**
 * Main fragment shader
 */
void main() {
    // Calculate enhanced normal
    vec3 normal = calculateMetalNormal();
    
    // Normalize input vectors
    vec3 viewDir = safeNormalize(v_viewDirection);
    vec3 lightDir = safeNormalize(u_lightPosition - v_worldPosition);
    
    // Sample roughness map
    float surfaceRoughness = texture2D(u_roughnessMap, v_uv).r;
    float finalRoughness = clamp(u_roughness + surfaceRoughness * 0.5, 0.04, 1.0);
    
    // Audio-reactive roughness modulation
    float audioRoughness = v_energyLevel * u_audioReactivity * 0.3;
    finalRoughness = clamp(finalRoughness + audioRoughness, 0.04, 1.0);
    
    // Calculate oxidation
    vec3 metalColor = calculateOxidation(u_metalColor);
    
    // Use metal color as F0 (metals have colored F0)
    vec3 F0 = metalColor;
    
    // Calculate BRDF
    vec3 brdf = calculateMetalBRDF(normal, viewDir, lightDir, F0, finalRoughness);
    
    // Calculate reflections
    vec3 reflections = calculateMetalReflections(normal, viewDir, finalRoughness);
    
    // Calculate Fresnel for environment reflections
    float NdotV = max(dot(normal, viewDir), 0.0);
    vec3 envFresnel = fresnelSchlickMetal(NdotV, F0);
    
    // Combine direct lighting and reflections
    float NdotL = max(dot(normal, lightDir), 0.0);
    vec3 directLighting = brdf * u_lightColor * u_lightIntensity * NdotL;
    vec3 indirectLighting = reflections * envFresnel;
    
    vec3 finalColor = directLighting + indirectLighting;
    
    // Add electromagnetic effects
    finalColor += calculateElectromagneticEffects(normal, viewDir);
    
    // Add conductivity effects
    finalColor += calculateConductivityEffects();
    
    // Audio-reactive color modulation
    if (u_colorResponse > 0.0) {
        vec3 audioColor = metalColor * vec3(
            u_bassLevel * 0.1,
            u_midLevel * 0.15,
            u_trebleLevel * 0.2
        );
        finalColor += audioColor * u_colorResponse * u_audioReactivity;
    }
    
    // Apply ambient lighting
    finalColor += u_ambientLight * metalColor * 0.03;
    
    // Metals are opaque
    float alpha = 1.0;
    
    // Final color output
    gl_FragColor = vec4(finalColor, alpha);
    
    // Apply tone mapping for HDR
    gl_FragColor.rgb = gl_FragColor.rgb / (gl_FragColor.rgb + vec3(1.0));
    
    // Gamma correction
    gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0 / 2.2));
}