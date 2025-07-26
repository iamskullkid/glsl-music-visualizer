/**
 * Fluid Simulation
 * Advanced Navier-Stokes based fluid dynamics simulation for the GLSL music visualizer
 * Implements real-time fluid physics with audio-reactive properties and material interactions
 * Location: src/physics/FluidSimulation.js
 */

import { MathUtils } from '../utils/MathUtils.js';
import { webglUtils } from '../utils/WebGLUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class FluidSimulation {
    constructor(options = {}) {
        // Grid resolution for fluid simulation
        this.gridWidth = options.gridWidth || 128;
        this.gridHeight = options.gridHeight || 128;
        this.gridDepth = options.gridDepth || 64;
        this.totalCells = this.gridWidth * this.gridHeight * this.gridDepth;
        
        // Physical parameters
        this.viscosity = options.viscosity || 0.0001;
        this.density = options.density || 1.0;
        this.diffusion = options.diffusion || 0.00001;
        this.buoyancy = options.buoyancy || -0.1;
        this.temperature = options.temperature || 20.0;
        
        // Simulation parameters
        this.timeStep = options.timeStep || 0.016; // 60 FPS
        this.cellSize = options.cellSize || 1.0;
        this.iterations = options.iterations || 20; // Gauss-Seidel iterations
        this.boundaryCondition = options.boundaryCondition || 'closed'; // 'closed', 'open', 'periodic'
        
        // Audio reactivity
        this.audioReactivity = {
            enabled: options.audioReactive !== false,
            bassInfluence: options.bassInfluence || 1.0,
            midInfluence: options.midInfluence || 0.7,
            trebleInfluence: options.trebleInfluence || 0.5,
            energyInfluence: options.energyInfluence || 1.2,
            beatInfluence: options.beatInfluence || 2.0
        };
        
        // Fluid state arrays - using typed arrays for performance
        this.velocity = {
            x: new Float32Array(this.totalCells),
            y: new Float32Array(this.totalCells),
            z: new Float32Array(this.totalCells),
            // Previous timestep for temporal smoothing
            xPrev: new Float32Array(this.totalCells),
            yPrev: new Float32Array(this.totalCells),
            zPrev: new Float32Array(this.totalCells)
        };
        
        this.pressure = new Float32Array(this.totalCells);
        this.pressurePrev = new Float32Array(this.totalCells);
        
        this.densityField = new Float32Array(this.totalCells);
        this.densityPrev = new Float32Array(this.totalCells);
        
        this.temperature = new Float32Array(this.totalCells);
        this.temperaturePrev = new Float32Array(this.totalCells);
        
        // Vorticity for enhanced fluid motion
        this.vorticity = {
            x: new Float32Array(this.totalCells),
            y: new Float32Array(this.totalCells),
            z: new Float32Array(this.totalCells)
        };
        
        // Material properties for different fluid types
        this.materialProperties = {
            water: {
                viscosity: 0.001,
                density: 1000,
                surfaceTension: 0.0728,
                refractionIndex: 1.33
            },
            oil: {
                viscosity: 0.1,
                density: 900,
                surfaceTension: 0.035,
                refractionIndex: 1.47
            },
            mercury: {
                viscosity: 0.00153,
                density: 13534,
                surfaceTension: 0.486,
                refractionIndex: 1.0
            },
            plasma: {
                viscosity: 0.00001,
                density: 1.225,
                surfaceTension: 0.0,
                refractionIndex: 1.0,
                electrical: true
            }
        };
        
        this.currentMaterial = 'water';
        
        // External forces (gravity, audio forces, user interaction)
        this.forces = {
            gravity: { x: 0, y: -9.81, z: 0 },
            external: { x: 0, y: 0, z: 0 },
            audio: { x: 0, y: 0, z: 0 }
        };
        
        // GPU compute shader support
        this.useGPUCompute = options.useGPUCompute !== false && webglUtils.supportsComputeShaders();
        this.gl = null;
        this.computePrograms = new Map();
        this.framebuffers = new Map();
        this.textures = new Map();
        
        // Performance monitoring
        this.performanceMetrics = {
            lastUpdateTime: 0,
            averageFrameTime: 16.67,
            gpuTime: 0,
            cpuTime: 0,
            memoryUsage: 0
        };
        
        // Boundary conditions
        this.boundaries = new Array(this.totalCells).fill(0); // 0 = fluid, 1 = solid boundary
        
        // Initialize system
        this.initialize();
        
        console.log('FluidSimulation initialized', {
            resolution: `${this.gridWidth}x${this.gridHeight}x${this.gridDepth}`,
            totalCells: this.totalCells,
            useGPUCompute: this.useGPUCompute,
            material: this.currentMaterial
        });
    }
    
    /**
     * Initialize fluid simulation
     */
    initialize() {
        // Fill initial conditions
        this.resetFluidState();
        
        // Initialize GPU compute if available
        if (this.useGPUCompute) {
            this.initializeGPUCompute();
        }
        
        // Set up default boundary conditions
        this.setupBoundaryConditions();
    }
    
    /**
     * Reset fluid to initial state
     */
    resetFluidState() {
        // Initialize with small random velocities for interesting initial conditions
        for (let i = 0; i < this.totalCells; i++) {
            this.velocity.x[i] = (Math.random() - 0.5) * 0.01;
            this.velocity.y[i] = (Math.random() - 0.5) * 0.01;
            this.velocity.z[i] = (Math.random() - 0.5) * 0.01;
            
            this.pressure[i] = 0;
            this.densityField[i] = this.density;
            this.temperature[i] = this.temperature;
        }
        
        // Clear previous state
        this.velocity.xPrev.fill(0);
        this.velocity.yPrev.fill(0);
        this.velocity.zPrev.fill(0);
        this.pressurePrev.fill(0);
        this.densityPrev.fill(this.density);
        this.temperaturePrev.fill(this.temperature);
    }
    
    /**
     * Set up boundary conditions for the simulation
     */
    setupBoundaryConditions() {
        for (let k = 0; k < this.gridDepth; k++) {
            for (let j = 0; j < this.gridHeight; j++) {
                for (let i = 0; i < this.gridWidth; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    // Mark boundaries based on condition type
                    if (this.boundaryCondition === 'closed') {
                        if (i === 0 || i === this.gridWidth - 1 ||
                            j === 0 || j === this.gridHeight - 1 ||
                            k === 0 || k === this.gridDepth - 1) {
                            this.boundaries[index] = 1; // Solid boundary
                        }
                    }
                    // Other boundary conditions would be implemented here
                }
            }
        }
    }
    
    /**
     * Convert 3D coordinates to 1D array index
     */
    getIndex(x, y, z) {
        x = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(x)));
        y = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(y)));
        z = Math.max(0, Math.min(this.gridDepth - 1, Math.floor(z)));
        return z * this.gridWidth * this.gridHeight + y * this.gridWidth + x;
    }
    
    /**
     * Convert 1D index back to 3D coordinates
     */
    getCoordinates(index) {
        const z = Math.floor(index / (this.gridWidth * this.gridHeight));
        const remainder = index % (this.gridWidth * this.gridHeight);
        const y = Math.floor(remainder / this.gridWidth);
        const x = remainder % this.gridWidth;
        return { x, y, z };
    }
    
    /**
     * Main simulation update step
     */
    update(deltaTime, audioData = null) {
        const startTime = performance.now();
        
        // Use fixed timestep for stability
        const timeStep = Math.min(deltaTime, this.timeStep);
        
        // Process audio input for reactive forces
        if (audioData && this.audioReactivity.enabled) {
            this.processAudioForces(audioData);
        }
        
        // Store previous state
        this.swapBuffers();
        
        if (this.useGPUCompute && this.gl) {
            this.updateGPU(timeStep);
        } else {
            this.updateCPU(timeStep);
        }
        
        // Update performance metrics
        this.performanceMetrics.lastUpdateTime = performance.now() - startTime;
        this.performanceMetrics.averageFrameTime = MathUtils.exponentialSmoothing(
            this.performanceMetrics.averageFrameTime,
            this.performanceMetrics.lastUpdateTime,
            0.1
        );
        
        // Report to performance monitor
        if (performanceMonitor) {
            performanceMonitor.recordCPUTime('physics', this.performanceMetrics.lastUpdateTime);
        }
    }
    
    /**
     * Process audio data to generate reactive forces
     */
    processAudioForces(audioData) {
        const { bassLevel, midLevel, trebleLevel, energy, beat, beatStrength } = audioData;
        
        // Calculate audio-driven forces
        const bassForce = bassLevel * this.audioReactivity.bassInfluence;
        const midForce = midLevel * this.audioReactivity.midInfluence;
        const trebleForce = trebleLevel * this.audioReactivity.trebleInfluence;
        const energyForce = energy * this.audioReactivity.energyInfluence;
        
        // Beat creates sudden force impulses
        if (beat) {
            const beatForce = beatStrength * this.audioReactivity.beatInfluence;
            this.addImpulse(
                this.gridWidth * 0.5,
                this.gridHeight * 0.3,
                this.gridDepth * 0.5,
                Math.random() * beatForce - beatForce * 0.5,
                beatForce,
                Math.random() * beatForce - beatForce * 0.5,
                10 // radius
            );
        }
        
        // Different frequencies affect different regions
        // Bass affects lower regions, treble affects upper regions
        const bassRegionY = this.gridHeight * 0.2;
        const trebleRegionY = this.gridHeight * 0.8;
        
        this.addContinuousForce(
            this.gridWidth * 0.5,
            bassRegionY,
            this.gridDepth * 0.5,
            (Math.random() - 0.5) * bassForce,
            bassForce * 0.5,
            (Math.random() - 0.5) * bassForce,
            20
        );
        
        this.addContinuousForce(
            this.gridWidth * 0.5,
            trebleRegionY,
            this.gridDepth * 0.5,
            (Math.random() - 0.5) * trebleForce,
            -trebleForce * 0.3,
            (Math.random() - 0.5) * trebleForce,
            15
        );
        
        // Mid frequencies create swirling motions
        const angle = Date.now() * 0.001 * midForce;
        this.addContinuousForce(
            this.gridWidth * 0.5 + Math.cos(angle) * 20,
            this.gridHeight * 0.5,
            this.gridDepth * 0.5 + Math.sin(angle) * 20,
            Math.cos(angle + Math.PI * 0.5) * midForce,
            0,
            Math.sin(angle + Math.PI * 0.5) * midForce,
            25
        );
    }
    
    /**
     * CPU-based fluid simulation update
     */
    updateCPU(timeStep) {
        // Step 1: Add forces (gravity, external, audio)
        this.addForces(timeStep);
        
        // Step 2: Advection - move quantities by velocity field
        this.advectVelocity(timeStep);
        this.advectDensity(timeStep);
        this.advectTemperature(timeStep);
        
        // Step 3: Diffusion - viscosity effects
        this.diffuseVelocity(timeStep);
        this.diffuseDensity(timeStep);
        this.diffuseTemperature(timeStep);
        
        // Step 4: Project velocity field to be incompressible
        this.projectVelocity();
        
        // Step 5: Calculate vorticity and apply vorticity confinement
        this.calculateVorticity();
        this.applyVorticityConfinement(timeStep);
        
        // Step 6: Apply buoyancy forces
        this.applyBuoyancy(timeStep);
        
        // Step 7: Apply boundary conditions
        this.applyBoundaryConditions();
    }
    
    /**
     * Add external forces to the fluid
     */
    addForces(timeStep) {
        for (let i = 0; i < this.totalCells; i++) {
            if (this.boundaries[i] === 0) { // Only affect fluid cells
                // Gravity
                this.velocity.x[i] += this.forces.gravity.x * timeStep;
                this.velocity.y[i] += this.forces.gravity.y * timeStep;
                this.velocity.z[i] += this.forces.gravity.z * timeStep;
                
                // External forces
                this.velocity.x[i] += this.forces.external.x * timeStep;
                this.velocity.y[i] += this.forces.external.y * timeStep;
                this.velocity.z[i] += this.forces.external.z * timeStep;
                
                // Audio forces
                this.velocity.x[i] += this.forces.audio.x * timeStep;
                this.velocity.y[i] += this.forces.audio.y * timeStep;
                this.velocity.z[i] += this.forces.audio.z * timeStep;
            }
        }
    }
    
    /**
     * Advect velocity field - semi-Lagrangian method
     */
    advectVelocity(timeStep) {
        this.advectField(
            this.velocity.x, this.velocity.xPrev,
            this.velocity.xPrev, this.velocity.yPrev, this.velocity.zPrev,
            timeStep
        );
        this.advectField(
            this.velocity.y, this.velocity.yPrev,
            this.velocity.xPrev, this.velocity.yPrev, this.velocity.zPrev,
            timeStep
        );
        this.advectField(
            this.velocity.z, this.velocity.zPrev,
            this.velocity.xPrev, this.velocity.yPrev, this.velocity.zPrev,
            timeStep
        );
    }
    
    /**
     * Advect density field
     */
    advectDensity(timeStep) {
        this.advectField(
            this.densityField, this.densityPrev,
            this.velocity.x, this.velocity.y, this.velocity.z,
            timeStep
        );
    }
    
    /**
     * Advect temperature field
     */
    advectTemperature(timeStep) {
        this.advectField(
            this.temperature, this.temperaturePrev,
            this.velocity.x, this.velocity.y, this.velocity.z,
            timeStep
        );
    }
    
    /**
     * Generic field advection using semi-Lagrangian method
     */
    advectField(field, prevField, velX, velY, velZ, timeStep) {
        const dt = timeStep / this.cellSize;
        
        for (let k = 1; k < this.gridDepth - 1; k++) {
            for (let j = 1; j < this.gridHeight - 1; j++) {
                for (let i = 1; i < this.gridWidth - 1; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 0) {
                        // Trace particle backwards
                        let x = i - dt * velX[index];
                        let y = j - dt * velY[index];
                        let z = k - dt * velZ[index];
                        
                        // Clamp to grid bounds
                        x = Math.max(0.5, Math.min(this.gridWidth - 1.5, x));
                        y = Math.max(0.5, Math.min(this.gridHeight - 1.5, y));
                        z = Math.max(0.5, Math.min(this.gridDepth - 1.5, z));
                        
                        // Trilinear interpolation
                        field[index] = this.interpolateTrilinear(prevField, x, y, z);
                    }
                }
            }
        }
    }
    
    /**
     * Trilinear interpolation for smooth field sampling
     */
    interpolateTrilinear(field, x, y, z) {
        const i0 = Math.floor(x), i1 = i0 + 1;
        const j0 = Math.floor(y), j1 = j0 + 1;
        const k0 = Math.floor(z), k1 = k0 + 1;
        
        const fx = x - i0;
        const fy = y - j0;
        const fz = z - k0;
        
        // Get the 8 surrounding values
        const c000 = field[this.getIndex(i0, j0, k0)];
        const c001 = field[this.getIndex(i0, j0, k1)];
        const c010 = field[this.getIndex(i0, j1, k0)];
        const c011 = field[this.getIndex(i0, j1, k1)];
        const c100 = field[this.getIndex(i1, j0, k0)];
        const c101 = field[this.getIndex(i1, j0, k1)];
        const c110 = field[this.getIndex(i1, j1, k0)];
        const c111 = field[this.getIndex(i1, j1, k1)];
        
        // Interpolate along x
        const c00 = c000 * (1 - fx) + c100 * fx;
        const c01 = c001 * (1 - fx) + c101 * fx;
        const c10 = c010 * (1 - fx) + c110 * fx;
        const c11 = c011 * (1 - fx) + c111 * fx;
        
        // Interpolate along y
        const c0 = c00 * (1 - fy) + c10 * fy;
        const c1 = c01 * (1 - fy) + c11 * fy;
        
        // Interpolate along z
        return c0 * (1 - fz) + c1 * fz;
    }
    
    /**
     * Diffuse velocity field using implicit method
     */
    diffuseVelocity(timeStep) {
        const viscosity = this.materialProperties[this.currentMaterial].viscosity;
        const alpha = timeStep * viscosity / (this.cellSize * this.cellSize);
        
        this.diffuseField(this.velocity.x, this.velocity.xPrev, alpha);
        this.diffuseField(this.velocity.y, this.velocity.yPrev, alpha);
        this.diffuseField(this.velocity.z, this.velocity.zPrev, alpha);
    }
    
    /**
     * Diffuse density field
     */
    diffuseDensity(timeStep) {
        const alpha = timeStep * this.diffusion / (this.cellSize * this.cellSize);
        this.diffuseField(this.densityField, this.densityPrev, alpha);
    }
    
    /**
     * Diffuse temperature field
     */
    diffuseTemperature(timeStep) {
        const alpha = timeStep * this.diffusion * 2.0 / (this.cellSize * this.cellSize);
        this.diffuseField(this.temperature, this.temperaturePrev, alpha);
    }
    
    /**
     * Generic field diffusion using Gauss-Seidel iteration
     */
    diffuseField(field, prevField, alpha) {
        const beta = 1.0 + 6.0 * alpha;
        
        for (let iter = 0; iter < this.iterations; iter++) {
            for (let k = 1; k < this.gridDepth - 1; k++) {
                for (let j = 1; j < this.gridHeight - 1; j++) {
                    for (let i = 1; i < this.gridWidth - 1; i++) {
                        const index = this.getIndex(i, j, k);
                        
                        if (this.boundaries[index] === 0) {
                            const neighbors = 
                                field[this.getIndex(i-1, j, k)] + field[this.getIndex(i+1, j, k)] +
                                field[this.getIndex(i, j-1, k)] + field[this.getIndex(i, j+1, k)] +
                                field[this.getIndex(i, j, k-1)] + field[this.getIndex(i, j, k+1)];
                            
                            field[index] = (prevField[index] + alpha * neighbors) / beta;
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Project velocity field to be divergence-free (incompressible)
     */
    projectVelocity() {
        // Calculate divergence
        const divergence = new Float32Array(this.totalCells);
        
        for (let k = 1; k < this.gridDepth - 1; k++) {
            for (let j = 1; j < this.gridHeight - 1; j++) {
                for (let i = 1; i < this.gridWidth - 1; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 0) {
                        divergence[index] = -0.5 * this.cellSize * (
                            this.velocity.x[this.getIndex(i+1, j, k)] - this.velocity.x[this.getIndex(i-1, j, k)] +
                            this.velocity.y[this.getIndex(i, j+1, k)] - this.velocity.y[this.getIndex(i, j-1, k)] +
                            this.velocity.z[this.getIndex(i, j, k+1)] - this.velocity.z[this.getIndex(i, j, k-1)]
                        );
                    }
                }
            }
        }
        
        // Solve pressure using Gauss-Seidel
        this.pressure.fill(0);
        
        for (let iter = 0; iter < this.iterations; iter++) {
            for (let k = 1; k < this.gridDepth - 1; k++) {
                for (let j = 1; j < this.gridHeight - 1; j++) {
                    for (let i = 1; i < this.gridWidth - 1; i++) {
                        const index = this.getIndex(i, j, k);
                        
                        if (this.boundaries[index] === 0) {
                            const neighbors = 
                                this.pressure[this.getIndex(i-1, j, k)] + this.pressure[this.getIndex(i+1, j, k)] +
                                this.pressure[this.getIndex(i, j-1, k)] + this.pressure[this.getIndex(i, j+1, k)] +
                                this.pressure[this.getIndex(i, j, k-1)] + this.pressure[this.getIndex(i, j, k+1)];
                            
                            this.pressure[index] = (divergence[index] + neighbors) / 6.0;
                        }
                    }
                }
            }
        }
        
        // Subtract pressure gradient from velocity
        for (let k = 1; k < this.gridDepth - 1; k++) {
            for (let j = 1; j < this.gridHeight - 1; j++) {
                for (let i = 1; i < this.gridWidth - 1; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 0) {
                        this.velocity.x[index] -= 0.5 * (
                            this.pressure[this.getIndex(i+1, j, k)] - this.pressure[this.getIndex(i-1, j, k)]
                        ) / this.cellSize;
                        
                        this.velocity.y[index] -= 0.5 * (
                            this.pressure[this.getIndex(i, j+1, k)] - this.pressure[this.getIndex(i, j-1, k)]
                        ) / this.cellSize;
                        
                        this.velocity.z[index] -= 0.5 * (
                            this.pressure[this.getIndex(i, j, k+1)] - this.pressure[this.getIndex(i, j, k-1)]
                        ) / this.cellSize;
                    }
                }
            }
        }
    }
    
    /**
     * Calculate vorticity (curl of velocity field)
     */
    calculateVorticity() {
        for (let k = 1; k < this.gridDepth - 1; k++) {
            for (let j = 1; j < this.gridHeight - 1; j++) {
                for (let i = 1; i < this.gridWidth - 1; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 0) {
                        // ω = ∇ × v
                        this.vorticity.x[index] = 0.5 * (
                            this.velocity.z[this.getIndex(i, j+1, k)] - this.velocity.z[this.getIndex(i, j-1, k)] -
                            this.velocity.y[this.getIndex(i, j, k+1)] + this.velocity.y[this.getIndex(i, j, k-1)]
                        ) / this.cellSize;
                        
                        this.vorticity.y[index] = 0.5 * (
                            this.velocity.x[this.getIndex(i, j, k+1)] - this.velocity.x[this.getIndex(i, j, k-1)] -
                            this.velocity.z[this.getIndex(i+1, j, k)] + this.velocity.z[this.getIndex(i-1, j, k)]
                        ) / this.cellSize;
                        
                        this.vorticity.z[index] = 0.5 * (
                            this.velocity.y[this.getIndex(i+1, j, k)] - this.velocity.y[this.getIndex(i-1, j, k)] -
                            this.velocity.x[this.getIndex(i, j+1, k)] + this.velocity.x[this.getIndex(i, j-1, k)]
                        ) / this.cellSize;
                    }
                }
            }
        }
    }
    
    /**
     * Apply vorticity confinement for enhanced swirling motion
     */
    applyVorticityConfinement(timeStep) {
        const epsilon = 0.01; // Vorticity confinement strength
        
        for (let k = 1; k < this.gridDepth - 1; k++) {
            for (let j = 1; j < this.gridHeight - 1; j++) {
                for (let i = 1; i < this.gridWidth - 1; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 0) {
                        // Calculate vorticity magnitude gradient
                        const vorticityMag = Math.sqrt(
                            this.vorticity.x[index] * this.vorticity.x[index] +
                            this.vorticity.y[index] * this.vorticity.y[index] +
                            this.vorticity.z[index] * this.vorticity.z[index]
                        );
                        
                        if (vorticityMag > 0.001) {
                            // Calculate gradient of vorticity magnitude
                            const gradX = 0.5 * (
                                Math.sqrt(
                                    this.vorticity.x[this.getIndex(i+1, j, k)] * this.vorticity.x[this.getIndex(i+1, j, k)] +
                                    this.vorticity.y[this.getIndex(i+1, j, k)] * this.vorticity.y[this.getIndex(i+1, j, k)] +
                                    this.vorticity.z[this.getIndex(i+1, j, k)] * this.vorticity.z[this.getIndex(i+1, j, k)]
                                ) -
                                Math.sqrt(
                                    this.vorticity.x[this.getIndex(i-1, j, k)] * this.vorticity.x[this.getIndex(i-1, j, k)] +
                                    this.vorticity.y[this.getIndex(i-1, j, k)] * this.vorticity.y[this.getIndex(i-1, j, k)] +
                                    this.vorticity.z[this.getIndex(i-1, j, k)] * this.vorticity.z[this.getIndex(i-1, j, k)]
                                )
                            ) / this.cellSize;
                            
                            const gradY = 0.5 * (
                                Math.sqrt(
                                    this.vorticity.x[this.getIndex(i, j+1, k)] * this.vorticity.x[this.getIndex(i, j+1, k)] +
                                    this.vorticity.y[this.getIndex(i, j+1, k)] * this.vorticity.y[this.getIndex(i, j+1, k)] +
                                    this.vorticity.z[this.getIndex(i, j+1, k)] * this.vorticity.z[this.getIndex(i, j+1, k)]
                                ) -
                                Math.sqrt(
                                    this.vorticity.x[this.getIndex(i, j-1, k)] * this.vorticity.x[this.getIndex(i, j-1, k)] +
                                    this.vorticity.y[this.getIndex(i, j-1, k)] * this.vorticity.y[this.getIndex(i, j-1, k)] +
                                    this.vorticity.z[this.getIndex(i, j-1, k)] * this.vorticity.z[this.getIndex(i, j-1, k)]
                                )
                            ) / this.cellSize;
                            
                            const gradZ = 0.5 * (
                                Math.sqrt(
                                    this.vorticity.x[this.getIndex(i, j, k+1)] * this.vorticity.x[this.getIndex(i, j, k+1)] +
                                    this.vorticity.y[this.getIndex(i, j, k+1)] * this.vorticity.y[this.getIndex(i, j, k+1)] +
                                    this.vorticity.z[this.getIndex(i, j, k+1)] * this.vorticity.z[this.getIndex(i, j, k+1)]
                                ) -
                                Math.sqrt(
                                    this.vorticity.x[this.getIndex(i, j, k-1)] * this.vorticity.x[this.getIndex(i, j, k-1)] +
                                    this.vorticity.y[this.getIndex(i, j, k-1)] * this.vorticity.y[this.getIndex(i, j, k-1)] +
                                    this.vorticity.z[this.getIndex(i, j, k-1)] * this.vorticity.z[this.getIndex(i, j, k-1)]
                                )
                            ) / this.cellSize;
                            
                            // Normalize gradient
                            const gradMag = Math.sqrt(gradX * gradX + gradY * gradY + gradZ * gradZ);
                            if (gradMag > 0.001) {
                                const normGradX = gradX / gradMag;
                                const normGradY = gradY / gradMag;
                                const normGradZ = gradZ / gradMag;
                                
                                // Apply vorticity confinement force: f = ε(N × ω)
                                this.velocity.x[index] += epsilon * timeStep * (
                                    normGradY * this.vorticity.z[index] - normGradZ * this.vorticity.y[index]
                                );
                                this.velocity.y[index] += epsilon * timeStep * (
                                    normGradZ * this.vorticity.x[index] - normGradX * this.vorticity.z[index]
                                );
                                this.velocity.z[index] += epsilon * timeStep * (
                                    normGradX * this.vorticity.y[index] - normGradY * this.vorticity.x[index]
                                );
                            }
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Apply buoyancy forces based on temperature and density differences
     */
    applyBuoyancy(timeStep) {
        const referenceTemperature = 20.0;
        const referenceDensity = this.materialProperties[this.currentMaterial].density;
        
        for (let i = 0; i < this.totalCells; i++) {
            if (this.boundaries[i] === 0) {
                // Temperature-based buoyancy
                const tempDiff = this.temperature[i] - referenceTemperature;
                const densityDiff = this.densityField[i] - referenceDensity;
                
                // Buoyancy force: F = ρ * g * β * ΔT (where β is thermal expansion coefficient)
                const thermalExpansion = 0.0002; // Typical for water
                const buoyancyForce = this.buoyancy * thermalExpansion * tempDiff - 
                                    this.buoyancy * (densityDiff / referenceDensity);
                
                this.velocity.y[i] += buoyancyForce * timeStep;
            }
        }
    }
    
    /**
     * Apply boundary conditions to all fields
     */
    applyBoundaryConditions() {
        this.setBoundaryVelocity();
        this.setBoundaryPressure();
        this.setBoundaryDensity();
        this.setBoundaryTemperature();
    }
    
    /**
     * Set velocity boundary conditions
     */
    setBoundaryVelocity() {
        // No-slip boundary condition for velocity (velocity = 0 at walls)
        for (let k = 0; k < this.gridDepth; k++) {
            for (let j = 0; j < this.gridHeight; j++) {
                for (let i = 0; i < this.gridWidth; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 1) {
                        this.velocity.x[index] = 0;
                        this.velocity.y[index] = 0;
                        this.velocity.z[index] = 0;
                    }
                }
            }
        }
    }
    
    /**
     * Set pressure boundary conditions
     */
    setBoundaryPressure() {
        // Neumann boundary condition for pressure (zero normal gradient)
        for (let k = 0; k < this.gridDepth; k++) {
            for (let j = 0; j < this.gridHeight; j++) {
                for (let i = 0; i < this.gridWidth; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 1) {
                        // Copy pressure from nearest fluid cell
                        let nearestFluidPressure = 0;
                        let found = false;
                        
                        // Check neighbors
                        const neighbors = [
                            this.getIndex(Math.max(0, i-1), j, k),
                            this.getIndex(Math.min(this.gridWidth-1, i+1), j, k),
                            this.getIndex(i, Math.max(0, j-1), k),
                            this.getIndex(i, Math.min(this.gridHeight-1, j+1), k),
                            this.getIndex(i, j, Math.max(0, k-1)),
                            this.getIndex(i, j, Math.min(this.gridDepth-1, k+1))
                        ];
                        
                        for (const neighborIndex of neighbors) {
                            if (this.boundaries[neighborIndex] === 0) {
                                nearestFluidPressure = this.pressure[neighborIndex];
                                found = true;
                                break;
                            }
                        }
                        
                        if (found) {
                            this.pressure[index] = nearestFluidPressure;
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Set density boundary conditions
     */
    setBoundaryDensity() {
        // Zero normal gradient for density
        for (let k = 0; k < this.gridDepth; k++) {
            for (let j = 0; j < this.gridHeight; j++) {
                for (let i = 0; i < this.gridWidth; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 1) {
                        this.densityField[index] = this.materialProperties[this.currentMaterial].density;
                    }
                }
            }
        }
    }
    
    /**
     * Set temperature boundary conditions
     */
    setBoundaryTemperature() {
        // Fixed temperature at boundaries
        for (let k = 0; k < this.gridDepth; k++) {
            for (let j = 0; j < this.gridHeight; j++) {
                for (let i = 0; i < this.gridWidth; i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 1) {
                        this.temperature[index] = 20.0; // Room temperature
                    }
                }
            }
        }
    }
    
    /**
     * Add an impulse force at a specific location
     */
    addImpulse(x, y, z, forceX, forceY, forceZ, radius) {
        const radiusSquared = radius * radius;
        
        for (let k = Math.max(0, Math.floor(z - radius)); k < Math.min(this.gridDepth, Math.ceil(z + radius)); k++) {
            for (let j = Math.max(0, Math.floor(y - radius)); j < Math.min(this.gridHeight, Math.ceil(y + radius)); j++) {
                for (let i = Math.max(0, Math.floor(x - radius)); i < Math.min(this.gridWidth, Math.ceil(x + radius)); i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 0) {
                        const dx = i - x;
                        const dy = j - y;
                        const dz = k - z;
                        const distSquared = dx * dx + dy * dy + dz * dz;
                        
                        if (distSquared < radiusSquared) {
                            const falloff = Math.exp(-distSquared / radiusSquared);
                            
                            this.velocity.x[index] += forceX * falloff;
                            this.velocity.y[index] += forceY * falloff;
                            this.velocity.z[index] += forceZ * falloff;
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Add continuous force over time at a specific location
     */
    addContinuousForce(x, y, z, forceX, forceY, forceZ, radius) {
        const radiusSquared = radius * radius;
        
        for (let k = Math.max(0, Math.floor(z - radius)); k < Math.min(this.gridDepth, Math.ceil(z + radius)); k++) {
            for (let j = Math.max(0, Math.floor(y - radius)); j < Math.min(this.gridHeight, Math.ceil(y + radius)); j++) {
                for (let i = Math.max(0, Math.floor(x - radius)); i < Math.min(this.gridWidth, Math.ceil(x + radius)); i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 0) {
                        const dx = i - x;
                        const dy = j - y;
                        const dz = k - z;
                        const distSquared = dx * dx + dy * dy + dz * dz;
                        
                        if (distSquared < radiusSquared) {
                            const falloff = Math.exp(-distSquared / radiusSquared);
                            
                            this.forces.external.x += forceX * falloff * 0.01;
                            this.forces.external.y += forceY * falloff * 0.01;
                            this.forces.external.z += forceZ * falloff * 0.01;
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Add density source at a specific location
     */
    addDensitySource(x, y, z, amount, radius) {
        const radiusSquared = radius * radius;
        
        for (let k = Math.max(0, Math.floor(z - radius)); k < Math.min(this.gridDepth, Math.ceil(z + radius)); k++) {
            for (let j = Math.max(0, Math.floor(y - radius)); j < Math.min(this.gridHeight, Math.ceil(y + radius)); j++) {
                for (let i = Math.max(0, Math.floor(x - radius)); i < Math.min(this.gridWidth, Math.ceil(x + radius)); i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 0) {
                        const dx = i - x;
                        const dy = j - y;
                        const dz = k - z;
                        const distSquared = dx * dx + dy * dy + dz * dz;
                        
                        if (distSquared < radiusSquared) {
                            const falloff = Math.exp(-distSquared / radiusSquared);
                            this.densityField[index] += amount * falloff;
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Add temperature source at a specific location
     */
    addTemperatureSource(x, y, z, temperature, radius) {
        const radiusSquared = radius * radius;
        
        for (let k = Math.max(0, Math.floor(z - radius)); k < Math.min(this.gridDepth, Math.ceil(z + radius)); k++) {
            for (let j = Math.max(0, Math.floor(y - radius)); j < Math.min(this.gridHeight, Math.ceil(y + radius)); j++) {
                for (let i = Math.max(0, Math.floor(x - radius)); i < Math.min(this.gridWidth, Math.ceil(x + radius)); i++) {
                    const index = this.getIndex(i, j, k);
                    
                    if (this.boundaries[index] === 0) {
                        const dx = i - x;
                        const dy = j - y;
                        const dz = k - z;
                        const distSquared = dx * dx + dy * dy + dz * dz;
                        
                        if (distSquared < radiusSquared) {
                            const falloff = Math.exp(-distSquared / radiusSquared);
                            this.temperature[index] = MathUtils.lerp(
                                this.temperature[index],
                                temperature,
                                falloff * 0.1
                            );
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Swap current and previous buffers
     */
    swapBuffers() {
        [this.velocity.x, this.velocity.xPrev] = [this.velocity.xPrev, this.velocity.x];
        [this.velocity.y, this.velocity.yPrev] = [this.velocity.yPrev, this.velocity.y];
        [this.velocity.z, this.velocity.zPrev] = [this.velocity.zPrev, this.velocity.z];
        [this.pressure, this.pressurePrev] = [this.pressurePrev, this.pressure];
        [this.densityField, this.densityPrev] = [this.densityPrev, this.densityField];
        [this.temperature, this.temperaturePrev] = [this.temperaturePrev, this.temperature];
    }
    
    /**
     * Initialize GPU compute shaders (if supported)
     */
    initializeGPUCompute() {
        if (!this.useGPUCompute) return;
        
        try {
            this.gl = webglUtils.gl;
            
            // Create compute shader programs for each simulation step
            this.createComputePrograms();
            
            // Create textures for fluid state
            this.createFluidTextures();
            
            // Create framebuffers for compute operations
            this.createComputeFramebuffers();
            
            console.log('GPU compute initialized for fluid simulation');
        } catch (error) {
            console.warn('Failed to initialize GPU compute, falling back to CPU:', error);
            this.useGPUCompute = false;
        }
    }
    
    /**
     * Create compute shader programs
     */
    createComputePrograms() {
        // This would implement GPU compute shaders for fluid simulation
        // For now, we'll stub this as it requires extensive GLSL compute shader code
        console.log('GPU compute programs would be created here');
    }
    
    /**
     * Create fluid state textures
     */
    createFluidTextures() {
        const gl = this.gl;
        
        // Create 3D textures for velocity, pressure, density, temperature
        const textureNames = ['velocity', 'pressure', 'density', 'temperature'];
        
        for (const name of textureNames) {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_3D, texture);
            
            // Set texture parameters
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
            
            // Allocate texture memory
            gl.texImage3D(
                gl.TEXTURE_3D, 0, gl.RGBA32F,
                this.gridWidth, this.gridHeight, this.gridDepth,
                0, gl.RGBA, gl.FLOAT, null
            );
            
            this.textures.set(name, texture);
        }
    }
    
    /**
     * Create compute framebuffers
     */
    createComputeFramebuffers() {
        const gl = this.gl;
        
        // Create framebuffers for each texture
        for (const [name, texture] of this.textures) {
            const framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            
            // Attach texture to framebuffer
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_3D, texture, 0
            );
            
            this.framebuffers.set(name, framebuffer);
        }
    }
    
    /**
     * GPU-based fluid simulation update
     */
    updateGPU(timeStep) {
        // This would implement the GPU version of the fluid simulation
        // For now, fall back to CPU
        console.log('GPU fluid simulation would run here');
        this.updateCPU(timeStep);
    }
    
    /**
     * Change fluid material properties
     */
    setMaterial(materialName) {
        if (this.materialProperties.hasOwnProperty(materialName)) {
            this.currentMaterial = materialName;
            const props = this.materialProperties[materialName];
            
            console.log(`Switched to material: ${materialName}`, props);
        } else {
            console.warn(`Unknown material: ${materialName}`);
        }
    }
    
    /**
     * Get velocity at a specific world position
     */
    getVelocityAt(worldX, worldY, worldZ) {
        const gridX = (worldX / this.cellSize) + this.gridWidth * 0.5;
        const gridY = (worldY / this.cellSize) + this.gridHeight * 0.5;
        const gridZ = (worldZ / this.cellSize) + this.gridDepth * 0.5;
        
        if (gridX < 0 || gridX >= this.gridWidth ||
            gridY < 0 || gridY >= this.gridHeight ||
            gridZ < 0 || gridZ >= this.gridDepth) {
            return { x: 0, y: 0, z: 0 };
        }
        
        return {
            x: this.interpolateTrilinear(this.velocity.x, gridX, gridY, gridZ),
            y: this.interpolateTrilinear(this.velocity.y, gridX, gridY, gridZ),
            z: this.interpolateTrilinear(this.velocity.z, gridX, gridY, gridZ)
        };
    }
    
    /**
     * Get density at a specific world position
     */
    getDensityAt(worldX, worldY, worldZ) {
        const gridX = (worldX / this.cellSize) + this.gridWidth * 0.5;
        const gridY = (worldY / this.cellSize) + this.gridHeight * 0.5;
        const gridZ = (worldZ / this.cellSize) + this.gridDepth * 0.5;
        
        if (gridX < 0 || gridX >= this.gridWidth ||
            gridY < 0 || gridY >= this.gridHeight ||
            gridZ < 0 || gridZ >= this.gridDepth) {
            return this.materialProperties[this.currentMaterial].density;
        }
        
        return this.interpolateTrilinear(this.densityField, gridX, gridY, gridZ);
    }
    
    /**
     * Get temperature at a specific world position
     */
    getTemperatureAt(worldX, worldY, worldZ) {
        const gridX = (worldX / this.cellSize) + this.gridWidth * 0.5;
        const gridY = (worldY / this.cellSize) + this.gridHeight * 0.5;
        const gridZ = (worldZ / this.cellSize) + this.gridDepth * 0.5;
        
        if (gridX < 0 || gridX >= this.gridWidth ||
            gridY < 0 || gridY >= this.gridHeight ||
            gridZ < 0 || gridZ >= this.gridDepth) {
            return 20.0;
        }
        
        return this.interpolateTrilinear(this.temperature, gridX, gridY, gridZ);
    }
    
    /**
     * Set external forces
     */
    setExternalForces(forceX, forceY, forceZ) {
        this.forces.external.x = forceX;
        this.forces.external.y = forceY;
        this.forces.external.z = forceZ;
    }
    
    /**
     * Get simulation statistics
     */
    getStatistics() {
        // Calculate fluid statistics
        let totalEnergy = 0;
        let maxVelocity = 0;
        let avgDensity = 0;
        let avgTemperature = 0;
        let fluidCells = 0;
        
        for (let i = 0; i < this.totalCells; i++) {
            if (this.boundaries[i] === 0) {
                const vx = this.velocity.x[i];
                const vy = this.velocity.y[i];
                const vz = this.velocity.z[i];
                const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
                
                totalEnergy += 0.5 * this.densityField[i] * speed * speed;
                maxVelocity = Math.max(maxVelocity, speed);
                avgDensity += this.densityField[i];
                avgTemperature += this.temperature[i];
                fluidCells++;
            }
        }
        
        return {
            totalEnergy,
            maxVelocity,
            avgDensity: avgDensity / fluidCells,
            avgTemperature: avgTemperature / fluidCells,
            fluidCells,
            performance: this.performanceMetrics
        };
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        console.log('Disposing FluidSimulation...');
        
        // Clean up GPU resources
        if (this.gl) {
            for (const texture of this.textures.values()) {
                this.gl.deleteTexture(texture);
            }
            for (const framebuffer of this.framebuffers.values()) {
                this.gl.deleteFramebuffer(framebuffer);
            }
            for (const program of this.computePrograms.values()) {
                this.gl.deleteProgram(program);
            }
        }
        
        // Clear arrays
        this.velocity.x = null;
        this.velocity.y = null;
        this.velocity.z = null;
        this.velocity.xPrev = null;
        this.velocity.yPrev = null;
        this.velocity.zPrev = null;
        this.pressure = null;
        this.pressurePrev = null;
        this.densityField = null;
        this.densityPrev = null;
        this.temperature = null;
        this.temperaturePrev = null;
        this.vorticity.x = null;
        this.vorticity.y = null;
        this.vorticity.z = null;
        this.boundaries = null;
        
        // Clear maps
        this.textures.clear();
        this.framebuffers.clear();
        this.computePrograms.clear();
        
        console.log('FluidSimulation disposed');
    }
}