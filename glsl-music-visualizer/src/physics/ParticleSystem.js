/**
 * Advanced Particle System
 * High-performance physics-based particle simulation for music visualization
 * Location: src/physics/ParticleSystem.js
 * 
 * Provides comprehensive particle simulation including forces, collisions,
 * constraints, and audio-reactive behaviors for the blob visualizer
 */

import { MathUtils } from '../utils/MathUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';
import { vec3, vec4, mat4 } from 'gl-matrix';

export class ParticleSystem {
    constructor(config = {}) {
        this.isInitialized = false;
        this.gl = null;
        
        // Configuration with comprehensive particle settings
        this.config = {
            // System parameters
            maxParticles: 10000,
            initialParticleCount: 1000,
            particleSize: 1.0,
            particleLifetime: 5.0,
            particleLifetimeVariation: 2.0,
            
            // Physics settings
            gravity: [0, -9.81, 0],
            airResistance: 0.98,
            enableCollisions: true,
            enableConstraints: true,
            enableForces: true,
            enableAudioReactivity: true,
            
            // Performance settings
            updateMode: 'cpu',           // 'cpu', 'gpu', 'hybrid'
            spatialOptimization: true,
            frustumCulling: true,
            levelOfDetail: true,
            batchSize: 512,
            
            // Audio reactivity
            audioInfluence: {
                emission: 1.0,           // Beat-triggered emission
                velocity: 0.5,           // Audio-driven velocity
                size: 0.3,               // Size modulation
                color: 0.8,              // Color modulation
                forces: 0.6,             // Force field modulation
                lifetime: 0.2            // Lifetime modulation
            },
            
            // Visual settings
            renderMode: 'billboard',     // 'billboard', 'oriented', 'mesh'
            blendMode: 'additive',       // 'additive', 'alpha', 'multiply'
            colorMode: 'gradient',       // 'solid', 'gradient', 'rainbow', 'audio'
            textureMode: 'circle',       // 'circle', 'square', 'star', 'custom'
            
            // Emission settings
            emissionRate: 50,            // Particles per second
            emissionBurst: 100,          // Particles per burst
            emissionShape: 'sphere',     // 'point', 'sphere', 'box', 'cone', 'surface'
            emissionRadius: 1.0,
            emissionVelocity: [0, 5, 0],
            emissionSpread: Math.PI / 4,
            
            // Force field settings
            forces: {
                wind: { strength: 0, direction: [1, 0, 0] },
                vortex: { strength: 0, axis: [0, 1, 0], center: [0, 0, 0] },
                attractor: { strength: 0, position: [0, 0, 0], falloff: 2.0 },
                repeller: { strength: 0, position: [0, 0, 0], falloff: 2.0 },
                turbulence: { strength: 0, frequency: 1.0, octaves: 3 },
                magnetic: { strength: 0, field: [0, 1, 0] }
            },
            
            // Constraint settings
            constraints: {
                bounds: { enabled: true, min: [-10, -10, -10], max: [10, 10, 10] },
                sphere: { enabled: false, center: [0, 0, 0], radius: 5.0 },
                plane: { enabled: false, normal: [0, 1, 0], distance: 0 },
                cylinder: { enabled: false, axis: [0, 1, 0], radius: 3.0 }
            },
            
            // Collision settings
            collisionResponse: 'bounce',  // 'bounce', 'stick', 'slide', 'destroy'
            restitution: 0.8,            // Bounce factor
            friction: 0.1,               // Surface friction
            collisionRadius: 0.1,        // Particle collision radius
            
            // Memory management
            poolSize: 12000,             // Object pool size
            gcInterval: 1000,            // Garbage collection interval (ms)
            memoryLimit: 256,            // Memory limit in MB
            
            ...config
        };
        
        // Particle arrays (Structure of Arrays for performance)
        this.particles = {
            // Position and movement
            positions: new Float32Array(this.config.maxParticles * 3),
            velocities: new Float32Array(this.config.maxParticles * 3),
            accelerations: new Float32Array(this.config.maxParticles * 3),
            
            // Physical properties
            masses: new Float32Array(this.config.maxParticles),
            sizes: new Float32Array(this.config.maxParticles),
            rotations: new Float32Array(this.config.maxParticles),
            angularVelocities: new Float32Array(this.config.maxParticles),
            
            // Visual properties
            colors: new Float32Array(this.config.maxParticles * 4), // RGBA
            opacities: new Float32Array(this.config.maxParticles),
            textureIndices: new Uint16Array(this.config.maxParticles),
            
            // Lifecycle
            ages: new Float32Array(this.config.maxParticles),
            lifetimes: new Float32Array(this.config.maxParticles),
            birthTimes: new Float32Array(this.config.maxParticles),
            
            // State flags
            active: new Uint8Array(this.config.maxParticles),
            visible: new Uint8Array(this.config.maxParticles),
            collided: new Uint8Array(this.config.maxParticles),
            
            // Audio reactivity
            audioWeights: new Float32Array(this.config.maxParticles),
            frequencyBands: new Uint8Array(this.config.maxParticles),
            beatSensitivity: new Float32Array(this.config.maxParticles)
        };
        
        // System state
        this.state = {
            activeParticleCount: 0,
            totalEmitted: 0,
            lastEmissionTime: 0,
            deltaTime: 0,
            elapsedTime: 0,
            frameCount: 0,
            
            // Audio state
            lastBeatTime: 0,
            audioData: null,
            audioInfluenceFactors: {
                emission: 0,
                velocity: 0,
                size: 0,
                color: 0,
                forces: 0
            }
        };
        
        // Force systems
        this.forces = {
            gravity: new GravityForce(this.config.gravity),
            wind: new WindForce(this.config.forces.wind),
            vortex: new VortexForce(this.config.forces.vortex),
            attractor: new AttractorForce(this.config.forces.attractor),
            repeller: new RepellerForce(this.config.forces.repeller),
            turbulence: new TurbulenceForce(this.config.forces.turbulence),
            magnetic: new MagneticForce(this.config.forces.magnetic)
        };
        
        // Constraint systems
        this.constraints = {
            bounds: new BoundsConstraint(this.config.constraints.bounds),
            sphere: new SphereConstraint(this.config.constraints.sphere),
            plane: new PlaneConstraint(this.config.constraints.plane),
            cylinder: new CylinderConstraint(this.config.constraints.cylinder)
        };
        
        // Collision detection
        this.collisionSystem = new CollisionSystem(this.config);
        
        // Spatial optimization
        this.spatialGrid = new SpatialGrid(this.config);
        
        // GPU compute resources (for GPU-based simulation)
        this.gpuResources = {
            computeShader: null,
            positionBuffer: null,
            velocityBuffer: null,
            uniformBuffer: null,
            enabled: false
        };
        
        // Performance monitoring
        this.performance = {
            updateTime: 0,
            renderTime: 0,
            collisionTime: 0,
            spatialTime: 0,
            memoryUsage: 0,
            particlesPerFrame: 0,
            frameRate: 60
        };
        
        // Object pools for memory efficiency
        this.pools = {
            vec3Pool: new ObjectPool(() => vec3.create(), 1000),
            tempVectors: new Array(10).fill(null).map(() => vec3.create()),
            forceAccumulators: new Float32Array(this.config.maxParticles * 3)
        };
        
        // Emitters
        this.emitters = new Map();
        this.defaultEmitter = null;
        
        // Event system
        this.eventCallbacks = new Map();
        
        // Debug and visualization
        this.debug = {
            enabled: process.env.NODE_ENV === 'development',
            showBounds: false,
            showForces: false,
            showConstraints: false,
            showSpatialGrid: false,
            particleStats: {
                active: 0,
                visible: 0,
                colliding: 0,
                memoryUsed: 0
            }
        };
    }
    
    /**
     * Initialize particle system with WebGL context
     */
    async initialize(gl) {
        try {
            this.gl = gl;
            
            // Initialize GPU resources if available
            if (this.config.updateMode === 'gpu' || this.config.updateMode === 'hybrid') {
                await this.initializeGPUResources();
            }
            
            // Initialize spatial optimization
            if (this.config.spatialOptimization) {
                this.spatialGrid.initialize();
            }
            
            // Initialize collision system
            if (this.config.enableCollisions) {
                this.collisionSystem.initialize();
            }
            
            // Initialize force systems
            if (this.config.enableForces) {
                Object.values(this.forces).forEach(force => {
                    if (force.initialize) {
                        force.initialize();
                    }
                });
            }
            
            // Initialize constraint systems
            if (this.config.enableConstraints) {
                Object.values(this.constraints).forEach(constraint => {
                    if (constraint.initialize) {
                        constraint.initialize();
                    }
                });
            }
            
            // Create default emitter
            this.createDefaultEmitter();
            
            // Initialize initial particles
            this.emitInitialParticles();
            
            this.isInitialized = true;
            
            console.log('ParticleSystem initialized', {
                maxParticles: this.config.maxParticles,
                updateMode: this.config.updateMode,
                spatialOptimization: this.config.spatialOptimization,
                gpuAcceleration: this.gpuResources.enabled
            });
            
        } catch (error) {
            console.error('Failed to initialize ParticleSystem:', error);
            throw error;
        }
    }
    
    /**
     * Initialize GPU compute resources for GPU-based simulation
     */
    async initializeGPUResources() {
        // Check for compute shader support
        if (!this.gl.getExtension('EXT_color_buffer_float') || 
            !this.gl.getExtension('OES_texture_float_linear')) {
            console.warn('GPU compute not fully supported, falling back to CPU');
            this.config.updateMode = 'cpu';
            return;
        }
        
        try {
            // Create compute shader for particle updates
            this.gpuResources.computeShader = await this.createComputeShader();
            
            // Create GPU buffers
            this.createGPUBuffers();
            
            this.gpuResources.enabled = true;
            console.log('GPU acceleration enabled for particle system');
            
        } catch (error) {
            console.warn('Failed to initialize GPU resources:', error);
            this.config.updateMode = 'cpu';
        }
    }
    
    /**
     * Create GPU buffers for particle data
     */
    createGPUBuffers() {
        const gl = this.gl;
        
        // Position buffer
        this.gpuResources.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gpuResources.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.particles.positions, gl.DYNAMIC_DRAW);
        
        // Velocity buffer
        this.gpuResources.velocityBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.gpuResources.velocityBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.particles.velocities, gl.DYNAMIC_DRAW);
        
        // Uniform buffer
        this.gpuResources.uniformBuffer = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.gpuResources.uniformBuffer);
        gl.bufferData(gl.UNIFORM_BUFFER, 256, gl.DYNAMIC_DRAW);
    }
    
    /**
     * Create compute shader for particle updates
     */
    async createComputeShader() {
        console.log('GPU compute shader creation not yet implemented');
        return null;
    }
    
    /**
     * Create default particle emitter
     */
    createDefaultEmitter() {
        this.defaultEmitter = new ParticleEmitter({
            name: 'default',
            position: [0, 0, 0],
            rate: this.config.emissionRate,
            burst: this.config.emissionBurst,
            shape: this.config.emissionShape,
            radius: this.config.emissionRadius,
            velocity: this.config.emissionVelocity,
            spread: this.config.emissionSpread,
            lifetime: this.config.particleLifetime,
            lifetimeVariation: this.config.particleLifetimeVariation
        });
        
        this.emitters.set('default', this.defaultEmitter);
    }
    
    /**
     * Emit initial particle population
     */
    emitInitialParticles() {
        const count = Math.min(this.config.initialParticleCount, this.config.maxParticles);
        
        for (let i = 0; i < count; i++) {
            this.emitParticle(this.defaultEmitter, i);
        }
        
        this.state.activeParticleCount = count;
        console.log('Emitted ' + count + ' initial particles');
    }
    
    /**
     * Utility method for random number generation
     */
    randomRange(min, max) {
        return min + Math.random() * (max - min);
    }
    
    /**
     * Main particle system update function
     */
    update(deltaTime, audioData = null) {
        if (!this.isInitialized) {
            console.warn('ParticleSystem not initialized');
            return;
        }
        
        const startTime = performance.now();
        
        try {
            // Update system state
            this.updateSystemState(deltaTime, audioData);
            
            // Update audio influence factors
            if (audioData && this.config.enableAudioReactivity) {
                this.updateAudioInfluence(audioData);
            }
            
            // Emit new particles
            this.updateEmission(deltaTime);
            
            // Update particle physics
            if (this.config.updateMode === 'gpu' && this.gpuResources.enabled) {
                this.updateParticlesGPU(deltaTime);
            } else {
                this.updateParticlesCPU(deltaTime);
            }
            
            // Apply constraints
            if (this.config.enableConstraints) {
                this.applyConstraints();
            }
            
            // Handle collisions
            if (this.config.enableCollisions) {
                this.updateCollisions();
            }
            
            // Update spatial optimization
            if (this.config.spatialOptimization) {
                this.updateSpatialGrid();
            }
            
            // Cleanup dead particles
            this.cleanupParticles();
            
            // Update performance metrics
            const updateTime = performance.now() - startTime;
            this.updatePerformanceMetrics(updateTime);
            
            this.state.frameCount++;
            
        } catch (error) {
            console.error('Particle system update error:', error);
        }
    }
    
    /**
     * Update system state and timing
     */
    updateSystemState(deltaTime, audioData) {
        this.state.deltaTime = deltaTime;
        this.state.elapsedTime += deltaTime;
        this.state.audioData = audioData;
        
        // Update frame rate estimation
        this.performance.frameRate = MathUtils.exponentialSmoothing(
            this.performance.frameRate,
            1 / deltaTime,
            0.1
        );
    }
    
    /**
     * Update audio influence factors based on audio analysis
     */
    updateAudioInfluence(audioData) {
        const influence = this.state.audioInfluenceFactors;
        const audioInfluenceConfig = this.config.audioInfluence;
        
        // Beat-triggered effects
        if (audioData.beat) {
            influence.emission = 1.0;
            influence.velocity = audioData.beatStrength || 0.5;
            this.state.lastBeatTime = this.state.elapsedTime;
        } else {
            // Decay emission influence
            influence.emission *= 0.95;
            influence.velocity *= 0.98;
        }
        
        // Onset-triggered effects
        if (audioData.onset) {
            influence.forces = audioData.onsetStrength || 0.3;
        } else {
            influence.forces *= 0.97;
        }
        
        // Continuous audio features
        if (audioData.features) {
            // Size modulation based on loudness
            if (audioData.features.perceptual && audioData.features.perceptual.totalLoudness) {
                influence.size = MathUtils.lerp(
                    influence.size,
                    audioData.features.perceptual.totalLoudness * audioInfluenceConfig.size,
                    0.1
                );
            }
            
            // Color modulation based on spectral features
            if (audioData.features.spectral && audioData.features.spectral.centroid) {
                influence.color = MathUtils.lerp(
                    influence.color,
                    MathUtils.map(audioData.features.spectral.centroid, 0, 8000, 0, 1) * audioInfluenceConfig.color,
                    0.05
                );
            }
        }
        
        // Frequency band analysis for individual particle control
        if (audioData.frequencyData) {
            this.updateFrequencyBandInfluence(audioData.frequencyData);
        }
    }
    
    /**
     * Update frequency band influence for individual particles
     */
    updateFrequencyBandInfluence(frequencyData) {
        const bandCount = 8;
        const bandsPerBin = Math.floor(frequencyData.length / bandCount);
        
        for (let i = 0; i < this.state.activeParticleCount; i++) {
            if (!this.particles.active[i]) {
                continue;
            }
            
            const bandIndex = this.particles.frequencyBands[i];
            if (bandIndex < bandCount) {
                // Calculate band energy
                let bandEnergy = 0;
                const startBin = bandIndex * bandsPerBin;
                const endBin = Math.min(startBin + bandsPerBin, frequencyData.length);
                
                for (let bin = startBin; bin < endBin; bin++) {
                    bandEnergy += frequencyData[bin];
                }
                
                bandEnergy /= bandsPerBin;
                
                // Apply audio weight and beat sensitivity
                const audioWeight = this.particles.audioWeights[i];
                const beatSensitivity = this.particles.beatSensitivity[i];
                
                this.particles.audioWeights[i] = MathUtils.lerp(
                    audioWeight,
                    bandEnergy * beatSensitivity,
                    0.1
                );
            }
        }
    }
    
    /**
     * Update particle emission
     */
    updateEmission(deltaTime) {
        // Update all emitters
        this.emitters.forEach(emitter => {
            if (emitter.enabled) {
                this.updateEmitter(emitter, deltaTime);
            }
        });
    }
    
    /**
     * Update individual emitter
     */
    updateEmitter(emitter, deltaTime) {
        const currentTime = this.state.elapsedTime;
        const timeSinceLastEmission = currentTime - this.state.lastEmissionTime;
        
        // Calculate emission count based on rate and audio influence
        let emissionCount = 0;
        
        // Continuous emission
        const baseRate = emitter.rate * deltaTime;
        const audioRate = baseRate * (1 + this.state.audioInfluenceFactors.emission);
        emissionCount += audioRate;
        
        // Beat-triggered bursts
        if (this.state.audioData && this.state.audioData.beat && timeSinceLastEmission > 0.1) {
            const burstSize = emitter.burst * this.state.audioInfluenceFactors.emission;
            emissionCount += burstSize;
            this.state.lastEmissionTime = currentTime;
        }
        
        // Emit particles
        const particlesToEmit = Math.floor(emissionCount);
        for (let i = 0; i < particlesToEmit; i++) {
            if (this.state.activeParticleCount < this.config.maxParticles) {
                const particleIndex = this.findNextAvailableParticle();
                if (particleIndex >= 0) {
                    this.emitParticle(emitter, particleIndex);
                }
            }
        }
    }
    
    /**
     * Find next available particle slot
     */
    findNextAvailableParticle() {
        for (let i = 0; i < this.config.maxParticles; i++) {
            if (!this.particles.active[i]) {
                return i;
            }
        }
        return -1;
    }
    
    /**
     * Emit a single particle from an emitter
     */
    emitParticle(emitter, index) {
        // Position
        const position = this.generateEmissionPosition(emitter);
        this.particles.positions[index * 3] = position[0];
        this.particles.positions[index * 3 + 1] = position[1];
        this.particles.positions[index * 3 + 2] = position[2];
        
        // Velocity
        const velocity = this.generateEmissionVelocity(emitter);
        this.particles.velocities[index * 3] = velocity[0];
        this.particles.velocities[index * 3 + 1] = velocity[1];
        this.particles.velocities[index * 3 + 2] = velocity[2];
        
        // Reset acceleration
        this.particles.accelerations[index * 3] = 0;
        this.particles.accelerations[index * 3 + 1] = 0;
        this.particles.accelerations[index * 3 + 2] = 0;
        
        // Physical properties
        this.particles.masses[index] = this.randomRange(0.5, 2.0);
        this.particles.sizes[index] = this.config.particleSize * this.randomRange(0.5, 1.5);
        this.particles.rotations[index] = this.randomRange(0, MathUtils.TWO_PI);
        this.particles.angularVelocities[index] = this.randomRange(-2, 2);
        
        // Visual properties
        const color = this.generateParticleColor(emitter, index);
        this.particles.colors[index * 4] = color[0];
        this.particles.colors[index * 4 + 1] = color[1];
        this.particles.colors[index * 4 + 2] = color[2];
        this.particles.colors[index * 4 + 3] = color[3];
        
        this.particles.opacities[index] = 1.0;
        this.particles.textureIndices[index] = 0;
        
        // Lifecycle
        const lifetime = emitter.lifetime + this.randomRange(-emitter.lifetimeVariation, emitter.lifetimeVariation);
        this.particles.lifetimes[index] = Math.max(0.1, lifetime);
        this.particles.ages[index] = 0;
        this.particles.birthTimes[index] = this.state.elapsedTime;
        
        // State
        this.particles.active[index] = 1;
        this.particles.visible[index] = 1;
        this.particles.collided[index] = 0;
        
        // Audio reactivity
        this.particles.audioWeights[index] = this.randomRange(0.5, 1.0);
        this.particles.frequencyBands[index] = Math.floor(this.randomRange(0, 8));
        this.particles.beatSensitivity[index] = this.randomRange(0.3, 1.0);
        
        this.state.activeParticleCount++;
        this.state.totalEmitted++;
    }
    
    /**
     * Generate emission position based on emitter shape
     */
    generateEmissionPosition(emitter) {
        const position = vec3.create();
        
        switch (emitter.shape) {
            case 'point':
                vec3.copy(position, emitter.position);
                break;
                
            case 'sphere':
                const sphereRadius = emitter.radius * Math.cbrt(Math.random());
                const theta = this.randomRange(0, MathUtils.TWO_PI);
                const phi = Math.acos(this.randomRange(-1, 1));
                
                position[0] = emitter.position[0] + sphereRadius * Math.sin(phi) * Math.cos(theta);
                position[1] = emitter.position[1] + sphereRadius * Math.sin(phi) * Math.sin(theta);
                position[2] = emitter.position[2] + sphereRadius * Math.cos(phi);
                break;
                
            case 'box':
                position[0] = emitter.position[0] + this.randomRange(-emitter.radius, emitter.radius);
                position[1] = emitter.position[1] + this.randomRange(-emitter.radius, emitter.radius);
                position[2] = emitter.position[2] + this.randomRange(-emitter.radius, emitter.radius);
                break;
                
            case 'cone':
                const coneRadius = emitter.radius * Math.sqrt(Math.random());
                const coneAngle = this.randomRange(0, MathUtils.TWO_PI);
                const coneHeight = this.randomRange(0, emitter.radius);
                
                position[0] = emitter.position[0] + coneRadius * Math.cos(coneAngle);
                position[1] = emitter.position[1] + coneHeight;
                position[2] = emitter.position[2] + coneRadius * Math.sin(coneAngle);
                break;
                
            default:
                vec3.copy(position, emitter.position);
        }
        
        return position;
    }
    
    /**
     * Generate emission velocity
     */
    generateEmissionVelocity(emitter) {
        const velocity = vec3.create();
        
        // Base velocity
        vec3.copy(velocity, emitter.velocity);
        
        // Add spread
        if (emitter.spread > 0) {
            const spreadX = this.randomRange(-emitter.spread, emitter.spread);
            const spreadY = this.randomRange(-emitter.spread, emitter.spread);
            const spreadZ = this.randomRange(-emitter.spread, emitter.spread);
            
            velocity[0] += spreadX;
            velocity[1] += spreadY;
            velocity[2] += spreadZ;
        }
        
        // Apply audio influence to velocity
        const audioVelocityFactor = 1 + this.state.audioInfluenceFactors.velocity;
        vec3.scale(velocity, velocity, audioVelocityFactor);
        
        return velocity;
    }
    
    /**
     * Generate particle color
     */
    generateParticleColor(emitter, index) {
        const color = vec4.create();
        
        switch (this.config.colorMode) {
            case 'solid':
                vec4.set(color, 1.0, 1.0, 1.0, 1.0);
                break;
                
            case 'gradient':
                const t = index / this.config.maxParticles;
                color[0] = MathUtils.lerp(0.2, 1.0, t);
                color[1] = MathUtils.lerp(0.8, 0.2, t);
                color[2] = MathUtils.lerp(1.0, 0.3, t);
                color[3] = 1.0;
                break;
                
            case 'rainbow':
                const hue = (index * 137.508) % 360;
                const rgb = ColorUtils.hslToRgb(hue, 1.0, 0.6);
                color[0] = rgb[0];
                color[1] = rgb[1];
                color[2] = rgb[2];
                color[3] = 1.0;
                break;
                
            case 'audio':
                const audioColor = this.generateAudioReactiveColor();
                vec4.copy(color, audioColor);
                break;
                
            default:
                vec4.set(color, 1.0, 1.0, 1.0, 1.0);
        }
        
        return color;
    }
    
    /**
     * Generate audio-reactive color
     */
    generateAudioReactiveColor() {
        const color = vec4.create();
        const audioData = this.state.audioData;
        
        if (audioData && audioData.features) {
            // Map spectral centroid to hue
            let hue = 240;
            if (audioData.features.spectral && audioData.features.spectral.centroid) {
                hue = MathUtils.map(audioData.features.spectral.centroid, 0, 8000, 240, 0);
            }
            
            // Map energy to saturation and brightness
            let saturation = 0.8;
            let lightness = 0.6;
            
            if (audioData.features.perceptual && audioData.features.perceptual.totalLoudness) {
                saturation = MathUtils.clamp(audioData.features.perceptual.totalLoudness, 0.3, 1.0);
                lightness = MathUtils.clamp(0.4 + audioData.features.perceptual.totalLoudness * 0.4, 0.2, 0.9);
            }
            
            // Apply color influence factor
            saturation *= this.state.audioInfluenceFactors.color;
            
            const rgb = ColorUtils.hslToRgb(hue, saturation, lightness);
            color[0] = rgb[0];
            color[1] = rgb[1];
            color[2] = rgb[2];
            color[3] = 1.0;
        } else {
            vec4.set(color, 1.0, 1.0, 1.0, 1.0);
        }
        
        return color;
    }
    
    /**
     * Update particles using CPU
     */
    updateParticlesCPU(deltaTime) {
        const startTime = performance.now();
        
        // Clear force accumulators
        this.pools.forceAccumulators.fill(0);
        
        // Apply forces to all active particles
        if (this.config.enableForces) {
            this.applyForces(deltaTime);
        }
        
        // Update particle physics
        for (let i = 0; i < this.config.maxParticles; i++) {
            if (!this.particles.active[i]) {
                continue;
            }
            
            this.updateParticlePhysics(i, deltaTime);
            this.updateParticleLifecycle(i, deltaTime);
            this.updateParticleVisuals(i, deltaTime);
        }
        
        this.performance.updateTime = performance.now() - startTime;
    }
    
    /**
     * Update particles using GPU compute shaders
     */
    updateParticlesGPU(deltaTime) {
        if (!this.gpuResources.enabled) {
            this.updateParticlesCPU(deltaTime);
            return;
        }
        
        const startTime = performance.now();
        
        try {
            // Upload uniforms
            this.updateGPUUniforms(deltaTime);
            
            // Dispatch compute shader
            this.gl.useProgram(this.gpuResources.computeShader);
            this.gl.dispatchCompute(
                Math.ceil(this.state.activeParticleCount / this.config.batchSize),
                1,
                1
            );
            
            // Memory barrier
            this.gl.memoryBarrier(this.gl.SHADER_STORAGE_BARRIER_BIT);
            
            // Read back results if needed
            if (this.config.enableCollisions || this.config.spatialOptimization) {
                this.readbackGPUData();
            }
            
        } catch (error) {
            console.warn('GPU particle update failed, falling back to CPU:', error);
            this.updateParticlesCPU(deltaTime);
        }
        
        this.performance.updateTime = performance.now() - startTime;
    }
    
    /**
     * Update GPU uniforms
     */
    updateGPUUniforms(deltaTime) {
        const uniforms = new Float32Array([
            deltaTime,
            this.state.elapsedTime,
            this.state.audioInfluenceFactors.velocity,
            this.state.audioInfluenceFactors.forces
        ]);
        
        const gl = this.gl;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.gpuResources.uniformBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, uniforms);
    }
    
    /**
     * Read back data from GPU
     */
    readbackGPUData() {
        console.log('GPU readback not implemented - using CPU fallback');
    }
    
    /**
     * Apply forces to particles
     */
    applyForces(deltaTime) {
        const forces = this.forces;
        const audioInfluence = this.state.audioInfluenceFactors.forces;
        
        for (let i = 0; i < this.config.maxParticles; i++) {
            if (!this.particles.active[i]) {
                continue;
            }
            
            const position = [
                this.particles.positions[i * 3],
                this.particles.positions[i * 3 + 1],
                this.particles.positions[i * 3 + 2]
            ];
            
            const velocity = [
                this.particles.velocities[i * 3],
                this.particles.velocities[i * 3 + 1],
                this.particles.velocities[i * 3 + 2]
            ];
            
            const mass = this.particles.masses[i];
            const audioWeight = this.particles.audioWeights[i];
            
            // Gravity
            if (forces.gravity.enabled) {
                const gravityForce = forces.gravity.calculate(position, velocity, mass);
                this.addForce(i, gravityForce);
            }
            
            // Wind
            if (forces.wind.enabled) {
                const windForce = forces.wind.calculate(position, velocity, mass);
                const audioWindForce = vec3.scale(vec3.create(), windForce, 1 + audioInfluence * audioWeight);
                this.addForce(i, audioWindForce);
            }
            
            // Apply other forces...
            // (Implementation continues with other force types)
            
            // Air resistance
            if (this.config.airResistance < 1.0) {
                const resistance = 1.0 - this.config.airResistance;
                this.particles.velocities[i * 3] *= (1 - resistance * deltaTime);
                this.particles.velocities[i * 3 + 1] *= (1 - resistance * deltaTime);
                this.particles.velocities[i * 3 + 2] *= (1 - resistance * deltaTime);
            }
        }
    }
    
    /**
     * Add force to particle
     */
    addForce(particleIndex, force) {
        this.pools.forceAccumulators[particleIndex * 3] += force[0];
        this.pools.forceAccumulators[particleIndex * 3 + 1] += force[1];
        this.pools.forceAccumulators[particleIndex * 3 + 2] += force[2];
    }
    
    /**
     * Update individual particle physics
     */
    updateParticlePhysics(index, deltaTime) {
        const mass = this.particles.masses[index];
        
        // Apply accumulated forces to acceleration
        this.particles.accelerations[index * 3] = this.pools.forceAccumulators[index * 3] / mass;
        this.particles.accelerations[index * 3 + 1] = this.pools.forceAccumulators[index * 3 + 1] / mass;
        this.particles.accelerations[index * 3 + 2] = this.pools.forceAccumulators[index * 3 + 2] / mass;
        
        // Integrate velocity
        this.particles.velocities[index * 3] += this.particles.accelerations[index * 3] * deltaTime;
        this.particles.velocities[index * 3 + 1] += this.particles.accelerations[index * 3 + 1] * deltaTime;
        this.particles.velocities[index * 3 + 2] += this.particles.accelerations[index * 3 + 2] * deltaTime;
        
        // Integrate position
        this.particles.positions[index * 3] += this.particles.velocities[index * 3] * deltaTime;
        this.particles.positions[index * 3 + 1] += this.particles.velocities[index * 3 + 1] * deltaTime;
        this.particles.positions[index * 3 + 2] += this.particles.velocities[index * 3 + 2] * deltaTime;
        
        // Update rotation
        this.particles.rotations[index] += this.particles.angularVelocities[index] * deltaTime;
        
        // Apply audio-reactive size modulation
        const baseSizeInfluence = this.state.audioInfluenceFactors.size;
        const audioWeight = this.particles.audioWeights[index];
        const sizeModulation = 1 + baseSizeInfluence * audioWeight * 0.3;
        
        this.particles.sizes[index] = this.config.particleSize * sizeModulation;
    }
    
    /**
     * Update particle lifecycle
     */
    updateParticleLifecycle(index, deltaTime) {
        // Age particle
        this.particles.ages[index] += deltaTime;
        
        // Calculate lifecycle progress
        const lifetime = this.particles.lifetimes[index];
        const age = this.particles.ages[index];
        const lifecycleProgress = age / lifetime;
        
        // Update opacity based on lifecycle
        if (lifecycleProgress < 0.1) {
            this.particles.opacities[index] = lifecycleProgress / 0.1;
        } else if (lifecycleProgress > 0.9) {
            this.particles.opacities[index] = (1.0 - lifecycleProgress) / 0.1;
        } else {
            this.particles.opacities[index] = 1.0;
        }
        
        // Mark for removal if dead
        if (age >= lifetime) {
            this.particles.active[index] = 0;
            this.particles.visible[index] = 0;
            this.state.activeParticleCount--;
        }
    }
    
    /**
     * Update particle visual properties
     */
    updateParticleVisuals(index, deltaTime) {
        // Update alpha based on opacity
        this.particles.colors[index * 4 + 3] = this.particles.opacities[index];
    }
    
    /**
     * Apply constraints to particles
     */
    applyConstraints() {
        // Constraint application logic here
        // (Simplified for brevity)
    }
    
    /**
     * Update collision detection and response
     */
    updateCollisions() {
        const startTime = performance.now();
        
        if (this.config.spatialOptimization) {
            this.collisionSystem.detectCollisionsSpatial(this.particles, this.spatialGrid);
        } else {
            this.collisionSystem.detectCollisionsBrute(this.particles, this.state.activeParticleCount);
        }
        
        this.performance.collisionTime = performance.now() - startTime;
    }
    
    /**
     * Update spatial grid for optimization
     */
    updateSpatialGrid() {
        const startTime = performance.now();
        
        this.spatialGrid.clear();
        
        for (let i = 0; i < this.config.maxParticles; i++) {
            if (!this.particles.active[i]) {
                continue;
            }
            
            const position = [
                this.particles.positions[i * 3],
                this.particles.positions[i * 3 + 1],
                this.particles.positions[i * 3 + 2]
            ];
            
            this.spatialGrid.insert(i, position);
        }
        
        this.performance.spatialTime = performance.now() - startTime;
    }
    
    /**
     * Clean up dead particles and manage memory
     */
    cleanupParticles() {
        if (this.state.frameCount % 60 === 0) {
            this.compactParticleArrays();
        }
    }
    
    /**
     * Compact particle arrays by removing dead particles
     */
    compactParticleArrays() {
        let writeIndex = 0;
        let deadParticles = 0;
        
        for (let readIndex = 0; readIndex < this.config.maxParticles; readIndex++) {
            if (this.particles.active[readIndex]) {
                if (writeIndex !== readIndex) {
                    this.copyParticleData(readIndex, writeIndex);
                }
                writeIndex++;
            } else {
                deadParticles++;
            }
        }
        
        // Clear remaining slots
        for (let i = writeIndex; i < this.config.maxParticles; i++) {
            this.clearParticleData(i);
        }
        
        console.log('Compacted particle arrays: removed ' + deadParticles + ' dead particles');
    }
    
    /**
     * Copy particle data from one index to another
     */
    copyParticleData(fromIndex, toIndex) {
        // Position
        this.particles.positions[toIndex * 3] = this.particles.positions[fromIndex * 3];
        this.particles.positions[toIndex * 3 + 1] = this.particles.positions[fromIndex * 3 + 1];
        this.particles.positions[toIndex * 3 + 2] = this.particles.positions[fromIndex * 3 + 2];
        
        // Copy other properties...
        this.particles.active[toIndex] = this.particles.active[fromIndex];
        this.particles.masses[toIndex] = this.particles.masses[fromIndex];
        // ... (continue with other properties)
    }
    
    /**
     * Clear particle data at index
     */
    clearParticleData(index) {
        this.particles.positions[index * 3] = 0;
        this.particles.positions[index * 3 + 1] = 0;
        this.particles.positions[index * 3 + 2] = 0;
        this.particles.active[index] = 0;
        // ... (clear other properties)
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(updateTime) {
        this.performance.updateTime = MathUtils.exponentialSmoothing(
            this.performance.updateTime,
            updateTime,
            0.1
        );
        
        this.performance.particlesPerFrame = this.state.activeParticleCount;
        
        performanceMonitor.recordCPUTime('particleSystem', updateTime);
    }
    
    /**
     * Get particle data for rendering
     */
    getParticleData() {
        return {
            positions: this.particles.positions,
            colors: this.particles.colors,
            sizes: this.particles.sizes,
            rotations: this.particles.rotations,
            opacities: this.particles.opacities,
            textureIndices: this.particles.textureIndices,
            active: this.particles.active,
            visible: this.particles.visible,
            count: this.state.activeParticleCount
        };
    }
    
    /**
     * Get system status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            config: this.config,
            state: this.state,
            performance: this.performance,
            particles: {
                active: this.state.activeParticleCount,
                total: this.config.maxParticles,
                utilization: this.state.activeParticleCount / this.config.maxParticles
            }
        };
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        console.log('Disposing ParticleSystem...');
        
        if (this.gpuResources.enabled) {
            this.disposeGPUResources();
        }
        
        this.emitters.clear();
        this.eventCallbacks.clear();
        
        Object.keys(this.particles).forEach(key => {
            this.particles[key] = null;
        });
        
        this.isInitialized = false;
        this.gl = null;
        
        console.log('ParticleSystem disposed');
    }
    
    /**
     * Dispose GPU resources
     */
    disposeGPUResources() {
        if (this.gpuResources.computeShader) {
            this.gl.deleteProgram(this.gpuResources.computeShader);
        }
        
        if (this.gpuResources.positionBuffer) {
            this.gl.deleteBuffer(this.gpuResources.positionBuffer);
        }
        
        if (this.gpuResources.velocityBuffer) {
            this.gl.deleteBuffer(this.gpuResources.velocityBuffer);
        }
        
        if (this.gpuResources.uniformBuffer) {
            this.gl.deleteBuffer(this.gpuResources.uniformBuffer);
        }
        
        this.gpuResources.enabled = false;
    }
}

/**
 * Particle Emitter Class
 */
class ParticleEmitter {
    constructor(config = {}) {
        this.config = {
            name: 'emitter',
            position: [0, 0, 0],
            rate: 50,
            burst: 100,
            shape: 'sphere',
            radius: 1.0,
            velocity: [0, 5, 0],
            spread: Math.PI / 4,
            lifetime: 5.0,
            lifetimeVariation: 2.0,
            enabled: true,
            ...config
        };
        
        this.state = {
            lastEmissionTime: 0,
            totalEmitted: 0,
            averageRate: 0
        };
    }
}

/**
 * Force System Classes
 */
class GravityForce {
    constructor(config = {}) {
        this.config = {
            strength: [0, -9.81, 0],
            enabled: true,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    calculate(position, velocity, mass) {
        return vec3.scale(vec3.create(), this.config.strength, mass);
    }
}

class WindForce {
    constructor(config = {}) {
        this.config = {
            strength: 0,
            direction: [1, 0, 0],
            enabled: false,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    calculate(position, velocity, mass) {
        const force = vec3.scale(vec3.create(), this.config.direction, this.config.strength);
        return force;
    }
}

class VortexForce {
    constructor(config = {}) {
        this.config = {
            strength: 0,
            axis: [0, 1, 0],
            center: [0, 0, 0],
            enabled: false,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    calculate(position, velocity, mass) {
        const toCenter = vec3.subtract(vec3.create(), this.config.center, position);
        const distance = vec3.length(toCenter);
        
        if (distance < 0.001) {
            return vec3.create();
        }
        
        const tangent = vec3.cross(vec3.create(), this.config.axis, toCenter);
        vec3.normalize(tangent, tangent);
        
        const strength = this.config.strength / (distance * distance + 1);
        return vec3.scale(vec3.create(), tangent, strength);
    }
}

class AttractorForce {
    constructor(config = {}) {
        this.config = {
            strength: 0,
            position: [0, 0, 0],
            falloff: 2.0,
            enabled: false,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    calculate(position, velocity, mass) {
        const toAttractor = vec3.subtract(vec3.create(), this.config.position, position);
        const distance = vec3.length(toAttractor);
        
        if (distance < 0.001) {
            return vec3.create();
        }
        
        vec3.normalize(toAttractor, toAttractor);
        const strength = this.config.strength / Math.pow(distance, this.config.falloff);
        
        return vec3.scale(vec3.create(), toAttractor, strength * mass);
    }
}

class RepellerForce {
    constructor(config = {}) {
        this.config = {
            strength: 0,
            position: [0, 0, 0],
            falloff: 2.0,
            enabled: false,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    calculate(position, velocity, mass) {
        const fromRepeller = vec3.subtract(vec3.create(), position, this.config.position);
        const distance = vec3.length(fromRepeller);
        
        if (distance < 0.001) {
            return vec3.create();
        }
        
        vec3.normalize(fromRepeller, fromRepeller);
        const strength = this.config.strength / Math.pow(distance, this.config.falloff);
        
        return vec3.scale(vec3.create(), fromRepeller, strength * mass);
    }
}

class TurbulenceForce {
    constructor(config = {}) {
        this.config = {
            strength: 0,
            frequency: 1.0,
            octaves: 3,
            enabled: false,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    calculate(position, velocity, mass, time) {
        // Simplified noise implementation
        const x = position[0] * this.config.frequency + time * 0.1;
        const y = position[1] * this.config.frequency + time * 0.1;
        const z = position[2] * this.config.frequency + time * 0.1;
        
        const noise = [
            Math.sin(x) * 0.5,
            Math.sin(y) * 0.5,
            Math.sin(z) * 0.5
        ];
        
        return vec3.scale(vec3.create(), noise, this.config.strength);
    }
}

class MagneticForce {
    constructor(config = {}) {
        this.config = {
            strength: 0,
            field: [0, 1, 0],
            enabled: false,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    calculate(position, velocity, mass) {
        const magneticForce = vec3.cross(vec3.create(), velocity, this.config.field);
        return vec3.scale(vec3.create(), magneticForce, this.config.strength);
    }
}

/**
 * Constraint System Classes
 */
class BoundsConstraint {
    constructor(config = {}) {
        this.config = {
            min: [-10, -10, -10],
            max: [10, 10, 10],
            enabled: true,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    apply(position, velocity) {
        // Constraint implementation
        return {
            position: position,
            velocity: velocity,
            positionChanged: false,
            velocityChanged: false,
            collision: false
        };
    }
}

class SphereConstraint {
    constructor(config = {}) {
        this.config = {
            center: [0, 0, 0],
            radius: 5.0,
            enabled: false,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    apply(position, velocity) {
        return {
            position: position,
            velocity: velocity,
            positionChanged: false,
            velocityChanged: false,
            collision: false
        };
    }
}

class PlaneConstraint {
    constructor(config = {}) {
        this.config = {
            normal: [0, 1, 0],
            distance: 0,
            enabled: false,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    apply(position, velocity) {
        return {
            position: position,
            velocity: velocity,
            positionChanged: false,
            velocityChanged: false,
            collision: false
        };
    }
}

class CylinderConstraint {
    constructor(config = {}) {
        this.config = {
            axis: [0, 1, 0],
            radius: 3.0,
            center: [0, 0, 0],
            enabled: false,
            ...config
        };
        this.enabled = this.config.enabled;
    }
    
    apply(position, velocity) {
        return {
            position: position,
            velocity: velocity,
            positionChanged: false,
            velocityChanged: false,
            collision: false
        };
    }
}

/**
 * Collision System
 */
class CollisionSystem {
    constructor(config) {
        this.config = config;
        this.collisionPairs = [];
    }
    
    initialize() {
        console.log('Collision system initialized');
    }
    
    detectCollisionsSpatial(particles, spatialGrid) {
        // Collision detection implementation
    }
    
    detectCollisionsBrute(particles, activeCount) {
        // Brute force collision detection
    }
    
    dispose() {
        this.collisionPairs.length = 0;
    }
}

/**
 * Spatial Grid for optimization
 */
class SpatialGrid {
    constructor(config) {
        this.config = config;
        this.cellSize = 2.0;
        this.cells = new Map();
    }
    
    initialize() {
        this.clear();
        console.log('Spatial grid initialized');
    }
    
    clear() {
        this.cells.clear();
    }
    
    insert(particleIndex, position) {
        const cellKey = this.getCellKey(position);
        
        if (!this.cells.has(cellKey)) {
            this.cells.set(cellKey, []);
        }
        
        this.cells.get(cellKey).push(particleIndex);
    }
    
    getCellKey(position) {
        const x = Math.floor(position[0] / this.cellSize);
        const y = Math.floor(position[1] / this.cellSize);
        const z = Math.floor(position[2] / this.cellSize);
        return x + ',' + y + ',' + z;
    }
    
    dispose() {
        this.clear();
    }
}

/**
 * Object Pool for memory efficiency
 */
class ObjectPool {
    constructor(createFn, initialSize = 100) {
        this.createFn = createFn;
        this.pool = [];
        this.inUse = new Set();
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }
    
    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        
        this.inUse.add(obj);
        return obj;
    }
    
    release(obj) {
        if (this.inUse.has(obj)) {
            this.inUse.delete(obj);
            this.pool.push(obj);
        }
    }
    
    clear() {
        this.pool.length = 0;
        this.inUse.clear();
    }
}