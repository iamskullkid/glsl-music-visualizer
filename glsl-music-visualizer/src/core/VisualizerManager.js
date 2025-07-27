/**
 * Visualizer Manager
 * Central coordination system for all visualizer implementations
 * Location: src/core/VisualizerManager.js
 * 
 * Manages visualizer lifecycle, transitions, performance monitoring,
 * and integration with core systems (audio, rendering, materials).
 * Coordinates multiple visualizers and handles seamless switching.
 */

import { BaseVisualizer } from '../visualizers/base/BaseVisualizer.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { performanceMonitor } from './PerformanceMonitor.js';

export class VisualizerManager {
    constructor(options = {}) {
        // Configuration
        this.config = {
            maxActiveVisualizers: options.maxActiveVisualizers || 3,
            enableHotSwapping: options.enableHotSwapping !== false,
            enableTransitions: options.enableTransitions !== false,
            enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
            transitionDuration: options.transitionDuration || 2000, // ms
            updateFrequency: options.updateFrequency || 60, // Hz
            adaptiveQuality: options.adaptiveQuality !== false,
            enablePreloading: options.enablePreloading !== false,
            maxPreloadedVisualizers: options.maxPreloadedVisualizers || 5
        };
        
        // Visualizer registry
        this.visualizers = new Map(); // All registered visualizers
        this.visualizerTypes = new Map(); // Visualizer class constructors
        this.activeVisualizers = new Map(); // Currently active visualizers
        this.preloadedVisualizers = new Map(); // Preloaded for quick switching
        
        // Current state
        this.currentVisualizer = null;
        this.previousVisualizer = null;
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.transitionStartTime = 0;
        
        // Performance tracking
        this.performanceMetrics = {
            averageFPS: 0,
            renderTime: 0,
            updateTime: 0,
            memoryUsage: 0,
            gpuUsage: 0,
            lastUpdate: 0,
            frameDrops: 0,
            qualityLevel: 1.0
        };
        
        // Transition system
        this.transitions = {
            types: new Map([
                ['fade', this.fadeTransition.bind(this)],
                ['dissolve', this.dissolveTransition.bind(this)],
                ['morph', this.morphTransition.bind(this)],
                ['slide', this.slideTransition.bind(this)],
                ['zoom', this.zoomTransition.bind(this)]
            ]),
            currentType: 'fade',
            easing: 'easeInOutCubic',
            direction: 'forward'
        };
        
        // Integration points
        this.integrations = {
            renderEngine: null,
            audioEngine: null,
            materialManager: null,
            shaderManager: null,
            uiManager: null
        };
        
        // WebGL context
        this.gl = null;
        this.canvas = null;
        
        // Auto-switching system
        this.autoSwitch = {
            enabled: options.enableAutoSwitch === true,
            mode: 'time', // 'time', 'audio', 'random', 'energy'
            interval: options.autoSwitchInterval || 60000, // ms
            lastSwitch: 0,
            criteria: {
                energyChange: 0.4,
                genreChange: true,
                beatPatternChange: 0.3,
                userActivity: false
            }
        };
        
        // Event system
        this.eventCallbacks = new Map([
            ['visualizerRegistered', []],
            ['visualizerActivated', []],
            ['visualizerDeactivated', []],
            ['transitionStarted', []],
            ['transitionCompleted', []],
            ['performanceChanged', []],
            ['error', []],
            ['qualityAdjusted', []]
        ]);
        
        // Audio data cache
        this.audioData = {
            current: null,
            history: [],
            maxHistory: 60, // 1 second at 60fps
            features: {
                energy: 0,
                bass: 0,
                mid: 0,
                treble: 0,
                beat: false,
                tempo: 120
            }
        };
        
        // Error handling and recovery
        this.errorRecovery = {
            enabled: true,
            maxRetries: 3,
            retryDelay: 1000,
            fallbackVisualizer: 'simple_waveform',
            criticalErrors: new Set()
        };
        
        // Statistics and analytics
        this.statistics = {
            visualizerSwitches: 0,
            totalRenderTime: 0,
            averageTransitionTime: 0,
            errorCount: 0,
            startTime: Date.now(),
            uptime: 0
        };
        
        this.isInitialized = false;
        
        console.log('VisualizerManager created', {
            maxActive: this.config.maxActiveVisualizers,
            transitionDuration: this.config.transitionDuration,
            autoSwitch: this.autoSwitch.enabled
        });
    }
    
    /**
     * Initialize the visualizer manager
     * @param {Object} integrations - Core system integrations
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @returns {Promise<void>}
     */
    async initialize(integrations, canvas) {
        try {
            this.integrations = integrations;
            this.canvas = canvas;
            this.gl = integrations.renderEngine.gl;
            
            // Validate required integrations
            this.validateIntegrations();
            
            // Initialize performance monitoring
            if (this.config.enablePerformanceMonitoring) {
                this.initializePerformanceMonitoring();
            }
            
            // Setup transition system
            this.initializeTransitionSystem();
            
            // Setup auto-switching if enabled
            if (this.autoSwitch.enabled) {
                this.initializeAutoSwitching();
            }
            
            // Register built-in visualizer types
            await this.registerBuiltinVisualizers();
            
            // Setup error handling
            this.setupErrorHandling();
            
            this.isInitialized = true;
            
            console.log('VisualizerManager initialized', {
                integrations: Object.keys(this.integrations).filter(k => this.integrations[k]),
                registeredTypes: this.visualizerTypes.size,
                canvas: { width: canvas.width, height: canvas.height }
            });
            
        } catch (error) {
            console.error('Failed to initialize VisualizerManager:', error);
            this.handleError('initialization', error);
            throw error;
        }
    }
    
    /**
     * Register a visualizer type
     * @param {string} name - Visualizer type name
     * @param {class} VisualizerClass - Visualizer class constructor
     * @param {Object} metadata - Visualizer metadata
     */
    registerVisualizerType(name, VisualizerClass, metadata = {}) {
        // Validate visualizer class
        if (!this.isValidVisualizerClass(VisualizerClass)) {
            throw new Error(`Invalid visualizer class: ${name}`);
        }
        
        const typeInfo = {
            name,
            class: VisualizerClass,
            metadata: {
                description: metadata.description || '',
                category: metadata.category || 'general',
                complexity: metadata.complexity || 'medium',
                audioReactive: metadata.audioReactive !== false,
                materials: metadata.materials || [],
                performance: metadata.performance || 'medium',
                ...metadata
            },
            registeredAt: Date.now()
        };
        
        this.visualizerTypes.set(name, typeInfo);
        this.emit('visualizerRegistered', { name, typeInfo });
        
        console.log(`Registered visualizer type: ${name}`, typeInfo.metadata);
    }
    
    /**
     * Create and activate a visualizer
     * @param {string} type - Visualizer type name
     * @param {Object} config - Visualizer configuration
     * @param {boolean} preload - Whether to preload only
     * @returns {Promise<BaseVisualizer>}
     */
    async createVisualizer(type, config = {}, preload = false) {
        if (!this.visualizerTypes.has(type)) {
            throw new Error(`Unknown visualizer type: ${type}`);
        }
        
        const typeInfo = this.visualizerTypes.get(type);
        const VisualizerClass = typeInfo.class;
        
        try {
            // Create visualizer instance
            const visualizer = new VisualizerClass(
                config.name || `${type}_${Date.now()}`,
                { ...typeInfo.metadata, ...config }
            );
            
            // Initialize visualizer
            await visualizer.initialize(this.gl, this.canvas, this.integrations);
            
            // Setup event handlers
            this.setupVisualizerEventHandlers(visualizer);
            
            // Store visualizer
            this.visualizers.set(visualizer.id, visualizer);
            
            if (preload) {
                this.preloadedVisualizers.set(type, visualizer);
                console.log(`Preloaded visualizer: ${type}`);
            } else {
                this.activeVisualizers.set(visualizer.id, visualizer);
                console.log(`Created and activated visualizer: ${type}`);
            }
            
            return visualizer;
            
        } catch (error) {
            console.error(`Failed to create visualizer ${type}:`, error);
            this.handleError('creation', error, { type });
            throw error;
        }
    }
    
    /**
     * Switch to a different visualizer
     * @param {string} type - Visualizer type name
     * @param {Object} options - Switch options
     * @returns {Promise<void>}
     */
    async switchVisualizer(type, options = {}) {
        if (this.isTransitioning && !options.force) {
            console.warn('Cannot switch visualizer: transition in progress');
            return;
        }
        
        try {
            const {
                transition = this.transitions.currentType,
                duration = this.config.transitionDuration,
                config = {},
                immediate = false
            } = options;
            
            // Get or create target visualizer
            let targetVisualizer = this.preloadedVisualizers.get(type);
            if (!targetVisualizer) {
                targetVisualizer = await this.createVisualizer(type, config);
            } else {
                // Move from preloaded to active
                this.preloadedVisualizers.delete(type);
                this.activeVisualizers.set(targetVisualizer.id, targetVisualizer);
            }
            
            // Store previous visualizer
            this.previousVisualizer = this.currentVisualizer;
            
            if (immediate || !this.config.enableTransitions) {
                // Immediate switch
                await this.immediateSwitch(targetVisualizer);
            } else {
                // Animated transition
                await this.animatedTransition(targetVisualizer, transition, duration);
            }
            
            // Update statistics
            this.statistics.visualizerSwitches++;
            this.autoSwitch.lastSwitch = Date.now();
            
            console.log(`Switched to visualizer: ${type}`);
            
        } catch (error) {
            console.error(`Failed to switch to visualizer ${type}:`, error);
            this.handleError('switch', error, { type });
        }
    }
    
    /**
     * Update all active visualizers
     * @param {number} deltaTime - Time since last update
     * @param {Object} audioData - Current audio data
     */
    update(deltaTime, audioData) {
        if (!this.isInitialized) return;
        
        const startTime = performance.now();
        
        // Update audio data cache
        this.updateAudioData(audioData);
        
        // Update performance metrics
        this.updatePerformanceMetrics();
        
        // Handle auto-switching
        if (this.autoSwitch.enabled) {
            this.handleAutoSwitching(audioData);
        }
        
        // Update current visualizer
        if (this.currentVisualizer && !this.isTransitioning) {
            try {
                this.currentVisualizer.update(deltaTime, audioData);
            } catch (error) {
                this.handleVisualizerError(this.currentVisualizer, error);
            }
        }
        
        // Update transition if active
        if (this.isTransitioning) {
            this.updateTransition(deltaTime);
        }
        
        // Update preloaded visualizers (minimal updates)
        this.updatePreloadedVisualizers(deltaTime, audioData);
        
        // Adaptive quality adjustment
        if (this.config.adaptiveQuality) {
            this.adjustQuality();
        }
        
        this.performanceMetrics.updateTime = performance.now() - startTime;
    }
    
    /**
     * Render current visualizer(s)
     * @param {number} deltaTime - Time since last render
     * @param {Object} renderState - Current render state
     */
    render(deltaTime, renderState) {
        if (!this.isInitialized) return;
        
        const startTime = performance.now();
        
        try {
            if (this.isTransitioning && this.previousVisualizer && this.currentVisualizer) {
                // Render transition between visualizers
                this.renderTransition(deltaTime, renderState);
            } else if (this.currentVisualizer) {
                // Render current visualizer
                this.currentVisualizer.render(deltaTime, renderState);
            }
        } catch (error) {
            this.handleVisualizerError(this.currentVisualizer, error);
        }
        
        this.performanceMetrics.renderTime = performance.now() - startTime;
    }
    
    /**
     * Handle canvas resize
     * @param {number} width - New canvas width
     * @param {number} height - New canvas height
     */
    resize(width, height) {
        console.log(`Resizing visualizers to ${width}x${height}`);
        
        // Resize all active visualizers
        this.activeVisualizers.forEach(visualizer => {
            try {
                visualizer.resize(width, height);
            } catch (error) {
                this.handleVisualizerError(visualizer, error);
            }
        });
        
        // Resize preloaded visualizers
        this.preloadedVisualizers.forEach(visualizer => {
            try {
                visualizer.resize(width, height);
            } catch (error) {
                console.warn('Error resizing preloaded visualizer:', error);
            }
        });
    }
    
    // ===== TRANSITION METHODS =====
    
    /**
     * Immediate switch without transition
     */
    async immediateSwitch(targetVisualizer) {
        if (this.currentVisualizer) {
            this.currentVisualizer.deactivate();
        }
        
        this.currentVisualizer = targetVisualizer;
        this.currentVisualizer.activate();
        
        this.emit('visualizerActivated', { visualizer: targetVisualizer });
    }
    
    /**
     * Animated transition between visualizers
     */
    async animatedTransition(targetVisualizer, transitionType, duration) {
        if (!this.transitions.types.has(transitionType)) {
            console.warn(`Unknown transition type: ${transitionType}, using fade`);
            transitionType = 'fade';
        }
        
        this.isTransitioning = true;
        this.transitionProgress = 0;
        this.transitionStartTime = performance.now();
        this.transitions.currentType = transitionType;
        
        // Activate target visualizer
        targetVisualizer.activate();
        this.currentVisualizer = targetVisualizer;
        
        this.emit('transitionStarted', {
            from: this.previousVisualizer,
            to: targetVisualizer,
            type: transitionType,
            duration
        });
        
        // Transition will be handled in updateTransition()
    }
    
    /**
     * Update transition progress
     */
    updateTransition(deltaTime) {
        const elapsed = performance.now() - this.transitionStartTime;
        const duration = this.config.transitionDuration;
        
        this.transitionProgress = Math.min(elapsed / duration, 1.0);
        
        // Apply easing
        const easedProgress = this.applyEasing(this.transitionProgress, this.transitions.easing);
        
        // Update transition effect
        const transitionFunc = this.transitions.types.get(this.transitions.currentType);
        transitionFunc(easedProgress);
        
        // Complete transition
        if (this.transitionProgress >= 1.0) {
            this.completeTransition();
        }
    }
    
    /**
     * Complete transition
     */
    completeTransition() {
        this.isTransitioning = false;
        this.transitionProgress = 0;
        
        // Deactivate previous visualizer
        if (this.previousVisualizer) {
            this.previousVisualizer.deactivate();
            this.cleanupInactiveVisualizer(this.previousVisualizer);
        }
        
        this.emit('transitionCompleted', {
            visualizer: this.currentVisualizer,
            duration: performance.now() - this.transitionStartTime
        });
        
        this.previousVisualizer = null;
    }
    
    /**
     * Render transition between two visualizers
     */
    renderTransition(deltaTime, renderState) {
        const transitionFunc = this.transitions.types.get(this.transitions.currentType);
        transitionFunc(this.transitionProgress, deltaTime, renderState);
    }
    
    // ===== TRANSITION EFFECTS =====
    
    /**
     * Fade transition
     */
    fadeTransition(progress, deltaTime, renderState) {
        const gl = this.gl;
        
        if (renderState) {
            // Render previous visualizer with fading alpha
            if (this.previousVisualizer) {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                
                // Set alpha uniform if available
                const alpha = 1.0 - progress;
                this.setTransitionAlpha(this.previousVisualizer, alpha);
                this.previousVisualizer.render(deltaTime, renderState);
            }
            
            // Render current visualizer with increasing alpha
            if (this.currentVisualizer) {
                const alpha = progress;
                this.setTransitionAlpha(this.currentVisualizer, alpha);
                this.currentVisualizer.render(deltaTime, renderState);
            }
            
            gl.disable(gl.BLEND);
        }
    }
    
    /**
     * Dissolve transition
     */
    dissolveTransition(progress, deltaTime, renderState) {
        // Similar to fade but with noise-based dissolution
        this.fadeTransition(progress, deltaTime, renderState);
        // Additional noise-based masking would be implemented in shaders
    }
    
    /**
     * Morph transition
     */
    morphTransition(progress, deltaTime, renderState) {
        // Geometric morphing between visualizers
        // Implementation depends on specific visualizer geometry
        this.fadeTransition(progress, deltaTime, renderState);
    }
    
    /**
     * Slide transition
     */
    slideTransition(progress, deltaTime, renderState) {
        // Sliding transition with viewport manipulation
        this.fadeTransition(progress, deltaTime, renderState);
    }
    
    /**
     * Zoom transition
     */
    zoomTransition(progress, deltaTime, renderState) {
        // Zoom-based transition
        this.fadeTransition(progress, deltaTime, renderState);
    }
    
    // ===== UTILITY METHODS =====
    
    /**
     * Set transition alpha for visualizer
     */
    setTransitionAlpha(visualizer, alpha) {
        // This would set a uniform in the visualizer's shader
        // Implementation depends on shader structure
        if (visualizer.setUniform) {
            visualizer.setUniform('u_transitionAlpha', alpha);
        }
    }
    
    /**
     * Apply easing function
     */
    applyEasing(t, easingType) {
        switch (easingType) {
            case 'linear':
                return t;
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
            default:
                return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        }
    }
    
    /**
     * Validate visualizer class
     */
    isValidVisualizerClass(VisualizerClass) {
        try {
            // Check if it extends BaseVisualizer
            const prototype = VisualizerClass.prototype;
            return prototype instanceof BaseVisualizer.constructor ||
                   VisualizerClass.prototype.constructor === BaseVisualizer ||
                   prototype.isPrototypeOf(BaseVisualizer.prototype);
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Validate required integrations
     */
    validateIntegrations() {
        const required = ['renderEngine'];
        const missing = required.filter(key => !this.integrations[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required integrations: ${missing.join(', ')}`);
        }
    }
    
    /**
     * Initialize performance monitoring
     */
    initializePerformanceMonitoring() {
        performanceMonitor.registerSystem('VisualizerManager', {
            updateCallback: (metrics) => this.onPerformanceUpdate(metrics),
            thresholds: {
                minFPS: 30,
                maxRenderTime: 16.67,
                maxUpdateTime: 5.0
            }
        });
    }
    
    /**
     * Initialize transition system
     */
    initializeTransitionSystem() {
        // Pre-compile transition shaders if needed
        console.log('Transition system initialized');
    }
    
    /**
     * Initialize auto-switching
     */
    initializeAutoSwitching() {
        console.log(`Auto-switching enabled: mode=${this.autoSwitch.mode}, interval=${this.autoSwitch.interval}ms`);
    }
    
    /**
     * Register built-in visualizer types
     */
    async registerBuiltinVisualizers() {
        // Built-in visualizers would be registered here
        // For now, this is a placeholder for future implementations
        console.log('Built-in visualizers registered');
    }
    
    /**
     * Setup error handling
     */
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason);
        });
    }
    
    /**
     * Setup visualizer event handlers
     */
    setupVisualizerEventHandlers(visualizer) {
        visualizer.on('error', (error) => {
            this.handleVisualizerError(visualizer, error);
        });
        
        visualizer.on('performanceChanged', (metrics) => {
            this.onVisualizerPerformanceChanged(visualizer, metrics);
        });
    }
    
    /**
     * Update audio data cache
     */
    updateAudioData(audioData) {
        if (audioData) {
            this.audioData.current = audioData;
            this.audioData.history.push(audioData);
            
            // Limit history size
            if (this.audioData.history.length > this.audioData.maxHistory) {
                this.audioData.history.shift();
            }
            
            // Update features
            if (audioData.features) {
                Object.assign(this.audioData.features, audioData.features);
            }
        }
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        const now = performance.now();
        
        if (now - this.performanceMetrics.lastUpdate > 1000) {
            // Calculate average FPS
            this.performanceMetrics.averageFPS = this.calculateAverageFPS();
            
            // Update memory usage
            if (performance.memory) {
                this.performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
            }
            
            this.performanceMetrics.lastUpdate = now;
            this.emit('performanceChanged', this.performanceMetrics);
        }
    }
    
    /**
     * Handle auto-switching logic
     */
    handleAutoSwitching(audioData) {
        const now = Date.now();
        const timeSinceLastSwitch = now - this.autoSwitch.lastSwitch;
        
        if (timeSinceLastSwitch < this.autoSwitch.interval) {
            return;
        }
        
        let shouldSwitch = false;
        
        switch (this.autoSwitch.mode) {
            case 'time':
                shouldSwitch = true;
                break;
            case 'audio':
                shouldSwitch = this.shouldSwitchBasedOnAudio(audioData);
                break;
            case 'energy':
                shouldSwitch = this.shouldSwitchBasedOnEnergy(audioData);
                break;
            case 'random':
                shouldSwitch = Math.random() < 0.1; // 10% chance each check
                break;
        }
        
        if (shouldSwitch) {
            this.autoSwitchToRandomVisualizer();
        }
    }
    
    /**
     * Auto-switch to random visualizer
     */
    async autoSwitchToRandomVisualizer() {
        const availableTypes = Array.from(this.visualizerTypes.keys());
        const currentType = this.currentVisualizer?.type;
        
        // Filter out current type
        const otherTypes = availableTypes.filter(type => type !== currentType);
        
        if (otherTypes.length > 0) {
            const randomType = otherTypes[Math.floor(Math.random() * otherTypes.length)];
            try {
                await this.switchVisualizer(randomType, { transition: 'fade' });
                console.log(`Auto-switched to: ${randomType}`);
            } catch (error) {
                console.error('Auto-switch failed:', error);
            }
        }
    }
    
    /**
     * Update preloaded visualizers (minimal updates)
     */
    updatePreloadedVisualizers(deltaTime, audioData) {
        this.preloadedVisualizers.forEach(visualizer => {
            try {
                // Minimal update to keep visualizers warm
                if (visualizer.updateMinimal) {
                    visualizer.updateMinimal(deltaTime, audioData);
                }
            } catch (error) {
                console.warn('Error updating preloaded visualizer:', error);
            }
        });
    }
    
    /**
     * Adjust quality based on performance
     */
    adjustQuality() {
        const fps = this.performanceMetrics.averageFPS;
        const targetFPS = 60;
        
        if (fps < targetFPS * 0.8) {
            // Decrease quality
            this.performanceMetrics.qualityLevel = Math.max(0.1, this.performanceMetrics.qualityLevel - 0.05);
            this.applyQualityToVisualizers(this.performanceMetrics.qualityLevel);
            this.emit('qualityAdjusted', { level: this.performanceMetrics.qualityLevel, reason: 'performance' });
        } else if (fps > targetFPS * 0.95) {
            // Increase quality
            this.performanceMetrics.qualityLevel = Math.min(1.0, this.performanceMetrics.qualityLevel + 0.02);
            this.applyQualityToVisualizers(this.performanceMetrics.qualityLevel);
        }
    }
    
    /**
     * Apply quality level to all visualizers
     */
    applyQualityToVisualizers(qualityLevel) {
        this.activeVisualizers.forEach(visualizer => {
            if (visualizer.setQualityLevel) {
                visualizer.setQualityLevel(qualityLevel);
            }
        });
    }
    
    // ===== ERROR HANDLING =====
    
    /**
     * Handle visualizer error
     */
    handleVisualizerError(visualizer, error) {
        console.error(`Visualizer error in ${visualizer?.name}:`, error);
        
        this.statistics.errorCount++;
        this.emit('error', { visualizer, error });
        
        // Attempt recovery
        if (this.errorRecovery.enabled) {
            this.attemptVisualizerRecovery(visualizer, error);
        }
    }
    
    /**
     * Attempt to recover from visualizer error
     */
    async attemptVisualizerRecovery(visualizer, error) {
        try {
            // Try to restart the visualizer
            await visualizer.initialize(this.gl, this.canvas, this.integrations);
            console.log(`Successfully recovered visualizer: ${visualizer.name}`);
        } catch (recoveryError) {
            console.error(`Failed to recover visualizer ${visualizer.name}:`, recoveryError);
            
            // Switch to fallback visualizer if available
            if (this.errorRecovery.fallbackVisualizer) {
                await this.switchVisualizer(this.errorRecovery.fallbackVisualizer, { immediate: true });
            }
        }
    }
    
    /**
     * Handle global error
     */
    handleGlobalError(error) {
        console.error('Global error in VisualizerManager:', error);
        this.handleError('global', error);
    }
    
    /**
     * Generic error handler
     */
    handleError(context, error, metadata = {}) {
        const errorInfo = {
            context,
            error,
            metadata,
            timestamp: Date.now(),
            visualizer: this.currentVisualizer?.name
        };
        
        this.emit('error', errorInfo);
        this.statistics.errorCount++;
        
        // Log to external error tracking if available
        if (window.errorTracker) {
            window.errorTracker.logError(errorInfo);
        }
    }
    
    // ===== AUDIO ANALYSIS HELPERS =====
    
    /**
     * Check if should switch based on audio analysis
     */
    shouldSwitchBasedOnAudio(audioData) {
        if (!audioData || !audioData.features) return false;
        
        const criteria = this.autoSwitch.criteria;
        const features = audioData.features;
        const history = this.audioData.history;
        
        if (history.length < 10) return false; // Need some history
        
        // Check for significant energy change
        const avgEnergy = history.slice(-10).reduce((sum, data) => sum + (data.features?.energy || 0), 0) / 10;
        const energyChange = Math.abs(features.energy - avgEnergy) / avgEnergy;
        
        if (energyChange > criteria.energyChange) {
            return true;
        }
        
        // Check for beat pattern change
        const recentBeats = history.slice(-30).filter(data => data.features?.beat).length;
        const beatDensityChange = Math.abs(recentBeats - 15) / 30; // 15 = half of 30 frames
        
        if (beatDensityChange > criteria.beatPatternChange) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if should switch based on energy levels
     */
    shouldSwitchBasedOnEnergy(audioData) {
        if (!audioData || !audioData.features) return false;
        
        const energy = audioData.features.energy;
        const bass = audioData.features.bass;
        
        // Switch on high energy or strong bass
        return energy > 0.8 || bass > 0.7;
    }
    
    /**
     * Calculate average FPS
     */
    calculateAverageFPS() {
        // This would be calculated from frame timestamps
        // Simplified implementation
        return 60; // Placeholder
    }
    
    // ===== CLEANUP AND MANAGEMENT =====
    
    /**
     * Cleanup inactive visualizer
     */
    cleanupInactiveVisualizer(visualizer) {
        // Remove from active visualizers
        this.activeVisualizers.delete(visualizer.id);
        
        // Move to preloaded if there's space, otherwise dispose
        if (this.preloadedVisualizers.size < this.config.maxPreloadedVisualizers) {
            this.preloadedVisualizers.set(visualizer.type, visualizer);
            console.log(`Moved visualizer to preloaded: ${visualizer.name}`);
        } else {
            this.disposeVisualizer(visualizer);
        }
    }
    
    /**
     * Dispose of a visualizer
     */
    disposeVisualizer(visualizer) {
        try {
            visualizer.dispose();
            this.visualizers.delete(visualizer.id);
            console.log(`Disposed visualizer: ${visualizer.name}`);
        } catch (error) {
            console.error(`Error disposing visualizer ${visualizer.name}:`, error);
        }
    }
    
    /**
     * Preload visualizer for quick switching
     */
    async preloadVisualizer(type, config = {}) {
        if (this.preloadedVisualizers.has(type)) {
            return this.preloadedVisualizers.get(type);
        }
        
        if (this.preloadedVisualizers.size >= this.config.maxPreloadedVisualizers) {
            // Remove oldest preloaded visualizer
            const oldestType = this.preloadedVisualizers.keys().next().value;
            const oldestVisualizer = this.preloadedVisualizers.get(oldestType);
            this.preloadedVisualizers.delete(oldestType);
            this.disposeVisualizer(oldestVisualizer);
        }
        
        return await this.createVisualizer(type, config, true);
    }
    
    // ===== PUBLIC API =====
    
    /**
     * Get list of available visualizer types
     */
    getAvailableTypes() {
        return Array.from(this.visualizerTypes.keys());
    }
    
    /**
     * Get visualizer type metadata
     */
    getTypeMetadata(type) {
        return this.visualizerTypes.get(type)?.metadata || null;
    }
    
    /**
     * Get current visualizer info
     */
    getCurrentVisualizerInfo() {
        return this.currentVisualizer ? this.currentVisualizer.getInfo() : null;
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            statistics: { ...this.statistics },
            uptime: Date.now() - this.statistics.startTime
        };
    }
    
    /**
     * Set transition type
     */
    setTransitionType(type) {
        if (this.transitions.types.has(type)) {
            this.transitions.currentType = type;
            console.log(`Transition type set to: ${type}`);
        } else {
            console.warn(`Unknown transition type: ${type}`);
        }
    }
    
    /**
     * Enable/disable auto-switching
     */
    setAutoSwitch(enabled, options = {}) {
        this.autoSwitch.enabled = enabled;
        
        if (options.mode) this.autoSwitch.mode = options.mode;
        if (options.interval) this.autoSwitch.interval = options.interval;
        if (options.criteria) Object.assign(this.autoSwitch.criteria, options.criteria);
        
        console.log(`Auto-switch ${enabled ? 'enabled' : 'disabled'}:`, this.autoSwitch);
    }
    
    /**
     * Force immediate visualizer switch (emergency)
     */
    async forceSwitch(type, config = {}) {
        try {
            await this.switchVisualizer(type, { ...config, immediate: true, force: true });
        } catch (error) {
            console.error(`Force switch to ${type} failed:`, error);
            throw error;
        }
    }
    
    /**
     * Get system status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            currentVisualizer: this.currentVisualizer?.name || null,
            activeCount: this.activeVisualizers.size,
            preloadedCount: this.preloadedVisualizers.size,
            registeredTypes: this.visualizerTypes.size,
            isTransitioning: this.isTransitioning,
            transitionProgress: this.transitionProgress,
            autoSwitch: this.autoSwitch.enabled,
            performance: this.performanceMetrics,
            errors: this.statistics.errorCount
        };
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
    
    // ===== PERFORMANCE CALLBACKS =====
    
    /**
     * Performance update callback
     */
    onPerformanceUpdate(metrics) {
        Object.assign(this.performanceMetrics, metrics);
    }
    
    /**
     * Visualizer performance change callback
     */
    onVisualizerPerformanceChanged(visualizer, metrics) {
        // Handle individual visualizer performance changes
        if (metrics.fps < 30) {
            console.warn(`Low performance in visualizer ${visualizer.name}:`, metrics);
        }
    }
    
    // ===== DISPOSAL =====
    
    /**
     * Dispose of the visualizer manager
     */
    dispose() {
        console.log('Disposing VisualizerManager...');
        
        // Stop auto-switching
        this.autoSwitch.enabled = false;
        
        // Dispose all visualizers
        this.visualizers.forEach(visualizer => {
            this.disposeVisualizer(visualizer);
        });
        
        // Clear collections
        this.visualizers.clear();
        this.visualizerTypes.clear();
        this.activeVisualizers.clear();
        this.preloadedVisualizers.clear();
        
        // Clear event callbacks
        this.eventCallbacks.forEach(callbacks => callbacks.length = 0);
        
        // Clear audio data
        this.audioData.history.length = 0;
        
        // Unregister from performance monitor
        performanceMonitor.unregisterSystem('VisualizerManager');
        
        // Reset state
        this.isInitialized = false;
        this.currentVisualizer = null;
        this.previousVisualizer = null;
        this.isTransitioning = false;
        
        console.log('VisualizerManager disposed');
    }
}

// Export the VisualizerManager class
export { VisualizerManager };