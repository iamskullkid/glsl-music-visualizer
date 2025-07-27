/**
 * Material System for Blob Visualizer
 * Handles material property management, shader uniform updates, and material transitions
 * specifically for the blob visualizer implementation
 * Location: src/visualizers/blob/MaterialSystem.js
 */

import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';
import { vec3, vec4 } from 'gl-matrix';

export class MaterialSystem {
    constructor(config = {}) {
        // Configuration
        this.config = {
            // Material behavior settings
            enableMaterialPhysics: config.enableMaterialPhysics !== false,
            enableAudioReactivity: config.enableAudioReactivity !== false,
            enableTransitions: config.enableTransitions !== false,
            enablePhaseChanges: config.enablePhaseChanges !== false,
            
            // Transition settings
            transitionDuration: config.transitionDuration || 2.0,
            transitionEasing: config.transitionEasing || 'smoothstep',
            maxConcurrentTransitions: config.maxConcurrentTransitions || 4,
            
            // Audio reactivity settings
            audioSensitivity: config.audioSensitivity || 1.0,
            bassInfluence: config.bassInfluence || 0.8,
            midInfluence: config.midInfluence || 0.6,
            trebleInfluence: config.trebleInfluence || 0.4,
            energyInfluence: config.energyInfluence || 1.0,
            beatInfluence: config.beatInfluence || 1.5,
            
            // Quality and performance
            updateFrequency: config.updateFrequency || 60,
            shaderUpdateRate: config.shaderUpdateRate || 60,
            enableOptimizations: config.enableOptimizations !== false,
            qualityLevel: config.qualityLevel || 1.0
        };
        
        // Current material state
        this.currentState = {
            materialId: null,
            materialType: 'builtin',
            phase: 'liquid',
            temperature: 293.15, // Room temperature in Kelvin
            ionization: 0.0,
            pressure: 101325, // Standard atmospheric pressure in Pa
            lastUpdate: performance.now(),
            isTransitioning: false
        };
        
        // Material properties cache
        this.properties = {
            // Physical properties
            physical: {
                density: 1000.0,           // kg/m³
                viscosity: 0.001,          // Pa·s
                surfaceTension: 0.0728,    // N/m
                bulkModulus: 2.2e9,        // Pa
                thermalConductivity: 0.6,  // W/(m·K)
                thermalExpansion: 2.1e-4,  // 1/K
                compressibility: 4.5e-10   // 1/Pa
            },
            
            // Optical properties
            optical: {
                baseColor: [1.0, 1.0, 1.0, 1.0],   // RGBA
                emission: [0.0, 0.0, 0.0],          // RGB emission
                refractionIndex: 1.333,              // Dimensionless
                absorption: [0.01, 0.01, 0.01],     // Per unit length
                scattering: 0.1,                    // Rayleigh scattering
                transparency: 0.95,                 // 0-1
                metallic: 0.0,                      // 0-1
                roughness: 0.5,                     // 0-1
                specular: 0.04                      // 0-1
            },
            
            // Electrical properties
            electrical: {
                conductivity: 5.5e-6,               // S/m
                dielectricConstant: 81.0,           // Dimensionless
                magneticPermeability: 1.0,          // Dimensionless
                polarizability: 1.45e-30            // C·m²/V
            },
            
            // Thermal properties
            thermal: {
                specificHeat: 4186,                 // J/(kg·K)
                meltingPoint: 273.15,               // K
                boilingPoint: 373.15,               // K
                vaporization: 2.26e6,               // J/kg
                sublimation: 2.83e6                 // J/kg
            }
        };
        
        // Shader uniform mappings
        this.uniformMappings = {
            // Material identification
            'u_materialId': () => this.getMaterialHash(),
            'u_materialType': () => this.getMaterialTypeCode(),
            'u_materialPhase': () => this.getPhaseCode(),
            
            // Basic physical properties
            'u_density': () => this.properties.physical.density,
            'u_viscosity': () => this.properties.physical.viscosity,
            'u_surfaceTension': () => this.properties.physical.surfaceTension,
            'u_temperature': () => this.currentState.temperature,
            'u_pressure': () => this.currentState.pressure,
            'u_ionization': () => this.currentState.ionization,
            
            // Optical properties
            'u_materialColor': () => this.properties.optical.baseColor,
            'u_emission': () => this.properties.optical.emission,
            'u_refractiveIndex': () => this.properties.optical.refractionIndex,
            'u_transparency': () => this.properties.optical.transparency,
            'u_metallic': () => this.properties.optical.metallic,
            'u_roughness': () => this.properties.optical.roughness,
            'u_absorption': () => this.properties.optical.absorption,
            'u_scattering': () => this.properties.optical.scattering,
            
            // Electrical properties
            'u_conductivity': () => this.properties.electrical.conductivity,
            'u_dielectricConstant': () => this.properties.electrical.dielectricConstant,
            'u_magneticPermeability': () => this.properties.electrical.magneticPermeability,
            
            // Thermal properties
            'u_specificHeat': () => this.properties.thermal.specificHeat,
            'u_meltingPoint': () => this.properties.thermal.meltingPoint,
            'u_boilingPoint': () => this.properties.thermal.boilingPoint,
            
            // Computed properties
            'u_phaseTransitionProgress': () => this.calculatePhaseTransitionProgress(),
            'u_audioReactivityScale': () => this.calculateAudioReactivityScale(),
            'u_materialComplexity': () => this.calculateMaterialComplexity()
        };
        
        // Active material transitions
        this.activeTransitions = new Map();
        this.transitionCounter = 0;
        
        // Audio integration state
        this.audioState = {
            energy: 0,
            bass: 0,
            mid: 0,
            treble: 0,
            beat: false,
            beatStrength: 0,
            lastUpdate: 0,
            smoothedValues: {
                energy: 0,
                bass: 0,
                mid: 0,
                treble: 0
            }
        };
        
        // Performance tracking
        this.performanceMetrics = {
            updateTime: 0,
            uniformUpdateTime: 0,
            transitionCount: 0,
            cacheHitRate: 0,
            lastFrameTime: 0
        };
        
        // Integration references
        this.integrations = {
            materialManager: null,
            propertyInterpolator: null,
            blobPhysics: null,
            shaderManager: null,
            audioEngine: null
        };
        
        console.log('MaterialSystem initialized for blob visualizer', this.config);
    }
    
    /**
     * Initialize the material system
     */
    async initialize(integrations = {}) {
        try {
            console.log('Initializing MaterialSystem...');
            
            // Store integration references
            this.integrations = { ...this.integrations, ...integrations };
            
            // Validate required integrations
            if (!this.integrations.materialManager) {
                throw new Error('MaterialManager integration required');
            }
            
            // Setup initial material state
            await this.loadDefaultMaterial();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('MaterialSystem initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize MaterialSystem:', error);
            throw error;
        }
    }
    
    /**
     * Update material system
     */
    update(deltaTime, audioData = null) {
        const startTime = performance.now();
        
        try {
            // Update audio state
            if (audioData && this.config.enableAudioReactivity) {
                this.updateAudioState(audioData);
            }
            
            // Process active transitions
            this.updateActiveTransitions(deltaTime);
            
            // Update material properties based on current state
            this.updateMaterialProperties(deltaTime);
            
            // Update phase transitions if enabled
            if (this.config.enablePhaseChanges) {
                this.updatePhaseTransitions(deltaTime);
            }
            
            // Apply audio reactivity modifications
            if (this.config.enableAudioReactivity && audioData) {
                this.applyAudioReactivity(audioData);
            }
            
            // Update performance metrics
            this.performanceMetrics.updateTime = performance.now() - startTime;
            this.performanceMetrics.lastFrameTime = deltaTime;
            
        } catch (error) {
            console.error('MaterialSystem update error:', error);
        }
    }
    
    /**
     * Set material by ID
     */
    async setMaterial(materialId, options = {}) {
        try {
            const { immediate = false, duration = this.config.transitionDuration } = options;
            
            console.log(`MaterialSystem: Setting material to ${materialId}`);
            
            // Get material properties from MaterialManager
            const material = await this.integrations.materialManager.getMaterial(materialId);
            if (!material) {
                throw new Error(`Material not found: ${materialId}`);
            }
            
            if (immediate || !this.config.enableTransitions) {
                // Immediate material change
                this.applyMaterialProperties(material);
                this.currentState.materialId = materialId;
                this.currentState.isTransitioning = false;
            } else {
                // Start transition
                await this.startMaterialTransition(material, duration);
            }
            
        } catch (error) {
            console.error('Failed to set material:', error);
            throw error;
        }
    }
    
    /**
     * Start material transition
     */
    async startMaterialTransition(targetMaterial, duration) {
        if (this.activeTransitions.size >= this.config.maxConcurrentTransitions) {
            console.warn('Maximum concurrent transitions reached, skipping');
            return;
        }
        
        const transitionId = ++this.transitionCounter;
        const currentProperties = this.cloneProperties(this.properties);
        
        const transition = {
            id: transitionId,
            startTime: performance.now(),
            duration: duration * 1000, // Convert to milliseconds
            easing: this.config.transitionEasing,
            fromMaterialId: this.currentState.materialId,
            toMaterialId: targetMaterial.id,
            fromProperties: currentProperties,
            toProperties: this.cloneProperties(targetMaterial.properties),
            progress: 0.0,
            isComplete: false
        };
        
        this.activeTransitions.set(transitionId, transition);
        this.currentState.isTransitioning = true;
        
        console.log(`Started material transition: ${transition.fromMaterialId} -> ${transition.toMaterialId}`);
    }
    
    /**
     * Update active transitions
     */
    updateActiveTransitions(deltaTime) {
        if (this.activeTransitions.size === 0) return;
        
        const currentTime = performance.now();
        const completedTransitions = [];
        
        for (const [id, transition] of this.activeTransitions) {
            const elapsed = currentTime - transition.startTime;
            const rawProgress = Math.min(elapsed / transition.duration, 1.0);
            
            // Apply easing
            transition.progress = this.applyEasing(rawProgress, transition.easing);
            
            // Interpolate properties using PropertyInterpolator if available
            if (this.integrations.propertyInterpolator) {
                this.interpolateTransitionProperties(transition);
            } else {
                this.simpleInterpolateProperties(transition);
            }
            
            // Check if transition is complete
            if (rawProgress >= 1.0) {
                transition.isComplete = true;
                completedTransitions.push(id);
                this.currentState.materialId = transition.toMaterialId;
            }
        }
        
        // Clean up completed transitions
        completedTransitions.forEach(id => {
            this.activeTransitions.delete(id);
            console.log(`Completed material transition: ${id}`);
        });
        
        if (this.activeTransitions.size === 0) {
            this.currentState.isTransitioning = false;
        }
        
        this.performanceMetrics.transitionCount = this.activeTransitions.size;
    }
    
    /**
     * Apply easing function to transition progress
     */
    applyEasing(t, easingType) {
        switch (easingType) {
            case 'linear':
                return t;
            case 'smoothstep':
                return t * t * (3 - 2 * t);
            case 'smootherstep':
                return t * t * t * (t * (t * 6 - 15) + 10);
            case 'easeInQuad':
                return t * t;
            case 'easeOutQuad':
                return t * (2 - t);
            case 'easeInOutQuad':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            case 'easeInCubic':
                return t * t * t;
            case 'easeOutCubic':
                return (--t) * t * t + 1;
            case 'easeInOutCubic':
                return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            default:
                return MathUtils.smoothstep(0, 1, t);
        }
    }
    
    /**
     * Interpolate transition properties using PropertyInterpolator
     */
    interpolateTransitionProperties(transition) {
        if (!this.integrations.propertyInterpolator) return;
        
        const interpolatedProps = this.integrations.propertyInterpolator.interpolate(
            transition.fromProperties,
            transition.toProperties,
            transition.progress,
            {
                blendMode: 'mix',
                easing: transition.easing,
                audioInfluence: this.audioState
            }
        );
        
        if (interpolatedProps) {
            this.properties = interpolatedProps;
        }
    }
    
    /**
     * Simple property interpolation fallback
     */
    simpleInterpolateProperties(transition) {
        const { fromProperties, toProperties, progress } = transition;
        
        // Interpolate physical properties
        if (fromProperties.physical && toProperties.physical) {
            this.properties.physical = this.interpolatePropertyGroup(
                fromProperties.physical,
                toProperties.physical,
                progress
            );
        }
        
        // Interpolate optical properties
        if (fromProperties.optical && toProperties.optical) {
            this.properties.optical = this.interpolatePropertyGroup(
                fromProperties.optical,
                toProperties.optical,
                progress
            );
        }
        
        // Interpolate electrical properties
        if (fromProperties.electrical && toProperties.electrical) {
            this.properties.electrical = this.interpolatePropertyGroup(
                fromProperties.electrical,
                toProperties.electrical,
                progress
            );
        }
        
        // Interpolate thermal properties
        if (fromProperties.thermal && toProperties.thermal) {
            this.properties.thermal = this.interpolatePropertyGroup(
                fromProperties.thermal,
                toProperties.thermal,
                progress
            );
        }
    }
    
    /**
     * Interpolate a group of properties
     */
    interpolatePropertyGroup(fromGroup, toGroup, progress) {
        const result = {};
        
        Object.keys(fromGroup).forEach(key => {
            const fromValue = fromGroup[key];
            const toValue = toGroup[key];
            
            if (fromValue !== undefined && toValue !== undefined) {
                if (Array.isArray(fromValue) && Array.isArray(toValue)) {
                    // Interpolate arrays (colors, vectors)
                    result[key] = fromValue.map((from, i) => 
                        MathUtils.lerp(from, toValue[i] || 0, progress)
                    );
                } else if (typeof fromValue === 'number' && typeof toValue === 'number') {
                    result[key] = MathUtils.lerp(fromValue, toValue, progress);
                } else {
                    // Use from or to based on progress
                    result[key] = progress < 0.5 ? fromValue : toValue;
                }
            } else {
                result[key] = fromValue !== undefined ? fromValue : toValue;
            }
        });
        
        return result;
    }
    
    /**
     * Update audio state with smoothing
     */
    updateAudioState(audioData) {
        if (!audioData || !audioData.features) return;
        
        const smoothing = 0.1; // Smoothing factor
        const features = audioData.features;
        
        // Update raw values
        this.audioState.energy = features.energy || 0;
        this.audioState.bass = features.bass || 0;
        this.audioState.mid = features.mid || 0;
        this.audioState.treble = features.treble || 0;
        this.audioState.beat = features.beat || false;
        this.audioState.beatStrength = features.beatStrength || 0;
        this.audioState.lastUpdate = performance.now();
        
        // Apply smoothing to prevent jarring changes
        this.audioState.smoothedValues.energy = MathUtils.lerp(
            this.audioState.smoothedValues.energy,
            this.audioState.energy,
            smoothing
        );
        this.audioState.smoothedValues.bass = MathUtils.lerp(
            this.audioState.smoothedValues.bass,
            this.audioState.bass,
            smoothing
        );
        this.audioState.smoothedValues.mid = MathUtils.lerp(
            this.audioState.smoothedValues.mid,
            this.audioState.mid,
            smoothing
        );
        this.audioState.smoothedValues.treble = MathUtils.lerp(
            this.audioState.smoothedValues.treble,
            this.audioState.treble,
            smoothing
        );
    }
    
    /**
     * Apply audio reactivity to material properties
     */
    applyAudioReactivity(audioData) {
        if (!this.config.enableAudioReactivity || !audioData) return;
        
        const smoothed = this.audioState.smoothedValues;
        const intensity = this.config.audioSensitivity;
        
        // Modify viscosity based on energy
        const baseViscosity = this.properties.physical.viscosity;
        const energyInfluence = smoothed.energy * this.config.energyInfluence * intensity;
        this.properties.physical.viscosity = baseViscosity * (1 + energyInfluence * 0.5);
        
        // Modify surface tension based on bass
        const baseSurfaceTension = this.properties.physical.surfaceTension;
        const bassInfluence = smoothed.bass * this.config.bassInfluence * intensity;
        this.properties.physical.surfaceTension = baseSurfaceTension * (1 + bassInfluence * 0.3);
        
        // Modify emission based on mid/treble
        const baseEmission = this.properties.optical.emission;
        const midInfluence = smoothed.mid * this.config.midInfluence * intensity;
        const trebleInfluence = smoothed.treble * this.config.trebleInfluence * intensity;
        
        this.properties.optical.emission = [
            baseEmission[0] + midInfluence * 0.2,
            baseEmission[1] + trebleInfluence * 0.2,
            baseEmission[2] + (midInfluence + trebleInfluence) * 0.1
        ];
        
        // Beat response
        if (this.audioState.beat) {
            const beatInfluence = this.audioState.beatStrength * this.config.beatInfluence * intensity;
            
            // Temporary increase in temperature for beat response
            this.currentState.temperature += beatInfluence * 10;
            
            // Increase emission intensity
            this.properties.optical.emission = this.properties.optical.emission.map(
                channel => channel + beatInfluence * 0.5
            );
        }
    }
    
    /**
     * Update phase transitions based on temperature
     */
    updatePhaseTransitions(deltaTime) {
        if (!this.config.enablePhaseChanges) return;
        
        const temp = this.currentState.temperature;
        const melting = this.properties.thermal.meltingPoint;
        const boiling = this.properties.thermal.boilingPoint;
        
        let targetPhase = 'liquid';
        
        if (temp < melting) {
            targetPhase = 'solid';
        } else if (temp > boiling) {
            targetPhase = 'gas';
        }
        
        if (targetPhase !== this.currentState.phase) {
            console.log(`Phase transition: ${this.currentState.phase} -> ${targetPhase}`);
            this.currentState.phase = targetPhase;
            this.applyPhaseProperties(targetPhase);
        }
    }
    
    /**
     * Apply phase-specific property modifications
     */
    applyPhaseProperties(phase) {
        switch (phase) {
            case 'solid':
                this.properties.physical.viscosity *= 1000; // Much higher viscosity
                this.properties.optical.transparency *= 0.5; // Less transparent
                break;
            case 'gas':
                this.properties.physical.viscosity *= 0.1; // Much lower viscosity
                this.properties.physical.density *= 0.001; // Much lower density
                this.properties.optical.transparency *= 1.5; // More transparent
                break;
            case 'liquid':
            default:
                // Use base properties
                break;
        }
    }
    
    /**
     * Update shader uniforms
     */
    updateShaderUniforms(shaderProgram) {
        if (!shaderProgram || !this.integrations.shaderManager) return;
        
        const startTime = performance.now();
        
        try {
            // Update all mapped uniforms
            for (const [uniformName, getter] of Object.entries(this.uniformMappings)) {
                const value = getter();
                if (value !== undefined) {
                    this.integrations.shaderManager.setUniform(uniformName, value);
                }
            }
            
            // Update performance metrics
            this.performanceMetrics.uniformUpdateTime = performance.now() - startTime;
            
        } catch (error) {
            console.error('Failed to update shader uniforms:', error);
        }
    }
    
    /**
     * Get current material properties for external systems
     */
    getMaterialProperties() {
        return {
            id: this.currentState.materialId,
            type: this.currentState.materialType,
            phase: this.currentState.phase,
            temperature: this.currentState.temperature,
            pressure: this.currentState.pressure,
            ionization: this.currentState.ionization,
            properties: this.cloneProperties(this.properties),
            isTransitioning: this.currentState.isTransitioning,
            audioState: { ...this.audioState }
        };
    }
    
    /**
     * Get shader uniform data
     */
    getShaderUniforms() {
        const uniforms = {};
        
        for (const [uniformName, getter] of Object.entries(this.uniformMappings)) {
            uniforms[uniformName] = getter();
        }
        
        return uniforms;
    }
    
    // ===== UTILITY METHODS =====
    
    /**
     * Load default material
     */
    async loadDefaultMaterial() {
        if (this.integrations.materialManager) {
            const defaultMaterial = await this.integrations.materialManager.getMaterial('water_pure');
            if (defaultMaterial) {
                this.applyMaterialProperties(defaultMaterial);
                this.currentState.materialId = defaultMaterial.id;
            }
        }
    }
    
    /**
     * Apply material properties directly
     */
    applyMaterialProperties(material) {
        if (material.properties) {
            this.properties = this.cloneProperties(material.properties);
        }
        
        // Update state
        this.currentState.materialType = material.type || 'builtin';
        this.currentState.lastUpdate = performance.now();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.integrations.materialManager) {
            // Listen for material changes from MaterialManager
            this.integrations.materialManager.on?.('materialChanged', (material) => {
                this.setMaterial(material.id, { immediate: false });
            });
        }
        
        if (this.integrations.blobPhysics) {
            // Listen for physics events that might affect materials
            this.integrations.blobPhysics.on?.('materialPhysicsUpdated', (physicsData) => {
                this.handlePhysicsUpdate(physicsData);
            });
        }
    }
    
    /**
     * Handle physics updates
     */
    handlePhysicsUpdate(physicsData) {
        // Update temperature based on physics
        if (physicsData.temperature !== undefined) {
            this.currentState.temperature = physicsData.temperature;
        }
        
        // Update pressure
        if (physicsData.pressure !== undefined) {
            this.currentState.pressure = physicsData.pressure;
        }
        
        // Update ionization
        if (physicsData.ionization !== undefined) {
            this.currentState.ionization = physicsData.ionization;
        }
    }
    
    /**
     * Clone properties object
     */
    cloneProperties(properties) {
        return JSON.parse(JSON.stringify(properties));
    }
    
    /**
     * Calculate material hash for shader identification
     */
    getMaterialHash() {
        return this.currentState.materialId 
            ? this.currentState.materialId.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0)
            : 0;
    }
    
    /**
     * Get material type code for shaders
     */
    getMaterialTypeCode() {
        const types = { 'builtin': 1, 'user': 2, 'runtime': 3 };
        return types[this.currentState.materialType] || 0;
    }
    
    /**
     * Get phase code for shaders
     */
    getPhaseCode() {
        const phases = { 'solid': 1, 'liquid': 2, 'gas': 3, 'plasma': 4 };
        return phases[this.currentState.phase] || 2;
    }
    
    /**
     * Calculate phase transition progress
     */
    calculatePhaseTransitionProgress() {
        const temp = this.currentState.temperature;
        const melting = this.properties.thermal.meltingPoint;
        const boiling = this.properties.thermal.boilingPoint;
        
        if (temp < melting) {
            // Solid phase
            return Math.max(0, temp / melting);
        } else if (temp < boiling) {
            // Liquid phase
            return (temp - melting) / (boiling - melting);
        } else {
            // Gas phase
            return Math.min(1, temp / (boiling * 2));
        }
    }
    
    /**
     * Calculate audio reactivity scale
     */
    calculateAudioReactivityScale() {
        if (!this.config.enableAudioReactivity) return 0;
        
        const energy = this.audioState.smoothedValues.energy;
        const beatInfluence = this.audioState.beat ? this.audioState.beatStrength : 0;
        
        return (energy * 0.7 + beatInfluence * 0.3) * this.config.audioSensitivity;
    }
    
    /**
     * Calculate material complexity for optimization
     */
    calculateMaterialComplexity() {
        let complexity = 0;
        
        // Base complexity from material properties
        complexity += this.currentState.isTransitioning ? 0.5 : 0;
        complexity += this.config.enablePhaseChanges ? 0.3 : 0;
        complexity += this.config.enableAudioReactivity ? 0.2 : 0;
        
        return Math.min(complexity, 1.0);
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            activeTransitions: this.activeTransitions.size,
            cacheHitRate: this.performanceMetrics.cacheHitRate,
            memoryUsage: this.getMemoryUsage()
        };
    }
    
    /**
     * Get memory usage estimate
     */
    getMemoryUsage() {
        return {
            activeTransitions: this.activeTransitions.size,
            propertiesSize: JSON.stringify(this.properties).length,
            uniformMappings: Object.keys(this.uniformMappings).length
        };
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Clear active transitions
        this.activeTransitions.clear();
        
        // Remove event listeners
        if (this.integrations.materialManager?.off) {
            this.integrations.materialManager.off('materialChanged');
        }
        
        if (this.integrations.blobPhysics?.off) {
            this.integrations.blobPhysics.off('materialPhysicsUpdated');
        }
        
        console.log('MaterialSystem destroyed');
    }
}