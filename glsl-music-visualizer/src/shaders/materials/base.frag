/**
 * Base Material Fragment Shader
 * Default/fallback material shader with standard PBR implementation,
 * comprehensive audio reactivity, and adaptive quality features
 * Location: src/shaders/materials/base.frag
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
 * Clamp to [0,1] range (manual implementation since saturate() isn't available in all GLSL versions)
 */
float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec3 saturate(vec3 x) {
    return clamp(x, 0.0, 1.0);
}

/**
 * Hash function for procedural generation
 */
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
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

/**
 * Fresnel-Schlick approximation
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(saturate(1.0 - cosTheta), 5.0);
}

/**
 * GGX Distribution function
 */
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = saturate(dot(N, H));
    float NdotH2 = NdotH * NdotH;
    
    float nom = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    
    return nom / denom;
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
    float NdotV = saturate(dot(N, V));
    float NdotL = saturate(dot(N, L));
    float ggx2 = geometrySchlickGGX(NdotV, roughness);
    float ggx1 = geometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
}

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
    return c.z * mix(K.xxx, saturate(p - K.xxx), c.y);
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

// Base material properties
uniform vec3 u_baseColor;            // Base color/albedo
uniform float u_metallic;            // Metallic factor [0-1]
uniform float u_roughness;           // Surface roughness [0-1]
uniform float u_transparency;        // Transparency [0-1]
uniform vec3 u_emissionColor;        // Emission color
uniform float u_emissionStrength;    // Emission intensity
uniform float u_normalMapStrength;   // Normal map intensity
uniform float u_aoStrength;          // Ambient occlusion strength

// Lighting
uniform vec3 u_lightPosition;
uniform vec3 u_lightColor;
uniform vec3 u_ambientLight;
uniform float u_lightIntensity;

// Environment mapping
uniform samplerCube u_environmentMap;  // Environment cubemap
uniform sampler2D u_normalMap;         // Normal map texture
uniform sampler2D u_roughnessMap;      // Roughness map
uniform sampler2D u_metallicMap;       // Metallic map
uniform sampler2D u_aoMap;             // Ambient occlusion map
uniform sampler2D u_emissionMap;       // Emission map

// Audio reactivity
uniform float u_audioReactivity;       // Audio response strength
uniform float u_colorResponse;         // Color response to audio
uniform float u_roughnessResponse;     // Roughness response
uniform float u_emissionResponse;      // Emission response to audio
uniform float u_metallicResponse;      // Metallic response

// Quality and features
uniform float u_qualityLevel;          // Rendering quality [0.1-1.0]
uniform bool u_enableTextures;         // Enable texture sampling
uniform bool u_enableEnvironment;      // Enable environment mapping
uniform bool u_enableNormalMapping;    // Enable normal mapping
uniform bool u_enableEmission;         // Enable emission effects
uniform bool u_enableAudioReactivity;  // Enable audio responses

// ===== MAIN FUNCTIONS =====

/**
 * Sample and blend material textures
 */
vec4 sampleMaterialTextures() {
    vec4 result = vec4(u_baseColor, 1.0);
    
    if (!u_enableTextures || u_qualityLevel < 0.3) {
        return result;
    }
    
    // Sample base color (albedo) from texture
    // Note: In a real implementation, this would sample from an albedo texture
    // For now, we'll use procedural patterns
    vec2 uv = v_uv;
    
    // Add procedural surface detail
    float detail = noise2D(uv * 8.0 + u_time * 0.1) * 0.1;
    result.rgb = result.rgb + detail;
    
    return result;
}

/**
 * Calculate enhanced normal with normal mapping
 */
vec3 calculateSurfaceNormal() {
    vec3 baseNormal = safeNormalize(v_worldNormal);
    
    if (!u_enableNormalMapping || u_qualityLevel < 0.4) {
        return baseNormal;
    }
    
    // Sample normal map
    vec3 normalSample = texture2D(u_normalMap, v_uv).rgb * 2.0 - 1.0;
    
    // Audio-reactive normal distortion
    if (u_enableAudioReactivity) {
        float audioDistortion = v_energyLevel * u_audioReactivity * 0.2;
        normalSample.xy *= (1.0 + audioDistortion);
    }
    
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
 * Sample material properties from maps
 */
void sampleMaterialProperties(out float metallic, out float roughness, out float ao, out vec3 emission) {
    // Default values
    metallic = u_metallic;
    roughness = u_roughness;
    ao = 1.0;
    emission = u_emissionColor * u_emissionStrength;
    
    if (!u_enableTextures || u_qualityLevel < 0.5) {
        return;
    }
    
    // Sample material property maps
    metallic = metallic * texture2D(u_metallicMap, v_uv).r;
    roughness = roughness * texture2D(u_roughnessMap, v_uv).r;
    float aoSample = texture2D(u_aoMap, v_uv).r;
    ao = mix(1.0, aoSample, u_aoStrength);
    
    if (u_enableEmission) {
        vec3 emissionSample = texture2D(u_emissionMap, v_uv).rgb;
        emission = emission * emissionSample;
    }
    
    // Apply audio-reactive property modulation
    if (u_enableAudioReactivity) {
        metallic = saturate(metallic + v_energyLevel * u_metallicResponse * 0.3);
        roughness = saturate(roughness + v_turbulence * u_roughnessResponse * 0.2);
        emission = emission * (1.0 + v_beatStrength * u_emissionResponse);
    }
}

/**
 * Calculate Cook-Torrance BRDF
 */
vec3 calculateBRDF(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 albedo, float metallic, float roughness) {
    vec3 halfVector = safeNormalize(viewDir + lightDir);
    
    float NdotL = saturate(dot(normal, lightDir));
    float NdotV = saturate(dot(normal, viewDir));
    float NdotH = saturate(dot(normal, halfVector));
    float VdotH = saturate(dot(viewDir, halfVector));
    
    // Calculate F0 (base reflectance)
    vec3 F0 = mix(vec3(0.04), albedo, metallic);
    
    // Distribution term (D)
    float D = distributionGGX(normal, halfVector, roughness);
    
    // Geometry term (G)
    float G = geometrySmith(normal, viewDir, lightDir, roughness);
    
    // Fresnel term (F)
    vec3 F = fresnelSchlick(VdotH, F0);
    
    // Calculate specular BRDF
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + EPSILON;
    vec3 specular = numerator / denominator;
    
    // Calculate diffuse component
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD = kD * (1.0 - metallic); // Metals have no diffuse component
    
    vec3 diffuse = kD * albedo / PI;
    
    return (diffuse + specular) * NdotL;
}

/**
 * Calculate environment lighting (IBL approximation)
 */
vec3 calculateEnvironmentLighting(vec3 normal, vec3 viewDir, vec3 albedo, float metallic, float roughness) {
    if (!u_enableEnvironment || u_qualityLevel < 0.6) {
        return u_ambientLight * albedo * 0.1;
    }
    
    // Calculate reflection direction
    vec3 reflectionDir = reflect(-viewDir, normal);
    
    // Sample environment map
    vec3 envColor = textureCube(u_environmentMap, reflectionDir).rgb;
    
    // Calculate Fresnel for environment lighting
    float NdotV = saturate(dot(normal, viewDir));
    vec3 F0 = mix(vec3(0.04), albedo, metallic);
    vec3 F = fresnelSchlick(NdotV, F0);
    
    // Combine diffuse and specular environment lighting
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD = kD * (1.0 - metallic);
    
    vec3 diffuse = kD * albedo * u_ambientLight;
    vec3 specular = envColor * F * (1.0 - roughness * 0.5);
    
    return diffuse + specular;
}

/**
 * Apply audio-reactive color effects
 */
vec3 applyAudioReactiveColor(vec3 baseColor) {
    if (!u_enableAudioReactivity || u_colorResponse <= 0.0) {
        return baseColor;
    }
    
    // Convert to HSV for color manipulation
    vec3 hsv = rgb2hsv(baseColor);
    
    // Audio-reactive hue shifting
    float hueShift = (u_midLevel - u_trebleLevel) * u_colorResponse * 0.1;
    hsv.x = fract(hsv.x + hueShift);
    
    // Energy-based saturation boost
    float saturationBoost = v_energyLevel * u_colorResponse * 0.3;
    hsv.y = saturate(hsv.y + saturationBoost);
    
    // Beat-synchronized brightness pulses
    float brightnessPulse = u_beatDetected * u_audioReactivity * 0.2;
    hsv.z = saturate(hsv.z + brightnessPulse);
    
    // Convert back to RGB
    return hsv2rgb(hsv);
}

/**
 * Calculate frequency-based color overlay
 */
vec3 calculateFrequencyColors() {
    if (!u_enableAudioReactivity || u_qualityLevel < 0.3) {
        return vec3(0.0);
    }
    
    // Map frequency bands to colors
    vec3 bassColor = vec3(1.0, 0.2, 0.2) * u_bassLevel;      // Red for bass
    vec3 midColor = vec3(0.2, 1.0, 0.2) * u_midLevel;        // Green for mids
    vec3 trebleColor = vec3(0.2, 0.2, 1.0) * u_trebleLevel;  // Blue for treble
    
    // Combine frequency colors
    vec3 frequencyOverlay = (bassColor + midColor + trebleColor) * u_colorResponse * 0.2;
    
    return frequencyOverlay;
}

/**
 * Main fragment shader
 */
void main() {
    // Sample material textures
    vec4 albedoSample = sampleMaterialTextures();
    vec3 albedo = albedoSample.rgb;
    
    // Calculate surface normal
    vec3 normal = calculateSurfaceNormal();
    
    // Sample material properties
    float metallic, roughness, ao;
    vec3 emission;
    sampleMaterialProperties(metallic, roughness, ao, emission);
    
    // Normalize input vectors
    vec3 viewDir = safeNormalize(v_viewDirection);
    vec3 lightDir = safeNormalize(u_lightPosition - v_worldPosition);
    
    // Calculate direct lighting using Cook-Torrance BRDF
    vec3 directLighting = calculateBRDF(normal, viewDir, lightDir, albedo, metallic, roughness);
    directLighting *= u_lightColor * u_lightIntensity;
    
    // Calculate environment lighting
    vec3 environmentLighting = calculateEnvironmentLighting(normal, viewDir, albedo, metallic, roughness);
    environmentLighting *= ao; // Apply ambient occlusion
    
    // Combine lighting
    vec3 finalColor = directLighting + environmentLighting;
    
    // Add emission
    if (u_enableEmission) {
        finalColor += emission;
    }
    
    // Apply audio-reactive effects
    if (u_enableAudioReactivity) {
        finalColor = applyAudioReactiveColor(finalColor);
        finalColor += calculateFrequencyColors();
    }
    
    // Calculate final alpha
    float alpha = albedoSample.a * (1.0 - u_transparency);
    
    // Distance-based alpha falloff for depth
    float distanceFactor = 1.0 - saturate(length(v_viewPosition) / 100.0);
    alpha *= distanceFactor;
    
    // Apply tone mapping for HDR
    finalColor = finalColor / (finalColor + vec3(1.0));
    
    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));
    
    // Final output
    gl_FragColor = vec4(finalColor, alpha);
}