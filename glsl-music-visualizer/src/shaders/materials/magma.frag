/**
 * Magma Material Fragment Shader
 * Molten rock rendering with crystallization, cooling effects,
 * thermal gradients, viscous flow, and audio reactivity
 * Location: src/shaders/materials/magma.frag
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
 * Convert temperature to RGB for magma/lava colors
 */
vec3 magmaTemperatureToRGB(float temperature) {
    // Magma temperature range: 700°C (973K) to 1200°C (1473K)
    temperature = clamp(temperature, 973.0, 1473.0);
    
    float t = (temperature - 973.0) / 500.0; // Normalize to 0-1
    
    vec3 color;
    
    if (t < 0.3) {
        // Cool magma: dark red to bright red
        color = mix(vec3(0.2, 0.0, 0.0), vec3(1.0, 0.1, 0.0), t / 0.3);
    } else if (t < 0.7) {
        // Medium temperature: red to orange
        color = mix(vec3(1.0, 0.1, 0.0), vec3(1.0, 0.5, 0.0), (t - 0.3) / 0.4);
    } else {
        // Hot magma: orange to yellow-white
        color = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 1.0, 0.3), (t - 0.7) / 0.3);
    }
    
    return color;
}

/**
 * Calculate crystallization pattern
 */
float calculateCrystallization(vec3 position, float temperature, float time) {
    // Crystallization occurs when temperature drops below solidification point
    float solidificationTemp = 1073.0; // ~800°C
    
    if (temperature > solidificationTemp) {
        return 0.0; // No crystallization above solidification point
    }
    
    // Cooling rate affects crystal formation
    float coolingFactor = (solidificationTemp - temperature) / solidificationTemp;
    
    // Crystal nucleation sites based on noise
    float crystalNoise = noise3D(position * 4.0 + time * 0.1);
    float nucleationSites = smoothstep(0.6, 0.8, crystalNoise);
    
    // Crystal growth based on cooling and time
    float crystalGrowth = coolingFactor * nucleationSites;
    
    return clamp(crystalGrowth, 0.0, 1.0);
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

// Magma material properties
uniform float u_temperature;         // Magma temperature [973-1473K]
uniform float u_viscosity;           // Magma viscosity
uniform float u_density;             // Magma density
uniform vec3 u_magmaColor;           // Base magma color
uniform float u_crystallization;     // Crystallization factor
uniform vec3 u_crystalColor;         // Crystal/solid color
uniform float u_coolingRate;         // Heat dissipation rate
uniform float u_flowRate;            // Flow animation speed

// Thermal properties
uniform float u_thermalGradient;     // Temperature variation
uniform float u_heatConduction;      // Heat transfer rate
uniform vec3 u_emberColor;           // Hot spot/ember color
uniform float u_emberDensity;        // Hot spot density

// Lighting
uniform vec3 u_lightPosition;
uniform vec3 u_lightColor;
uniform vec3 u_ambientLight;
uniform float u_lightIntensity;

// Audio reactivity
uniform float u_audioReactivity;     // Audio response strength
uniform float u_temperatureResponse; // Temperature response to audio
uniform float u_viscosityResponse;   // Viscosity response to audio
uniform float u_crystallResponse;    // Crystallization response

// Quality settings
uniform float u_qualityLevel;        // Rendering quality [0.1-1.0]
uniform bool u_enableCrystals;       // Enable crystallization effects
uniform bool u_enableThermal;        // Enable thermal gradients
uniform bool u_enableEmbers;         // Enable hot ember effects
uniform bool u_enableFlow;           // Enable flow animation

// ===== MAIN FUNCTIONS =====

/**
 * Calculate magma temperature with thermal gradients
 */
float calculateMagmaTemperature(vec3 position, float time) {
    // Base temperature with spatial variation
    float baseTemp = u_temperature;
    
    // Thermal gradients - hotter in center, cooler at edges
    float radialDistance = length(position.xz);
    float thermalGradient = exp(-radialDistance * 0.2) * u_thermalGradient;
    
    // Vertical temperature variation (cooler at top)
    float verticalGradient = mix(50.0, -100.0, clamp(position.y + 1.0, 0.0, 1.0));
    
    // Audio-reactive temperature fluctuations
    float audioTemp = v_energyLevel * u_temperatureResponse * 200.0;
    float bassHeat = u_bassLevel * u_audioReactivity * 150.0;
    
    // Temporal fluctuations
    float timeTemp = sin(time * 0.5 + position.x * 0.1) * 30.0;
    
    // Combine all temperature factors
    float finalTemp = baseTemp + thermalGradient + verticalGradient + audioTemp + bassHeat + timeTemp;
    
    return clamp(finalTemp, 800.0, 1500.0);
}

/**
 * Calculate viscosity based on temperature and composition
 */
float calculateViscosity(float temperature, float crystallization) {
    // Viscosity increases dramatically as temperature decreases
    float tempFactor = 1473.0 / clamp(temperature, 973.0, 1473.0);
    float baseViscosity = u_viscosity * pow(tempFactor, 3.0);
    
    // Crystallization increases viscosity significantly
    float crystalViscosity = baseViscosity * (1.0 + crystallization * 10.0);
    
    // Audio-reactive viscosity modulation
    float audioViscosity = 1.0 + v_energyLevel * u_viscosityResponse * 0.5;
    
    return crystalViscosity * audioViscosity;
}

/**
 * Calculate magma flow effects
 */
vec3 calculateMagmaFlow(vec3 position, float viscosity, float time) {
    if (!u_enableFlow || u_qualityLevel < 0.3) {
        return vec3(0.0);
    }
    
    // Flow is inversely related to viscosity
    float flowSpeed = u_flowRate / (viscosity * 0.001 + 1.0);
    
    // Audio-reactive flow enhancement
    flowSpeed *= (1.0 + v_energyLevel * u_audioReactivity * 0.5);
    
    // Multi-scale flow turbulence
    vec3 flow1 = vec3(
        noise3D(position * 0.5 + time * flowSpeed * 0.3),
        0.0, // Primarily horizontal flow
        noise3D(position * 0.5 + time * flowSpeed * 0.3 + 100.0)
    ) * 2.0 - 1.0;
    
    vec3 flow2 = vec3(
        noise3D(position * 1.0 + time * flowSpeed * 0.5),
        0.0,
        noise3D(position * 1.0 + time * flowSpeed * 0.5 + 200.0)
    ) * 2.0 - 1.0;
    
    vec3 totalFlow = (flow1 * 0.7 + flow2 * 0.3) * 0.1;
    
    return totalFlow;
}

/**
 * Calculate ember and hot spot effects
 */
vec3 calculateEmbers(vec3 position, float temperature, float time) {
    if (!u_enableEmbers || u_qualityLevel < 0.4) {
        return vec3(0.0);
    }
    
    // Ember probability based on temperature
    float emberThreshold = 1200.0;
    if (temperature < emberThreshold) {
        return vec3(0.0);
    }
    
    // Audio-reactive ember generation
    float audioEmbers = v_energyLevel * u_audioReactivity * u_emberDensity;
    
    // Hot spots using noise
    float emberNoise = noise3D(position * 6.0 + time * 2.0);
    float emberDensity = smoothstep(0.7, 0.9, emberNoise) * audioEmbers;
    
    // Hot ember color based on temperature
    float emberTemp = temperature + emberNoise * 300.0;
    vec3 emberColor = magmaTemperatureToRGB(emberTemp) * u_emberColor;
    
    return emberColor * emberDensity * 2.0;
}

/**
 * Calculate surface crystallization effects
 */
vec3 calculateCrystalSurface(vec3 position, float temperature, float time) {
    if (!u_enableCrystals || u_qualityLevel < 0.5) {
        return vec3(0.0);
    }
    
    // Audio-reactive crystallization
    float audioCrystal = u_beatDetected * u_crystallResponse * 0.3;
    float totalCrystallization = u_crystallization + audioCrystal;
    
    // Calculate crystallization pattern
    float crystalPattern = calculateCrystallization(position, temperature, time);
    crystalPattern *= totalCrystallization;
    
    // Crystal surface properties
    vec3 crystalSurface = u_crystalColor * crystalPattern;
    
    // Crystal structure using noise
    float crystalStructure = noise3D(position * 8.0) * 0.5 + 0.5;
    crystalSurface *= crystalStructure;
    
    return crystalSurface;
}

/**
 * Calculate thermal emission
 */
vec3 calculateThermalEmission(float temperature, vec3 baseColor) {
    // Self-illumination based on temperature
    float emissionStrength = clamp((temperature - 973.0) / 500.0, 0.0, 1.0);
    
    // Audio-reactive emission enhancement
    emissionStrength *= (1.0 + v_energyLevel * u_audioReactivity * 0.6);
    
    // Temperature-based color
    vec3 thermalColor = magmaTemperatureToRGB(temperature);
    
    return thermalColor * baseColor * emissionStrength * 2.0;
}

/**
 * Main fragment shader
 */
void main() {
    // Calculate magma temperature at this position
    float temperature = calculateMagmaTemperature(v_worldPosition, u_time);
    
    // Calculate crystallization factor
    float crystallization = 0.0;
    if (u_enableCrystals) {
        crystallization = calculateCrystallization(v_worldPosition, temperature, u_time);
    }
    
    // Calculate material viscosity
    float viscosity = calculateViscosity(temperature, crystallization);
    
    // Base magma color from temperature
    vec3 magmaColor = magmaTemperatureToRGB(temperature) * u_magmaColor;
    
    // Add crystal surface effects
    vec3 crystalSurface = calculateCrystalSurface(v_worldPosition, temperature, u_time);
    
    // Mix molten and crystallized regions
    vec3 baseColor = mix(magmaColor, crystalSurface, crystallization);
    
    // Calculate thermal self-emission
    vec3 thermalEmission = calculateThermalEmission(temperature, baseColor);
    
    // Add ember hot spots
    vec3 embers = calculateEmbers(v_worldPosition, temperature, u_time);
    
    // Calculate flow effects (affects color variation)
    vec3 flowEffect = calculateMagmaFlow(v_worldPosition, viscosity, u_time);
    
    // Combine all color contributions
    vec3 finalColor = baseColor + thermalEmission + embers;
    
    // Apply flow distortion to color
    finalColor += flowEffect * 0.1;
    
    // Audio-reactive color modulation
    if (u_temperatureResponse > 0.0) {
        vec3 audioColor = magmaColor * vec3(
            u_bassLevel * 0.2,
            u_midLevel * 0.15,
            u_trebleLevel * 0.1
        );
        finalColor += audioColor * u_temperatureResponse * u_audioReactivity;
    }
    
    // Beat-synchronized intensity pulses
    float beatPulse = 1.0 + u_beatDetected * u_audioReactivity * 0.2;
    finalColor *= beatPulse;
    
    // Apply minimal ambient lighting (magma is self-lit)
    finalColor += u_ambientLight * baseColor * 0.05;
    
    // Calculate alpha based on material state
    float alpha = 1.0;
    
    // Crystallized regions are more opaque
    alpha = mix(0.9, 1.0, crystallization);
    
    // Temperature affects opacity (hotter = more emission = more visible)
    float thermalAlpha = clamp((temperature - 900.0) / 400.0, 0.5, 1.0);
    alpha *= thermalAlpha;
    
    // Apply tone mapping for HDR
    finalColor = finalColor / (finalColor + vec3(1.0));
    
    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));
    
    // Final output
    gl_FragColor = vec4(finalColor, alpha);
}