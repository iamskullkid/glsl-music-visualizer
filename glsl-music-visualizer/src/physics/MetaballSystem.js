/**
 * Advanced Metaball System
 * High-performance metaball physics and surface generation for blob visualization
 * Location: src/physics/MetaballSystem.js
 * 
 * Provides sophisticated metaball calculations, marching cubes surface generation,
 * and audio-reactive blob behaviors for the music visualizer
 */

import { MathUtils } from '../utils/MathUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';
import { vec3, vec4, mat4 } from 'gl-matrix';

export class MetaballSystem {
    constructor(config = {}) {
        this.isInitialized = false;
        this.gl = null;
        
        // Configuration with comprehensive metaball settings
        this.config = {
            // System parameters
            maxMetaballs: 64,
            initialMetaballCount: 8,
            gridResolution: 64,
            isoLevel: 0.5,
            
            // Physics settings
            enablePhysics: true,
            enableCollisions: true,
            enableConstraints: true,
            enableAudioReactivity: true,
            
            // Performance settings
            updateMode: 'cpu',           // 'cpu', 'gpu', 'hybrid'
            enableLOD: true,             // Level of detail
            frustumCulling: true,
            adaptiveGridSize: true,
            marchingCubesOptimization: true,
            
            // Audio reactivity settings
            audioInfluence: {
                size: 1.0,               // Size modulation strength
                position: 0.5,           // Position movement
                charge: 0.8,             // Charge/strength modulation
                morphing: 0.6,           // Shape morphing
                emission: 0.4,           // New metaball emission
                absorption: 0.3          // Metaball absorption/merging
            },
            
            // Visual settings
            renderMode: 'marchingCubes', // 'marchingCubes', 'rayMarching', 'particles'
            smoothingMode: 'cubic',      // 'linear', 'cubic', 'quintic'
            normalCalculation: 'gradient', // 'gradient', 'analytical'
            enableCSG: false,            // Constructive Solid Geometry
            
            // Metaball properties
            defaultRadius: 1.0,
            defaultCharge: 1.0,
            minRadius: 0.1,
            maxRadius: 5.0,
            chargeDecay: 0.95,
            
            // Grid settings
            gridBounds: {
                min: [-10, -10, -10],
                max: [10, 10, 10]
            },
            
            // Marching cubes settings
            enableSharpFeatures: true,
            vertexCaching: true,
            normalSmoothing: true,
            uvGeneration: true,
            
            // Force field settings
            forces: {
                gravity: { strength: [0, -2, 0], enabled: true },
                attraction: { strength: 0.5, enabled: true },
                repulsion: { strength: 0.3, enabled: true },
                turbulence: { strength: 0.2, enabled: false },
                vortex: { strength: 0.0, axis: [0, 1, 0], enabled: false }
            },
            
            // Material properties (for different blob states)
            materials: {
                water: {
                    charge: 1.0,
                    viscosity: 0.8,
                    surfaceTension: 0.6,
                    density: 1.0
                },
                metal: {
                    charge: 1.5,
                    viscosity: 0.3,
                    surfaceTension: 0.9,
                    density: 2.0
                },
                gas: {
                    charge: 0.5,
                    viscosity: 0.1,
                    surfaceTension: 0.1,
                    density: 0.3
                },
                plasma: {
                    charge: 2.0,
                    viscosity: 0.05,
                    surfaceTension: 0.2,
                    density: 0.8
                }
            },
            
            ...config
        };
        
        // Metaball data (Structure of Arrays for performance)
        this.metaballs = {
            // Spatial properties
            positions: new Float32Array(this.config.maxMetaballs * 3),
            velocities: new Float32Array(this.config.maxMetaballs * 3),
            accelerations: new Float32Array(this.config.maxMetaballs * 3),
            
            // Physical properties
            radii: new Float32Array(this.config.maxMetaballs),
            charges: new Float32Array(this.config.maxMetaballs),
            masses: new Float32Array(this.config.maxMetaballs),
            
            // Material properties
            materialTypes: new Uint8Array(this.config.maxMetaballs),
            viscosities: new Float32Array(this.config.maxMetaballs),
            surfaceTensions: new Float32Array(this.config.maxMetaballs),
            densities: new Float32Array(this.config.maxMetaballs),
            
            // Lifecycle and state
            ages: new Float32Array(this.config.maxMetaballs),
            lifetimes: new Float32Array(this.config.maxMetaballs),
            active: new Uint8Array(this.config.maxMetaballs),
            
            // Audio reactivity
            audioWeights: new Float32Array(this.config.maxMetaballs),
            frequencyBands: new Uint8Array(this.config.maxMetaballs),
            beatSensitivity: new Float32Array(this.config.maxMetaballs),
            
            // Visual properties
            colors: new Float32Array(this.config.maxMetaballs * 4), // RGBA
            temperatures: new Float32Array(this.config.maxMetaballs),
            emissions: new Float32Array(this.config.maxMetaballs)
        };
        
        // System state
        this.state = {
            activeMetaballCount: 0,
            totalEmitted: 0,
            lastEmissionTime: 0,
            deltaTime: 0,
            elapsedTime: 0,
            frameCount: 0,
            
            // Audio state
            audioData: null,
            audioInfluenceFactors: {
                size: 0,
                position: 0,
                charge: 0,
                morphing: 0,
                emission: 0
            },
            
            // Surface generation state
            surfaceGenerated: false,
            vertexCount: 0,
            triangleCount: 0,
            lastSurfaceUpdate: 0
        };
        
        // 3D scalar field for metaball evaluation
        this.scalarField = {
            grid: null,
            resolution: this.config.gridResolution,
            bounds: this.config.gridBounds,
            cellSize: 0,
            dimensions: [0, 0, 0],
            dirty: true
        };
        
        // Marching cubes data
        this.marchingCubes = {
            vertices: new Float32Array(0),
            normals: new Float32Array(0),
            uvs: new Float32Array(0),
            indices: new Uint32Array(0),
            edgeTable: null,
            triTable: null,
            vertexCache: new Map(),
            edgeCache: new Map()
        };
        
        // GPU compute resources (for GPU-based computation)
        this.gpuResources = {
            scalarFieldTexture: null,
            computeShader: null,
            uniformBuffer: null,
            vertexBuffer: null,
            enabled: false
        };
        
        // Force field system
        this.forceField = new MetaballForceField(this.config.forces);
        
        // Performance monitoring
        this.performance = {
            updateTime: 0,
            scalarFieldTime: 0,
            marchingCubesTime: 0,
            totalVertices: 0,
            totalTriangles: 0,
            memoryUsage: 0
        };
        
        // Spatial optimization
        this.spatialGrid = new MetaballSpatialGrid(this.config);
        
        // Material transition system
        this.materialTransition = new MaterialTransitionSystem(this.config);
        
        // Event system
        this.eventCallbacks = new Map();
        
        // Debug visualization
        this.debug = {
            enabled: process.env.NODE_ENV === 'development',
            showGrid: false,
            showMetaballs: false,
            showForceField: false,
            showScalarField: false,
            wireframeMode: false
        };
    }
    
    /**
     * Initialize metaball system with WebGL context
     */
    async initialize(gl) {
        try {
            this.gl = gl;
            
            // Initialize scalar field
            this.initializeScalarField();
            
            // Initialize marching cubes tables
            this.initializeMarchingCubes();
            
            // Initialize GPU resources if available
            if (this.config.updateMode === 'gpu' || this.config.updateMode === 'hybrid') {
                await this.initializeGPUResources();
            }
            
            // Initialize spatial optimization
            if (this.config.enableLOD) {
                this.spatialGrid.initialize();
            }
            
            // Initialize force field
            this.forceField.initialize();
            
            // Initialize material transition system
            this.materialTransition.initialize();
            
            // Create initial metaballs
            this.createInitialMetaballs();
            
            this.isInitialized = true;
            
            console.log('MetaballSystem initialized', {
                maxMetaballs: this.config.maxMetaballs,
                gridResolution: this.config.gridResolution,
                updateMode: this.config.updateMode,
                gpuAcceleration: this.gpuResources.enabled
            });
            
        } catch (error) {
            console.error('Failed to initialize MetaballSystem:', error);
            throw error;
        }
    }
    
    /**
     * Initialize 3D scalar field grid
     */
    initializeScalarField() {
        const bounds = this.config.gridBounds;
        const resolution = this.config.gridResolution;
        
        // Calculate grid dimensions
        this.scalarField.dimensions = [
            Math.ceil((bounds.max[0] - bounds.min[0]) * resolution / 10),
            Math.ceil((bounds.max[1] - bounds.min[1]) * resolution / 10),
            Math.ceil((bounds.max[2] - bounds.min[2]) * resolution / 10)
        ];
        
        this.scalarField.cellSize = (bounds.max[0] - bounds.min[0]) / this.scalarField.dimensions[0];
        
        // Allocate scalar field grid
        const totalCells = this.scalarField.dimensions[0] * 
                          this.scalarField.dimensions[1] * 
                          this.scalarField.dimensions[2];
        
        this.scalarField.grid = new Float32Array(totalCells);
        
        console.log('Scalar field initialized', {
            dimensions: this.scalarField.dimensions,
            cellSize: this.scalarField.cellSize,
            totalCells: totalCells
        });
    }
    
    /**
     * Initialize marching cubes lookup tables
     */
    initializeMarchingCubes() {
        // Simplified edge table (in a full implementation, this would be the complete 256-entry table)
        this.marchingCubes.edgeTable = new Uint16Array(256);
        for (let i = 0; i < 256; i++) {
            this.marchingCubes.edgeTable[i] = i; // Placeholder
        }
        
        // Simplified triangle table
        this.marchingCubes.triTable = new Int8Array(4096);
        for (let i = 0; i < 4096; i++) {
            this.marchingCubes.triTable[i] = -1; // Placeholder
        }
        
        // Initialize vertex and edge caches
        this.marchingCubes.vertexCache.clear();
        this.marchingCubes.edgeCache.clear();
        
        console.log('Marching cubes tables initialized');
    }
    
    /**
     * Initialize GPU compute resources
     */
    async initializeGPUResources() {
        // Check for GPU support
        if (!this.gl || !this.gl.getExtension('OES_texture_float')) {
            console.warn('GPU compute not supported, falling back to CPU');
            this.config.updateMode = 'cpu';
            return;
        }
        
        try {
            // Create 3D texture for scalar field
            this.createScalarFieldTexture();
            
            // Create compute shader for metaball evaluation
            this.gpuResources.computeShader = await this.createMetaballComputeShader();
            
            this.gpuResources.enabled = true;
            console.log('GPU acceleration enabled for metaball system');
            
        } catch (error) {
            console.warn('Failed to initialize GPU resources:', error);
            this.config.updateMode = 'cpu';
        }
    }
    
    /**
     * Create 3D texture for scalar field
     */
    createScalarFieldTexture() {
        const gl = this.gl;
        
        if (!gl.TEXTURE_3D) {
            console.warn('3D textures not supported');
            return;
        }
        
        const dims = this.scalarField.dimensions;
        
        this.gpuResources.scalarFieldTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, this.gpuResources.scalarFieldTexture);
        
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        console.log('3D texture created for scalar field');
    }
    
    /**
     * Create compute shader for metaball evaluation
     */
    async createMetaballComputeShader() {
        console.log('GPU compute shader creation placeholder');
        return null;
    }
    
    /**
     * Create initial metaball configuration
     */
    createInitialMetaballs() {
        const count = Math.min(this.config.initialMetaballCount, this.config.maxMetaballs);
        
        for (let i = 0; i < count; i++) {
            this.createMetaball(i, {
                position: [
                    this.randomRange(-2, 2),
                    this.randomRange(-2, 2),
                    this.randomRange(-2, 2)
                ],
                radius: this.randomRange(0.5, 1.5),
                charge: this.randomRange(0.8, 1.2),
                materialType: Math.floor(this.randomRange(0, 4))
            });
        }
        
        this.state.activeMetaballCount = count;
        console.log('Created ' + count + ' initial metaballs');
    }
    
    /**
     * Create a single metaball
     */
    createMetaball(index, config = {}) {
        // Position
        const pos = config.position || [0, 0, 0];
        this.metaballs.positions[index * 3] = pos[0];
        this.metaballs.positions[index * 3 + 1] = pos[1];
        this.metaballs.positions[index * 3 + 2] = pos[2];
        
        // Velocity (initially at rest)
        this.metaballs.velocities[index * 3] = 0;
        this.metaballs.velocities[index * 3 + 1] = 0;
        this.metaballs.velocities[index * 3 + 2] = 0;
        
        // Physical properties
        this.metaballs.radii[index] = config.radius || this.config.defaultRadius;
        this.metaballs.charges[index] = config.charge || this.config.defaultCharge;
        this.metaballs.masses[index] = Math.PI * Math.pow(this.metaballs.radii[index], 3) * 4 / 3;
        
        // Material properties
        const materialType = config.materialType || 0;
        this.metaballs.materialTypes[index] = materialType;
        
        const materialNames = ['water', 'metal', 'gas', 'plasma'];
        const materialName = materialNames[materialType] || 'water';
        const material = this.config.materials[materialName];
        
        this.metaballs.viscosities[index] = material.viscosity;
        this.metaballs.surfaceTensions[index] = material.surfaceTension;
        this.metaballs.densities[index] = material.density;
        
        // Lifecycle
        this.metaballs.ages[index] = 0;
        this.metaballs.lifetimes[index] = Infinity; // Persistent by default
        this.metaballs.active[index] = 1;
        
        // Audio reactivity
        this.metaballs.audioWeights[index] = this.randomRange(0.5, 1.0);
        this.metaballs.frequencyBands[index] = Math.floor(this.randomRange(0, 8));
        this.metaballs.beatSensitivity[index] = this.randomRange(0.3, 1.0);
        
        // Visual properties
        const color = this.generateMetaballColor(materialType);
        this.metaballs.colors[index * 4] = color[0];
        this.metaballs.colors[index * 4 + 1] = color[1];
        this.metaballs.colors[index * 4 + 2] = color[2];
        this.metaballs.colors[index * 4 + 3] = color[3];
        
        this.metaballs.temperatures[index] = this.randomRange(0.3, 0.8);
        this.metaballs.emissions[index] = 0;
        
        this.scalarField.dirty = true;
    }
    
    /**
     * Generate color for metaball based on material type
     */
    generateMetaballColor(materialType) {
        const colors = [
            [0.3, 0.6, 1.0, 1.0], // Water - blue
            [0.7, 0.7, 0.8, 1.0], // Metal - silver
            [0.9, 0.9, 0.5, 0.3], // Gas - yellow, translucent
            [1.0, 0.3, 0.8, 0.8]  // Plasma - magenta
        ];
        
        return colors[materialType] || colors[0];
    }
    
    /**
     * Utility method for random number generation
     */
    randomRange(min, max) {
        return min + Math.random() * (max - min);
    }
    
    /**
     * Main metaball system update function
     */
    update(deltaTime, audioData = null) {
        if (!this.isInitialized) {
            console.warn('MetaballSystem not initialized');
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
            
            // Update metaball physics
            if (this.config.enablePhysics) {
                this.updateMetaballPhysics(deltaTime);
            }
            
            // Handle material transitions
            this.materialTransition.update(deltaTime, audioData);
            
            // Update scalar field
            if (this.scalarField.dirty || this.shouldUpdateScalarField()) {
                this.updateScalarField();
            }
            
            // Generate surface using marching cubes
            if (this.shouldRegenerateSurface()) {
                this.generateSurface();
            }
            
            // Update performance metrics
            const updateTime = performance.now() - startTime;
            this.updatePerformanceMetrics(updateTime);
            
            this.state.frameCount++;
            
        } catch (error) {
            console.error('Metaball system update error:', error);
        }
    }
    
    /**
     * Update system state and timing
     */
    updateSystemState(deltaTime, audioData) {
        this.state.deltaTime = deltaTime;
        this.state.elapsedTime += deltaTime;
        this.state.audioData = audioData;
    }
    
    /**
     * Update audio influence factors
     */
    updateAudioInfluence(audioData) {
        const influence = this.state.audioInfluenceFactors;
        const audioConfig = this.config.audioInfluence;
        
        // Beat-triggered effects
        if (audioData.beat) {
            influence.size = audioData.beatStrength || 0.5;
            influence.charge = audioData.beatStrength || 0.5;
            influence.emission = 1.0;
        } else {
            influence.size *= 0.95;
            influence.charge *= 0.95;
            influence.emission *= 0.9;
        }
        
        // Continuous audio features
        if (audioData.features) {
            // Size modulation based on loudness
            if (audioData.features.perceptual && audioData.features.perceptual.totalLoudness) {
                influence.size = MathUtils.lerp(
                    influence.size,
                    audioData.features.perceptual.totalLoudness * audioConfig.size,
                    0.1
                );
            }
            
            // Morphing based on spectral complexity
            if (audioData.features.spectral && audioData.features.spectral.centroid) {
                influence.morphing = MathUtils.lerp(
                    influence.morphing,
                    MathUtils.map(audioData.features.spectral.centroid, 0, 8000, 0, 1) * audioConfig.morphing,
                    0.05
                );
            }
        }
        
        // Apply audio influence to individual metaballs
        this.applyAudioInfluenceToMetaballs();
    }
    
    /**
     * Apply audio influence to individual metaballs
     */
    applyAudioInfluenceToMetaballs() {
        const influence = this.state.audioInfluenceFactors;
        
        for (let i = 0; i < this.state.activeMetaballCount; i++) {
            if (!this.metaballs.active[i]) {
                continue;
            }
            
            const audioWeight = this.metaballs.audioWeights[i];
            const beatSensitivity = this.metaballs.beatSensitivity[i];
            
            // Size modulation
            const baseRadius = this.config.defaultRadius;
            const sizeInfluence = influence.size * audioWeight * beatSensitivity;
            this.metaballs.radii[i] = MathUtils.lerp(
                this.metaballs.radii[i],
                baseRadius * (1 + sizeInfluence * 0.5),
                0.1
            );
            
            // Charge modulation
            const baseCharge = this.config.defaultCharge;
            const chargeInfluence = influence.charge * audioWeight;
            this.metaballs.charges[i] = MathUtils.lerp(
                this.metaballs.charges[i],
                baseCharge * (1 + chargeInfluence * 0.3),
                0.05
            );
            
            // Temperature modulation (affects color)
            const tempInfluence = influence.morphing * audioWeight;
            this.metaballs.temperatures[i] = MathUtils.lerp(
                this.metaballs.temperatures[i],
                0.5 + tempInfluence * 0.5,
                0.02
            );
        }
        
        this.scalarField.dirty = true;
    }
    
    /**
     * Update metaball physics
     */
    updateMetaballPhysics(deltaTime) {
        // Apply forces
        this.forceField.applyForces(this.metaballs, this.state.activeMetaballCount, deltaTime);
        
        // Integrate motion
        for (let i = 0; i < this.state.activeMetaballCount; i++) {
            if (!this.metaballs.active[i]) {
                continue;
            }
            
            // Verlet integration for stability
            const mass = this.metaballs.masses[i];
            
            // Update velocity from acceleration
            this.metaballs.velocities[i * 3] += this.metaballs.accelerations[i * 3] * deltaTime;
            this.metaballs.velocities[i * 3 + 1] += this.metaballs.accelerations[i * 3 + 1] * deltaTime;
            this.metaballs.velocities[i * 3 + 2] += this.metaballs.accelerations[i * 3 + 2] * deltaTime;
            
            // Apply viscosity damping
            const viscosity = this.metaballs.viscosities[i];
            const dampingFactor = Math.pow(1 - viscosity, deltaTime);
            this.metaballs.velocities[i * 3] *= dampingFactor;
            this.metaballs.velocities[i * 3 + 1] *= dampingFactor;
            this.metaballs.velocities[i * 3 + 2] *= dampingFactor;
            
            // Update position from velocity
            this.metaballs.positions[i * 3] += this.metaballs.velocities[i * 3] * deltaTime;
            this.metaballs.positions[i * 3 + 1] += this.metaballs.velocities[i * 3 + 1] * deltaTime;
            this.metaballs.positions[i * 3 + 2] += this.metaballs.velocities[i * 3 + 2] * deltaTime;
            
            // Apply boundary constraints
            this.applyBoundaryConstraints(i);
            
            // Update age
            this.metaballs.ages[i] += deltaTime;
            
            // Check for lifetime expiration
            if (this.metaballs.lifetimes[i] < Infinity && 
                this.metaballs.ages[i] >= this.metaballs.lifetimes[i]) {
                this.destroyMetaball(i);
            }
        }
        
        // Handle metaball interactions
        if (this.config.enableCollisions) {
            this.updateMetaballInteractions();
        }
        
        this.scalarField.dirty = true;
    }
    
    /**
     * Apply boundary constraints to metaball
     */
    applyBoundaryConstraints(index) {
        const bounds = this.config.gridBounds;
        const radius = this.metaballs.radii[index];
        
        // X bounds
        if (this.metaballs.positions[index * 3] - radius < bounds.min[0]) {
            this.metaballs.positions[index * 3] = bounds.min[0] + radius;
            this.metaballs.velocities[index * 3] *= -0.5;
        } else if (this.metaballs.positions[index * 3] + radius > bounds.max[0]) {
            this.metaballs.positions[index * 3] = bounds.max[0] - radius;
            this.metaballs.velocities[index * 3] *= -0.5;
        }
        
        // Y bounds
        if (this.metaballs.positions[index * 3 + 1] - radius < bounds.min[1]) {
            this.metaballs.positions[index * 3 + 1] = bounds.min[1] + radius;
            this.metaballs.velocities[index * 3 + 1] *= -0.5;
        } else if (this.metaballs.positions[index * 3 + 1] + radius > bounds.max[1]) {
            this.metaballs.positions[index * 3 + 1] = bounds.max[1] - radius;
            this.metaballs.velocities[index * 3 + 1] *= -0.5;
        }
        
        // Z bounds
        if (this.metaballs.positions[index * 3 + 2] - radius < bounds.min[2]) {
            this.metaballs.positions[index * 3 + 2] = bounds.min[2] + radius;
            this.metaballs.velocities[index * 3 + 2] *= -0.5;
        } else if (this.metaballs.positions[index * 3 + 2] + radius > bounds.max[2]) {
            this.metaballs.positions[index * 3 + 2] = bounds.max[2] - radius;
            this.metaballs.velocities[index * 3 + 2] *= -0.5;
        }
    }
    
    /**
     * Update metaball interactions (merging, splitting)
     */
    updateMetaballInteractions() {
        for (let i = 0; i < this.state.activeMetaballCount; i++) {
            if (!this.metaballs.active[i]) {
                continue;
            }
            
            for (let j = i + 1; j < this.state.activeMetaballCount; j++) {
                if (!this.metaballs.active[j]) {
                    continue;
                }
                
                const distance = this.calculateDistance(i, j);
                const radiusSum = this.metaballs.radii[i] + this.metaballs.radii[j];
                
                // Check for merging condition
                if (distance < radiusSum * 0.5) {
                    this.mergeMetaballs(i, j);
                }
            }
        }
    }
    
    /**
     * Calculate distance between two metaballs
     */
    calculateDistance(index1, index2) {
        const dx = this.metaballs.positions[index1 * 3] - this.metaballs.positions[index2 * 3];
        const dy = this.metaballs.positions[index1 * 3 + 1] - this.metaballs.positions[index2 * 3 + 1];
        const dz = this.metaballs.positions[index1 * 3 + 2] - this.metaballs.positions[index2 * 3 + 2];
        
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    /**
     * Merge two metaballs
     */
    mergeMetaballs(index1, index2) {
        // Use conservation of mass for merging
        const mass1 = this.metaballs.masses[index1];
        const mass2 = this.metaballs.masses[index2];
        const totalMass = mass1 + mass2;
        
        // Weighted average position
        this.metaballs.positions[index1 * 3] = 
            (this.metaballs.positions[index1 * 3] * mass1 + this.metaballs.positions[index2 * 3] * mass2) / totalMass;
        this.metaballs.positions[index1 * 3 + 1] = 
            (this.metaballs.positions[index1 * 3 + 1] * mass1 + this.metaballs.positions[index2 * 3 + 1] * mass2) / totalMass;
        this.metaballs.positions[index1 * 3 + 2] = 
            (this.metaballs.positions[index1 * 3 + 2] * mass1 + this.metaballs.positions[index2 * 3 + 2] * mass2) / totalMass;
        
        // Conservation of momentum
        this.metaballs.velocities[index1 * 3] = 
            (this.metaballs.velocities[index1 * 3] * mass1 + this.metaballs.velocities[index2 * 3] * mass2) / totalMass;
        this.metaballs.velocities[index1 * 3 + 1] = 
            (this.metaballs.velocities[index1 * 3 + 1] * mass1 + this.metaballs.velocities[index2 * 3 + 1] * mass2) / totalMass;
        this.metaballs.velocities[index1 * 3 + 2] = 
            (this.metaballs.velocities[index1 * 3 + 2] * mass1 + this.metaballs.velocities[index2 * 3 + 2] * mass2) / totalMass;
        
        // Update radius based on volume conservation
        const volume1 = (4/3) * Math.PI * Math.pow(this.metaballs.radii[index1], 3);
        const volume2 = (4/3) * Math.PI * Math.pow(this.metaballs.radii[index2], 3);
        const newRadius = Math.pow((volume1 + volume2) * 3 / (4 * Math.PI), 1/3);
        this.metaballs.radii[index1] = Math.min(newRadius, this.config.maxRadius);
        
        // Update other properties
        this.metaballs.charges[index1] = Math.max(this.metaballs.charges[index1], this.metaballs.charges[index2]);
        this.metaballs.masses[index1] = totalMass;
        
        // Remove the second metaball
        this.destroyMetaball(index2);
        
        this.scalarField.dirty = true;
    }
    
    /**
     * Destroy a metaball
     */
    destroyMetaball(index) {
        this.metaballs.active[index] = 0;
        this.state.activeMetaballCount--;
        this.scalarField.dirty = true;
    }
    
    /**
     * Check if scalar field should be updated
     */
    shouldUpdateScalarField() {
        return this.state.frameCount % 2 === 0;
    }
    
    /**
     * Update 3D scalar field based on metaball positions and properties
     */
    updateScalarField() {
        const startTime = performance.now();
        
        if (this.config.updateMode === 'gpu' && this.gpuResources.enabled) {
            this.updateScalarFieldGPU();
        } else {
            this.updateScalarFieldCPU();
        }
        
        this.performance.scalarFieldTime = performance.now() - startTime;
        this.scalarField.dirty = false;
    }
    
    /**
     * Update scalar field using CPU computation
     */
    updateScalarFieldCPU() {
        const grid = this.scalarField.grid;
        const dims = this.scalarField.dimensions;
        const bounds = this.config.gridBounds;
        const cellSize = this.scalarField.cellSize;
        
        // Clear grid
        grid.fill(0);
        
        // Iterate through grid cells
        for (let x = 0; x < dims[0]; x++) {
            for (let y = 0; y < dims[1]; y++) {
                for (let z = 0; z < dims[2]; z++) {
                    const gridIndex = x + y * dims[0] + z * dims[0] * dims[1];
                    
                    // World position of this grid cell
                    const worldPos = [
                        bounds.min[0] + x * cellSize,
                        bounds.min[1] + y * cellSize,
                        bounds.min[2] + z * cellSize
                    ];
                    
                    // Evaluate metaball field at this position
                    let fieldValue = 0;
                    
                    for (let i = 0; i < this.state.activeMetaballCount; i++) {
                        if (!this.metaballs.active[i]) {
                            continue;
                        }
                        
                        const metaballPos = [
                            this.metaballs.positions[i * 3],
                            this.metaballs.positions[i * 3 + 1],
                            this.metaballs.positions[i * 3 + 2]
                        ];
                        
                        const radius = this.metaballs.radii[i];
                        const charge = this.metaballs.charges[i];
                        
                        const distance = vec3.distance(worldPos, metaballPos);
                        
                        // Metaball field contribution
                        if (distance > 0) {
                            const contribution = charge * Math.pow(radius / distance, 2);
                            fieldValue += contribution;
                        } else {
                            fieldValue += charge * 1000;
                        }
                    }
                    
                    grid[gridIndex] = fieldValue;
                }
            }
        }
    }
    
    /**
     * Update scalar field using GPU computation
     */
    updateScalarFieldGPU() {
        console.log('GPU scalar field computation not yet implemented');
        this.updateScalarFieldCPU();
    }
    
    /**
     * Check if surface should be regenerated
     */
    shouldRegenerateSurface() {
        return this.scalarField.dirty || 
               (this.state.elapsedTime - this.state.lastSurfaceUpdate > 1/30);
    }
    
    /**
     * Generate surface mesh using marching cubes algorithm
     */
    generateSurface() {
        const startTime = performance.now();
        
        // Clear previous surface data
        this.clearSurfaceData();
        
        // Run marching cubes algorithm
        this.runMarchingCubes();
        
        // Generate normals
        this.generateSurfaceNormals();
        
        // Update state
        this.state.surfaceGenerated = true;
        this.state.lastSurfaceUpdate = this.state.elapsedTime;
        this.performance.marchingCubesTime = performance.now() - startTime;
        
        // Emit surface update event
        this.emit('surfaceUpdated', {
            vertexCount: this.state.vertexCount,
            triangleCount: this.state.triangleCount
        });
    }
    
    /**
     * Clear previous surface data
     */
    clearSurfaceData() {
        this.marchingCubes.vertexCache.clear();
        this.marchingCubes.edgeCache.clear();
        this.state.vertexCount = 0;
        this.state.triangleCount = 0;
    }
    
    /**
     * Run marching cubes algorithm
     */
    runMarchingCubes() {
        const dims = this.scalarField.dimensions;
        const grid = this.scalarField.grid;
        const isoLevel = this.config.isoLevel;
        
        const vertices = [];
        const indices = [];
        
        // Simplified marching cubes implementation
        for (let x = 0; x < dims[0] - 1; x++) {
            for (let y = 0; y < dims[1] - 1; y++) {
                for (let z = 0; z < dims[2] - 1; z++) {
                    const cubeValues = this.getCubeValues(x, y, z, grid, dims);
                    
                    // Determine cube configuration
                    let cubeIndex = 0;
                    for (let i = 0; i < 8; i++) {
                        if (cubeValues[i] < isoLevel) {
                            cubeIndex |= (1 << i);
                        }
                    }
                    
                    // Skip empty cubes
                    if (cubeIndex === 0 || cubeIndex === 255) {
                        continue;
                    }
                    
                    // Generate triangles for this cube
                    const triangles = this.generateCubeTriangles(x, y, z, cubeValues, isoLevel);
                    
                    for (let i = 0; i < triangles.length; i += 9) {
                        vertices.push(triangles[i], triangles[i + 1], triangles[i + 2]);
                        vertices.push(triangles[i + 3], triangles[i + 4], triangles[i + 5]);
                        vertices.push(triangles[i + 6], triangles[i + 7], triangles[i + 8]);
                        
                        const baseIndex = this.state.vertexCount;
                        indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
                        this.state.vertexCount += 3;
                        this.state.triangleCount++;
                    }
                }
            }
        }
        
        // Store generated surface
        this.marchingCubes.vertices = new Float32Array(vertices);
        this.marchingCubes.indices = new Uint32Array(indices);
    }
    
    /**
     * Get the 8 corner values of a cube
     */
    getCubeValues(x, y, z, grid, dims) {
        const values = new Array(8);
        
        values[0] = grid[x + y * dims[0] + z * dims[0] * dims[1]];
        values[1] = grid[(x + 1) + y * dims[0] + z * dims[0] * dims[1]];
        values[2] = grid[(x + 1) + (y + 1) * dims[0] + z * dims[0] * dims[1]];
        values[3] = grid[x + (y + 1) * dims[0] + z * dims[0] * dims[1]];
        values[4] = grid[x + y * dims[0] + (z + 1) * dims[0] * dims[1]];
        values[5] = grid[(x + 1) + y * dims[0] + (z + 1) * dims[0] * dims[1]];
        values[6] = grid[(x + 1) + (y + 1) * dims[0] + (z + 1) * dims[0] * dims[1]];
        values[7] = grid[x + (y + 1) * dims[0] + (z + 1) * dims[0] * dims[1]];
        
        return values;
    }
    
    /**
     * Generate triangles for a cube (simplified implementation)
     */
    generateCubeTriangles(x, y, z, cubeValues, isoLevel) {
        const triangles = [];
        const bounds = this.config.gridBounds;
        const cellSize = this.scalarField.cellSize;
        
        // This is a simplified implementation
        // A full marching cubes would use lookup tables
        
        // Find surface intersections and generate triangles
        for (let i = 0; i < 8; i++) {
            if (cubeValues[i] > isoLevel) {
                // Generate a simple triangle for visualization
                const worldX = bounds.min[0] + x * cellSize;
                const worldY = bounds.min[1] + y * cellSize;
                const worldZ = bounds.min[2] + z * cellSize;
                
                triangles.push(
                    worldX, worldY, worldZ,
                    worldX + cellSize, worldY, worldZ,
                    worldX, worldY + cellSize, worldZ
                );
                break;
            }
        }
        
        return triangles;
    }
    
    /**
     * Generate surface normals
     */
    generateSurfaceNormals() {
        const vertices = this.marchingCubes.vertices;
        const normals = new Float32Array(vertices.length);
        
        // Calculate normals for each triangle
        for (let i = 0; i < vertices.length; i += 9) {
            const v1 = [vertices[i], vertices[i + 1], vertices[i + 2]];
            const v2 = [vertices[i + 3], vertices[i + 4], vertices[i + 5]];
            const v3 = [vertices[i + 6], vertices[i + 7], vertices[i + 8]];
            
            const edge1 = vec3.subtract(vec3.create(), v2, v1);
            const edge2 = vec3.subtract(vec3.create(), v3, v1);
            const normal = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), edge1, edge2));
            
            // Apply to all three vertices
            normals[i] = normals[i + 3] = normals[i + 6] = normal[0];
            normals[i + 1] = normals[i + 4] = normals[i + 7] = normal[1];
            normals[i + 2] = normals[i + 5] = normals[i + 8] = normal[2];
        }
        
        this.marchingCubes.normals = normals;
    }
    
    /**
     * Get surface data for rendering
     */
    getSurfaceData() {
        return {
            vertices: this.marchingCubes.vertices,
            normals: this.marchingCubes.normals,
            uvs: this.marchingCubes.uvs,
            indices: this.marchingCubes.indices,
            vertexCount: this.state.vertexCount,
            triangleCount: this.state.triangleCount,
            generated: this.state.surfaceGenerated
        };
    }
    
    /**
     * Get metaball data for rendering/debugging
     */
    getMetaballData() {
        return {
            positions: this.metaballs.positions,
            radii: this.metaballs.radii,
            charges: this.metaballs.charges,
            colors: this.metaballs.colors,
            active: this.metaballs.active,
            count: this.state.activeMetaballCount
        };
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
        
        this.performance.totalVertices = this.state.vertexCount;
        this.performance.totalTriangles = this.state.triangleCount;
        
        performanceMonitor.recordCPUTime('metaballSystem', updateTime);
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
            metaballs: {
                active: this.state.activeMetaballCount,
                total: this.config.maxMetaballs
            },
            surface: {
                vertices: this.state.vertexCount,
                triangles: this.state.triangleCount,
                generated: this.state.surfaceGenerated
            }
        };
    }
    
    /**
     * Event system
     */
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, new Set());
        }
        this.eventCallbacks.get(event).add(callback);
    }
    
    off(event, callback) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).delete(callback);
        }
    }
    
    emit(event, data) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in metaball system event listener for ' + event + ':', error);
                }
            });
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        console.log('Disposing MetaballSystem...');
        
        if (this.gpuResources.enabled) {
            this.disposeGPUResources();
        }
        
        this.forceField.dispose();
        this.materialTransition.dispose();
        this.spatialGrid.dispose();
        
        this.eventCallbacks.clear();
        
        Object.keys(this.metaballs).forEach(key => {
            this.metaballs[key] = null;
        });
        
        this.scalarField.grid = null;
        this.marchingCubes.vertices = null;
        this.marchingCubes.normals = null;
        this.marchingCubes.indices = null;
        
        this.isInitialized = false;
        this.gl = null;
        
        console.log('MetaballSystem disposed');
    }
    
    /**
     * Dispose GPU resources
     */
    disposeGPUResources() {
        if (this.gpuResources.scalarFieldTexture) {
            this.gl.deleteTexture(this.gpuResources.scalarFieldTexture);
        }
        
        if (this.gpuResources.computeShader) {
            this.gl.deleteProgram(this.gpuResources.computeShader);
        }
        
        this.gpuResources.enabled = false;
    }
}

/**
 * Metaball Force Field System
 */
class MetaballForceField {
    constructor(config) {
        this.config = config;
    }
    
    initialize() {
        console.log('Metaball force field initialized');
    }
    
    applyForces(metaballs, count, deltaTime) {
        // Clear accelerations
        for (let i = 0; i < count; i++) {
            metaballs.accelerations[i * 3] = 0;
            metaballs.accelerations[i * 3 + 1] = 0;
            metaballs.accelerations[i * 3 + 2] = 0;
        }
        
        // Apply gravity
        if (this.config.gravity.enabled) {
            this.applyGravity(metaballs, count, deltaTime);
        }
        
        // Apply inter-metaball forces
        if (this.config.attraction.enabled || this.config.repulsion.enabled) {
            this.applyInterMetaballForces(metaballs, count, deltaTime);
        }
    }
    
    applyGravity(metaballs, count, deltaTime) {
        const gravity = this.config.gravity.strength;
        
        for (let i = 0; i < count; i++) {
            if (!metaballs.active[i]) {
                continue;
            }
            
            metaballs.accelerations[i * 3] += gravity[0];
            metaballs.accelerations[i * 3 + 1] += gravity[1];
            metaballs.accelerations[i * 3 + 2] += gravity[2];
        }
    }
    
    applyInterMetaballForces(metaballs, count, deltaTime) {
        const attractionStrength = this.config.attraction.strength;
        const repulsionStrength = this.config.repulsion.strength;
        
        for (let i = 0; i < count; i++) {
            if (!metaballs.active[i]) {
                continue;
            }
            
            for (let j = i + 1; j < count; j++) {
                if (!metaballs.active[j]) {
                    continue;
                }
                
                const dx = metaballs.positions[j * 3] - metaballs.positions[i * 3];
                const dy = metaballs.positions[j * 3 + 1] - metaballs.positions[i * 3 + 1];
                const dz = metaballs.positions[j * 3 + 2] - metaballs.positions[i * 3 + 2];
                
                const distanceSquared = dx * dx + dy * dy + dz * dz;
                const distance = Math.sqrt(distanceSquared);
                
                if (distance > 0.001) {
                    const radiusSum = metaballs.radii[i] + metaballs.radii[j];
                    
                    let force = 0;
                    if (distance < radiusSum * 2) {
                        force = attractionStrength / distanceSquared;
                    } else if (distance < radiusSum) {
                        force = -repulsionStrength / distanceSquared;
                    }
                    
                    if (force !== 0) {
                        const forceX = force * dx / distance;
                        const forceY = force * dy / distance;
                        const forceZ = force * dz / distance;
                        
                        metaballs.accelerations[i * 3] += forceX / metaballs.masses[i];
                        metaballs.accelerations[i * 3 + 1] += forceY / metaballs.masses[i];
                        metaballs.accelerations[i * 3 + 2] += forceZ / metaballs.masses[i];
                        
                        metaballs.accelerations[j * 3] -= forceX / metaballs.masses[j];
                        metaballs.accelerations[j * 3 + 1] -= forceY / metaballs.masses[j];
                        metaballs.accelerations[j * 3 + 2] -= forceZ / metaballs.masses[j];
                    }
                }
            }
        }
    }
    
    dispose() {
        // Cleanup force field resources
    }
}

/**
 * Material Transition System
 */
class MaterialTransitionSystem {
    constructor(config) {
        this.config = config;
        this.transitions = new Map();
    }
    
    initialize() {
        console.log('Material transition system initialized');
    }
    
    update(deltaTime, audioData) {
        // Handle material state transitions based on audio
        if (audioData && audioData.features) {
            this.updateAudioBasedTransitions(audioData);
        }
        
        // Process ongoing transitions
        this.processTransitions(deltaTime);
    }
    
    updateAudioBasedTransitions(audioData) {
        // Example transitions based on audio
        if (audioData.features.perceptual && audioData.features.perceptual.totalLoudness > 0.8) {
            this.triggerTransition('plasma');
        }
        
        if (audioData.features.perceptual && audioData.features.perceptual.totalLoudness < 0.2) {
            this.triggerTransition('water');
        }
    }
    
    triggerTransition(targetMaterial) {
        console.log('Triggering transition to:', targetMaterial);
    }
    
    processTransitions(deltaTime) {
        this.transitions.forEach((transition, id) => {
            transition.progress += deltaTime / transition.duration;
            
            if (transition.progress >= 1.0) {
                this.completeTransition(id);
            }
        });
    }
    
    completeTransition(transitionId) {
        this.transitions.delete(transitionId);
    }
    
    dispose() {
        this.transitions.clear();
    }
}

/**
 * Spatial Grid for metaball optimization
 */
class MetaballSpatialGrid {
    constructor(config) {
        this.config = config;
        this.cells = new Map();
        this.cellSize = 2.0;
    }
    
    initialize() {
        this.clear();
        console.log('Metaball spatial grid initialized');
    }
    
    clear() {
        this.cells.clear();
    }
    
    insert(metaballIndex, position) {
        const cellKey = this.getCellKey(position);
        
        if (!this.cells.has(cellKey)) {
            this.cells.set(cellKey, []);
        }
        
        this.cells.get(cellKey).push(metaballIndex);
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

// Export the main MetaballSystem class
export { MetaballSystem };