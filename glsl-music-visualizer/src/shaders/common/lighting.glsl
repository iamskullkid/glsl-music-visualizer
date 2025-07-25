/**
 * Physically Based Rendering (PBR) Lighting Functions for GLSL Shaders
 * Comprehensive lighting system with advanced material properties
 * for realistic rendering of water, metal, fire, and plasma materials
 */

#ifndef LIGHTING_GLSL
#define LIGHTING_GLSL

#include "utils.glsl"

// ===== MATERIAL STRUCTURES =====

struct Material {
    vec3 albedo;           // Base color
    float metallic;        // Metallic factor (0 = dielectric, 1 = metal)
    float roughness;       // Surface roughness (0 = mirror, 1 = completely rough)
    float ao;             // Ambient occlusion
    vec3 emission;         // Emissive color
    vec3 normal;           // Surface normal (world space)
    float subsurface;      // Subsurface scattering factor
    float transmission;    // Transmission factor for translucent materials
    float ior;            // Index of refraction
};

struct Light {
    vec3 position;         // Light position (world space)
    vec3 direction;        // Light direction (for directional lights)
    vec3 color;           // Light color and intensity
    float range;          // Light range (for point/spot lights)
    float innerCone;      // Inner cone angle (for spot lights)
    float outerCone;      // Outer cone angle (for spot lights)
    int type;             // Light type: 0=directional, 1=point, 2=spot
};

// ===== UTILITY FUNCTIONS =====

/**
 * Convert linear color to sRGB
 */
vec3 linearTosRGB(vec3 color) {
    return pow(color, vec3(1.0 / 2.2));
}

/**
 * Convert sRGB color to linear
 */
vec3 sRGBToLinear(vec3 color) {
    return pow(color, vec3(2.2));
}

/**
 * Luminance calculation for HDR tone mapping
 */
float getLuminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

/**
 * Safe normalize - prevents division by zero
 */
vec3 safeNormalize(vec3 v) {
    float len = length(v);
    return len > EPSILON ? v / len : vec3(0.0, 0.0, 1.0);
}

// ===== FRESNEL FUNCTIONS =====

/**
 * Fresnel-Schlick approximation
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/**
 * Fresnel-Schlick with roughness for IBL
 */
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/**
 * Exact Fresnel calculation (more accurate for dielectrics)
 */
float fresnelExact(float cosTheta, float ior) {
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    float sinThetaT = sinTheta / ior;
    
    if (sinThetaT >= 1.0) return 1.0; // Total internal reflection
    
    float cosThetaT = sqrt(1.0 - sinThetaT * sinThetaT);
    
    float rs = (cosTheta - ior * cosThetaT) / (cosTheta + ior * cosThetaT);
    float rp = (ior * cosTheta - cosThetaT) / (ior * cosTheta + cosThetaT);
    
    return 0.5 * (rs * rs + rp * rp);
}

// ===== DISTRIBUTION FUNCTIONS =====

/**
 * GGX/Trowbridge-Reitz normal distribution function
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

// ===== GEOMETRY FUNCTIONS =====

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

// ===== BRDF FUNCTIONS =====

/**
 * Lambert diffuse BRDF
 */
vec3 lambertDiffuse(vec3 albedo) {
    return albedo / PI;
}

/**
 * Burley diffuse BRDF (Disney's principled BRDF)
 */
vec3 burleyDiffuse(vec3 albedo, float roughness, float NdotV, float NdotL, float VdotH) {
    float FD90 = 0.5 + 2.0 * VdotH * VdotH * roughness;
    float FdV = 1.0 + (FD90 - 1.0) * pow(1.0 - NdotV, 5.0);
    float FdL = 1.0 + (FD90 - 1.0) * pow(1.0 - NdotL, 5.0);
    return albedo / PI * FdV * FdL;
}

/**
 * Cook-Torrance specular BRDF
 */
vec3 cookTorranceSpecular(vec3 N, vec3 V, vec3 L, vec3 H, vec3 F0, float roughness) {
    float NDF = distributionGGX(N, H, roughness);
    float G = geometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + EPSILON;
    
    return numerator / denominator;
}

// ===== MATERIAL-SPECIFIC LIGHTING =====

/**
 * Water material lighting with subsurface scattering
 */
vec3 calculateWaterLighting(Material mat, vec3 viewDir, vec3 lightDir, vec3 lightColor, float depth) {
    vec3 N = mat.normal;
    vec3 V = normalize(viewDir);
    vec3 L = normalize(lightDir);
    vec3 H = normalize(V + L);
    
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float VdotH = max(dot(V, H), 0.0);
    
    // Fresnel for water (IOR ≈ 1.33)
    vec3 F0 = vec3(0.02); // Water F0
    vec3 F = fresnelSchlick(NdotV, F0);
    
    // Specular reflection
    vec3 specular = cookTorranceSpecular(N, V, L, H, F0, mat.roughness);
    
    // Subsurface scattering approximation
    float backlight = max(0.0, dot(-L, V));
    vec3 subsurface = mat.albedo * lightColor * pow(backlight, 4.0) * mat.subsurface;
    
    // Depth-based attenuation
    float attenuation = exp(-depth * 0.1);
    subsurface *= attenuation;
    
    // Transmission
    vec3 transmission = mat.albedo * lightColor * mat.transmission * (1.0 - F) * NdotL;
    
    return (specular * F + subsurface + transmission) * lightColor * NdotL;
}

/**
 * Metal material lighting with anisotropy
 */
vec3 calculateMetalLighting(Material mat, vec3 viewDir, vec3 lightDir, vec3 lightColor, vec3 tangent, vec3 bitangent) {
    vec3 N = mat.normal;
    vec3 V = normalize(viewDir);
    vec3 L = normalize(lightDir);
    vec3 H = normalize(V + L);
    
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    
    // Metallic F0 (use albedo as F0 for metals)
    vec3 F0 = mix(vec3(0.04), mat.albedo, mat.metallic);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    
    // Anisotropic specular
    float roughnessX = mat.roughness;
    float roughnessY = mat.roughness * 0.5; // Anisotropy factor
    
    float NDF = distributionGGXAnisotropic(N, H, tangent, bitangent, roughnessX, roughnessY);
    float G = geometrySmith(N, V, L, mat.roughness);
    
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * NdotV * NdotL + EPSILON;
    vec3 specular = numerator / denominator;
    
    // Metals have no diffuse component
    vec3 kS = F;
    vec3 kD = vec3(0.0); // No diffuse for metals
    
    return (kD * mat.albedo / PI + specular) * lightColor * NdotL;
}

/**
 * Fire/Plasma material lighting with emission
 */
vec3 calculateFireLighting(Material mat, vec3 viewDir, vec3 lightDir, vec3 lightColor, float temperature, float density) {
    vec3 N = mat.normal;
    vec3 V = normalize(viewDir);
    vec3 L = normalize(lightDir);
    
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    
    // Blackbody radiation based on temperature
    vec3 emission = temperatureToRGB(temperature) * density * mat.emission;
    
    // Self-illumination doesn't depend on external lighting
    vec3 selfLight = emission * (1.0 + 0.5 * sin(temperature * 0.001)); // Flickering effect
    
    // Volumetric scattering approximation
    float scattering = pow(max(0.0, dot(-L, V)), 2.0);
    vec3 scattered = lightColor * mat.albedo * scattering * density * 0.1;
    
    // Fire doesn't reflect much light, mostly emits
    return selfLight + scattered;
}

/**
 * Glass/Crystal material lighting with refraction
 */
vec3 calculateGlassLighting(Material mat, vec3 viewDir, vec3 lightDir, vec3 lightColor, vec3 refractionColor) {
    vec3 N = mat.normal;
    vec3 V = normalize(viewDir);
    vec3 L = normalize(lightDir);
    vec3 H = normalize(V + L);
    
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float VdotH = max(dot(V, H), 0.0);
    
    // Glass F0 (around 0.04 for common glass)
    vec3 F0 = vec3(0.04);
    vec3 F = fresnelExact(NdotV, mat.ior);
    
    // Specular reflection
    vec3 specular = cookTorranceSpecular(N, V, L, H, F0, mat.roughness);
    
    // Refraction/transmission
    vec3 refraction = refractionColor * mat.albedo * (1.0 - F.x) * mat.transmission;
    
    // Combine reflection and refraction
    return specular * F.x + refraction;
}

// ===== ADVANCED LIGHTING EFFECTS =====

/**
 * Volumetric lighting (god rays effect)
 */
float volumetricLight(vec3 rayStart, vec3 rayDir, vec3 lightPos, float rayLength, int steps) {
    float stepSize = rayLength / float(steps);
    float totalDensity = 0.0;
    
    for (int i = 0; i < steps; i++) {
        vec3 currentPos = rayStart + rayDir * (float(i) * stepSize);
        float distToLight = length(lightPos - currentPos);
        
        // Simple volumetric density (could be replaced with noise)
        float density = 1.0 / (1.0 + distToLight * distToLight * 0.1);
        totalDensity += density * stepSize;
    }
    
    return totalDensity;
}

/**
 * Screen-space ambient occlusion approximation
 */
float calculateSSAO(vec3 position, vec3 normal, float radius, int samples) {
    float occlusion = 0.0;
    
    for (int i = 0; i < samples; i++) {
        // Generate hemisphere sample (simplified)
        float theta = float(i) * 2.4; // Golden angle approximation
        float phi = acos(sqrt(float(i) / float(samples)));
        
        vec3 sampleDir = vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
        
        // Orient sample to hemisphere around normal
        sampleDir = normalize(sampleDir + normal);
        
        vec3 samplePos = position + sampleDir * radius;
        
        // Check if sample is occluded (simplified)
        // In a real implementation, you'd sample depth buffer
        float sampleDepth = length(samplePos);
        float surfaceDepth = length(position);
        
        if (sampleDepth > surfaceDepth) {
            occlusion += 1.0;
        }
    }
    
    return 1.0 - (occlusion / float(samples));
}

/**
 * Image-based lighting approximation
 */
vec3 calculateIBL(Material mat, vec3 viewDir, vec3 envColor, float envIntensity) {
    vec3 N = mat.normal;
    vec3 V = normalize(viewDir);
    vec3 R = reflect(-V, N);
    
    float NdotV = max(dot(N, V), 0.0);
    
    // Fresnel for IBL
    vec3 F0 = mix(vec3(0.04), mat.albedo, mat.metallic);
    vec3 F = fresnelSchlickRoughness(NdotV, F0, mat.roughness);
    
    // Diffuse IBL
    vec3 kS = F;
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - mat.metallic;
    
    vec3 diffuse = kD * mat.albedo * envColor;
    
    // Specular IBL (simplified - would normally sample environment map)
    vec3 specular = envColor * F * (1.0 - mat.roughness);
    
    return (diffuse + specular) * envIntensity * mat.ao;
}

// ===== AUDIO-REACTIVE LIGHTING =====

/**
 * Audio-reactive lighting intensity
 */
vec3 audioReactiveLighting(vec3 baseColor, float bassLevel, float midLevel, float trebleLevel, float energy) {
    // Bass affects overall intensity
    float intensity = 1.0 + bassLevel * 0.5;
    
    // Mid frequencies affect color temperature
    float temperature = 3000.0 + midLevel * 2000.0;
    vec3 tempColor = temperatureToRGB(temperature);
    
    // Treble adds sparkle/highlights
    float sparkle = 1.0 + trebleLevel * 0.3 * sin(energy * 10.0);
    
    return baseColor * tempColor * intensity * sparkle;
}

/**
 * Beat-synchronized lighting pulse
 */
float beatPulse(float time, float bpm, float beatStrength, float pulseWidth) {
    float beatPeriod = 60.0 / bpm;
    float beatPhase = mod(time, beatPeriod) / beatPeriod;
    
    float pulse = smoothstep(0.0, pulseWidth, beatPhase) * 
                  smoothstep(pulseWidth * 2.0, pulseWidth, beatPhase);
    
    return 1.0 + pulse * beatStrength;
}

// ===== MAIN LIGHTING CALCULATION =====

/**
 * Calculate lighting for a point with multiple lights
 */
vec3 calculateLighting(Material mat, vec3 worldPos, vec3 viewDir, Light lights[8], int lightCount, vec3 ambientColor) {
    vec3 totalLight = vec3(0.0);
    
    // Ambient lighting
    vec3 ambient = ambientColor * mat.albedo * mat.ao;
    totalLight += ambient;
    
    // Direct lighting from each light source
    for (int i = 0; i < lightCount && i < 8; i++) {
        Light light = lights[i];
        vec3 lightDir;
        float attenuation = 1.0;
        
        if (light.type == 0) { // Directional light
            lightDir = -light.direction;
        } else { // Point or spot light
            lightDir = light.position - worldPos;
            float distance = length(lightDir);
            lightDir /= distance;
            
            // Distance attenuation
            attenuation = 1.0 / (1.0 + 0.1 * distance + 0.01 * distance * distance);
            
            if (light.type == 2) { // Spot light
                float spotEffect = dot(normalize(-light.direction), lightDir);
                float spotAttenuation = smoothstep(light.outerCone, light.innerCone, spotEffect);
                attenuation *= spotAttenuation;
            }
        }
        
        // Apply material-specific lighting
        vec3 lightContribution = vec3(0.0);
        
        if (mat.metallic > 0.5) {
            // Treat as metal
            vec3 tangent = normalize(cross(mat.normal, vec3(0.0, 1.0, 0.0)));
            vec3 bitangent = cross(mat.normal, tangent);
            lightContribution = calculateMetalLighting(mat, viewDir, lightDir, light.color, tangent, bitangent);
        } else if (mat.transmission > 0.1) {
            // Treat as glass/water
            if (mat.ior < 1.5) {
                // Water-like
                lightContribution = calculateWaterLighting(mat, viewDir, lightDir, light.color, 1.0);
            } else {
                // Glass-like
                lightContribution = calculateGlassLighting(mat, viewDir, lightDir, light.color, ambientColor);
            }
        } else if (length(mat.emission) > 0.1) {
            // Emissive material (fire/plasma)
            lightContribution = calculateFireLighting(mat, viewDir, lightDir, light.color, 3000.0, 1.0);
        } else {
            // Standard PBR
            vec3 N = mat.normal;
            vec3 V = normalize(viewDir);
            vec3 L = normalize(lightDir);
            vec3 H = normalize(V + L);
            
            float NdotL = max(dot(N, L), 0.0);
            float NdotV = max(dot(N, V), 0.0);
            float VdotH = max(dot(V, H), 0.0);
            
            vec3 F0 = mix(vec3(0.04), mat.albedo, mat.metallic);
            vec3 F = fresnelSchlick(VdotH, F0);
            
            vec3 kS = F;
            vec3 kD = vec3(1.0) - kS;
            kD *= 1.0 - mat.metallic;
            
            vec3 diffuse = burleyDiffuse(mat.albedo, mat.roughness, NdotV, NdotL, VdotH);
            vec3 specular = cookTorranceSpecular(N, V, L, H, F0, mat.roughness);
            
            lightContribution = (kD * diffuse + specular) * light.color * NdotL;
        }
        
        totalLight += lightContribution * attenuation;
    }
    
    return totalLight;
}

#endif // LIGHTING_GLSL