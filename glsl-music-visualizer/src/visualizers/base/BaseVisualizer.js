/**
 * Base Visualizer Abstract Class
 * Foundation for all visualizer implementations in the GLSL music visualizer
 * Location: src/visualizers/base/BaseVisualizer.js
 * 
 * Provides the common interface and functionality that all visualizers must implement,
 * including audio data integration, shader management, performance monitoring,
 * and material system compatibility.
 */

import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';

export class BaseVisualizer {
    constructor(name, config = {}) {
        if (this.constructor === BaseVisualizer) {
            throw new Error('BaseVisualizer is an abstract class and cannot be instantiated directly');
        }
        
        // Visualizer identity
        this.name = name;
        this.type = config.type || 'unknown';
        this.version = config.version || '1.0.0';
        this.id = config.id || this.generateId();
        
        // Configuration
        this.config = {
            // Core settings
            enabled: config.enabled !== false,
            priority: config.priority || 0,
            
            // Rendering settings
            enableDepthTest: config.enableDepthTest !== false,
            enableBlending: config.enableBlending !== false,
            blendMode: config.blendMode || 'normal',
            primitive: config.primitive || 'triangles',
            
            // Performance settings
            targetFPS: config.targetFPS || 60,
            adaptiveQuality: config.adaptiveQuality !== false,
            maxComplexity: config.maxComplexity || 1.0,
            
            // Audio reactivity
            audioReactivity: config.audioReactivity || 1.0,
            frequencyRange: config.frequencyRange || [20, 20000],
            beatSensitivity: config.beatSensitivity || 0.5,
            
            // Animation settings
            animationSpeed: config.animationSpeed || 1.0,
            smoothingFactor: config.smoothingFactor || 0.1,
            
            // Visual effects
            enablePostProcessing: config.enablePostProcessing !== false,
            enableParticles: config.enableParticles !== false,
            enablePhysics: config.enablePhysics !== false,
            
            ...config
        };
        
        // State management
        this.state = {
            isInitialized: false,
            isActive: false,
            isPaused: false,
            isLoading: false,
            hasError: false,
            errorMessage: null,
            
            // Timing
            startTime: 0,
            lastUpdateTime: 0,
            deltaTime: 0,
            totalTime: 0,
            frameCount: 0,
            
            // Performance
            averageFPS: 0,
            lastFPSUpdate: 0,
            performanceTier: 'high',
            qualityLevel: 1.0,
            
            // Animation state
            animationTime: 0,
            animationPhase: 0,
            transitionProgress: 0,
            
            // Audio state
            lastAudioUpdate: 0,
            audioDataAge: 0,
            beatDetected: false,
            lastBeatTime: 0
        };
        
        // Audio data references
        this.audioData = {
            frequencyData: null,
            timeData: null,
            features: null,
            lastUpdate: 0
        };
        
        // Shader resources
        this.shaders = {
            programs: new Map(),
            uniforms: new Map(),
            attributes: new Map(),
            currentProgram: null
        };
        
        // Geometry resources
        this.geometry = {
            buffers: new Map(),
            vaos: new Map(),
            meshes: new Map()
        };
        
        // Material system integration
        this.materials = {
            current: null,
            properties: new Map(),
            uniforms: new Map()
        };
        
        // WebGL resources
        this.gl = null;
        this.canvas = null;
        
        // Performance monitoring
        this.performanceMetrics = {
            renderTime: 0,
            updateTime: 0,
            shaderTime: 0,
            geometryTime: 0,
            memoryUsage: 0,
            lastMetricsUpdate: 0
        };
        
        // Event system
        this.eventCallbacks = new Map([
            ['initialized', []],
            ['activated', []],
            ['deactivated', []],
            ['updated', []],
            ['rendered', []],
            ['error', []],
            ['performanceChanged', []],
            ['audioUpdated', []],
            ['materialChanged', []]
        ]);
        
        // Integration points
        this.integrations = {
            renderEngine: null,
            audioEngine: null,
            materialManager: null,
            shaderManager: null,
            physics: null
        };
        
        console.log(`${this.constructor.name} created:`, this.name);
    }
    
    // ===== ABSTRACT METHODS (Must be implemented by subclasses) =====
    
    /**
     * Initialize visualizer resources
     * ABSTRACT METHOD - Must be implemented by subclasses
     * @param {WebGLRenderingContext} gl - WebGL context
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {Object} integrations - System integrations
     * @returns {Promise<void>}
     */
    async initialize(gl, canvas, integrations) {
        throw new Error(`${this.constructor.name} must implement initialize() method`);
    }
    
    /**
     * Update visualizer state
     * ABSTRACT METHOD - Must be implemented by subclasses
     * @param {number} deltaTime - Time since last update (seconds)
     * @param {Object} audioData - Current audio analysis data
     * @returns {void}
     */
    update(deltaTime, audioData) {
        throw new Error(`${this.constructor.name} must implement update() method`);
    }
    
    /**
     * Render visualizer
     * ABSTRACT METHOD - Must be implemented by subclasses
     * @param {number} deltaTime - Time since last render (seconds)
     * @param {Object} renderState - Current render state
     * @returns {void}
     */
    render(deltaTime, renderState) {
        throw new Error(`${this.constructor.name} must implement render() method`);
    }
    
    /**
     * Resize visualizer for new canvas dimensions
     * ABSTRACT METHOD - Must be implemented by subclasses
     * @param {number} width - New canvas width
     * @param {number} height - New canvas height
     * @returns {void}
     */
    resize(width, height) {
        throw new Error(`${this.constructor.name} must implement resize() method`);
    }
    
    // ===== CONCRETE METHODS (Shared functionality) =====
    
    /**
     * Base initialization setup
     * Called by subclass initialize() methods
     */
    async initializeBase(gl, canvas, integrations) {
        this.gl = gl;
        this.canvas = canvas;
        this.integrations = integrations;
        
        // Validate integrations
        this.validateIntegrations(integrations);
        
        // Initialize performance monitoring
        this.initializePerformanceMonitoring();
        
        // Set initial timing
        this.state.startTime = performance.now();
        this.state.lastUpdateTime = this.state.startTime;
        
        // Initialize audio data structures
        this.initializeAudioStructures();
        
        // Setup event handling
        this.setupEventHandling();
        
        this.state.isInitialized = true;
        this.emit('initialized', { visualizer: this });
        
        console.log(`${this.constructor.name} base initialization complete`);
    }
    
    /**
     * Base update logic
     * Called by subclass update() methods
     */
    updateBase(deltaTime, audioData) {
        // Update timing
        const now = performance.now();
        this.state.deltaTime = deltaTime;
        this.state.totalTime += deltaTime;
        this.state.frameCount++;
        this.state.lastUpdateTime = now;
        
        // Update animation time
        this.state.animationTime += deltaTime * this.config.animationSpeed;
        this.state.animationPhase = (this.state.animationTime % (Math.PI * 2));
        
        // Update audio data
        this.updateAudioData(audioData);
        
        // Update performance metrics
        this.updatePerformanceMetrics();
        
        // Adaptive quality adjustment
        if (this.config.adaptiveQuality) {
            this.adjustQuality();
        }
        
        this.emit('updated', { deltaTime, audioData });
    }
    
    /**
     * Base render setup
     * Called by subclass render() methods
     */
    renderBase(deltaTime, renderState) {
        if (!this.state.isInitialized || !this.state.isActive) {
            return;
        }
        
        const startTime = performance.now();
        
        // Setup WebGL state
        this.setupRenderState(renderState);
        
        // Track render time
        this.performanceMetrics.renderTime = performance.now() - startTime;
        
        this.emit('rendered', { deltaTime, renderState });
    }
    
    /**
     * Activate visualizer
     */
    activate() {
        if (!this.state.isInitialized) {
            console.warn(`Cannot activate ${this.name}: not initialized`);
            return;
        }
        
        this.state.isActive = true;
        this.state.isPaused = false;
        this.emit('activated', { visualizer: this });
        
        console.log(`Visualizer activated: ${this.name}`);
    }
    
    /**
     * Deactivate visualizer
     */
    deactivate() {
        this.state.isActive = false;
        this.emit('deactivated', { visualizer: this });
        
        console.log(`Visualizer deactivated: ${this.name}`);
    }
    
    /**
     * Pause/unpause visualizer
     */
    pause(paused = true) {
        this.state.isPaused = paused;
        console.log(`Visualizer ${paused ? 'paused' : 'resumed'}: ${this.name}`);
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.validateConfig();
        console.log(`Configuration updated for ${this.name}`);
    }
    
    /**
     * Set audio data
     */
    setAudioData(audioData) {
        this.audioData = audioData;
        this.audioData.lastUpdate = performance.now();
        this.state.lastAudioUpdate = this.audioData.lastUpdate;
        this.emit('audioUpdated', audioData);
    }
    
    /**
     * Set material properties
     */
    setMaterial(material) {
        this.materials.current = material;
        this.emit('materialChanged', material);
    }
    
    /**
     * Get visualizer information
     */
    getInfo() {
        return {
            name: this.name,
            type: this.type,
            version: this.version,
            id: this.id,
            state: { ...this.state },
            config: { ...this.config },
            performance: { ...this.performanceMetrics }
        };
    }
    
    /**
     * Get current performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            fps: this.state.averageFPS,
            qualityLevel: this.state.qualityLevel,
            performanceTier: this.state.performanceTier
        };
    }
    
    // ===== UTILITY METHODS =====
    
    /**
     * Generate unique visualizer ID
     */
    generateId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${this.name.toLowerCase().replace(/\s+/g, '_')}_${timestamp}_${random}`;
    }
    
    /**
     * Validate integrations
     */
    validateIntegrations(integrations) {
        const required = ['renderEngine', 'shaderManager'];
        const optional = ['audioEngine', 'materialManager', 'physics'];
        
        for (const integration of required) {
            if (!integrations[integration]) {
                throw new Error(`Required integration missing: ${integration}`);
            }
        }
        
        // Log available integrations
        const available = [...required, ...optional].filter(key => integrations[key]);
        console.log(`Available integrations for ${this.name}:`, available);
    }
    
    /**
     * Initialize performance monitoring
     */
    initializePerformanceMonitoring() {
        performanceMonitor.registerVisualizer(this.name, {
            updateCallback: (metrics) => this.onPerformanceUpdate(metrics),
            thresholds: {
                minFPS: 30,
                maxRenderTime: 16.67,
                maxMemoryUsage: 256 * 1024 * 1024
            }
        });
    }
    
    /**
     * Initialize audio data structures
     */
    initializeAudioStructures() {
        this.audioData = {
            frequencyData: new Float32Array(1024),
            timeData: new Float32Array(1024),
            features: {
                bass: 0,
                mid: 0,
                treble: 0,
                energy: 0,
                beat: false
            },
            lastUpdate: 0
        };
    }
    
    /**
     * Setup event handling
     */
    setupEventHandling() {
        // Setup internal event handlers
        this.on('error', (error) => {
            this.state.hasError = true;
            this.state.errorMessage = error.message;
            console.error(`Error in ${this.name}:`, error);
        });
    }
    
    /**
     * Update audio data with smoothing
     */
    updateAudioData(audioData) {
        if (!audioData) return;
        
        const now = performance.now();
        this.state.audioDataAge = now - audioData.timestamp;
        
        // Smooth audio features
        const smoothing = this.config.smoothingFactor;
        if (this.audioData.features && audioData.features) {
            this.audioData.features.bass = MathUtils.lerp(
                this.audioData.features.bass,
                audioData.features.bass,
                smoothing
            );
            this.audioData.features.mid = MathUtils.lerp(
                this.audioData.features.mid,
                audioData.features.mid,
                smoothing
            );
            this.audioData.features.treble = MathUtils.lerp(
                this.audioData.features.treble,
                audioData.features.treble,
                smoothing
            );
            this.audioData.features.energy = MathUtils.lerp(
                this.audioData.features.energy,
                audioData.features.energy,
                smoothing
            );
        }
        
        // Beat detection
        if (audioData.features && audioData.features.beat) {
            this.state.beatDetected = true;
            this.state.lastBeatTime = now;
        } else {
            this.state.beatDetected = false;
        }
        
        // Copy frequency and time data
        if (audioData.frequencyData) {
            this.audioData.frequencyData.set(audioData.frequencyData);
        }
        if (audioData.timeData) {
            this.audioData.timeData.set(audioData.timeData);
        }
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        const now = performance.now();
        
        // Calculate FPS
        if (now - this.state.lastFPSUpdate > 1000) {
            this.state.averageFPS = this.state.frameCount;
            this.state.frameCount = 0;
            this.state.lastFPSUpdate = now;
        }
        
        // Update performance tier based on FPS
        if (this.state.averageFPS < 30) {
            this.state.performanceTier = 'low';
        } else if (this.state.averageFPS < 50) {
            this.state.performanceTier = 'medium';
        } else {
            this.state.performanceTier = 'high';
        }
    }
    
    /**
     * Adjust quality based on performance
     */
    adjustQuality() {
        const targetFPS = this.config.targetFPS;
        const currentFPS = this.state.averageFPS;
        
        if (currentFPS < targetFPS * 0.8) {
            // Decrease quality
            this.state.qualityLevel = Math.max(0.1, this.state.qualityLevel - 0.1);
        } else if (currentFPS > targetFPS * 0.95) {
            // Increase quality
            this.state.qualityLevel = Math.min(1.0, this.state.qualityLevel + 0.05);
        }
    }
    
    /**
     * Setup WebGL render state
     */
    setupRenderState(renderState) {
        const gl = this.gl;
        
        // Depth testing
        if (this.config.enableDepthTest) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
        
        // Blending
        if (this.config.enableBlending) {
            gl.enable(gl.BLEND);
            this.setBlendMode(this.config.blendMode);
        } else {
            gl.disable(gl.BLEND);
        }
    }
    
    /**
     * Set blend mode
     */
    setBlendMode(mode) {
        const gl = this.gl;
        
        switch (mode) {
            case 'additive':
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                break;
            case 'multiply':
                gl.blendFunc(gl.DST_COLOR, gl.ZERO);
                break;
            case 'screen':
                gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE);
                break;
            case 'normal':
            default:
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
        }
    }
    
    /**
     * Validate configuration
     */
    validateConfig() {
        // Clamp numeric values
        this.config.audioReactivity = MathUtils.clamp(this.config.audioReactivity, 0, 10);
        this.config.animationSpeed = MathUtils.clamp(this.config.animationSpeed, 0.1, 10);
        this.config.smoothingFactor = MathUtils.clamp(this.config.smoothingFactor, 0.01, 1.0);
        this.config.beatSensitivity = MathUtils.clamp(this.config.beatSensitivity, 0, 1);
        this.config.maxComplexity = MathUtils.clamp(this.config.maxComplexity, 0.1, 2.0);
        
        // Validate frequency range
        if (this.config.frequencyRange[0] >= this.config.frequencyRange[1]) {
            this.config.frequencyRange = [20, 20000];
        }
    }
    
    /**
     * Performance update callback
     */
    onPerformanceUpdate(metrics) {
        Object.assign(this.performanceMetrics, metrics);
        this.emit('performanceChanged', metrics);
    }
    
    // ===== EVENT SYSTEM =====
    
    /**
     * Add event listener
     */
    on(event, callback) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).push(callback);
        } else {
            console.warn(`Unknown event type: ${event}`);
        }
    }
    
    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.eventCallbacks.has(event)) {
            const callbacks = this.eventCallbacks.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    /**
     * Emit event
     */
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
    
    // ===== CLEANUP =====
    
    /**
     * Dispose of visualizer resources
     * Should be overridden by subclasses to clean up specific resources
     */
    dispose() {
        console.log(`Disposing visualizer: ${this.name}`);
        
        // Deactivate
        this.deactivate();
        
        // Clear event callbacks
        this.eventCallbacks.forEach(callbacks => callbacks.length = 0);
        
        // Clear shader resources
        this.shaders.programs.clear();
        this.shaders.uniforms.clear();
        this.shaders.attributes.clear();
        
        // Clear geometry resources
        this.geometry.buffers.clear();
        this.geometry.vaos.clear();
        this.geometry.meshes.clear();
        
        // Clear material properties
        this.materials.properties.clear();
        this.materials.uniforms.clear();
        
        // Unregister from performance monitor
        performanceMonitor.unregisterVisualizer(this.name);
        
        // Reset state
        this.state.isInitialized = false;
        this.state.isActive = false;
        
        console.log(`Visualizer disposed: ${this.name}`);
    }
}