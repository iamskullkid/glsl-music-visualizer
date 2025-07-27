/**
 * Property Interpolator
 * Advanced smooth interpolation system for material property transitions
 * Provides seamless blending between different material states and properties
 * Location: src/materials/PropertyInterpolator.js
 */

import { MathUtils } from '../utils/MathUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class PropertyInterpolator {
    constructor(options = {}) {
        // Interpolation configuration
        this.config = {
            defaultDuration: options.defaultDuration || 2.0,
            maxActiveTransitions: options.maxActiveTransitions || 32,
            interpolationQuality: options.interpolationQuality || 'high', // 'low', 'medium', 'high'
            usePhysicsBasedTransitions: options.usePhysicsBasedTransitions !== false,
            enableAudioReactivity: options.enableAudioReactivity !== false,
            smoothingFactor: options.smoothingFactor || 0.15
        };
        
        // Active transition tracking
        this.activeTransitions = new Map();
        this.transitionCounter = 0;
        
        // Transition types and their specific behaviors
        this.transitionTypes = {
            material: {
                duration: 3.0,
                easing: 'smoothstep',
                requiresPhysicsUpdate: true,
                blendMode: 'mix'
            },
            phase: {
                duration: 1.5,
                easing: 'elastic',
                requiresPhysicsUpdate: true,
                blendMode: 'crossfade'
            },
            temperature: {
                duration: 0.8,
                easing: 'exponential',
                requiresPhysicsUpdate: true,
                blendMode: 'linear'
            },
            viscosity: {
                duration: 1.2,
                easing: 'smoothstep',
                requiresPhysicsUpdate: true,
                blendMode: 'logarithmic'
            },
            optical: {
                duration: 0.5,
                easing: 'cubic',
                requiresPhysicsUpdate: false,
                blendMode: 'hsv'
            },
            electromagnetic: {
                duration: 0.3,
                easing: 'exponential',
                requiresPhysicsUpdate: true,
                blendMode: 'linear'
            },
            surface: {
                duration: 2.5,
                easing: 'elastic',
                requiresPhysicsUpdate: true,
                blendMode: 'smooth'
            }
        };
        
        // Easing functions for different transition types
        this.easingFunctions = {
            linear: (t) => t,
            smoothstep: (t) => MathUtils.smoothstep(0, 1, t),
            smootherstep: (t) => MathUtils.smootherstep(0, 1, t),
            cubic: (t) => t * t * (3 - 2 * t),
            quintic: (t) => t * t * t * (t * (t * 6 - 15) + 10),
            exponential: (t) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
            elastic: (t) => MathUtils.easeOutElastic(t),
            bounce: (t) => MathUtils.easeOutBounce(t),
            spring: (t) => this.springEasing(t),
            overshoot: (t) => this.overshootEasing(t),
            anticipate: (t) => this.anticipateEasing(t)
        };
        
        // Material property templates for interpolation
        this.propertyTemplates = {
            physical: {
                density: { min: 0.1, max: 20000, logScale: true },
                viscosity: { min: 1e-6, max: 1e6, logScale: true },
                surfaceTension: { min: 0, max: 1, logScale: false },
                bulkModulus: { min: 1e3, max: 1e12, logScale: true },
                thermalConductivity: { min: 0.001, max: 100, logScale: true },
                thermalExpansion: { min: 1e-6, max: 1e-3, logScale: true }
            },
            optical: {
                refractionIndex: { min: 1.0, max: 3.0, logScale: false },
                absorption: { min: 0, max: 10, logScale: false, isArray: true },
                scattering: { min: 0, max: 1, logScale: false },
                emission: { min: 0, max: 10, logScale: false, isArray: true }
            },
            electrical: {
                conductivity: { min: 1e-12, max: 1e8, logScale: true },
                dielectricConstant: { min: 1, max: 100, logScale: false },
                magneticPermeability: { min: 0.1, max: 10, logScale: false }
            },
            thermal: {
                temperature: { min: 0, max: 10000, logScale: false },
                specificHeat: { min: 100, max: 10000, logScale: false },
                freezingPoint: { min: 0, max: 3000, logScale: false },
                boilingPoint: { min: 0, max: 6000, logScale: false }
            }
        };
        
        // Audio-reactive transition modifiers
        this.audioModifiers = {
            enabled: this.config.enableAudioReactivity,
            bassInfluence: 0.8,
            midInfluence: 0.6,
            trebleInfluence: 0.4,
            energyInfluence: 1.0,
            beatInfluence: 2.0,
            adaptiveSpeed: true,
            rhythmSync: true
        };
        
        // Spatial interpolation grid for location-based property variations
        this.spatialGrid = {
            enabled: options.enableSpatialInterpolation !== false,
            resolution: options.spatialResolution || 32,
            data: null,
            bounds: { min: -10, max: 10 }
        };
        
        // Performance tracking
        this.performanceMetrics = {
            activeTransitions: 0,
            interpolationsPerFrame: 0,
            averageInterpolationTime: 0,
            memoryUsage: 0,
            cacheHitRate: 0
        };
        
        // Interpolation cache for frequently used values
        this.interpolationCache = new Map();
        this.cacheMaxSize = 1000;
        this.cacheStats = { hits: 0, misses: 0 };
        
        // Initialize systems
        this.initialize();
        
        console.log('PropertyInterpolator initialized', {
            quality: this.config.interpolationQuality,
            maxTransitions: this.config.maxActiveTransitions,
            audioReactive: this.audioModifiers.enabled,
            spatialInterpolation: this.spatialGrid.enabled
        });
    }
    
    /**
     * Initialize interpolation system
     */
    initialize() {
        // Initialize spatial interpolation grid if enabled
        if (this.spatialGrid.enabled) {
            this.initializeSpatialGrid();
        }
        
        // Set up transition optimization
        this.setupTransitionOptimization();
    }
    
    /**
     * Initialize spatial interpolation grid
     */
    initializeSpatialGrid() {
        const resolution = this.spatialGrid.resolution;
        const totalCells = resolution * resolution * resolution;
        
        this.spatialGrid.data = {
            weights: new Float32Array(totalCells),
            properties: new Map(),
            resolution: resolution
        };
        
        // Initialize weight field with smooth falloffs
        for (let k = 0; k < resolution; k++) {
            for (let j = 0; j < resolution; j++) {
                for (let i = 0; i < resolution; i++) {
                    const index = k * resolution * resolution + j * resolution + i;
                    
                    // Create smooth weight distribution
                    const x = (i / (resolution - 1)) * 2 - 1; // -1 to 1
                    const y = (j / (resolution - 1)) * 2 - 1;
                    const z = (k / (resolution - 1)) * 2 - 1;
                    
                    const distance = Math.sqrt(x*x + y*y + z*z);
                    this.spatialGrid.data.weights[index] = Math.exp(-distance * 2);
                }
            }
        }
    }
    
    /**
     * Set up transition optimization
     */
    setupTransitionOptimization() {
        // Pre-compute common easing curve values for performance
        this.easingLookupTables = new Map();
        
        const resolutions = {
            low: 16,
            medium: 64,
            high: 256
        };
        
        const tableResolution = resolutions[this.config.interpolationQuality];
        
        Object.keys(this.easingFunctions).forEach(easingName => {
            const table = new Float32Array(tableResolution);
            for (let i = 0; i < tableResolution; i++) {
                const t = i / (tableResolution - 1);
                table[i] = this.easingFunctions[easingName](t);
            }
            this.easingLookupTables.set(easingName, table);
        });
    }
    
    /**
     * Start a new property transition
     */
    startTransition(config) {
        if (this.activeTransitions.size >= this.config.maxActiveTransitions) {
            this.cleanupOldestTransition();
        }
        
        const transitionId = this.transitionCounter++;
        
        const transition = {
            id: transitionId,
            type: config.type || 'material',
            startTime: performance.now(),
            duration: config.duration || this.transitionTypes[config.type]?.duration || this.config.defaultDuration,
            
            // Source and target properties
            fromProperties: this.cloneProperties(config.from),
            toProperties: this.cloneProperties(config.to),
            currentProperties: this.cloneProperties(config.from),
            
            // Transition behavior
            easing: config.easing || this.transitionTypes[config.type]?.easing || 'smoothstep',
            blendMode: config.blendMode || this.transitionTypes[config.type]?.blendMode || 'mix',
            
            // Spatial and temporal modifiers
            spatialWeight: config.spatialWeight || 1.0,
            temporalModifier: config.temporalModifier || 1.0,
            audioReactive: config.audioReactive !== false,
            
            // Physics integration
            requiresPhysicsUpdate: this.transitionTypes[config.type]?.requiresPhysicsUpdate || false,
            
            // State tracking
            progress: 0.0,
            isComplete: false,
            
            // Callbacks
            onUpdate: config.onUpdate || null,
            onComplete: config.onComplete || null,
            
            // Performance tracking
            updateCount: 0,
            averageUpdateTime: 0
        };
        
        this.activeTransitions.set(transitionId, transition);
        
        console.log(`Started transition ${transitionId}:`, {
            type: transition.type,
            duration: transition.duration,
            easing: transition.easing,
            blendMode: transition.blendMode
        });
        
        return transitionId;
    }
    
    /**
     * Update all active transitions
     */
    update(deltaTime, audioData = null) {
        const startTime = performance.now();
        
        if (this.activeTransitions.size === 0) {
            return;
        }
        
        let interpolationsThisFrame = 0;
        const completedTransitions = [];
        
        // Process each active transition
        this.activeTransitions.forEach((transition, id) => {
            const updateStartTime = performance.now();
            
            // Calculate transition progress
            const elapsed = performance.now() - transition.startTime;
            let rawProgress = elapsed / (transition.duration * 1000);
            
            // Apply audio modifiers if enabled
            if (transition.audioReactive && audioData && this.audioModifiers.enabled) {
                rawProgress = this.applyAudioModifiers(rawProgress, audioData, transition);
            }
            
            // Clamp progress to [0, 1]
            rawProgress = MathUtils.clamp(rawProgress, 0, 1);
            
            // Apply easing function
            const easedProgress = this.applyEasing(rawProgress, transition.easing);
            transition.progress = easedProgress;
            
            // Interpolate properties
            this.interpolateProperties(transition);
            interpolationsThisFrame++;
            
            // Update performance tracking for this transition
            const updateTime = performance.now() - updateStartTime;
            transition.updateCount++;
            transition.averageUpdateTime = MathUtils.exponentialSmoothing(
                transition.averageUpdateTime,
                updateTime,
                0.1
            );
            
            // Call update callback
            if (transition.onUpdate) {
                transition.onUpdate(transition.currentProperties, transition.progress);
            }
            
            // Check if transition is complete
            if (rawProgress >= 1.0) {
                transition.isComplete = true;
                completedTransitions.push(id);
            }
        });
        
        // Clean up completed transitions
        completedTransitions.forEach(id => {
            const transition = this.activeTransitions.get(id);
            if (transition.onComplete) {
                transition.onComplete(transition.currentProperties);
            }
            this.activeTransitions.delete(id);
        });
        
        // Update performance metrics
        this.performanceMetrics.activeTransitions = this.activeTransitions.size;
        this.performanceMetrics.interpolationsPerFrame = interpolationsThisFrame;
        this.performanceMetrics.averageInterpolationTime = performance.now() - startTime;
        
        // Report to performance monitor
        if (performanceMonitor && interpolationsThisFrame > 0) {
            performanceMonitor.recordCPUTime('physics', this.performanceMetrics.averageInterpolationTime);
        }
    }
    
    /**
     * Apply audio modifiers to transition progress
     */
    applyAudioModifiers(progress, audioData, transition) {
        const { bassLevel, midLevel, trebleLevel, energy, beat, beatStrength, bpm } = audioData;
        
        let modifiedProgress = progress;
        
        // Energy-based speed modulation
        if (this.audioModifiers.adaptiveSpeed) {
            const energyFactor = 0.5 + energy * 0.5; // 0.5x to 1.0x speed
            modifiedProgress = progress * (1 + (energyFactor - 1) * this.audioModifiers.energyInfluence);
        }
        
        // Beat synchronization
        if (this.audioModifiers.rhythmSync && bpm > 0 && beat) {
            const beatPhase = (performance.now() / 1000) % (60 / bpm);
            const beatProgress = beatPhase / (60 / bpm);
            
            // Snap to beat boundaries for dramatic transitions
            if (beatStrength > 0.7 && transition.type === 'material') {
                const snapStrength = beatStrength * this.audioModifiers.beatInfluence;
                modifiedProgress = MathUtils.lerp(
                    modifiedProgress,
                    Math.floor(beatProgress * 4) / 4, // Quantize to quarter beats
                    snapStrength * 0.2
                );
            }
        }
        
        // Frequency-specific modulation
        switch (transition.type) {
            case 'material':
            case 'phase':
                // Bass drives major material changes
                modifiedProgress += bassLevel * this.audioModifiers.bassInfluence * 0.1;
                break;
            case 'optical':
            case 'surface':
                // Treble affects visual properties
                modifiedProgress += trebleLevel * this.audioModifiers.trebleInfluence * 0.1;
                break;
            case 'temperature':
            case 'electromagnetic':
                // Energy affects thermal and EM properties
                modifiedProgress += energy * this.audioModifiers.energyInfluence * 0.1;
                break;
        }
        
        return MathUtils.clamp(modifiedProgress, 0, 1);
    }
    
    /**
     * Apply easing function to transition progress
     */
    applyEasing(t, easingName) {
        if (this.config.interpolationQuality === 'low') {
            // Use direct function calls for low quality (faster)
            return this.easingFunctions[easingName](t);
        }
        
        // Use lookup table for medium/high quality (smoother)
        const lookupTable = this.easingLookupTables.get(easingName);
        if (!lookupTable) {
            return this.easingFunctions[easingName](t);
        }
        
        const tableSize = lookupTable.length;
        const scaledT = t * (tableSize - 1);
        const index = Math.floor(scaledT);
        const fraction = scaledT - index;
        
        if (index >= tableSize - 1) {
            return lookupTable[tableSize - 1];
        }
        
        // Linear interpolation between lookup table values
        return MathUtils.lerp(lookupTable[index], lookupTable[index + 1], fraction);
    }
    
    /**
     * Interpolate properties for a transition
     */
    interpolateProperties(transition) {
        const { fromProperties, toProperties, currentProperties, progress, blendMode } = transition;
        
        // Create cache key for repeated calculations
        const cacheKey = `${transition.id}_${Math.floor(progress * 1000)}`;
        
        if (this.interpolationCache.has(cacheKey)) {
            Object.assign(currentProperties, this.interpolationCache.get(cacheKey));
            this.cacheStats.hits++;
            return;
        }
        
        this.cacheStats.misses++;
        
        // Interpolate each property category
        this.interpolatePropertyCategory(fromProperties, toProperties, currentProperties, progress, blendMode, 'physical');
        this.interpolatePropertyCategory(fromProperties, toProperties, currentProperties, progress, blendMode, 'optical');
        this.interpolatePropertyCategory(fromProperties, toProperties, currentProperties, progress, blendMode, 'electrical');
        this.interpolatePropertyCategory(fromProperties, toProperties, currentProperties, progress, blendMode, 'thermal');
        
        // Apply spatial modifiers if enabled
        if (this.spatialGrid.enabled && transition.spatialWeight !== 1.0) {
            this.applySpatialModifiers(currentProperties, transition);
        }
        
        // Cache the result
        if (this.interpolationCache.size < this.cacheMaxSize) {
            this.interpolationCache.set(cacheKey, this.cloneProperties(currentProperties));
        } else if (Math.random() < 0.1) { // Randomly clear some cache entries
            this.interpolationCache.clear();
        }
    }
    
    /**
     * Interpolate a specific category of properties
     */
    interpolatePropertyCategory(fromProps, toProps, currentProps, progress, blendMode, category) {
        if (!fromProps[category] || !toProps[category]) {
            return;
        }
        
        if (!currentProps[category]) {
            currentProps[category] = {};
        }
        
        const fromCat = fromProps[category];
        const toCat = toProps[category];
        const currentCat = currentProps[category];
        const template = this.propertyTemplates[category];
        
        Object.keys(fromCat).forEach(propName => {
            if (!(propName in toCat)) return;
            
            const fromValue = fromCat[propName];
            const toValue = toCat[propName];
            const propTemplate = template[propName];
            
            if (Array.isArray(fromValue) && Array.isArray(toValue)) {
                // Handle array properties (like RGB values)
                currentCat[propName] = this.interpolateArray(fromValue, toValue, progress, blendMode);
            } else if (typeof fromValue === 'number' && typeof toValue === 'number') {
                // Handle scalar properties
                currentCat[propName] = this.interpolateScalar(
                    fromValue, 
                    toValue, 
                    progress, 
                    blendMode, 
                    propTemplate
                );
            } else if (typeof fromValue === 'object' && typeof toValue === 'object') {
                // Handle nested objects
                currentCat[propName] = this.interpolateObject(fromValue, toValue, progress, blendMode);
            }
        });
    }
    
    /**
     * Interpolate array values (e.g., RGB colors)
     */
    interpolateArray(fromArray, toArray, progress, blendMode) {
        const result = new Array(Math.min(fromArray.length, toArray.length));
        
        for (let i = 0; i < result.length; i++) {
            switch (blendMode) {
                case 'hsv':
                    // Special handling for color arrays
                    if (result.length >= 3) {
                        const fromColor = [fromArray[0], fromArray[1], fromArray[2], fromArray[3] || 1];
                        const toColor = [toArray[0], toArray[1], toArray[2], toArray[3] || 1];
                        const interpolated = ColorUtils.lerpHsv(fromColor, toColor, progress);
                        return interpolated;
                    }
                    // Fall through to linear for non-color arrays
                case 'linear':
                default:
                    result[i] = MathUtils.lerp(fromArray[i], toArray[i], progress);
                    break;
            }
        }
        
        return result;
    }
    
    /**
     * Interpolate scalar values
     */
    interpolateScalar(fromValue, toValue, progress, blendMode, template) {
        let result;
        
        switch (blendMode) {
            case 'logarithmic':
                if (template && template.logScale && fromValue > 0 && toValue > 0) {
                    const logFrom = Math.log(fromValue);
                    const logTo = Math.log(toValue);
                    result = Math.exp(MathUtils.lerp(logFrom, logTo, progress));
                } else {
                    result = MathUtils.lerp(fromValue, toValue, progress);
                }
                break;
                
            case 'smooth':
                result = MathUtils.lerp(fromValue, toValue, MathUtils.smoothstep(0, 1, progress));
                break;
                
            case 'elastic':
                result = MathUtils.lerp(fromValue, toValue, MathUtils.easeOutElastic(progress));
                break;
                
            case 'exponential':
                const exp = progress === 0 ? 0 : Math.pow(2, 10 * (progress - 1));
                result = MathUtils.lerp(fromValue, toValue, exp);
                break;
                
            case 'crossfade':
                // Symmetric crossfade with dip in the middle
                const crossfadeProgress = Math.sin(progress * Math.PI);
                result = MathUtils.lerp(fromValue, toValue, crossfadeProgress);
                break;
                
            case 'linear':
            case 'mix':
            default:
                result = MathUtils.lerp(fromValue, toValue, progress);
                break;
        }
        
        // Apply template constraints if available
        if (template) {
            result = MathUtils.clamp(result, template.min, template.max);
        }
        
        return result;
    }
    
    /**
     * Interpolate object properties recursively
     */
    interpolateObject(fromObj, toObj, progress, blendMode) {
        const result = {};
        
        Object.keys(fromObj).forEach(key => {
            if (key in toObj) {
                if (typeof fromObj[key] === 'number' && typeof toObj[key] === 'number') {
                    result[key] = MathUtils.lerp(fromObj[key], toObj[key], progress);
                } else if (Array.isArray(fromObj[key]) && Array.isArray(toObj[key])) {
                    result[key] = this.interpolateArray(fromObj[key], toObj[key], progress, blendMode);
                } else if (typeof fromObj[key] === 'object' && typeof toObj[key] === 'object') {
                    result[key] = this.interpolateObject(fromObj[key], toObj[key], progress, blendMode);
                } else {
                    result[key] = progress < 0.5 ? fromObj[key] : toObj[key];
                }
            }
        });
        
        return result;
    }
    
    /**
     * Apply spatial modifiers based on position
     */
    applySpatialModifiers(properties, transition) {
        // This would modify properties based on spatial position
        // For now, we'll apply a simple uniform modifier
        const spatialInfluence = transition.spatialWeight;
        
        if (spatialInfluence !== 1.0) {
            // Apply spatial influence to key properties
            if (properties.physical) {
                Object.keys(properties.physical).forEach(key => {
                    if (typeof properties.physical[key] === 'number') {
                        properties.physical[key] *= spatialInfluence;
                    }
                });
            }
        }
    }
    
    /**
     * Custom spring easing function
     */
    springEasing(t) {
        const springConstant = 4;
        const damping = 0.8;
        
        return 1 - Math.exp(-springConstant * t) * Math.cos(damping * springConstant * t);
    }
    
    /**
     * Custom overshoot easing function
     */
    overshootEasing(t) {
        const overshoot = 1.5;
        return (t - 1) * (t - 1) * ((overshoot + 1) * (t - 1) + overshoot) + 1;
    }
    
    /**
     * Custom anticipate easing function
     */
    anticipateEasing(t) {
        const anticipate = 2.0;
        return t * t * ((anticipate + 1) * t - anticipate);
    }
    
    /**
     * Get interpolated property value at specific location
     */
    getPropertyAt(propertyPath, worldX, worldY, worldZ) {
        // Find transitions affecting this property
        const relevantTransitions = Array.from(this.activeTransitions.values())
            .filter(transition => this.hasProperty(transition.currentProperties, propertyPath));
        
        if (relevantTransitions.length === 0) {
            return null;
        }
        
        // Spatial blending if multiple transitions affect this location
        if (relevantTransitions.length === 1) {
            return this.getPropertyValue(relevantTransitions[0].currentProperties, propertyPath);
        }
        
        // Weighted blend of multiple transitions
        let weightedSum = 0;
        let totalWeight = 0;
        
        relevantTransitions.forEach(transition => {
            const weight = this.calculateSpatialWeight(transition, worldX, worldY, worldZ);
            const value = this.getPropertyValue(transition.currentProperties, propertyPath);
            
            if (typeof value === 'number') {
                weightedSum += value * weight;
                totalWeight += weight;
            }
        });
        
        return totalWeight > 0 ? weightedSum / totalWeight : null;
    }
    
    /**
     * Calculate spatial weight for transition at given location
     */
    calculateSpatialWeight(transition, x, y, z) {
        // Simple distance-based weighting for now
        // Could be enhanced with more sophisticated spatial interpolation
        const distance = Math.sqrt(x*x + y*y + z*z);
        return Math.exp(-distance * 0.1) * transition.spatialWeight;
    }
    
    /**
     * Check if properties object has a specific property path
     */
    hasProperty(properties, propertyPath) {
        const parts = propertyPath.split('.');
        let current = properties;
        
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get property value by path
     */
    getPropertyValue(properties, propertyPath) {
        const parts = propertyPath.split('.');
        let current = properties;
        
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return null;
            }
        }
        
        return current;
    }
    
    /**
     * Clone properties object deeply
     */
    cloneProperties(properties) {
        return JSON.parse(JSON.stringify(properties));
    }
    
    /**
     * Clean up oldest transition to make room for new ones
     */
    cleanupOldestTransition() {
        let oldestTime = Infinity;
        let oldestId = null;
        
        this.activeTransitions.forEach((transition, id) => {
            if (transition.startTime < oldestTime) {
                oldestTime = transition.startTime;
                oldestId = id;
            }
        });
        
        if (oldestId !== null) {
            this.activeTransitions.delete(oldestId);
        }
    }
    
    /**
     * Stop a specific transition
     */
    stopTransition(transitionId) {
        if (this.activeTransitions.has(transitionId)) {
            const transition = this.activeTransitions.get(transitionId);
            if (transition.onComplete) {
                transition.onComplete(transition.currentProperties);
            }
            this.activeTransitions.delete(transitionId);
            return true;
        }
        
        return false;
    }
    
    /**
     * Stop all transitions of a specific type
     */
    stopTransitionsByType(transitionType) {
        const toRemove = [];
        
        this.activeTransitions.forEach((transition, id) => {
            if (transition.type === transitionType) {
                toRemove.push(id);
            }
        });
        
        toRemove.forEach(id => this.stopTransition(id));
        
        return toRemove.length;
    }
    
    /**
     * Create a material transition between two material types
     */
    createMaterialTransition(fromMaterial, toMaterial, options = {}) {
        return this.startTransition({
            type: 'material',
            from: fromMaterial,
            to: toMaterial,
            duration: options.duration || 3.0,
            easing: options.easing || 'smoothstep',
            blendMode: options.blendMode || 'mix',
            audioReactive: options.audioReactive !== false,
            spatialWeight: options.spatialWeight || 1.0,
            onUpdate: options.onUpdate,
            onComplete: options.onComplete
        });
    }
    
    /**
     * Create a phase transition (solid/liquid/gas/plasma)
     */
    createPhaseTransition(fromPhase, toPhase, options = {}) {
        return this.startTransition({
            type: 'phase',
            from: { phase: fromPhase },
            to: { phase: toPhase },
            duration: options.duration || 1.5,
            easing: options.easing || 'elastic',
            blendMode: options.blendMode || 'crossfade',
            audioReactive: options.audioReactive !== false,
            spatialWeight: options.spatialWeight || 1.0,
            onUpdate: options.onUpdate,
            onComplete: options.onComplete
        });
    }
    
    /**
     * Create a temperature transition
     */
    createTemperatureTransition(fromTemp, toTemp, options = {}) {
        return this.startTransition({
            type: 'temperature',
            from: { thermal: { temperature: fromTemp } },
            to: { thermal: { temperature: toTemp } },
            duration: options.duration || 0.8,
            easing: options.easing || 'exponential',
            blendMode: options.blendMode || 'linear',
            audioReactive: options.audioReactive !== false,
            spatialWeight: options.spatialWeight || 1.0,
            onUpdate: options.onUpdate,
            onComplete: options.onComplete
        });
    }
    
    /**
     * Create a viscosity transition
     */
    createViscosityTransition(fromViscosity, toViscosity, options = {}) {
        return this.startTransition({
            type: 'viscosity',
            from: { physical: { viscosity: fromViscosity } },
            to: { physical: { viscosity: toViscosity } },
            duration: options.duration || 1.2,
            easing: options.easing || 'smoothstep',
            blendMode: options.blendMode || 'logarithmic',
            audioReactive: options.audioReactive !== false,
            spatialWeight: options.spatialWeight || 1.0,
            onUpdate: options.onUpdate,
            onComplete: options.onComplete
        });
    }
    
    /**
     * Create an optical property transition (color, transparency, etc.)
     */
    createOpticalTransition(fromOptical, toOptical, options = {}) {
        return this.startTransition({
            type: 'optical',
            from: { optical: fromOptical },
            to: { optical: toOptical },
            duration: options.duration || 0.5,
            easing: options.easing || 'cubic',
            blendMode: options.blendMode || 'hsv',
            audioReactive: options.audioReactive !== false,
            spatialWeight: options.spatialWeight || 1.0,
            onUpdate: options.onUpdate,
            onComplete: options.onComplete
        });
    }
    
    /**
     * Create a surface property transition (surface tension, roughness, etc.)
     */
    createSurfaceTransition(fromSurface, toSurface, options = {}) {
        return this.startTransition({
            type: 'surface',
            from: { surface: fromSurface },
            to: { surface: toSurface },
            duration: options.duration || 2.5,
            easing: options.easing || 'elastic',
            blendMode: options.blendMode || 'smooth',
            audioReactive: options.audioReactive !== false,
            spatialWeight: options.spatialWeight || 1.0,
            onUpdate: options.onUpdate,
            onComplete: options.onComplete
        });
    }
    
    /**
     * Create an electromagnetic transition
     */
    createElectromagneticTransition(fromEM, toEM, options = {}) {
        return this.startTransition({
            type: 'electromagnetic',
            from: { electrical: fromEM },
            to: { electrical: toEM },
            duration: options.duration || 0.3,
            easing: options.easing || 'exponential',
            blendMode: options.blendMode || 'linear',
            audioReactive: options.audioReactive !== false,
            spatialWeight: options.spatialWeight || 1.0,
            onUpdate: options.onUpdate,
            onComplete: options.onComplete
        });
    }
    
    /**
     * Create a complex multi-property transition
     */
    createComplexTransition(fromProperties, toProperties, options = {}) {
        const transitions = [];
        
        // Break down complex transition into category-specific transitions
        const categories = ['physical', 'optical', 'electrical', 'thermal'];
        
        categories.forEach(category => {
            if (fromProperties[category] && toProperties[category]) {
                const categoryTransition = this.startTransition({
                    type: category,
                    from: { [category]: fromProperties[category] },
                    to: { [category]: toProperties[category] },
                    duration: options.duration || this.config.defaultDuration,
                    easing: options.easing || 'smoothstep',
                    blendMode: options.blendMode || 'mix',
                    audioReactive: options.audioReactive !== false,
                    spatialWeight: options.spatialWeight || 1.0,
                    onUpdate: options.onUpdate,
                    onComplete: options.onComplete
                });
                
                transitions.push(categoryTransition);
            }
        });
        
        return transitions;
    }
    
    /**
     * Create an audio-synchronized transition sequence
     */
    createAudioSequence(sequence, options = {}) {
        const sequenceId = `sequence_${this.transitionCounter++}`;
        const activeSequence = {
            id: sequenceId,
            steps: sequence,
            currentStep: 0,
            startTime: performance.now(),
            audioSync: options.audioSync !== false,
            loop: options.loop === true,
            onStepComplete: options.onStepComplete,
            onSequenceComplete: options.onSequenceComplete
        };
        
        // Start first step
        if (sequence.length > 0) {
            this.executeSequenceStep(activeSequence);
        }
        
        return sequenceId;
    }
    
    /**
     * Execute a step in an audio sequence
     */
    executeSequenceStep(sequence) {
        if (sequence.currentStep >= sequence.steps.length) {
            if (sequence.loop) {
                sequence.currentStep = 0;
            } else {
                if (sequence.onSequenceComplete) {
                    sequence.onSequenceComplete();
                }
                return;
            }
        }
        
        const step = sequence.steps[sequence.currentStep];
        
        const transitionId = this.startTransition({
            ...step,
            onComplete: (properties) => {
                if (step.onComplete) {
                    step.onComplete(properties);
                }
                if (sequence.onStepComplete) {
                    sequence.onStepComplete(sequence.currentStep, properties);
                }
                
                // Move to next step
                sequence.currentStep++;
                this.executeSequenceStep(sequence);
            }
        });
        
        return transitionId;
    }
    
    /**
     * Create a breathing/pulsing effect for materials
     */
    createBreathingEffect(baseProperties, intensity = 1.0, frequency = 1.0, options = {}) {
        const breathingTransition = {
            type: 'breathing',
            baseProperties: this.cloneProperties(baseProperties),
            intensity: intensity,
            frequency: frequency,
            phase: 0,
            audioReactive: options.audioReactive !== false,
            spatialWeight: options.spatialWeight || 1.0
        };
        
        return this.startTransition({
            type: 'breathing',
            from: baseProperties,
            to: baseProperties, // Will be modified by breathing logic
            duration: Number.MAX_SAFE_INTEGER, // Infinite duration
            easing: 'linear',
            blendMode: 'mix',
            audioReactive: options.audioReactive !== false,
            spatialWeight: options.spatialWeight || 1.0,
            customUpdate: (transition, deltaTime) => {
                this.updateBreathingEffect(transition, deltaTime, breathingTransition);
            }
        });
    }
    
    /**
     * Update breathing effect
     */
    updateBreathingEffect(transition, deltaTime, breathingData) {
        breathingData.phase += deltaTime * breathingData.frequency * Math.PI * 2;
        
        const breathingFactor = Math.sin(breathingData.phase) * breathingData.intensity;
        
        // Apply breathing to relevant properties
        if (breathingData.baseProperties.physical) {
            const basePhysical = breathingData.baseProperties.physical;
            
            if (!transition.currentProperties.physical) {
                transition.currentProperties.physical = {};
            }
            
            // Breathing affects scale-related properties
            if (basePhysical.density) {
                transition.currentProperties.physical.density = 
                    basePhysical.density * (1 + breathingFactor * 0.1);
            }
            
            if (basePhysical.viscosity) {
                transition.currentProperties.physical.viscosity = 
                    basePhysical.viscosity * (1 + breathingFactor * 0.2);
            }
            
            if (basePhysical.surfaceTension) {
                transition.currentProperties.physical.surfaceTension = 
                    basePhysical.surfaceTension * (1 + breathingFactor * 0.15);
            }
        }
        
        // Breathing affects optical properties
        if (breathingData.baseProperties.optical) {
            const baseOptical = breathingData.baseProperties.optical;
            
            if (!transition.currentProperties.optical) {
                transition.currentProperties.optical = {};
            }
            
            if (baseOptical.emission && Array.isArray(baseOptical.emission)) {
                transition.currentProperties.optical.emission = baseOptical.emission.map(
                    value => value * (1 + breathingFactor * 0.3)
                );
            }
            
            if (baseOptical.scattering) {
                transition.currentProperties.optical.scattering = 
                    baseOptical.scattering * (1 + breathingFactor * 0.25);
            }
        }
    }
    
    /**
     * Create a reactive transition that responds to audio beats
     */
    createBeatReactiveTransition(baseProperties, beatProperties, options = {}) {
        return this.startTransition({
            type: 'beat_reactive',
            from: baseProperties,
            to: beatProperties,
            duration: Number.MAX_SAFE_INTEGER, // Infinite duration
            easing: 'elastic',
            blendMode: 'mix',
            audioReactive: true,
            spatialWeight: options.spatialWeight || 1.0,
            beatSensitivity: options.beatSensitivity || 1.0,
            beatDecay: options.beatDecay || 0.95,
            customUpdate: (transition, deltaTime, audioData) => {
                this.updateBeatReactiveTransition(transition, deltaTime, audioData, options);
            }
        });
    }
    
    /**
     * Update beat-reactive transition
     */
    updateBeatReactiveTransition(transition, deltaTime, audioData, options) {
        if (!audioData) return;
        
        const { beat, beatStrength } = audioData;
        
        // Maintain beat intensity with decay
        if (!transition.beatIntensity) {
            transition.beatIntensity = 0;
        }
        
        if (beat && beatStrength > 0.3) {
            transition.beatIntensity = Math.min(1.0, 
                transition.beatIntensity + beatStrength * (options.beatSensitivity || 1.0)
            );
        }
        
        // Apply decay
        transition.beatIntensity *= Math.pow(options.beatDecay || 0.95, deltaTime * 60);
        
        // Update progress based on beat intensity
        transition.progress = transition.beatIntensity;
    }
    
    /**
     * Set audio reactivity parameters
     */
    setAudioReactivity(params) {
        Object.assign(this.audioModifiers, params);
    }
    
    /**
     * Get current transition statistics
     */
    getStatistics() {
        return {
            activeTransitions: this.activeTransitions.size,
            interpolationsPerFrame: this.performanceMetrics.interpolationsPerFrame,
            averageTime: this.performanceMetrics.averageInterpolationTime,
            cacheHitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses),
            memoryUsage: this.interpolationCache.size,
            performance: this.performanceMetrics
        };
    }
    
    /**
     * Get all active transitions
     */
    getActiveTransitions() {
        return Array.from(this.activeTransitions.values()).map(transition => ({
            id: transition.id,
            type: transition.type,
            progress: transition.progress,
            duration: transition.duration,
            easing: transition.easing,
            blendMode: transition.blendMode,
            isComplete: transition.isComplete
        }));
    }
    
    /**
     * Clear all transitions
     */
    clearAllTransitions() {
        this.activeTransitions.forEach((transition, id) => {
            if (transition.onComplete) {
                transition.onComplete(transition.currentProperties);
            }
        });
        
        this.activeTransitions.clear();
        this.interpolationCache.clear();
        this.cacheStats = { hits: 0, misses: 0 };
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        console.log('Disposing PropertyInterpolator...');
        
        // Clear all active transitions
        this.clearAllTransitions();
        
        // Clear lookup tables
        this.easingLookupTables.clear();
        
        // Clear spatial grid
        if (this.spatialGrid.data) {
            this.spatialGrid.data.weights = null;
            this.spatialGrid.data.properties.clear();
            this.spatialGrid.data = null;
        }
        
        console.log('PropertyInterpolator disposed');
    }
}