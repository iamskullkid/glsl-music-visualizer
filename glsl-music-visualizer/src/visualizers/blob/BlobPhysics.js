/**
 * Blob Physics System
 * Coordinates metaball physics, fluid simulation, and material interactions
 * specifically for the blob visualizer implementation
 * Location: src/visualizers/blob/BlobPhysics.js
 */

import { MetaballSystem } from '../../physics/MetaballSystem.js';
import { FluidSimulation } from '../../physics/FluidSimulation.js';
import { ParticleSystem } from '../../physics/ParticleSystem.js';
import { MaterialPhysics } from '../../physics/MaterialPhysics.js';
import { MathUtils } from '../../utils/MathUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';
import { vec3, vec4, mat4 } from 'gl-matrix';

export class BlobPhysics {
    constructor(config = {}) {
        // Configuration
        this.config = {
            // Core physics settings
            enableMetaballs: config.enableMetaballs !== false,
            enableFluidSim: config.enableFluidSim !== false,
            enableParticles: config.enableParticles !== false,
            enableMaterialPhysics: config.enableMaterialPhysics !== false,
            
            // Integration settings
            metaballFluidCoupling: config.metaballFluidCoupling !== false,
            fluidParticleCoupling: config.fluidParticleCoupling !== false,
            materialPhysicsCoupling: config.materialPhysicsCoupling !== false,
            
            // Performance settings
            updateFrequency: config.updateFrequency || 60,
            qualityLevel: config.qualityLevel || 1.0,
            adaptiveQuality: config.adaptiveQuality !== false,
            
            // Audio reactivity
            audioReactivity: config.audioReactivity || 1.0,
            bassResponse: config.bassResponse || 1.0,
            midResponse: config.midResponse || 0.7,
            trebleResponse: config.trebleResponse || 0.5,
            beatResponse: config.beatResponse || 1.5,
            
            // Metaball settings
            metaballCount: config.metaballCount || 8,
            metaballRadius: config.metaballRadius || 1.5,
            metaballCharge: config.metaballCharge || 1.0,
            
            // Fluid simulation settings
            fluidViscosity: config.fluidViscosity || 0.0001,
            fluidDensity: config.fluidDensity || 1000.0,
            surfaceTension: config.surfaceTension || 0.07,
            
            // Particle settings
            particleCount: config.particleCount || 1000,
            particleLifetime: config.particleLifetime || 5.0,
            
            ...config
        };
        
        // Physics system references
        this.metaballSystem = null;
        this.fluidSimulation = null;
        this.particleSystem = null;
        this.materialPhysics = null;
        
        // State management
        this.state = {
            isInitialized: false,
            isActive: false,
            currentMaterial: 'water',
            lastUpdate: 0,
            frameCount: 0,
            
            // Physics state
            metaballPositions: [],
            fluidVelocityField: null,
            particleEmitters: [],
            materialProperties: null,
            
            // Audio state
            audioData: null,
            audioInfluence: {
                energy: 0,
                bass: 0,
                mid: 0,
                treble: 0,
                beat: false,
                beatStrength: 0
            },
            
            // Performance tracking
            lastPerformanceUpdate: 0,
            averageUpdateTime: 0,
            targetFrameTime: 16.67 // 60 FPS
        };
        
        // Integration data
        this.integrationData = {
            // Metaball -> Fluid forces
            metaballForces: new Float32Array(32 * 3), // Up to 32 metaballs
            
            // Fluid -> Particle velocities
            fluidVelocities: new Map(),
            
            // Material property cache
            materialCache: new Map(),
            
            // Audio influence cache
            audioInfluenceCache: {
                metaballSizes: new Float32Array(32),
                metaballCharges: new Float32Array(32),
                fluidViscosity: 0,
                particleEmission: 0,
                lastUpdate: 0
            }
        };
        
        // Performance optimization
        this.optimization = {
            enableLOD: true,
            lodDistance: 50.0,
            frustumCulling: true,
            adaptiveGridSize: true,
            skipFrames: 0,
            maxSkipFrames: 2
        };
        
        // Event callbacks
        this.eventCallbacks = new Map([
            ['materialChanged', []],
            ['physicsUpdated', []],
            ['performanceChanged', []],
            ['error', []]
        ]);
        
        console.log('BlobPhysics initialized with config:', this.config);
    }
    
    /**
     * Initialize all physics systems
     */
    async initialize(gl, integrations = {}) {
        try {
            console.log('Initializing BlobPhysics systems...');
            
            // Store integrations
            this.integrations = integrations;
            
            // Initialize MetaballSystem
            if (this.config.enableMetaballs) {
                this.metaballSystem = new MetaballSystem({
                    maxMetaballs: 32,
                    initialMetaballCount: this.config.metaballCount,
                    gridResolution: this.calculateOptimalGridResolution(),
                    enablePhysics: true,
                    enableAudioReactivity: true,
                    audioInfluence: {
                        size: this.config.audioReactivity,
                        position: this.config.audioReactivity * 0.5,
                        charge: this.config.audioReactivity * 0.8
                    }
                });
                
                await this.metaballSystem.initialize(gl);
                console.log('MetaballSystem initialized');
            }
            
            // Initialize FluidSimulation
            if (this.config.enableFluidSim) {
                this.fluidSimulation = new FluidSimulation({
                    gridWidth: 64,
                    gridHeight: 64,
                    gridDepth: 64,
                    viscosity: this.config.fluidViscosity,
                    density: this.config.fluidDensity,
                    audioReactive: true,
                    bassInfluence: this.config.bassResponse,
                    midInfluence: this.config.midResponse,
                    trebleInfluence: this.config.trebleResponse
                });
                
                await this.fluidSimulation.initialize(gl);
                console.log('FluidSimulation initialized');
            }
            
            // Initialize ParticleSystem
            if (this.config.enableParticles) {
                this.particleSystem = new ParticleSystem({
                    maxParticles: this.config.particleCount,
                    enableAudioReactivity: true,
                    audioInfluence: {
                        emission: this.config.beatResponse,
                        velocity: this.config.audioReactivity * 0.5,
                        size: this.config.audioReactivity * 0.3
                    }
                });
                
                await this.particleSystem.initialize(gl);
                console.log('ParticleSystem initialized');
            }
            
            // Initialize MaterialPhysics
            if (this.config.enableMaterialPhysics) {
                this.materialPhysics = new MaterialPhysics({
                    audioReactive: true,
                    enablePhaseTransitions: true,
                    enableSurfaceTension: true
                });
                
                await this.materialPhysics.initialize();
                console.log('MaterialPhysics initialized');
            }
            
            // Setup integration connections
            this.setupSystemIntegrations();
            
            // Initialize performance monitoring
            this.initializePerformanceMonitoring();
            
            this.state.isInitialized = true;
            console.log('BlobPhysics initialization complete');
            
        } catch (error) {
            console.error('Failed to initialize BlobPhysics:', error);
            this.handleError('initialization', error);
            throw error;
        }
    }
    
    /**
     * Update all physics systems with integration
     */
    update(deltaTime, audioData = null) {
        if (!this.state.isInitialized) return;
        
        const startTime = performance.now();
        
        // Performance-based frame skipping
        if (this.shouldSkipFrame()) {
            this.optimization.skipFrames++;
            return;
        }
        
        // Update audio state
        this.updateAudioState(audioData);
        
        // Update material properties if changed
        this.updateMaterialProperties();
        
        // Calculate audio influence for all systems
        this.updateAudioInfluence(audioData);
        
        // Update individual physics systems
        this.updatePhysicsSystems(deltaTime);
        
        // Handle system integrations
        this.updateSystemIntegrations(deltaTime);
        
        // Update performance metrics
        this.updatePerformanceMetrics(startTime);
        
        this.state.frameCount++;
        this.state.lastUpdate = performance.now();
    }
    
    /**
     * Update individual physics systems
     */
    updatePhysicsSystems(deltaTime) {
        try {
            // Update MetaballSystem
            if (this.metaballSystem && this.config.enableMetaballs) {
                this.updateMetaballs(deltaTime);
            }
            
            // Update FluidSimulation
            if (this.fluidSimulation && this.config.enableFluidSim) {
                this.updateFluid(deltaTime);
            }
            
            // Update ParticleSystem
            if (this.particleSystem && this.config.enableParticles) {
                this.updateParticles(deltaTime);
            }
            
            // Update MaterialPhysics
            if (this.materialPhysics && this.config.enableMaterialPhysics) {
                this.updateMaterialPhysics(deltaTime);
            }
            
        } catch (error) {
            console.error('Error updating physics systems:', error);
            this.handleError('update', error);
        }
    }
    
    /**
     * Update metaball system with audio reactivity
     */
    updateMetaballs(deltaTime) {
        // Apply audio-reactive scaling to metaballs
        const audioInfluence = this.state.audioInfluence;
        
        // Update metaball sizes based on audio
        const baseScale = 1.0 + audioInfluence.energy * this.config.audioReactivity * 0.3;
        const beatScale = audioInfluence.beat ? 1.0 + audioInfluence.beatStrength * 0.2 : 1.0;
        
        // Apply frequency-specific effects
        for (let i = 0; i < this.config.metaballCount; i++) {
            const frequencyWeight = i / this.config.metaballCount;
            let scale = baseScale * beatScale;
            
            // Bass affects lower-index metaballs more
            if (frequencyWeight < 0.3) {
                scale *= 1.0 + audioInfluence.bass * this.config.bassResponse * 0.2;
            }
            // Treble affects higher-index metaballs more
            else if (frequencyWeight > 0.7) {
                scale *= 1.0 + audioInfluence.treble * this.config.trebleResponse * 0.15;
            }
            // Mid frequencies affect middle metaballs
            else {
                scale *= 1.0 + audioInfluence.mid * this.config.midResponse * 0.1;
            }
            
            this.integrationData.audioInfluenceCache.metaballSizes[i] = scale;
        }
        
        // Update metaball system
        this.metaballSystem.update(deltaTime, this.state.audioData);
        
        // Cache metaball positions for other systems
        this.cacheMetaballPositions();
    }
    
    /**
     * Update fluid simulation with metaball influences
     */
    updateFluid(deltaTime) {
        // Apply audio-reactive viscosity changes
        const audioViscosity = this.config.fluidViscosity * 
            (1.0 + this.state.audioInfluence.energy * this.config.audioReactivity * 0.5);
        this.integrationData.audioInfluenceCache.fluidViscosity = audioViscosity;
        
        // Apply metaball forces to fluid if coupling is enabled
        if (this.config.metaballFluidCoupling && this.metaballSystem) {
            this.applyMetaballForcesToFluid();
        }
        
        // Update fluid simulation
        this.fluidSimulation.update(deltaTime, this.state.audioData);
    }
    
    /**
     * Update particle system with fluid influences
     */
    updateParticles(deltaTime) {
        // Audio-reactive particle emission
        const audioEmission = this.state.audioInfluence.beat ? 
            this.state.audioInfluence.beatStrength * this.config.beatResponse : 0;
        this.integrationData.audioInfluenceCache.particleEmission = audioEmission;
        
        // Apply fluid velocities to particles if coupling is enabled
        if (this.config.fluidParticleCoupling && this.fluidSimulation) {
            this.applyFluidVelocitiesToParticles();
        }
        
        // Update particle system
        this.particleSystem.update(deltaTime, this.state.audioData);
    }
    
    /**
     * Update material physics
     */
    updateMaterialPhysics(deltaTime) {
        if (!this.materialPhysics) return;
        
        // Update material physics with current properties
        this.materialPhysics.update(deltaTime, this.state.audioData);
        
        // Apply material physics to other systems if coupling is enabled
        if (this.config.materialPhysicsCoupling) {
            this.applyMaterialPhysicsToSystems();
        }
    }
    
    /**
     * Handle system integrations
     */
    updateSystemIntegrations(deltaTime) {
        // Metaball -> Fluid coupling
        if (this.config.metaballFluidCoupling) {
            this.integrateMetaballsWithFluid(deltaTime);
        }
        
        // Fluid -> Particle coupling
        if (this.config.fluidParticleCoupling) {
            this.integrateFluidWithParticles(deltaTime);
        }
        
        // Material physics integration
        if (this.config.materialPhysicsCoupling) {
            this.integrateMaterialPhysics(deltaTime);
        }
    }
    
    /**
     * Apply metaball forces to fluid simulation
     */
    applyMetaballForcesToFluid() {
        if (!this.metaballSystem || !this.fluidSimulation) return;
        
        const metaballPositions = this.state.metaballPositions;
        
        for (let i = 0; i < metaballPositions.length; i += 3) {
            const x = metaballPositions[i];
            const y = metaballPositions[i + 1];
            const z = metaballPositions[i + 2];
            
            // Calculate force based on metaball properties
            const scale = this.integrationData.audioInfluenceCache.metaballSizes[i / 3] || 1.0;
            const forceStrength = scale * 0.5;
            
            // Apply radial force
            this.fluidSimulation.addImpulse(x, y, z, 0, forceStrength, 0, scale * 2.0);
        }
    }
    
    /**
     * Apply fluid velocities to particles
     */
    applyFluidVelocitiesToParticles() {
        if (!this.fluidSimulation || !this.particleSystem) return;
        
        // This would sample fluid velocities at particle positions
        // and apply them as additional forces
        // Implementation depends on particle system API
    }
    
    /**
     * Apply material physics to all systems
     */
    applyMaterialPhysicsToSystems() {
        if (!this.materialPhysics) return;
        
        const materialProps = this.materialPhysics.getMaterialProperties();
        
        // Update fluid properties
        if (this.fluidSimulation) {
            this.fluidSimulation.setViscosity(materialProps.viscosity);
            this.fluidSimulation.setDensity(materialProps.density);
        }
        
        // Update metaball properties
        if (this.metaballSystem) {
            // Apply material-specific metaball behaviors
            this.updateMetaballMaterialProperties(materialProps);
        }
    }
    
    /**
     * Update audio influence calculations
     */
    updateAudioInfluence(audioData) {
        if (!audioData) return;
        
        const influence = this.state.audioInfluence;
        
        // Update basic audio features
        influence.energy = audioData.features?.energy || 0;
        influence.bass = audioData.features?.bass || 0;
        influence.mid = audioData.features?.mid || 0;
        influence.treble = audioData.features?.treble || 0;
        influence.beat = audioData.features?.beat || false;
        influence.beatStrength = audioData.features?.beatStrength || 0;
        
        // Cache timestamp
        this.integrationData.audioInfluenceCache.lastUpdate = performance.now();
    }
    
    /**
     * Cache metaball positions for other systems
     */
    cacheMetaballPositions() {
        if (!this.metaballSystem) return;
        
        // Get metaball positions from metaball system
        const positions = this.metaballSystem.getMetaballPositions();
        this.state.metaballPositions = positions;
    }
    
    /**
     * Update material properties
     */
    updateMaterialProperties() {
        // Check if material has changed
        const currentMaterial = this.integrations?.materialManager?.getCurrentMaterial();
        
        if (currentMaterial && currentMaterial.id !== this.state.currentMaterial) {
            this.state.currentMaterial = currentMaterial.id;
            this.onMaterialChanged(currentMaterial);
        }
    }
    
    /**
     * Handle material change
     */
    onMaterialChanged(material) {
        console.log('BlobPhysics: Material changed to', material.id);
        
        // Update physics systems with new material properties
        if (this.materialPhysics) {
            this.materialPhysics.setMaterial(material.id);
        }
        
        // Update fluid properties
        if (this.fluidSimulation && material.properties?.physical) {
            const props = material.properties.physical;
            this.fluidSimulation.setViscosity(props.viscosity || this.config.fluidViscosity);
            this.fluidSimulation.setDensity(props.density || this.config.fluidDensity);
        }
        
        // Emit material changed event
        this.emit('materialChanged', material);
    }
    
    /**
     * Calculate optimal grid resolution based on performance
     */
    calculateOptimalGridResolution() {
        const baseResolution = 64;
        const qualityMultiplier = this.config.qualityLevel;
        
        return Math.floor(baseResolution * qualityMultiplier);
    }
    
    /**
     * Performance-based frame skipping
     */
    shouldSkipFrame() {
        if (!this.config.adaptiveQuality) return false;
        
        const currentTime = performance.now();
        const frameTime = currentTime - this.state.lastUpdate;
        
        // Skip if we're running too slow
        if (frameTime > this.state.targetFrameTime * 1.5 && 
            this.optimization.skipFrames < this.optimization.maxSkipFrames) {
            return true;
        }
        
        this.optimization.skipFrames = 0;
        return false;
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(startTime) {
        const updateTime = performance.now() - startTime;
        
        // Exponential smoothing for average update time
        this.state.averageUpdateTime = MathUtils.exponentialSmoothing(
            this.state.averageUpdateTime,
            updateTime,
            0.1
        );
        
        // Report to performance monitor
        if (performance.now() - this.state.lastPerformanceUpdate > 1000) {
            if (performanceMonitor && performanceMonitor.recordCPUTime) {
                performanceMonitor.recordCPUTime('blobPhysics', this.state.averageUpdateTime);
            }
            this.state.lastPerformanceUpdate = performance.now();
            
            this.emit('performanceChanged', {
                averageUpdateTime: this.state.averageUpdateTime,
                frameCount: this.state.frameCount
            });
        }
    }
    
    /**
     * Get current physics state for rendering
     */
    getPhysicsState() {
        return {
            metaballs: this.metaballSystem?.getMetaballData() || null,
            fluidVelocities: this.fluidSimulation?.getVelocityField() || null,
            particles: this.particleSystem?.getParticleData() || null,
            materialProperties: this.materialPhysics?.getMaterialProperties() || null,
            audioInfluence: { ...this.state.audioInfluence }
        };
    }
    
    /**
     * Set physics configuration
     */
    setConfiguration(newConfig) {
        Object.assign(this.config, newConfig);
        
        // Apply configuration to subsystems
        if (this.metaballSystem && newConfig.metaballCount) {
            this.metaballSystem.setMetaballCount(newConfig.metaballCount);
        }
        
        if (this.fluidSimulation && newConfig.fluidViscosity) {
            this.fluidSimulation.setViscosity(newConfig.fluidViscosity);
        }
        
        console.log('BlobPhysics configuration updated');
    }
    
    /**
     * Initialize performance monitoring
     */
    initializePerformanceMonitoring() {
        if (performanceMonitor && performanceMonitor.registerSystem) {
            performanceMonitor.registerSystem('BlobPhysics', {
                updateCallback: (metrics) => this.onPerformanceUpdate(metrics),
                thresholds: {
                    maxUpdateTime: 10.0, // 10ms
                    targetFPS: 60
                }
            });
        }
    }
    
    /**
     * Setup system integrations
     */
    setupSystemIntegrations() {
        // Connect metaball system events
        if (this.metaballSystem && this.metaballSystem.on) {
            this.metaballSystem.on('metaballsChanged', () => this.cacheMetaballPositions());
        }
        
        // Connect material physics events
        if (this.materialPhysics && this.materialPhysics.on) {
            this.materialPhysics.on('materialChanged', (props) => {
                this.state.materialProperties = props;
            });
        }
    }
    
    /**
     * Update audio state
     */
    updateAudioState(audioData) {
        this.state.audioData = audioData;
    }
    
    /**
     * Handle errors
     */
    handleError(context, error) {
        console.error(`BlobPhysics error in ${context}:`, error);
        this.emit('error', { context, error });
    }
    
    /**
     * Performance update callback
     */
    onPerformanceUpdate(metrics) {
        // Adjust quality based on performance
        if (this.config.adaptiveQuality) {
            if (metrics.averageFrameTime > this.state.targetFrameTime * 1.2) {
                this.config.qualityLevel = Math.max(0.5, this.config.qualityLevel - 0.1);
            } else if (metrics.averageFrameTime < this.state.targetFrameTime * 0.8) {
                this.config.qualityLevel = Math.min(1.0, this.config.qualityLevel + 0.05);
            }
        }
    }
    
    // ===== EVENT SYSTEM =====
    
    on(event, callback) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).push(callback);
        }
    }
    
    off(event, callback) {
        if (this.eventCallbacks.has(event)) {
            const callbacks = this.eventCallbacks.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in BlobPhysics event callback for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Dispose of all physics systems
     */
    dispose() {
        console.log('Disposing BlobPhysics...');
        
        // Dispose individual systems
        this.metaballSystem?.dispose();
        this.fluidSimulation?.dispose();
        this.particleSystem?.dispose();
        this.materialPhysics?.dispose();
        
        // Clear references
        this.metaballSystem = null;
        this.fluidSimulation = null;
        this.particleSystem = null;
        this.materialPhysics = null;
        
        // Clear caches
        this.integrationData.materialCache.clear();
        this.integrationData.fluidVelocities.clear();
        
        // Clear event callbacks
        this.eventCallbacks.forEach(callbacks => callbacks.length = 0);
        
        // Unregister from performance monitor
        if (performanceMonitor && performanceMonitor.unregisterSystem) {
            performanceMonitor.unregisterSystem('BlobPhysics');
        }
        
        this.state.isInitialized = false;
        console.log('BlobPhysics disposed');
    }
}