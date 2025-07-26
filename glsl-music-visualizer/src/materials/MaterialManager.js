/**
 * Material Manager
 * Central coordination system for all material-related functionality
 * Integrates MaterialPhysics, PropertyInterpolator, and MaterialPresets
 * Location: src/materials/MaterialManager.js
 */

import { MaterialPhysics } from '../physics/MaterialPhysics.js';
import { PropertyInterpolator } from './PropertyInterpolator.js';
import { MaterialPresets } from './MaterialPresets.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class MaterialManager {
    constructor(options = {}) {
        // Configuration
        this.config = {
            enablePhysics: options.enablePhysics !== false,
            enableInterpolation: options.enableInterpolation !== false,
            enablePresets: options.enablePresets !== false,
            enableAudioReactivity: options.enableAudioReactivity !== false,
            enableAutoTransitions: options.enableAutoTransitions === true,
            updateFrequency: options.updateFrequency || 60,
            maxConcurrentTransitions: options.maxConcurrentTransitions || 8,
            defaultMaterial: options.defaultMaterial || 'water_pure'
        };
        
        // Sub-systems
        this.physics = null;
        this.interpolator = null;
        this.presets = null;
        
        // Current material state
        this.currentState = {
            materialId: this.config.defaultMaterial,
            materialType: 'builtin',
            properties: null,
            phase: 'liquid',
            temperature: 293.15,
            transitionProgress: 0.0,
            lastUpdate: 0
        };
        
        // Active transitions tracking
        this.activeTransitions = new Map();
        this.transitionQueue = [];
        
        // Audio-reactive state
        this.audioState = {
            enabled: this.config.enableAudioReactivity,
            currentGenre: null,
            energyHistory: new Array(30).fill(0),
            beatHistory: new Array(10).fill(false),
            adaptiveThresholds: {
                energyHigh: 0.8,
                energyLow: 0.2,
                beatStrong: 0.7
            }
        };
        
        // Material caching for performance
        this.materialCache = new Map();
        this.renderCache = new Map();
        this.cacheStats = { hits: 0, misses: 0 };
        
        // Event system
        this.eventCallbacks = new Map([
            ['materialChanged', []],
            ['transitionStarted', []],
            ['transitionCompleted', []],
            ['phaseChanged', []],
            ['audioGenreDetected', []],
            ['error', []]
        ]);
        
        // Performance tracking
        this.performanceMetrics = {
            updateTime: 0,
            physicsTime: 0,
            interpolationTime: 0,
            cacheHitRate: 0,
            memoryUsage: 0,
            transitionCount: 0
        };
        
        // Auto-transition system
        this.autoTransition = {
            enabled: this.config.enableAutoTransitions,
            mode: 'audio', // 'audio', 'time', 'random'
            interval: 30000, // 30 seconds
            lastTransition: 0,
            criteria: {
                energyChange: 0.3,
                genreChange: true,
                beatPatternChange: 0.5
            }
        };
        
        // Spatial material zones (for advanced effects)
        this.spatialZones = new Map();
        this.spatialGrid = {
            enabled: options.enableSpatialZones === true,
            resolution: 16,
            bounds: { min: -10, max: 10 }
        };
        
        // Integration interfaces
        this.integrations = {
            fluidSimulation: null,
            particleSystem: null,
            metaballSystem: null,
            renderEngine: null,
            audioEngine: null
        };
        
        console.log('MaterialManager initializing...', {
            enablePhysics: this.config.enablePhysics,
            enableInterpolation: this.config.enableInterpolation,
            enablePresets: this.config.enablePresets,
            defaultMaterial: this.config.defaultMaterial
        });
    }
    
    /**
     * Initialize material manager and all sub-systems
     */
    async initialize(options = {}) {
        try {
            console.log('MaterialManager initializing sub-systems...');
            
            // Initialize MaterialPhysics
            if (this.config.enablePhysics) {
                this.physics = new MaterialPhysics({
                    audioReactive: this.config.enableAudioReactivity,
                    ...options.physics
                });
                console.log('✓ MaterialPhysics initialized');
            }
            
            // Initialize PropertyInterpolator
            if (this.config.enableInterpolation) {
                this.interpolator = new PropertyInterpolator({
                    enableAudioReactivity: this.config.enableAudioReactivity,
                    maxActiveTransitions: this.config.maxConcurrentTransitions,
                    ...options.interpolation
                });
                console.log('✓ PropertyInterpolator initialized');
            }
            
            // Initialize MaterialPresets
            if (this.config.enablePresets) {
                this.presets = new MaterialPresets({
                    enableFileWatching: options.enableFileWatching,
                    ...options.presets
                });
                
                // Load user presets
                await this.presets.loadUserPresets();
                console.log('✓ MaterialPresets initialized');
            }
            
            // Initialize spatial zones if enabled
            if (this.spatialGrid.enabled) {
                this.initializeSpatialZones();
                console.log('✓ Spatial zones initialized');
            }
            
            // Set initial material
            await this.setMaterial(this.config.defaultMaterial, 'builtin', { immediate: true });
            
            console.log('MaterialManager initialized successfully', {
                currentMaterial: this.currentState.materialId,
                subsystems: {
                    physics: !!this.physics,
                    interpolator: !!this.interpolator,
                    presets: !!this.presets
                }
            });
            
        } catch (error) {
            console.error('Failed to initialize MaterialManager:', error);
            this.emit('error', { type: 'initialization', error });
            throw error;
        }
    }
    
    /**
     * Initialize spatial material zones
     */
    initializeSpatialZones() {
        const resolution = this.spatialGrid.resolution;
        const bounds = this.spatialGrid.bounds;
        
        // Create default zones
        this.createSpatialZone('core', {
            center: [0, 0, 0],
            radius: 3,
            materialId: this.config.defaultMaterial,
            influence: 1.0
        });
        
        console.log(`Initialized ${this.spatialZones.size} spatial zones`);
    }
    
    /**
     * Main update loop - called every frame
     */
    update(deltaTime, audioData = null, fluidSimulation = null) {
        const startTime = performance.now();
        
        try {
            // Update audio state
            if (audioData && this.config.enableAudioReactivity) {
                this.updateAudioState(audioData);
            }
            
            // Process auto-transitions
            if (this.autoTransition.enabled) {
                this.processAutoTransitions(audioData);
            }
            
            // Update physics simulation
            if (this.physics && fluidSimulation) {
                const physicsStartTime = performance.now();
                this.physics.update(deltaTime, fluidSimulation, audioData);
                this.performanceMetrics.physicsTime = performance.now() - physicsStartTime;
            }
            
            // Update property interpolations
            if (this.interpolator) {
                const interpStartTime = performance.now();
                this.interpolator.update(deltaTime, audioData);
                this.performanceMetrics.interpolationTime = performance.now() - interpStartTime;
            }
            
            // Process transition queue
            this.processTransitionQueue();
            
            // Update current material state
            this.updateCurrentMaterialState();
            
            // Update spatial zones
            if (this.spatialGrid.enabled) {
                this.updateSpatialZones(deltaTime, audioData);
            }
            
            // Update performance metrics
            this.performanceMetrics.updateTime = performance.now() - startTime;
            this.performanceMetrics.cacheHitRate = this.calculateCacheHitRate();
            this.performanceMetrics.transitionCount = this.activeTransitions.size;
            
            // Report to performance monitor
            if (performanceMonitor) {
                performanceMonitor.recordCPUTime('materials', this.performanceMetrics.updateTime);
            }
            
            this.currentState.lastUpdate = performance.now();
            
        } catch (error) {
            console.error('MaterialManager update error:', error);
            this.emit('error', { type: 'update', error });
        }
    }
    
    /**
     * Set current material with optional transition
     */
    async setMaterial(materialId, type = 'builtin', options = {}) {
        try {
            // Get material from presets
            let materialPreset = null;
            if (this.presets) {
                materialPreset = this.presets.getPreset(materialId, type);
                if (!materialPreset) {
                    throw new Error(`Material preset not found: ${materialId} (${type})`);
                }
            }
            
            const {
                immediate = false,
                duration = 2.0,
                easing = 'smoothstep',
                audioReactive = true
            } = options;
            
            // Handle immediate change
            if (immediate || !this.interpolator) {
                this.applyMaterialImmediate(materialId, type, materialPreset);
                return;
            }
            
            // Create transition
            const transitionId = await this.createMaterialTransition(
                this.currentState.materialId,
                materialId,
                {
                    duration,
                    easing,
                    audioReactive,
                    fromType: this.currentState.materialType,
                    toType: type
                }
            );
            
            console.log(`Material transition started: ${this.currentState.materialId} → ${materialId}`);
            this.emit('transitionStarted', {
                from: this.currentState.materialId,
                to: materialId,
                transitionId,
                duration
            });
            
        } catch (error) {
            console.error('Failed to set material:', error);
            this.emit('error', { type: 'materialChange', error, materialId, type });
        }
    }
    
    /**
     * Apply material change immediately without transition
     */
    applyMaterialImmediate(materialId, type, materialPreset) {
        // Update current state
        this.currentState.materialId = materialId;
        this.currentState.materialType = type;
        this.currentState.properties = materialPreset;
        
        // Update physics system
        if (this.physics && materialPreset) {
            this.physics.setMaterial(materialId);
        }
        
        // Clear render cache
        this.renderCache.clear();
        
        console.log(`Material changed immediately to: ${materialId}`);
        this.emit('materialChanged', {
            materialId,
            type,
            properties: materialPreset
        });
    }
    
    /**
     * Create material transition
     */
    async createMaterialTransition(fromMaterialId, toMaterialId, options = {}) {
        if (!this.interpolator || !this.presets) {
            throw new Error('Interpolator or presets not available');
        }
        
        // Get material presets
        const fromPreset = this.presets.getPreset(fromMaterialId, options.fromType || 'builtin');
        const toPreset = this.presets.getPreset(toMaterialId, options.toType || 'builtin');
        
        if (!fromPreset || !toPreset) {
            throw new Error('Material presets not found for transition');
        }
        
        // Create transition with interpolator
        const transitionId = this.interpolator.createMaterialTransition(
            fromPreset,
            toPreset,
            {
                duration: options.duration || 2.0,
                easing: options.easing || 'smoothstep',
                audioReactive: options.audioReactive !== false,
                onUpdate: (properties, progress) => {
                    this.handleTransitionUpdate(transitionId, properties, progress);
                },
                onComplete: (properties) => {
                    this.handleTransitionComplete(transitionId, toMaterialId, options.toType, properties);
                }
            }
        );
        
        // Track active transition
        this.activeTransitions.set(transitionId, {
            fromMaterialId,
            toMaterialId,
            startTime: performance.now(),
            options
        });
        
        return transitionId;
    }
    
    /**
     * Handle transition update
     */
    handleTransitionUpdate(transitionId, properties, progress) {
        // Update current properties
        this.currentState.properties = properties;
        this.currentState.transitionProgress = progress;
        
        // Update physics with interpolated properties
        if (this.physics) {
            this.updatePhysicsWithProperties(properties);
        }
        
        // Clear render cache during transition
        this.renderCache.clear();
    }
    
    /**
     * Handle transition completion
     */
    handleTransitionComplete(transitionId, materialId, type, properties) {
        // Update final state
        this.currentState.materialId = materialId;
        this.currentState.materialType = type || 'builtin';
        this.currentState.properties = properties;
        this.currentState.transitionProgress = 1.0;
        
        // Update physics system
        if (this.physics) {
            this.physics.setMaterial(materialId);
        }
        
        // Remove from active transitions
        this.activeTransitions.delete(transitionId);
        
        // Clear caches
        this.renderCache.clear();
        
        console.log(`Material transition completed: ${materialId}`);
        this.emit('transitionCompleted', {
            materialId,
            type,
            transitionId,
            properties
        });
        
        this.emit('materialChanged', {
            materialId,
            type,
            properties
        });
    }
    
    /**
     * Update physics system with interpolated properties
     */
    updatePhysicsWithProperties(properties) {
        if (!this.physics) return;
        
        // Apply physical properties
        if (properties.physical) {
            const physical = properties.physical;
            this.physics.currentDensity = physical.density;
            this.physics.currentViscosity = physical.viscosity;
            this.physics.currentSurfaceTension = physical.surfaceTension;
        }
        
        // Apply thermal properties
        if (properties.thermal) {
            this.physics.materialState.temperature = properties.thermal.temperature;
        }
        
        // Apply electrical properties
        if (properties.electrical) {
            // Update electrical properties as needed
        }
    }
    
    /**
     * Update audio state and detect changes
     */
    updateAudioState(audioData) {
        const { bassLevel, midLevel, trebleLevel, energy, beat, beatStrength, bpm } = audioData;
        
        // Update energy history
        this.audioState.energyHistory.push(energy);
        if (this.audioState.energyHistory.length > 30) {
            this.audioState.energyHistory.shift();
        }
        
        // Update beat history
        this.audioState.beatHistory.push(beat);
        if (this.audioState.beatHistory.length > 10) {
            this.audioState.beatHistory.shift();
        }
        
        // Detect genre changes (simplified)
        const newGenre = this.detectMusicGenre(audioData);
        if (newGenre !== this.audioState.currentGenre) {
            this.audioState.currentGenre = newGenre;
            this.emit('audioGenreDetected', { genre: newGenre, confidence: 0.8 });
        }
        
        // Update adaptive thresholds
        this.updateAdaptiveThresholds();
    }
    
    /**
     * Simple genre detection based on audio characteristics
     */
    detectMusicGenre(audioData) {
        const { bassLevel, midLevel, trebleLevel, energy, bpm } = audioData;
        
        // Simple heuristic-based genre detection
        if (trebleLevel > 0.7 && energy > 0.8 && bpm > 120) {
            return 'electronic';
        } else if (bassLevel > 0.8 && energy > 0.7) {
            return 'rock';
        } else if (energy < 0.4 && trebleLevel > 0.6) {
            return 'classical';
        } else if (energy < 0.3) {
            return 'ambient';
        } else if (midLevel > 0.6) {
            return 'jazz';
        }
        
        return null;
    }
    
    /**
     * Update adaptive thresholds based on audio history
     */
    updateAdaptiveThresholds() {
        const energyHistory = this.audioState.energyHistory;
        const avgEnergy = energyHistory.reduce((sum, val) => sum + val, 0) / energyHistory.length;
        const stdEnergy = Math.sqrt(energyHistory.reduce((sum, val) => sum + Math.pow(val - avgEnergy, 2), 0) / energyHistory.length);
        
        // Adaptive thresholds based on current audio characteristics
        this.audioState.adaptiveThresholds.energyHigh = Math.min(0.9, avgEnergy + stdEnergy);
        this.audioState.adaptiveThresholds.energyLow = Math.max(0.1, avgEnergy - stdEnergy);
    }
    
    /**
     * Process auto-transitions based on audio
     */
    processAutoTransitions(audioData) {
        if (!this.autoTransition.enabled || !audioData) return;
        
        const now = performance.now();
        const timeSinceLastTransition = now - this.autoTransition.lastTransition;
        
        // Check if enough time has passed
        if (timeSinceLastTransition < this.autoTransition.interval) return;
        
        // Check for significant audio changes
        const shouldTransition = this.shouldTriggerAutoTransition(audioData);
        
        if (shouldTransition) {
            this.triggerAutoTransition(audioData);
            this.autoTransition.lastTransition = now;
        }
    }
    
    /**
     * Determine if auto-transition should be triggered
     */
    shouldTriggerAutoTransition(audioData) {
        const criteria = this.autoTransition.criteria;
        
        // Energy change criterion
        const energyHistory = this.audioState.energyHistory;
        if (energyHistory.length >= 10) {
            const recentEnergy = energyHistory.slice(-5).reduce((sum, val) => sum + val, 0) / 5;
            const oldEnergy = energyHistory.slice(-10, -5).reduce((sum, val) => sum + val, 0) / 5;
            const energyChange = Math.abs(recentEnergy - oldEnergy);
            
            if (energyChange > criteria.energyChange) {
                return true;
            }
        }
        
        // Genre change criterion
        if (criteria.genreChange && this.audioState.currentGenre) {
            // Genre already changed, trigger transition
            return true;
        }
        
        return false;
    }
    
    /**
     * Trigger automatic transition based on audio characteristics
     */
    async triggerAutoTransition(audioData) {
        if (!this.presets) return;
        
        try {
            // Get recommendations based on current audio
            const recommendations = this.presets.getRecommendedPresets(audioData, 3);
            
            if (recommendations.length > 0) {
                // Filter out current material
                const candidates = recommendations.filter(rec => 
                    rec.id !== this.currentState.materialId
                );
                
                if (candidates.length > 0) {
                    const selected = candidates[0]; // Use highest scored recommendation
                    
                    await this.setMaterial(selected.id, selected.type, {
                        duration: 3.0,
                        easing: 'smoothstep',
                        audioReactive: true
                    });
                    
                    console.log(`Auto-transition triggered: ${selected.preset.name}`);
                }
            }
        } catch (error) {
            console.warn('Auto-transition failed:', error);
        }
    }
    
    /**
     * Process queued transitions
     */
    processTransitionQueue() {
        // Process any queued transitions
        while (this.transitionQueue.length > 0 && this.activeTransitions.size < this.config.maxConcurrentTransitions) {
            const queuedTransition = this.transitionQueue.shift();
            this.executeQueuedTransition(queuedTransition);
        }
    }
    
    /**
     * Execute queued transition
     */
    async executeQueuedTransition(transition) {
        try {
            await this.setMaterial(transition.materialId, transition.type, transition.options);
        } catch (error) {
            console.warn('Queued transition failed:', error);
        }
    }
    
    /**
     * Update current material state
     */
    updateCurrentMaterialState() {
        if (!this.physics) return;
        
        // Update phase state
        const physicsStats = this.physics.getStatistics();
        if (physicsStats.phase !== this.currentState.phase) {
            const oldPhase = this.currentState.phase;
            this.currentState.phase = physicsStats.phase;
            
            this.emit('phaseChanged', {
                from: oldPhase,
                to: physicsStats.phase,
                temperature: physicsStats.properties.temperature
            });
        }
        
        // Update temperature
        this.currentState.temperature = physicsStats.properties.temperature;
    }
    
    /**
     * Update spatial material zones
     */
    updateSpatialZones(deltaTime, audioData) {
        for (const [zoneId, zone] of this.spatialZones) {
            // Update zone based on audio if reactive
            if (zone.audioReactive && audioData) {
                this.updateZoneWithAudio(zone, audioData);
            }
        }
    }
    
    /**
     * Update spatial zone with audio data
     */
    updateZoneWithAudio(zone, audioData) {
        const { energy, beat, beatStrength } = audioData;
        
        // Modulate zone radius based on energy
        if (zone.baseRadius) {
            zone.radius = zone.baseRadius * (1 + energy * 0.5);
        }
        
        // Pulse effect on beats
        if (beat && beatStrength > 0.5) {
            zone.influence = Math.min(2.0, zone.baseInfluence * (1 + beatStrength));
        } else {
            zone.influence = MathUtils.lerp(zone.influence, zone.baseInfluence || 1.0, 0.1);
        }
    }
    
    /**
     * Create spatial material zone
     */
    createSpatialZone(id, config) {
        const zone = {
            id,
            center: config.center || [0, 0, 0],
            radius: config.radius || 5,
            baseRadius: config.radius || 5,
            materialId: config.materialId,
            materialType: config.materialType || 'builtin',
            influence: config.influence || 1.0,
            baseInfluence: config.influence || 1.0,
            audioReactive: config.audioReactive !== false,
            enabled: config.enabled !== false
        };
        
        this.spatialZones.set(id, zone);
        return zone;
    }
    
    /**
     * Get material properties for rendering
     */
    getRenderProperties() {
        const cacheKey = `render_${this.currentState.materialId}_${this.currentState.transitionProgress}`;
        
        // Check render cache
        if (this.renderCache.has(cacheKey)) {
            this.cacheStats.hits++;
            return this.renderCache.get(cacheKey);
        }
        
        this.cacheStats.misses++;
        
        // Build render properties
        const renderProps = this.buildRenderProperties();
        
        // Cache result
        if (this.renderCache.size < 100) {
            this.renderCache.set(cacheKey, renderProps);
        }
        
        return renderProps;
    }
    
    /**
     * Build render properties from current state
     */
    buildRenderProperties() {
        const properties = this.currentState.properties;
        if (!properties) return null;
        
        const renderProps = {
            // Basic identification
            materialId: this.currentState.materialId,
            materialType: this.currentState.materialType,
            phase: this.currentState.phase,
            
            // Physical properties for shaders
            density: properties.physical?.density || 1000,
            viscosity: properties.physical?.viscosity || 0.001,
            surfaceTension: properties.physical?.surfaceTension || 0.07,
            temperature: this.currentState.temperature,
            
            // Optical properties
            baseColor: properties.optical?.baseColor || [1, 1, 1, 1],
            emission: properties.optical?.emission || [0, 0, 0],
            refractionIndex: properties.optical?.refractionIndex || 1.33,
            transparency: properties.optical?.transparency || 0.95,
            metallic: properties.optical?.metallic || 0.0,
            roughness: properties.optical?.roughness || 0.5,
            
            // Electrical properties
            conductivity: properties.electrical?.conductivity || 0,
            magneticPermeability: properties.electrical?.magneticPermeability || 1.0,
            
            // Animation properties
            transitionProgress: this.currentState.transitionProgress,
            time: (performance.now() - this.currentState.lastUpdate) / 1000
        };
        
        // Add physics-derived properties
        if (this.physics) {
            const physicsProps = this.physics.getMaterialProperties();
            Object.assign(renderProps, {
                currentDensity: physicsProps.density,
                currentViscosity: physicsProps.viscosity,
                currentSurfaceTension: physicsProps.surfaceTension,
                ionization: physicsProps.ionization || 0
            });
        }
        
        return renderProps;
    }
    
    /**
     * Set integration references
     */
    setIntegrations(integrations) {
        Object.assign(this.integrations, integrations);
        
        // Setup cross-system communication
        if (this.integrations.fluidSimulation && this.physics) {
            // Physics system can access fluid simulation
        }
        
        console.log('MaterialManager integrations set up', {
            fluidSimulation: !!this.integrations.fluidSimulation,
            particleSystem: !!this.integrations.particleSystem,
            metaballSystem: !!this.integrations.metaballSystem,
            renderEngine: !!this.integrations.renderEngine,
            audioEngine: !!this.integrations.audioEngine
        });
    }
    
    /**
     * Calculate cache hit rate
     */
    calculateCacheHitRate() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        return total > 0 ? this.cacheStats.hits / total : 0;
    }
    
    /**
     * Event system methods
     */
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
                    console.error(`Error in event callback for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Configuration methods
     */
    setAutoTransitionMode(mode, options = {}) {
        this.autoTransition.mode = mode;
        if (options.interval) this.autoTransition.interval = options.interval;
        if (options.criteria) Object.assign(this.autoTransition.criteria, options.criteria);
        
        console.log(`Auto-transition mode set to: ${mode}`);
    }
    
    enableAutoTransitions(enabled = true) {
        this.autoTransition.enabled = enabled;
        console.log(`Auto-transitions ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Debug and utility methods
     */
    getStatistics() {
        return {
            currentMaterial: this.currentState.materialId,
            phase: this.currentState.phase,
            temperature: this.currentState.temperature,
            activeTransitions: this.activeTransitions.size,
            queuedTransitions: this.transitionQueue.length,
            performance: this.performanceMetrics,
            cache: {
                materialCache: this.materialCache.size,
                renderCache: this.renderCache.size,
                hitRate: this.calculateCacheHitRate()
            },
            audioState: {
                genre: this.audioState.currentGenre,
                energyAvg: this.audioState.energyHistory.reduce((sum, val) => sum + val, 0) / this.audioState.energyHistory.length
            },
            spatialZones: this.spatialZones.size
        };
    }
    
    /**
     * Get current material state for external systems
     */
    getCurrentMaterial() {
        return {
            id: this.currentState.materialId,
            type: this.currentState.materialType,
            phase: this.currentState.phase,
            temperature: this.currentState.temperature,
            properties: this.currentState.properties,
            transitionProgress: this.currentState.transitionProgress,
            renderProperties: this.getRenderProperties()
        };
    }
    
    /**
     * Force update of material properties
     */
    refreshMaterial() {
        this.materialCache.clear();
        this.renderCache.clear();
        
        if (this.physics) {
            this.physics.updateMaterialProperties();
        }
        
        console.log('Material properties refreshed');
    }
    
    /**
     * Create custom material from properties
     */
    async createCustomMaterial(name, properties, options = {}) {
        if (!this.presets) {
            throw new Error('Presets system not available');
        }
        
        try {
            const customPreset = this.presets.createUserPreset(name, properties, options);
            
            console.log(`Custom material created: ${name}`);
            this.emit('materialCreated', { name, preset: customPreset });
            
            return customPreset;
        } catch (error) {
            console.error('Failed to create custom material:', error);
            this.emit('error', { type: 'materialCreation', error, name });
            throw error;
        }
    }
    
    /**
     * Generate material variation
     */
    async createMaterialVariation(baseMaterialId, variationAmount = 0.2, options = {}) {
        if (!this.presets) {
            throw new Error('Presets system not available');
        }
        
        try {
            const variation = this.presets.createRandomVariation(baseMaterialId, variationAmount, options);
            
            console.log(`Material variation created from: ${baseMaterialId}`);
            return variation;
        } catch (error) {
            console.error('Failed to create material variation:', error);
            throw error;
        }
    }
    
    /**
     * Create audio-reactive material
     */
    async createAudioReactiveMaterial(baseMaterialId, genre, audioData = null) {
        if (!this.presets) {
            throw new Error('Presets system not available');
        }
        
        try {
            const audioMaterial = this.presets.generateAudioPreset(baseMaterialId, genre, audioData);
            
            console.log(`Audio-reactive material created: ${audioMaterial.name}`);
            return audioMaterial;
        } catch (error) {
            console.error('Failed to create audio-reactive material:', error);
            throw error;
        }
    }
    
    /**
     * Interpolate between multiple materials
     */
    async blendMaterials(materialConfigs, options = {}) {
        if (!this.interpolator || !this.presets) {
            throw new Error('Required systems not available');
        }
        
        try {
            // Get all material presets
            const materials = materialConfigs.map(config => {
                const preset = this.presets.getPreset(config.id, config.type || 'builtin');
                return { preset, weight: config.weight || 1.0 };
            });
            
            // Create weighted blend
            const blendedProperties = this.createWeightedBlend(materials);
            
            // Create transition to blended material
            const transitionId = this.interpolator.startTransition({
                type: 'blend',
                from: this.currentState.properties,
                to: blendedProperties,
                duration: options.duration || 2.0,
                easing: options.easing || 'smoothstep',
                onUpdate: (properties, progress) => {
                    this.currentState.properties = properties;
                    this.currentState.transitionProgress = progress;
                },
                onComplete: (properties) => {
                    this.currentState.properties = properties;
                    this.currentState.materialId = 'blended_material';
                    this.currentState.materialType = 'runtime';
                    this.emit('materialChanged', {
                        materialId: 'blended_material',
                        type: 'runtime',
                        properties
                    });
                }
            });
            
            return transitionId;
        } catch (error) {
            console.error('Failed to blend materials:', error);
            throw error;
        }
    }
    
    /**
     * Create weighted blend of multiple materials
     */
    createWeightedBlend(materials) {
        const blended = {
            physical: {},
            optical: {},
            electrical: {},
            thermal: {},
            audioReactivity: {}
        };
        
        const totalWeight = materials.reduce((sum, mat) => sum + mat.weight, 0);
        
        // Blend each property category
        const categories = ['physical', 'optical', 'electrical', 'thermal', 'audioReactivity'];
        
        for (const category of categories) {
            const categoryBlend = {};
            const allKeys = new Set();
            
            // Collect all property keys
            materials.forEach(mat => {
                if (mat.preset[category]) {
                    Object.keys(mat.preset[category]).forEach(key => allKeys.add(key));
                }
            });
            
            // Blend each property
            for (const key of allKeys) {
                let weightedSum = 0;
                let weightSum = 0;
                
                materials.forEach(mat => {
                    if (mat.preset[category] && mat.preset[category][key] !== undefined) {
                        const value = mat.preset[category][key];
                        
                        if (Array.isArray(value)) {
                            // Handle array properties (colors, vectors)
                            if (!categoryBlend[key]) {
                                categoryBlend[key] = new Array(value.length).fill(0);
                            }
                            value.forEach((v, i) => {
                                categoryBlend[key][i] += v * mat.weight;
                            });
                        } else if (typeof value === 'number') {
                            weightedSum += value * mat.weight;
                            weightSum += mat.weight;
                        } else {
                            // For non-numeric values, use the highest weighted value
                            if (!categoryBlend[key] || mat.weight > (categoryBlend[key].weight || 0)) {
                                categoryBlend[key] = { value, weight: mat.weight };
                            }
                        }
                    }
                });
                
                // Finalize blended value
                if (Array.isArray(categoryBlend[key])) {
                    categoryBlend[key] = categoryBlend[key].map(v => v / totalWeight);
                } else if (typeof weightedSum === 'number' && weightSum > 0) {
                    categoryBlend[key] = weightedSum / weightSum;
                } else if (categoryBlend[key] && categoryBlend[key].value !== undefined) {
                    categoryBlend[key] = categoryBlend[key].value;
                }
            }
            
            blended[category] = categoryBlend;
        }
        
        return blended;
    }
    
    /**
     * Stop all active transitions
     */
    stopAllTransitions() {
        if (this.interpolator) {
            this.interpolator.clearAllTransitions();
        }
        
        this.activeTransitions.clear();
        this.transitionQueue = [];
        
        console.log('All material transitions stopped');
        this.emit('transitionsStopped');
    }
    
    /**
     * Stop specific transition
     */
    stopTransition(transitionId) {
        if (this.interpolator) {
            this.interpolator.stopTransition(transitionId);
        }
        
        this.activeTransitions.delete(transitionId);
        
        console.log(`Material transition stopped: ${transitionId}`);
    }
    
    /**
     * Queue material change for later execution
     */
    queueMaterialChange(materialId, type = 'builtin', options = {}) {
        this.transitionQueue.push({
            materialId,
            type,
            options,
            queuedAt: performance.now()
        });
        
        console.log(`Material change queued: ${materialId}`);
    }
    
    /**
     * Get available materials from presets
     */
    getAvailableMaterials(category = null) {
        if (!this.presets) return [];
        
        const searchOptions = {
            types: ['builtin', 'user', 'community'],
            sortBy: 'name',
            limit: 100
        };
        
        if (category) {
            searchOptions.categories = [category];
        }
        
        return this.presets.searchPresets('', searchOptions);
    }
    
    /**
     * Get material categories
     */
    getMaterialCategories() {
        if (!this.presets) return {};
        
        return this.presets.getCategories();
    }
    
    /**
     * Search materials
     */
    searchMaterials(query, options = {}) {
        if (!this.presets) return [];
        
        return this.presets.searchPresets(query, options);
    }
    
    /**
     * Export current material configuration
     */
    exportConfiguration() {
        return {
            version: '1.0.0',
            timestamp: Date.now(),
            currentMaterial: this.getCurrentMaterial(),
            config: this.config,
            audioState: this.audioState,
            autoTransition: this.autoTransition,
            spatialZones: Array.from(this.spatialZones.entries()),
            performance: this.performanceMetrics
        };
    }
    
    /**
     * Import material configuration
     */
    async importConfiguration(config) {
        try {
            if (config.version && config.currentMaterial) {
                // Apply configuration
                if (config.config) {
                    Object.assign(this.config, config.config);
                }
                
                if (config.audioState) {
                    Object.assign(this.audioState, config.audioState);
                }
                
                if (config.autoTransition) {
                    Object.assign(this.autoTransition, config.autoTransition);
                }
                
                // Restore spatial zones
                if (config.spatialZones) {
                    this.spatialZones.clear();
                    config.spatialZones.forEach(([id, zone]) => {
                        this.spatialZones.set(id, zone);
                    });
                }
                
                // Set current material
                await this.setMaterial(
                    config.currentMaterial.id,
                    config.currentMaterial.type,
                    { immediate: true }
                );
                
                console.log('Material configuration imported successfully');
                this.emit('configurationImported', config);
                
            } else {
                throw new Error('Invalid configuration format');
            }
        } catch (error) {
            console.error('Failed to import configuration:', error);
            this.emit('error', { type: 'configurationImport', error });
            throw error;
        }
    }
    
    /**
     * Reset to default state
     */
    async reset() {
        try {
            // Stop all transitions
            this.stopAllTransitions();
            
            // Clear caches
            this.materialCache.clear();
            this.renderCache.clear();
            
            // Reset audio state
            this.audioState.energyHistory.fill(0);
            this.audioState.beatHistory.fill(false);
            this.audioState.currentGenre = null;
            
            // Reset spatial zones
            this.spatialZones.clear();
            if (this.spatialGrid.enabled) {
                this.initializeSpatialZones();
            }
            
            // Set default material
            await this.setMaterial(this.config.defaultMaterial, 'builtin', { immediate: true });
            
            console.log('MaterialManager reset to default state');
            this.emit('reset');
            
        } catch (error) {
            console.error('Failed to reset MaterialManager:', error);
            this.emit('error', { type: 'reset', error });
        }
    }
    
    /**
     * Enable/disable specific features
     */
    setFeatureEnabled(feature, enabled) {
        switch (feature) {
            case 'physics':
                this.config.enablePhysics = enabled;
                break;
            case 'interpolation':
                this.config.enableInterpolation = enabled;
                break;
            case 'audioReactivity':
                this.config.enableAudioReactivity = enabled;
                this.audioState.enabled = enabled;
                break;
            case 'autoTransitions':
                this.autoTransition.enabled = enabled;
                break;
            case 'spatialZones':
                this.spatialGrid.enabled = enabled;
                break;
            default:
                console.warn(`Unknown feature: ${feature}`);
                return;
        }
        
        console.log(`Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('featureToggled', { feature, enabled });
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        
        // Apply config changes to sub-systems
        if (this.physics && newConfig.enablePhysics !== undefined) {
            // Physics system config updates
        }
        
        if (this.interpolator && newConfig.enableInterpolation !== undefined) {
            // Interpolator config updates
        }
        
        console.log('MaterialManager configuration updated');
        this.emit('configUpdated', newConfig);
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        console.log('Disposing MaterialManager...');
        
        // Stop all transitions
        this.stopAllTransitions();
        
        // Dispose sub-systems
        if (this.physics) {
            this.physics.dispose();
            this.physics = null;
        }
        
        if (this.interpolator) {
            this.interpolator.dispose();
            this.interpolator = null;
        }
        
        if (this.presets) {
            this.presets.dispose();
            this.presets = null;
        }
        
        // Clear all collections
        this.materialCache.clear();
        this.renderCache.clear();
        this.activeTransitions.clear();
        this.spatialZones.clear();
        this.transitionQueue = [];
        
        // Clear event callbacks
        this.eventCallbacks.clear();
        
        // Clear integrations
        Object.keys(this.integrations).forEach(key => {
            this.integrations[key] = null;
        });
        
        console.log('MaterialManager disposed');
    }
}

// Export the MaterialManager class
export { MaterialManager };