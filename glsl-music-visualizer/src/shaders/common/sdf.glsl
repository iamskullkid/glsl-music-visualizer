/**
 * Signed Distance Field (SDF) Functions for GLSL Shaders
 * Comprehensive collection of SDF primitives and operations for creating
 * complex 3D shapes and smooth boolean operations for the blob visualizer
 */

#ifndef SDF_GLSL
#define SDF_GLSL

#include "utils.glsl"

// ===== PRIMITIVE SHAPES =====

/**
 * Sphere SDF - Most basic primitive
 */
float sdSphere(vec3 p, float radius) {
    return length(p) - radius;
}

/**
 * Box SDF - Useful for boundaries and structures
 */
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

/**
 * Rounded Box SDF - Softer version of box
 */
float sdRoundBox(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

/**
 * Torus SDF - Ring shape
 */
float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

/**
 * Cylinder SDF - Infinite cylinder along Y axis
 */
float sdCylinder(vec3 p, float r) {
    return length(p.xz) - r;
}

/**
 * Capped Cylinder SDF - Finite cylinder
 */
float sdCappedCylinder(vec3 p, float h, float r) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

/**
 * Cone SDF - Cone with tip at origin
 */
float sdCone(vec3 p, vec2 c, float h) {
    // c is the sin/cos of the angle, h is height
    vec2 q = h * vec2(c.x / c.y, -1.0);
    
    vec2 w = vec2(length(p.xz), p.y);
    vec2 a = w - q * clamp(dot(w, q) / dot(q, q), 0.0, 1.0);
    vec2 b = w - q * vec2(clamp(w.x / q.x, 0.0, 1.0), 1.0);
    float k = sign(q.y);
    float d = min(dot(a, a), dot(b, b));
    float s = max(k * (w.x * q.y - w.y * q.x), k * (w.y - q.y));
    return sqrt(d) * sign(s);
}

/**
 * Plane SDF - Infinite plane
 */
float sdPlane(vec3 p, vec3 n, float h) {
    // n must be normalized
    return dot(p, n) + h;
}

/**
 * Capsule SDF - Line segment with rounded caps
 */
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

/**
 * Ellipsoid SDF - Stretched sphere
 */
float sdEllipsoid(vec3 p, vec3 r) {
    float k0 = length(p / r);
    float k1 = length(p / (r * r));
    return k0 < 1.0 ? (k0 - 1.0) * min(min(r.x, r.y), r.z) : k0 * (k0 - 1.0) / k1;
}

/**
 * Octahedron SDF - 8-sided polyhedron
 */
float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    return (p.x + p.y + p.z - s) * 0.57735027;
}

/**
 * Hexagonal Prism SDF
 */
float sdHexPrism(vec3 p, vec2 h) {
    const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
    p = abs(p);
    p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
    vec2 d = vec2(
        length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x),
        p.z - h.y
    );
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// ===== BOOLEAN OPERATIONS =====

/**
 * Union - Combines two SDFs
 */
float opUnion(float d1, float d2) {
    return min(d1, d2);
}

/**
 * Subtraction - Subtracts d2 from d1
 */
float opSubtraction(float d1, float d2) {
    return max(-d1, d2);
}

/**
 * Intersection - Intersection of two SDFs
 */
float opIntersection(float d1, float d2) {
    return max(d1, d2);
}

/**
 * Smooth Union - Smooth blending of two SDFs
 */
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

/**
 * Smooth Subtraction - Smooth subtraction
 */
float opSmoothSubtraction(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d2, -d1, h) + k * h * (1.0 - h);
}

/**
 * Smooth Intersection - Smooth intersection
 */
float opSmoothIntersection(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
}

/**
 * Exponential Smooth Union - More organic blending
 */
float opExpSmoothUnion(float a, float b, float k) {
    float res = exp2(-k * a) + exp2(-k * b);
    return -log2(res) / k;
}

/**
 * Polynomial Smooth Union - Different blending curve
 */
float opPolySmoothUnion(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// ===== TRANSFORMATIONS =====

/**
 * Translation - Move SDF in space
 */
vec3 opTranslate(vec3 p, vec3 offset) {
    return p - offset;
}

/**
 * Rotation around X axis
 */
vec3 opRotateX(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    mat3 m = mat3(1.0, 0.0, 0.0,
                  0.0, c, -s,
                  0.0, s, c);
    return m * p;
}

/**
 * Rotation around Y axis
 */
vec3 opRotateY(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    mat3 m = mat3(c, 0.0, s,
                  0.0, 1.0, 0.0,
                  -s, 0.0, c);
    return m * p;
}

/**
 * Rotation around Z axis
 */
vec3 opRotateZ(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    mat3 m = mat3(c, -s, 0.0,
                  s, c, 0.0,
                  0.0, 0.0, 1.0);
    return m * p;
}

/**
 * Scale transformation
 */
vec3 opScale(vec3 p, float s) {
    return p / s;
}

/**
 * Non-uniform scale
 */
vec3 opScale(vec3 p, vec3 s) {
    return p / s;
}

// ===== DOMAIN OPERATIONS =====

/**
 * Repetition - Create infinite copies
 */
vec3 opRepeat(vec3 p, vec3 c) {
    return mod(p + 0.5 * c, c) - 0.5 * c;
}

/**
 * Limited Repetition - Finite number of copies
 */
vec3 opLimitedRepeat(vec3 p, float c, vec3 l) {
    vec3 q = p - c * clamp(round(p / c), -l, l);
    return q;
}

/**
 * Polar Repetition - Circular repetition around Y axis
 */
vec3 opPolarRepeat(vec3 p, float repetitions) {
    float angle = 2.0 * PI / repetitions;
    float a = atan(p.x, p.z) + angle * 0.5;
    float r = length(p.xz);
    float c = floor(a / angle);
    a = mod(a, angle) - angle * 0.5;
    return vec3(cos(a) * r, p.y, sin(a) * r);
}

/**
 * Twist transformation - Twisted along Y axis
 */
vec3 opTwist(vec3 p, float k) {
    float c = cos(k * p.y);
    float s = sin(k * p.y);
    mat2 m = mat2(c, -s, s, c);
    return vec3(m * p.xz, p.y);
}

/**
 * Bend transformation - Bend along Y axis
 */
vec3 opBend(vec3 p, float k) {
    float c = cos(k * p.x);
    float s = sin(k * p.x);
    mat2 m = mat2(c, -s, s, c);
    return vec3(m * p.xy, p.z);
}

// ===== DISPLACEMENT AND MODULATION =====

/**
 * Displacement - Add noise-based displacement
 */
float opDisplace(vec3 p, float d, float scale) {
    // Requires noise function to be available
    return d + sin(scale * p.x) * sin(scale * p.y) * sin(scale * p.z) * 0.25;
}

/**
 * Onion - Create concentric shells
 */
float opOnion(float sdf, float thickness) {
    return abs(sdf) - thickness;
}

/**
 * Elongation - Stretch shape along axis
 */
float opElongate(vec3 p, vec3 h, float(*primitive)(vec3)) {
    vec3 q = abs(p) - h;
    return primitive(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

/**
 * Round - Add rounding to any SDF
 */
float opRound(float d, float rad) {
    return d - rad;
}

// ===== COMPLEX SHAPES FOR MUSIC VISUALIZER =====

/**
 * Metaball - Single influence sphere for metaball system
 */
float sdMetaball(vec3 p, vec3 center, float radius, float strength) {
    float dist = length(p - center);
    return strength / (dist * dist + 0.01) - radius;
}

/**
 * Blob - Combination of multiple metaballs
 */
float sdBlob(vec3 p, vec3 centers[8], float radii[8], float strengths[8], int count) {
    float result = 0.0;
    for (int i = 0; i < count && i < 8; i++) {
        result += sdMetaball(p, centers[i], radii[i], strengths[i]);
    }
    return result - 1.0; // Threshold for surface
}

/**
 * Organic Sphere - Sphere with noise-based surface displacement
 */
float sdOrganicSphere(vec3 p, float radius, float time, float noiseScale, float displacement) {
    float sphere = sdSphere(p, radius);
    
    // Add organic displacement using sine waves (simplified noise)
    float noise = sin(p.x * noiseScale + time) * 
                  sin(p.y * noiseScale + time * 1.1) * 
                  sin(p.z * noiseScale + time * 0.9);
    
    return sphere + noise * displacement;
}

/**
 * Flowing Shape - Shape that morphs over time
 */
float sdFlowingShape(vec3 p, float time, float flow) {
    vec3 twisted = opTwist(p, sin(time * 0.5) * flow);
    float sphere1 = sdSphere(twisted + vec3(sin(time) * 0.5, 0.0, 0.0), 1.0);
    float sphere2 = sdSphere(twisted + vec3(-sin(time) * 0.5, 0.0, 0.0), 0.8);
    return opSmoothUnion(sphere1, sphere2, 0.3);
}

/**
 * Audio Reactive Blob - Blob that responds to audio frequencies
 */
float sdAudioBlob(vec3 p, float bassLevel, float midLevel, float trebleLevel, float time) {
    // Base sphere influenced by bass
    float baseRadius = 1.0 + bassLevel * 0.5;
    float baseSphere = sdSphere(p, baseRadius);
    
    // Mid-frequency modulation
    vec3 midP = p + vec3(sin(time * 2.0 + p.y * 3.0) * midLevel * 0.2,
                         cos(time * 1.5 + p.x * 2.0) * midLevel * 0.2,
                         sin(time * 1.8 + p.z * 2.5) * midLevel * 0.2);
    
    // High-frequency surface detail
    float detail = sin(p.x * 8.0 + time * 4.0) * 
                   sin(p.y * 8.0 + time * 3.0) * 
                   sin(p.z * 8.0 + time * 5.0) * 
                   trebleLevel * 0.1;
    
    return sdSphere(midP, baseRadius) + detail;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Calculate normal vector for SDF (for lighting)
 */
vec3 calcNormal(vec3 p, float(*sdf)(vec3)) {
    const float h = 0.001;
    const vec2 k = vec2(1, -1);
    return normalize(k.xyy * sdf(p + k.xyy * h) +
                     k.yyx * sdf(p + k.yyx * h) +
                     k.yxy * sdf(p + k.yxy * h) +
                     k.xxx * sdf(p + k.xxx * h));
}

/**
 * Raymarching step - March along ray to find surface
 */
float rayMarch(vec3 ro, vec3 rd, float maxDist, int maxSteps, float(*scene)(vec3)) {
    float t = 0.0;
    for (int i = 0; i < maxSteps; i++) {
        vec3 p = ro + rd * t;
        float d = scene(p);
        if (d < 0.001 || t > maxDist) break;
        t += d;
    }
    return t;
}

/**
 * Soft Shadow calculation using SDF
 */
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k, float(*scene)(vec3)) {
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 64; i++) {
        float h = scene(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += h;
        if (t > maxt) break;
    }
    return res;
}

/**
 * Ambient Occlusion calculation
 */
float ambientOcclusion(vec3 p, vec3 n, float(*scene)(vec3)) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = scene(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

// ===== SPECIALIZED SDF COMBINATIONS FOR MATERIALS =====

/**
 * Liquid Metal Shape - Flowing metallic form
 */
float sdLiquidMetal(vec3 p, float time, float flow) {
    vec3 q = opTwist(p, sin(time * 0.3) * flow * 0.5);
    float sphere1 = sdSphere(q, 1.0);
    float sphere2 = sdSphere(q + vec3(0.0, sin(time) * 0.8, 0.0), 0.6);
    float sphere3 = sdSphere(q + vec3(sin(time * 1.2) * 0.6, 0.0, cos(time * 0.8) * 0.6), 0.4);
    
    float base = opSmoothUnion(sphere1, sphere2, 0.4);
    return opSmoothUnion(base, sphere3, 0.3);
}

/**
 * Fire Shape - Flame-like form
 */
float sdFire(vec3 p, float time, float intensity) {
    // Taper toward top
    float taper = 1.0 - smoothstep(-1.0, 2.0, p.y);
    
    // Rising motion with turbulence
    vec3 q = p + vec3(sin(time * 2.0 + p.y * 1.5) * 0.3,
                      -time * 1.5,
                      cos(time * 1.8 + p.y * 2.0) * 0.2) * intensity;
    
    float flame = sdCone(q, vec2(sin(PI * 0.25), cos(PI * 0.25)), 2.0) * taper;
    
    // Add flickering detail
    float flicker = sin(p.x * 4.0 + time * 6.0) * 
                    sin(p.z * 3.0 + time * 5.0) * 
                    intensity * 0.1 * taper;
    
    return flame + flicker;
}

/**
 * Water Droplet Shape - Surface tension simulation
 */
float sdWaterDrop(vec3 p, float time, float surface_tension) {
    // Oscillating droplet shape
    float osc = sin(time * 3.0) * surface_tension * 0.1;
    vec3 q = opScale(p, 1.0 + osc);
    
    // Main droplet body
    float drop = sdEllipsoid(q, vec3(0.8, 1.0 + osc * 2.0, 0.8));
    
    // Add surface ripples
    float ripple = sin(length(p.xz) * 8.0 - time * 4.0) * surface_tension * 0.05;
    
    return drop + ripple;
}

#endif // SDF_GLSL