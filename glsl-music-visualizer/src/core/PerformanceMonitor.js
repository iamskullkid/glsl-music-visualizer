/**
 * Performance Monitor
 * Comprehensive performance tracking and optimization system for the advanced GLSL music visualizer
 * Provides real-time metrics, adaptive quality scaling, and GPU/CPU profiling
 */

import { MathUtils } from '../utils/MathUtils.js';
import { webglUtils } from '../utils/WebGLUtils.js';

export class PerformanceMonitor {
    constructor() {
        this.isEnabled = true;
        this.debugMode = process.env.NODE_ENV === 'development';
        
        // Performance metrics
        this.metrics = {
            fps: {
                current: 60,
                average: 60,
                min: 60,
                max: 60,
                target: 60,
                samples: []
            },
            frameTime: {
                current: 16.67,
                average: 16.67,
                min: 16.67,
                max: 16.67,
                samples: []
            },
            gpu: {
                drawCalls: 0,
                triangles: 0,
                vertices: 0,
                textureBinds: 0,
                shaderSwitches: 0,
                memoryUsage: 0
            },
            cpu: {
                audioProcessing: 0,
                physics: 0,
                rendering: 0,
                ui: 0,
                total: 0
            },
            memory: {
                used: 0,
                total: 0,
                textures: 0,
                buffers: 0,
                shaders: 0
            }
        };
        
        // Quality settings
        this.qualitySettings = {
            current: 'high',
            adaptive: true,
            levels: {
                low: {
                    resolution: 0.5,
                    particles: 0.3,
                    effects: 0.2,
                    antialiasing: false,
                    shadows: false,
                    reflections: false
                },
                medium: {
                    resolution: 0.75,
                    particles: 0.6,
                    effects: 0.5,
                    antialiasing: true,
                    shadows: false,
                    reflections: true
                },
                high: {
                    resolution: 1.0,
                    particles: 1.0,
                    effects: 1.0,
                    antialiasing: true,
                    shadows: true,
                    reflections: true
                }
            }
        };
        
        // Timing and measurement
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.sampleWindow = 120; // Number of samples to keep
        this.updateInterval = 500; // Update frequency in ms
        this.lastUpdate = 0;
        
        // GPU timing (if available)
        this.gpuTimer = null;
        this.gpuQueries = [];
        this.gpuTimingSupported = false;
        
        // Performance thresholds
        this.thresholds = {
            targetFPS: 60,
            minFPS: 30,
            maxFrameTime: 33.33, // 30 FPS in ms
            gpuBudget: 16.67, // Target GPU time in ms
            memoryLimit: 512 * 1024 * 1024 // 512MB
        };
        
        // Adaptive quality state
        this.adaptiveState = {
            consecutiveLowFrames: 0,
            consecutiveGoodFrames: 0,
            lastQualityChange: 0,
            changeTimeout: 2000 // Minimum time between quality changes
        };
        
        // Event handlers
        this.onQualityChange = null;
        this.onPerformanceAlert = null;
        
        this.initialize();
    }
    
    /**
     * Initialize performance monitoring systems
     */
    initialize() {
        // Initialize GPU timing if available
        this.initializeGPUTiming();
        
        // Setup memory monitoring
        this.initializeMemoryMonitoring();
        
        // Start performance monitoring loop
        if (this.isEnabled) {
            this.startMonitoring();
        }
        
        console.log('PerformanceMonitor initialized', {
            gpuTiming: this.gpuTimingSupported,
            adaptiveQuality: this.qualitySettings.adaptive
        });
    }
    
    /**
     * Initialize GPU timing queries
     */
    initializeGPUTiming() {
        const gl = webglUtils.gl;
        if (!gl) return;
        
        // Check for timer query extensions
        const ext = webglUtils.getExtension('EXT_disjoint_timer_query_webgl2') ||
                   webglUtils.getExtension('EXT_disjoint_timer_query');
        
        if (ext) {
            this.gpuTimer = ext;
            this.gpuTimingSupported = true;
            
            // Pre-create query objects
            for (let i = 0; i < 8; i++) {
                const query = gl.createQuery ? gl.createQuery() : ext.createQueryEXT();
                this.gpuQueries.push({
                    query,
                    active: false,
                    startTime: 0
                });
            }
        }
    }
    
    /**
     * Initialize memory monitoring
     */
    initializeMemoryMonitoring() {
        // Monitor WebGL memory usage
        if (webglUtils.hasExtension('WEBGL_debug_renderer_info')) {
            const ext = webglUtils.getExtension('WEBGL_debug_renderer_info');
            console.log('GPU Info:', {
                renderer: webglUtils.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
                vendor: webglUtils.gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
            });
        }
        
        // Setup memory monitoring interval
        if (this.debugMode) {
            setInterval(() => {
                this.updateMemoryMetrics();
            }, 5000);
        }
    }
    
    /**
     * Start performance monitoring loop
     */
    startMonitoring() {
        const monitor = () => {
            if (!this.isEnabled) return;
            
            this.updateMetrics();
            
            if (this.qualitySettings.adaptive) {
                this.updateAdaptiveQuality();
            }
            
            requestAnimationFrame(monitor);
        };
        
        requestAnimationFrame(monitor);
        
        // Setup periodic detailed updates
        setInterval(() => {
            this.updateDetailedMetrics();
        }, this.updateInterval);
    }
    
    /**
     * Begin frame timing measurement
     */
    beginFrame() {
        if (!this.isEnabled) return;
        
        const now = performance.now();
        const frameTime = now - this.lastFrameTime;
        
        // Update frame metrics
        this.metrics.frameTime.current = frameTime;
        this.metrics.frameTime.samples.push(frameTime);
        
        if (this.metrics.frameTime.samples.length > this.sampleWindow) {
            this.metrics.frameTime.samples.shift();
        }
        
        // Calculate FPS
        this.metrics.fps.current = 1000 / frameTime;
        this.metrics.fps.samples.push(this.metrics.fps.current);
        
        if (this.metrics.fps.samples.length > this.sampleWindow) {
            this.metrics.fps.samples.shift();
        }
        
        this.lastFrameTime = now;
        this.frameCount++;
        
        // Begin GPU timing
        this.beginGPUTiming();
    }
    
    /**
     * End frame timing measurement
     */
    endFrame() {
        if (!this.isEnabled) return;
        
        // End GPU timing
        this.endGPUTiming();
        
        // Reset GPU counters for next frame
        this.resetGPUCounters();
    }
    
    /**
     * Begin GPU timing measurement
     */
    beginGPUTiming() {
        if (!this.gpuTimingSupported) return;
        
        const availableQuery = this.gpuQueries.find(q => !q.active);
        if (!availableQuery) return;
        
        const gl = webglUtils.gl;
        availableQuery.active = true;
        availableQuery.startTime = performance.now();
        
        if (gl.beginQuery) {
            gl.beginQuery(this.gpuTimer.TIME_ELAPSED_EXT, availableQuery.query);
        } else {
            this.gpuTimer.beginQueryEXT(this.gpuTimer.TIME_ELAPSED_EXT, availableQuery.query);
        }
    }
    
    /**
     * End GPU timing measurement
     */
    endGPUTiming() {
        if (!this.gpuTimingSupported) return;
        
        const gl = webglUtils.gl;
        
        if (gl.endQuery) {
            gl.endQuery(this.gpuTimer.TIME_ELAPSED_EXT);
        } else {
            this.gpuTimer.endQueryEXT(this.gpuTimer.TIME_ELAPSED_EXT);
        }
        
        // Process completed queries
        this.processGPUQueries();
    }
    
    /**
     * Process completed GPU timing queries
     */
    processGPUQueries() {
        if (!this.gpuTimingSupported) return;
        
        const gl = webglUtils.gl;
        
        this.gpuQueries.forEach(queryObj => {
            if (!queryObj.active) return;
            
            const available = gl.getQueryParameter ? 
                gl.getQueryParameter(queryObj.query, gl.QUERY_RESULT_AVAILABLE) :
                this.gpuTimer.getQueryObjectEXT(queryObj.query, this.gpuTimer.QUERY_RESULT_AVAILABLE_EXT);
            
            if (available) {
                const result = gl.getQueryParameter ?
                    gl.getQueryParameter(queryObj.query, gl.QUERY_RESULT) :
                    this.gpuTimer.getQueryObjectEXT(queryObj.query, this.gpuTimer.QUERY_RESULT_EXT);
                
                // Convert nanoseconds to milliseconds
                const gpuTime = result / 1000000;
                this.metrics.gpu.frameTime = gpuTime;
                
                queryObj.active = false;
            }
        });
    }
    
    /**
     * Update performance metrics
     */
    updateMetrics() {
        const now = performance.now();
        
        if (now - this.lastUpdate < this.updateInterval) return;
        
        // Calculate averages
        if (this.metrics.fps.samples.length > 0) {
            this.metrics.fps.average = this.metrics.fps.samples.reduce((a, b) => a + b, 0) / this.metrics.fps.samples.length;
            this.metrics.fps.min = Math.min(...this.metrics.fps.samples);
            this.metrics.fps.max = Math.max(...this.metrics.fps.samples);
        }
        
        if (this.metrics.frameTime.samples.length > 0) {
            this.metrics.frameTime.average = this.metrics.frameTime.samples.reduce((a, b) => a + b, 0) / this.metrics.frameTime.samples.length;
            this.metrics.frameTime.min = Math.min(...this.metrics.frameTime.samples);
            this.metrics.frameTime.max = Math.max(...this.metrics.frameTime.samples);
        }
        
        this.lastUpdate = now;
    }
    
    /**
     * Update detailed performance metrics
     */
    updateDetailedMetrics() {
        this.updateMemoryMetrics();
        this.updateCPUMetrics();
        
        // Check for performance alerts
        this.checkPerformanceAlerts();
    }
    
    /**
     * Update memory usage metrics
     */
    updateMemoryMetrics() {
        // JavaScript heap size
        if (performance.memory) {
            this.metrics.memory.used = performance.memory.usedJSHeapSize;
            this.metrics.memory.total = performance.memory.totalJSHeapSize;
        }
        
        // Estimate WebGL memory usage
        const gl = webglUtils.gl;
        if (gl) {
            // This is an approximation - actual GPU memory is hard to measure
            const capabilities = webglUtils.getCapabilities();
            this.metrics.memory.estimated = this.estimateGPUMemoryUsage(capabilities);
        }
    }
    
    /**
     * Estimate GPU memory usage
     * @param {Object} capabilities - WebGL capabilities
     * @returns {number} Estimated memory usage in bytes
     */
    estimateGPUMemoryUsage(capabilities) {
        // This is a rough estimation based on typical usage patterns
        const textureMemory = this.metrics.gpu.textureBinds * 4 * 1024 * 1024; // Assume 4MB per texture
        const bufferMemory = this.metrics.gpu.vertices * 32; // Assume 32 bytes per vertex
        const shaderMemory = this.metrics.gpu.shaderSwitches * 1024; // Assume 1KB per shader
        
        return textureMemory + bufferMemory + shaderMemory;
    }
    
    /**
     * Update CPU timing metrics
     */
    updateCPUMetrics() {
        // These would be populated by individual systems reporting their timing
        const total = this.metrics.cpu.audioProcessing + 
                     this.metrics.cpu.physics + 
                     this.metrics.cpu.rendering + 
                     this.metrics.cpu.ui;
        
        this.metrics.cpu.total = total;
    }
    
    /**
     * Update adaptive quality based on performance
     */
    updateAdaptiveQuality() {
        const currentFPS = this.metrics.fps.current;
        const targetFPS = this.thresholds.targetFPS;
        const minFPS = this.thresholds.minFPS;
        
        const now = performance.now();
        const timeSinceLastChange = now - this.adaptiveState.lastQualityChange;
        
        // Don't change quality too frequently
        if (timeSinceLastChange < this.adaptiveState.changeTimeout) {
            return;
        }
        
        // Track consecutive low/high performance frames
        if (currentFPS < minFPS) {
            this.adaptiveState.consecutiveLowFrames++;
            this.adaptiveState.consecutiveGoodFrames = 0;
        } else if (currentFPS > targetFPS * 0.9) {
            this.adaptiveState.consecutiveGoodFrames++;
            this.adaptiveState.consecutiveLowFrames = 0;
        } else {
            // Reset counters for marginal performance
            this.adaptiveState.consecutiveLowFrames = 0;
            this.adaptiveState.consecutiveGoodFrames = 0;
        }
        
        // Decide on quality changes
        const shouldDecrease = this.adaptiveState.consecutiveLowFrames > 10;
        const shouldIncrease = this.adaptiveState.consecutiveGoodFrames > 60 && 
                              this.qualitySettings.current !== 'high';
        
        if (shouldDecrease) {
            this.decreaseQuality();
        } else if (shouldIncrease) {
            this.increaseQuality();
        }
    }
    
    /**
     * Decrease rendering quality
     */
    decreaseQuality() {
        const currentLevel = this.qualitySettings.current;
        let newLevel;
        
        switch (currentLevel) {
            case 'high':
                newLevel = 'medium';
                break;
            case 'medium':
                newLevel = 'low';
                break;
            case 'low':
                return; // Already at lowest quality
        }
        
        this.setQuality(newLevel);
        console.log(`Quality decreased to ${newLevel} due to performance`);
    }
    
    /**
     * Increase rendering quality
     */
    increaseQuality() {
        const currentLevel = this.qualitySettings.current;
        let newLevel;
        
        switch (currentLevel) {
            case 'low':
                newLevel = 'medium';
                break;
            case 'medium':
                newLevel = 'high';
                break;
            case 'high':
                return; // Already at highest quality
        }
        
        this.setQuality(newLevel);
        console.log(`Quality increased to ${newLevel} due to good performance`);
    }
    
    /**
     * Set quality level
     * @param {string} level - Quality level ('low', 'medium', 'high')
     */
    setQuality(level) {
        if (!this.qualitySettings.levels[level]) {
            console.warn(`Invalid quality level: ${level}`);
            return;
        }
        
        const oldLevel = this.qualitySettings.current;
        this.qualitySettings.current = level;
        this.adaptiveState.lastQualityChange = performance.now();
        
        // Reset counters
        this.adaptiveState.consecutiveLowFrames = 0;
        this.adaptiveState.consecutiveGoodFrames = 0;
        
        // Notify listeners
        if (this.onQualityChange) {
            this.onQualityChange(level, oldLevel, this.qualitySettings.levels[level]);
        }
    }
    
    /**
     * Check for performance alerts
     */
    checkPerformanceAlerts() {
        const alerts = [];
        
        // Low FPS alert
        if (this.metrics.fps.average < this.thresholds.minFPS) {
            alerts.push({
                type: 'low_fps',
                severity: 'warning',
                message: `Low FPS detected: ${this.metrics.fps.average.toFixed(1)} fps`,
                value: this.metrics.fps.average,
                threshold: this.thresholds.minFPS
            });
        }
        
        // High frame time alert
        if (this.metrics.frameTime.average > this.thresholds.maxFrameTime) {
            alerts.push({
                type: 'high_frame_time',
                severity: 'warning',
                message: `High frame time: ${this.metrics.frameTime.average.toFixed(2)} ms`,
                value: this.metrics.frameTime.average,
                threshold: this.thresholds.maxFrameTime
            });
        }
        
        // Memory usage alert
        if (this.metrics.memory.used > this.thresholds.memoryLimit) {
            alerts.push({
                type: 'high_memory',
                severity: 'error',
                message: `High memory usage: ${(this.metrics.memory.used / 1024 / 1024).toFixed(1)} MB`,
                value: this.metrics.memory.used,
                threshold: this.thresholds.memoryLimit
            });
        }
        
        // Notify listeners of alerts
        if (alerts.length > 0 && this.onPerformanceAlert) {
            this.onPerformanceAlert(alerts);
        }
    }
    
    /**
     * Record CPU timing for a specific subsystem
     * @param {string} subsystem - Subsystem name ('audioProcessing', 'physics', 'rendering', 'ui')
     * @param {number} time - Time in milliseconds
     */
    recordCPUTime(subsystem, time) {
        if (this.metrics.cpu.hasOwnProperty(subsystem)) {
            this.metrics.cpu[subsystem] = MathUtils.exponentialSmoothing(
                this.metrics.cpu[subsystem], 
                time, 
                0.1
            );
        }
    }
    
    /**
     * Record GPU statistics
     * @param {Object} stats - GPU statistics
     */
    recordGPUStats(stats) {
        Object.assign(this.metrics.gpu, stats);
    }
    
    /**
     * Reset GPU counters
     */
    resetGPUCounters() {
        this.metrics.gpu.drawCalls = 0;
        this.metrics.gpu.triangles = 0;
        this.metrics.gpu.vertices = 0;
        this.metrics.gpu.textureBinds = 0;
        this.metrics.gpu.shaderSwitches = 0;
    }
    
    /**
     * Get current performance metrics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    
    /**
     * Get current quality settings
     * @returns {Object} Quality settings
     */
    getQualitySettings() {
        return { ...this.qualitySettings };
    }
    
    /**
     * Enable or disable adaptive quality
     * @param {boolean} enabled - Whether to enable adaptive quality
     */
    setAdaptiveQuality(enabled) {
        this.qualitySettings.adaptive = enabled;
        console.log(`Adaptive quality ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Set performance thresholds
     * @param {Object} thresholds - New threshold values
     */
    setThresholds(thresholds) {
        Object.assign(this.thresholds, thresholds);
    }
    
    /**
     * Enable or disable performance monitoring
     * @param {boolean} enabled - Whether to enable monitoring
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        if (enabled && !this.monitoring) {
            this.startMonitoring();
        }
    }
    
    /**
     * Get performance summary for debugging
     * @returns {Object} Performance summary
     */
    getSummary() {
        return {
            fps: {
                current: this.metrics.fps.current.toFixed(1),
                average: this.metrics.fps.average.toFixed(1),
                min: this.metrics.fps.min.toFixed(1),
                max: this.metrics.fps.max.toFixed(1)
            },
            frameTime: {
                current: this.metrics.frameTime.current.toFixed(2) + 'ms',
                average: this.metrics.frameTime.average.toFixed(2) + 'ms'
            },
            quality: this.qualitySettings.current,
            adaptiveEnabled: this.qualitySettings.adaptive,
            gpuTiming: this.gpuTimingSupported,
            memoryUsage: performance.memory ? 
                (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + ' MB' : 
                'N/A'
        };
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        this.isEnabled = false;
        
        // Clean up GPU queries
        if (this.gpuTimingSupported && webglUtils.gl) {
            const gl = webglUtils.gl;
            this.gpuQueries.forEach(queryObj => {
                if (gl.deleteQuery) {
                    gl.deleteQuery(queryObj.query);
                } else if (this.gpuTimer) {
                    this.gpuTimer.deleteQueryEXT(queryObj.query);
                }
            });
        }
        
        this.gpuQueries = [];
        this.gpuTimer = null;
    }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();