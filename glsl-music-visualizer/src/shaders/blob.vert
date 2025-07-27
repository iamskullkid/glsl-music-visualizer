/**
 * Blob Vertex Shader
 * Advanced vertex shader for physically-accurate amorphous blob rendering
 * Location: src/shaders/blob.vert
 * 
 * Handles metaball mesh deformation, audio-reactive displacement,
 * material property processing, and multi-layer surface detail generation.
 * Optimized for real-time performance with adaptive quality scaling.
 */

// Automatic version handling by ShaderManager
// Note: Includes will be processed by ShaderManager preprocessor

// ===== CONSTANTS =====
#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define EPSILON 0.0001

// ===== UTILITY FUNCTIONS =====

/**
 * Hash function for pseudo-random generation
 */
float hash(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

/**
 * 2D hash function
 */
vec2 hash2(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
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
 * Smooth interpolation function
 */
vec3 smoothstep3(vec3 edge0, vec3 edge1, vec3 x) {
    vec3 t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

/**
 * 3D Perlin noise implementation
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
    
    // Smooth interpolation (quintic)
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    // Trilinear interpolation
    return mix(
        mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
        mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
        u.z
    );
}

// ===== VERTEX ATTRIBUTES =====

// Standard vertex attributes (compatible with both WebGL1 and WebGL2)
attribute vec3 a_position;          // Base vertex position
attribute vec3 a_normal;            // Base vertex normal
attribute vec2 a_uv;                // Texture coordinates
attribute vec3 a_tangent;           // Tangent vector for normal mapping
attribute float a_vertexId;         // Vertex ID for procedural effects

// ===== UNIFORMS =====

// Transformation matrices
uniform mat4 u_mvpMatrix;        // Model-View-Projection matrix
uniform mat4 u_modelMatrix;      // Model matrix
uniform mat4 u_viewMatrix;       // View matrix
uniform mat4 u_projectionMatrix; // Projection matrix
uniform mat3 u_normalMatrix;     // Normal transformation matrix

// Camera properties
uniform vec3 u_cameraPosition;   // World space camera position
uniform vec3 u_cameraDirection;  // Camera forward direction
uniform float u_near;            // Near plane distance
uniform float u_far;             // Far plane distance

// Time and animation
uniform float u_time;            // Global time in seconds
uniform float u_deltaTime;       // Frame delta time
uniform float u_animationSpeed;  // Global animation speed multiplier
uniform float u_frameCount;      // Frame counter for temporal effects

// Audio analysis data
uniform float u_audioEnergy;     // Overall audio energy [0-1]
uniform float u_bassLevel;       // Bass frequency level [0-1]
uniform float u_midLevel;        // Mid frequency level [0-1]
uniform float u_trebleLevel;     // Treble frequency level [0-1]
uniform float u_beatDetected;    // Beat detection flag [0-1]
uniform float u_tempo;           // Detected tempo (BPM)
uniform float u_loudness;        // Perceptual loudness
uniform sampler2D u_frequencyData; // FFT frequency spectrum texture
uniform sampler2D u_waveformData;  // Time-domain waveform texture

// Metaball system
uniform int u_metaballCount;     // Number of active metaballs
uniform vec3 u_metaballPositions[32]; // Metaball positions
uniform float u_metaballRadii[32];    // Metaball radii
uniform float u_metaballInfluences[32]; // Metaball influence strengths
uniform vec4 u_metaballColors[32];     // Metaball colors
uniform float u_metaballThreshold;    // Isosurface threshold
uniform float u_metaballBlending;     // Blending smoothness

// Material properties
uniform float u_viscosity;       // Material viscosity [0-1]
uniform float u_surfaceTension;  // Surface tension strength
uniform float u_density;         // Material density
uniform float u_temperature;     // Material temperature
uniform vec3 u_materialColor;    // Base material color
uniform float u_metallic;        // Metallic property [0-1]
uniform float u_roughness;       // Surface roughness [0-1]
uniform float u_emission;        // Emission strength
uniform float u_transparency;    // Transparency level [0-1]
uniform float u_refractiveIndex; // Index of refraction

// Displacement and deformation
uniform float u_displacementScale; // Global displacement scaling
uniform float u_audioReactivity;   // Audio reactivity strength
uniform float u_turbulenceScale;   // Turbulence intensity
uniform float u_flowSpeed;         // Flow animation speed
uniform vec3 u_gravityDirection;   // Gravity direction
uniform float u_gravityStrength;   // Gravity strength
uniform float u_pressureStrength;  // Internal pressure

// Quality and performance
uniform float u_qualityLevel;    // Quality scaling [0.1-1.0]
uniform float u_lodDistance;     // Level-of-detail distance
uniform int u_maxDisplacementSteps; // Maximum displacement iterations
uniform float u_tessellationLevel; // Tessellation density
uniform bool u_enableDetailMaps;   // Enable detail displacement

// Post-processing and effects
uniform float u_bloomThreshold;  // Bloom emission threshold
uniform float u_hdrExposure;     // HDR exposure adjustment
uniform bool u_enableSSR;       // Screen-space reflections
uniform bool u_enableVolumetrics; // Volumetric effects

// ===== OUTPUT VARYINGS =====

// Standard varyings (compatible with both WebGL1 and WebGL2)
varying vec3 v_worldPosition;    // World space position
varying vec3 v_viewPosition;     // View space position
varying vec3 v_worldNormal;      // World space normal
varying vec3 v_viewNormal;       // View space normal
varying vec2 v_uv;               // Texture coordinates
varying vec3 v_tangent;          // World space tangent
varying vec3 v_bitangent;        // World space bitangent

// Audio-reactive properties
varying float v_audioInfluence;  // Local audio influence
varying float v_energyLevel;     // Localized energy level
varying float v_beatStrength;    // Beat influence strength

// Material properties
varying float v_displacement;    // Applied displacement amount
varying float v_metaballInfluence; // Metaball field strength
varying vec3 v_materialVelocity; // Material flow velocity
varying float v_surfaceDetail;   // Surface detail factor

// Lighting data
varying vec3 v_viewDirection;    // View direction
varying float v_fresnel;         // Fresnel factor
varying float v_depth;           // Normalized depth

// Special effects
varying float v_emission;        // Local emission strength
varying vec3 v_flowDirection;    // Flow direction
varying float v_turbulence;      // Turbulence factor

// ===== MAIN FUNCTIONS =====

/**
 * Calculate metaball field influence at a position
 */
float calculateMetaballField(vec3 position) {
    float totalInfluence = 0.0;
    
    for (int i = 0; i < u_metaballCount && i < 32; i++) {
        vec3 toMetaball = position - u_metaballPositions[i];
        float distance = length(toMetaball);
        float radius = u_metaballRadii[i];
        
        if (distance < radius * 2.0) {
            // Smooth metaball falloff
            float influence = u_metaballInfluences[i] * radius * radius / (distance * distance + 0.001);
            totalInfluence += influence;
        }
    }
    
    return totalInfluence;
}

/**
 * Calculate audio-reactive displacement
 */
vec3 calculateAudioDisplacement(vec3 position, vec3 normal) {
    // Base audio energy influence
    float energyDisplacement = u_audioEnergy * u_audioReactivity;
    
    // Frequency-based displacement
    float bassInfluence = u_bassLevel * 0.8;
    float midInfluence = u_midLevel * 0.5;
    float trebleInfluence = u_trebleLevel * 0.3;
    
    // Sample frequency data based on vertex position
    vec2 freqUV = vec2(mod(a_vertexId, 256.0) / 256.0, 0.5);
    vec4 freqSample = texture2D(u_frequencyData, freqUV);
    float localInfluence = freqSample.r * (bassInfluence + midInfluence + trebleInfluence);
    
    // Beat-synchronized pulsing
    float beatPulse = u_beatDetected * sin(u_time * u_tempo / 60.0 * 6.28318) * 0.5 + 0.5;
    
    // Combine all influences
    float totalDisplacement = energyDisplacement + localInfluence + beatPulse * 0.3;
    
    // Apply quality scaling
    totalDisplacement *= u_qualityLevel;
    
    return normal * totalDisplacement * u_displacementScale;
}

/**
 * Calculate surface turbulence and flow
 */
vec3 calculateSurfaceFlow(vec3 position, vec3 normal, float time) {
    // Multi-octave noise for complex surface patterns
    float turbulence1 = perlinNoise3D(position * 0.5 + time * u_flowSpeed) * 1.0;
    float turbulence2 = perlinNoise3D(position * 1.0 + time * u_flowSpeed * 1.3) * 0.5;
    float turbulence3 = perlinNoise3D(position * 2.0 + time * u_flowSpeed * 1.7) * 0.25;
    
    float totalTurbulence = (turbulence1 + turbulence2 + turbulence3) * u_turbulenceScale;
    
    // Audio-reactive turbulence modulation
    totalTurbulence *= (1.0 + u_audioEnergy * 2.0);
    
    // Flow direction calculation
    vec3 flowDir = vec3(
        perlinNoise3D(position * 0.3 + time * 0.1),
        perlinNoise3D(position * 0.3 + time * 0.1 + 100.0),
        perlinNoise3D(position * 0.3 + time * 0.1 + 200.0)
    );
    flowDir = normalize(flowDir * 2.0 - 1.0);
    
    // Combine turbulence with flow
    return mix(normal * totalTurbulence, flowDir * totalTurbulence, 0.3);
}

/**
 * Calculate material-specific deformation
 */
vec3 calculateMaterialDeformation(vec3 position, vec3 normal) {
    vec3 deformation = vec3(0.0);
    
    // Viscosity affects surface smoothness
    float viscosityEffect = (1.0 - u_viscosity) * 0.5;
    deformation += normal * viscosityEffect * sin(u_time + position.x * 2.0);
    
    // Surface tension creates bubble-like effects
    float tensionEffect = u_surfaceTension * 0.3;
    deformation += normal * tensionEffect * (sin(u_time * 2.0 + position.y * 3.0) * 0.5 + 0.5);
    
    // Gravity influence
    deformation += u_gravityDirection * u_gravityStrength * 0.1;
    
    // Temperature affects expansion/contraction
    float thermalExpansion = (u_temperature - 0.5) * 0.2;
    deformation += normal * thermalExpansion;
    
    return deformation;
}

/**
 * Calculate level-of-detail scaling
 */
float calculateLODFactor(vec3 worldPos) {
    float distance = length(u_cameraPosition - worldPos);
    float lodFactor = clamp(1.0 - distance / u_lodDistance, 0.1, 1.0);
    return lodFactor * u_qualityLevel;
}

/**
 * Calculate advanced surface normal with displacement
 */
vec3 calculateDisplacedNormal(vec3 position, vec3 baseNormal, float displacementAmount) {
    if (u_qualityLevel < 0.5) {
        return baseNormal; // Skip expensive normal calculation for low quality
    }
    
    // Calculate gradient of displacement field for accurate normals
    float epsilon = 0.01;
    vec3 pos1 = position + vec3(epsilon, 0.0, 0.0);
    vec3 pos2 = position + vec3(0.0, epsilon, 0.0);
    vec3 pos3 = position + vec3(0.0, 0.0, epsilon);
    
    float disp1 = calculateMetaballField(pos1);
    float disp2 = calculateMetaballField(pos2);
    float disp3 = calculateMetaballField(pos3);
    float dispCenter = calculateMetaballField(position);
    
    vec3 gradient = vec3(
        disp1 - dispCenter,
        disp2 - dispCenter,
        disp3 - dispCenter
    ) / epsilon;
    
    // Blend with base normal
    return normalize(baseNormal - gradient * 0.3);
}

/**
 * Main vertex shader
 */
void main() {
    // Start with base vertex data
    vec3 position = a_position;
    vec3 normal = a_normal;
    vec2 uv = a_uv;
    vec3 tangent = a_tangent;
    
    // Calculate metaball field influence
    float metaballInfluence = calculateMetaballField(position);
    v_metaballInfluence = metaballInfluence;
    
    // Calculate LOD factor for performance scaling
    float lodFactor = calculateLODFactor(position);
    
    // Apply audio-reactive displacement
    vec3 audioDisplacement = calculateAudioDisplacement(position, normal);
    audioDisplacement *= lodFactor;
    
    // Apply surface flow and turbulence
    vec3 surfaceFlow = calculateSurfaceFlow(position, normal, u_time);
    surfaceFlow *= lodFactor;
    
    // Apply material-specific deformation
    vec3 materialDeformation = calculateMaterialDeformation(position, normal);
    
    // Combine all displacements
    vec3 totalDisplacement = audioDisplacement + surfaceFlow + materialDeformation;
    v_displacement = length(totalDisplacement);
    
    // Apply displacement to position
    position += totalDisplacement;
    
    // Calculate new normal with displacement
    normal = calculateDisplacedNormal(position, normal, v_displacement);
    
    // Transform to world space
    vec3 worldPosition = (u_modelMatrix * vec4(position, 1.0)).xyz;
    vec3 worldNormal = normalize(u_normalMatrix * normal);
    vec3 worldTangent = normalize(u_normalMatrix * tangent);
    vec3 worldBitangent = cross(worldNormal, worldTangent);
    
    // Transform to view space
    vec3 viewPosition = (u_viewMatrix * vec4(worldPosition, 1.0)).xyz;
    vec3 viewNormal = normalize(mat3(u_viewMatrix) * worldNormal);
    
    // Calculate view direction
    vec3 viewDirection = normalize(u_cameraPosition - worldPosition);
    v_viewDirection = viewDirection;
    
    // Calculate Fresnel factor
    float fresnel = 1.0 - max(0.0, dot(worldNormal, viewDirection));
    fresnel = pow(fresnel, 2.0);
    v_fresnel = fresnel;
    
    // Calculate audio influence factors
    v_audioInfluence = length(audioDisplacement) / max(u_displacementScale, 0.001);
    v_energyLevel = u_audioEnergy;
    v_beatStrength = u_beatDetected;
    
    // Calculate material velocity (for motion blur and flow effects)
    vec3 prevPosition = position - totalDisplacement * u_deltaTime;
    v_materialVelocity = (position - prevPosition) / max(u_deltaTime, 0.001);
    
    // Calculate surface detail factor
    v_surfaceDetail = mix(0.5, 1.0, lodFactor);
    if (u_enableDetailMaps) {
        v_surfaceDetail *= (1.0 + perlinNoise3D(worldPosition * 4.0) * 0.2);
    }
    
    // Calculate flow direction for fragment shader
    v_flowDirection = normalize(surfaceFlow + u_gravityDirection * 0.3);
    
    // Calculate turbulence factor
    v_turbulence = length(surfaceFlow) / max(u_turbulenceScale, 0.001);
    
    // Calculate emission based on audio and material properties
    float audioEmission = (u_audioEnergy * u_beatDetected + u_bassLevel * 0.5) * u_audioReactivity;
    v_emission = u_emission + audioEmission * u_materialColor.r;
    
    // Calculate normalized depth
    v_depth = clamp((-viewPosition.z - u_near) / (u_far - u_near), 0.0, 1.0);
    
    // Pass through transformed data
    v_worldPosition = worldPosition;
    v_viewPosition = viewPosition;
    v_worldNormal = worldNormal;
    v_viewNormal = viewNormal;
    v_uv = uv;
    v_tangent = worldTangent;
    v_bitangent = worldBitangent;
    
    // Final position transformation
    gl_Position = u_mvpMatrix * vec4(position, 1.0);
    
    // Apply quality-based vertex position jittering for lower LOD
    if (u_qualityLevel < 0.7) {
        float jitter = (1.0 - u_qualityLevel) * 0.001;
        gl_Position.xy += vec2(
            hash(a_vertexId) - 0.5,
            hash(a_vertexId + 100.0) - 0.5
        ) * jitter;
    }
}