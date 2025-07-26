/**
 * Mathematical Utilities
 * Provides comprehensive mathematical functions for 3D graphics, audio analysis,
 * and physics calculations for the advanced GLSL music visualizer
 */

import { mat4, vec3, vec4, quat } from 'gl-matrix';

export class MathUtils {
    // Mathematical constants
    static PI = Math.PI;
    static TWO_PI = Math.PI * 2;
    static HALF_PI = Math.PI * 0.5;
    static DEG_TO_RAD = Math.PI / 180;
    static RAD_TO_DEG = 180 / Math.PI;
    static EPSILON = 1e-6;
    static GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
    
    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    
    /**
     * Linear interpolation between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    /**
     * Smooth step interpolation (cubic Hermite)
     * @param {number} edge0 - Lower edge
     * @param {number} edge1 - Upper edge
     * @param {number} x - Input value
     * @returns {number} Smoothed value
     */
    static smoothstep(edge0, edge1, x) {
        const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    }
    
    /**
     * Smoother step interpolation (quintic)
     * @param {number} edge0 - Lower edge
     * @param {number} edge1 - Upper edge
     * @param {number} x - Input value
     * @returns {number} Smoothed value
     */
    static smootherstep(edge0, edge1, x) {
        const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    /**
     * Map a value from one range to another
     * @param {number} value - Input value
     * @param {number} inMin - Input range minimum
     * @param {number} inMax - Input range maximum
     * @param {number} outMin - Output range minimum
     * @param {number} outMax - Output range maximum
     * @returns {number} Mapped value
     */
    static map(value, inMin, inMax, outMin, outMax) {
        return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
    }
    
    /**
     * Normalize a value to 0-1 range
     * @param {number} value - Input value
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Normalized value
     */
    static normalize(value, min, max) {
        return (value - min) / (max - min);
    }
    
    /**
     * Wrap a value within a range
     * @param {number} value - Input value
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Wrapped value
     */
    static wrap(value, min, max) {
        const range = max - min;
        return ((value - min) % range + range) % range + min;
    }
    
    /**
     * Check if two values are approximately equal
     * @param {number} a - First value
     * @param {number} b - Second value
     * @param {number} epsilon - Tolerance
     * @returns {boolean} True if approximately equal
     */
    static approximately(a, b, epsilon = this.EPSILON) {
        return Math.abs(a - b) < epsilon;
    }
    
    /**
     * Sign function that returns -1, 0, or 1
     * @param {number} value - Input value
     * @returns {number} Sign of the value
     */
    static sign(value) {
        return value > 0 ? 1 : value < 0 ? -1 : 0;
    }
    
    /**
     * Fractional part of a number
     * @param {number} value - Input value
     * @returns {number} Fractional part
     */
    static fract(value) {
        return value - Math.floor(value);
    }
    
    /**
     * Step function
     * @param {number} edge - Edge value
     * @param {number} x - Input value
     * @returns {number} 0 if x < edge, 1 otherwise
     */
    static step(edge, x) {
        return x < edge ? 0 : 1;
    }
    
    /**
     * Mix function (same as lerp but matches GLSL naming)
     * @param {number} x - Start value
     * @param {number} y - End value
     * @param {number} a - Mix factor
     * @returns {number} Mixed value
     */
    static mix(x, y, a) {
        return this.lerp(x, y, a);
    }
    
    // === VECTOR OPERATIONS ===
    
    /**
     * Create a 3D vector
     * @param {number} x - X component
     * @param {number} y - Y component
     * @param {number} z - Z component
     * @returns {Float32Array} 3D vector
     */
    static vec3(x = 0, y = 0, z = 0) {
        return vec3.fromValues(x, y, z);
    }
    
    /**
     * Create a 4D vector
     * @param {number} x - X component
     * @param {number} y - Y component
     * @param {number} z - Z component
     * @param {number} w - W component
     * @returns {Float32Array} 4D vector
     */
    static vec4(x = 0, y = 0, z = 0, w = 0) {
        return vec4.fromValues(x, y, z, w);
    }
    
    /**
     * Vector length (magnitude)
     * @param {Float32Array} v - Input vector
     * @returns {number} Vector length
     */
    static length(v) {
        return vec3.length(v);
    }
    
    /**
     * Vector distance between two points
     * @param {Float32Array} a - First vector
     * @param {Float32Array} b - Second vector
     * @returns {number} Distance
     */
    static distance(a, b) {
        return vec3.distance(a, b);
    }
    
    /**
     * Dot product of two vectors
     * @param {Float32Array} a - First vector
     * @param {Float32Array} b - Second vector
     * @returns {number} Dot product
     */
    static dot(a, b) {
        return vec3.dot(a, b);
    }
    
    /**
     * Cross product of two vectors
     * @param {Float32Array} a - First vector
     * @param {Float32Array} b - Second vector
     * @returns {Float32Array} Cross product vector
     */
    static cross(a, b) {
        const result = vec3.create();
        return vec3.cross(result, a, b);
    }
    
    /**
     * Normalize a vector
     * @param {Float32Array} v - Input vector
     * @returns {Float32Array} Normalized vector
     */
    static normalizeVec(v) {
        const result = vec3.create();
        return vec3.normalize(result, v);
    }
    
    /**
     * Linear interpolation between two vectors
     * @param {Float32Array} a - Start vector
     * @param {Float32Array} b - End vector
     * @param {number} t - Interpolation factor
     * @returns {Float32Array} Interpolated vector
     */
    static lerpVec(a, b, t) {
        const result = vec3.create();
        return vec3.lerp(result, a, b, t);
    }
    
    // === MATRIX OPERATIONS ===
    
    /**
     * Create a 4x4 identity matrix
     * @returns {Float32Array} Identity matrix
     */
    static mat4Identity() {
        return mat4.create();
    }
    
    /**
     * Create a perspective projection matrix
     * @param {number} fovy - Field of view in radians
     * @param {number} aspect - Aspect ratio
     * @param {number} near - Near plane distance
     * @param {number} far - Far plane distance
     * @returns {Float32Array} Perspective matrix
     */
    static perspective(fovy, aspect, near, far) {
        const result = mat4.create();
        return mat4.perspective(result, fovy, aspect, near, far);
    }
    
    /**
     * Create a look-at matrix
     * @param {Float32Array} eye - Eye position
     * @param {Float32Array} center - Look-at target
     * @param {Float32Array} up - Up vector
     * @returns {Float32Array} Look-at matrix
     */
    static lookAt(eye, center, up) {
        const result = mat4.create();
        return mat4.lookAt(result, eye, center, up);
    }
    
    /**
     * Create a translation matrix
     * @param {number} x - X translation
     * @param {number} y - Y translation
     * @param {number} z - Z translation
     * @returns {Float32Array} Translation matrix
     */
    static translate(x, y, z) {
        const result = mat4.create();
        return mat4.translate(result, result, vec3.fromValues(x, y, z));
    }
    
    /**
     * Create a rotation matrix around an axis
     * @param {number} angle - Rotation angle in radians
     * @param {Float32Array} axis - Rotation axis
     * @returns {Float32Array} Rotation matrix
     */
    static rotate(angle, axis) {
        const result = mat4.create();
        return mat4.rotate(result, result, angle, axis);
    }
    
    /**
     * Create a scale matrix
     * @param {number} x - X scale
     * @param {number} y - Y scale
     * @param {number} z - Z scale
     * @returns {Float32Array} Scale matrix
     */
    static scale(x, y, z) {
        const result = mat4.create();
        return mat4.scale(result, result, vec3.fromValues(x, y, z));
    }
    
    // === QUATERNION OPERATIONS ===
    
    /**
     * Create a quaternion from axis and angle
     * @param {Float32Array} axis - Rotation axis
     * @param {number} angle - Rotation angle in radians
     * @returns {Float32Array} Quaternion
     */
    static quatFromAxisAngle(axis, angle) {
        const result = quat.create();
        return quat.setAxisAngle(result, axis, angle);
    }
    
    /**
     * Convert quaternion to rotation matrix
     * @param {Float32Array} q - Quaternion
     * @returns {Float32Array} Rotation matrix
     */
    static quatToMat4(q) {
        const result = mat4.create();
        return mat4.fromQuat(result, q);
    }
    
    /**
     * Spherical linear interpolation between quaternions
     * @param {Float32Array} a - Start quaternion
     * @param {Float32Array} b - End quaternion
     * @param {number} t - Interpolation factor
     * @returns {Float32Array} Interpolated quaternion
     */
    static slerpQuat(a, b, t) {
        const result = quat.create();
        return quat.slerp(result, a, b, t);
    }
    
    // === NOISE AND RANDOM FUNCTIONS ===
    
    /**
     * Generate random number between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random number
     */
    static random(min = 0, max = 1) {
        return min + Math.random() * (max - min);
    }
    
    /**
     * Generate random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    static randomInt(min, max) {
        return Math.floor(this.random(min, max + 1));
    }
    
    /**
     * Generate random number with normal distribution
     * @param {number} mean - Mean value
     * @param {number} stdDev - Standard deviation
     * @returns {number} Random number with normal distribution
     */
    static randomNormal(mean = 0, stdDev = 1) {
        // Box-Muller transform
        if (this._spareNormal !== undefined) {
            const spare = this._spareNormal;
            delete this._spareNormal;
            return spare * stdDev + mean;
        }
        
        const u = Math.random();
        const v = Math.random();
        const mag = stdDev * Math.sqrt(-2 * Math.log(u));
        
        this._spareNormal = mag * Math.cos(2 * Math.PI * v);
        return mag * Math.sin(2 * Math.PI * v) + mean;
    }
    
    /**
     * Simple 1D noise function (based on sine)
     * @param {number} x - Input value
     * @returns {number} Noise value between -1 and 1
     */
    static noise1D(x) {
        return Math.sin(x * 12.9898) * 43758.5453 % 1;
    }
    
    /**
     * Simple 2D noise function
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Noise value between -1 and 1
     */
    static noise2D(x, y) {
        const dot = x * 12.9898 + y * 78.233;
        return Math.sin(dot) * 43758.5453 % 1;
    }
    
    // === AUDIO-SPECIFIC MATHEMATICAL FUNCTIONS ===
    
    /**
     * Convert frequency to mel scale
     * @param {number} frequency - Frequency in Hz
     * @returns {number} Mel scale value
     */
    static frequencyToMel(frequency) {
        return 2595 * Math.log10(1 + frequency / 700);
    }
    
    /**
     * Convert mel scale to frequency
     * @param {number} mel - Mel scale value
     * @returns {number} Frequency in Hz
     */
    static melToFrequency(mel) {
        return 700 * (Math.pow(10, mel / 2595) - 1);
    }
    
    /**
     * Convert amplitude to decibels
     * @param {number} amplitude - Linear amplitude
     * @returns {number} Decibel value
     */
    static amplitudeToDb(amplitude) {
        return 20 * Math.log10(Math.max(amplitude, this.EPSILON));
    }
    
    /**
     * Convert decibels to amplitude
     * @param {number} db - Decibel value
     * @returns {number} Linear amplitude
     */
    static dbToAmplitude(db) {
        return Math.pow(10, db / 20);
    }
    
    /**
     * Apply exponential smoothing to a value
     * @param {number} current - Current value
     * @param {number} target - Target value
     * @param {number} smoothing - Smoothing factor (0-1)
     * @returns {number} Smoothed value
     */
    static exponentialSmoothing(current, target, smoothing) {
        return current + (target - current) * smoothing;
    }
    
    /**
     * Calculate RMS (Root Mean Square) of an array
     * @param {Float32Array|Array} values - Array of values
     * @returns {number} RMS value
     */
    static rms(values) {
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
            sum += values[i] * values[i];
        }
        return Math.sqrt(sum / values.length);
    }
    
    /**
     * Apply windowing function (Hann window)
     * @param {Float32Array|Array} values - Input values
     * @returns {Array} Windowed values
     */
    static hannWindow(values) {
        const result = new Array(values.length);
        const N = values.length - 1;
        
        for (let i = 0; i < values.length; i++) {
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / N));
            result[i] = values[i] * window;
        }
        
        return result;
    }
    
    // === PHYSICS AND ANIMATION HELPERS ===
    
    /**
     * Spring-damper system calculation
     * @param {number} current - Current position
     * @param {number} target - Target position
     * @param {number} velocity - Current velocity
     * @param {number} springStrength - Spring constant
     * @param {number} damping - Damping factor
     * @param {number} deltaTime - Time step
     * @returns {Object} New position and velocity
     */
    static springDamper(current, target, velocity, springStrength, damping, deltaTime) {
        const force = (target - current) * springStrength - velocity * damping;
        const newVelocity = velocity + force * deltaTime;
        const newPosition = current + newVelocity * deltaTime;
        
        return {
            position: newPosition,
            velocity: newVelocity
        };
    }
    
    /**
     * Elastic ease out function
     * @param {number} t - Time parameter (0-1)
     * @returns {number} Eased value
     */
    static easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    
    /**
     * Bounce ease out function
     * @param {number} t - Time parameter (0-1)
     * @returns {number} Eased value
     */
    static easeOutBounce(t) {
        const n1 = 7.5625;
        const d1 = 2.75;
        
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    }
    
    // === GEOMETRY HELPERS ===
    
    /**
     * Calculate barycentric coordinates
     * @param {Float32Array} p - Point
     * @param {Float32Array} a - Triangle vertex A
     * @param {Float32Array} b - Triangle vertex B
     * @param {Float32Array} c - Triangle vertex C
     * @returns {Float32Array} Barycentric coordinates
     */
    static barycentric(p, a, b, c) {
        const v0 = vec3.create();
        const v1 = vec3.create();
        const v2 = vec3.create();
        
        vec3.subtract(v0, c, a);
        vec3.subtract(v1, b, a);
        vec3.subtract(v2, p, a);
        
        const dot00 = vec3.dot(v0, v0);
        const dot01 = vec3.dot(v0, v1);
        const dot02 = vec3.dot(v0, v2);
        const dot11 = vec3.dot(v1, v1);
        const dot12 = vec3.dot(v1, v2);
        
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
        
        return vec3.fromValues(1 - u - v, v, u);
    }
    
    /**
     * Calculate sphere surface point from UV coordinates
     * @param {number} u - U coordinate (0-1)
     * @param {number} v - V coordinate (0-1)
     * @param {number} radius - Sphere radius
     * @returns {Float32Array} 3D point on sphere surface
     */
    static sphereUVToPoint(u, v, radius = 1) {
        const theta = u * this.TWO_PI;
        const phi = v * this.PI;
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        return vec3.fromValues(x, y, z);
    }
    
    /**
     * Convert Cartesian coordinates to spherical
     * @param {Float32Array} point - 3D Cartesian point
     * @returns {Float32Array} Spherical coordinates [radius, theta, phi]
     */
    static cartesianToSpherical(point) {
        const [x, y, z] = point;
        const radius = Math.sqrt(x * x + y * y + z * z);
        const theta = Math.atan2(z, x);
        const phi = Math.acos(y / radius);
        
        return vec3.fromValues(radius, theta, phi);
    }
}

// Export singleton instance for convenience
export const mathUtils = new MathUtils();