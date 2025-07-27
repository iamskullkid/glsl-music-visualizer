/**
 * Main Application Entry Point - GLSL Music Visualizer
 * Coordinates all systems and handles application lifecycle
 * Location: src/main.js
 *
 * Features:
 * - System initialization and integration
 * - Core engine coordination (Audio, Render, Materials, UI)
 * - Performance monitoring and adaptive quality
 * - Error handling and recovery
 * - Application state management
 * - Hot-reload support for development
 * - Cross-browser compatibility
 * - Mobile and desktop optimization
 */

// Core engine imports
import { AudioEngine } from './core/AudioEngine.js';
import { RenderEngine } from './core/RenderEngine.js';
import { VisualizerManager } from './core/VisualizerManager.js';
import { shaderManager } from './core/ShaderManager.js';
import { performanceMonitor } from './core/PerformanceMonitor.js';

// Audio analysis imports
import { FFTProcessor } from './audio/FFTProcessor.js';
import { SpectralAnalyzer } from './audio/SpectralAnalyzer.js';
import { BeatDetector } from './audio/BeatDetector.js';
import { FeatureExtractor } from './audio/FeatureExtractor.js';

// Physics and material imports
import { ParticleSystem } from './physics/ParticleSystem.js';
import { MetaballSystem } from './physics/MetaballSystem.js';
import { FluidSimulation } from './physics/FluidSimulation.js';
import { MaterialPhysics } from './physics/MaterialPhysics.js';
import { MaterialManager } from './materials/MaterialManager.js';

// Visualizer imports
import { BlobVisualizer } from './visualizers/blob/BlobVisualizer.js';

// UI system imports
import { UIManager } from './ui/UIManager.js';

// Utility imports
import { webglUtils } from './utils/WebGLUtils.js';
import { MathUtils } from './utils/MathUtils.js';
import { ColorUtils } from './utils/ColorUtils.js';
import { FileUtils } from './utils/FileUtils.js';

/**
 * Main Application Class
 * Central coordination point for the entire GLSL Music Visualizer
 */
class GLSLMusicVisualizer {
    constructor(options = {}) {
        // Application configuration
        this.config = {
            // Canvas and rendering
            canvasId: options.canvasId || 'visualizer-canvas',
            enableWebGL2: options.enableWebGL2 !== false,
            enableHDR: options.enableHDR !== false,
            targetFPS: options.targetFPS || 60,
            adaptiveQuality: options.adaptiveQuality !== false,
            
            // Audio settings
            enableAudioInput: options.enableAudioInput !== false,
            enableMicrophone: options.enableMicrophone !== false,
            defaultFFTSize: options.defaultFFTSize || 4096,
            audioLatency: options.audioLatency || 'balanced', // 'playback', 'balanced', 'interactive'
            
            // Visual settings
            defaultVisualizer: options.defaultVisualizer || 'blob',
            enableParticles: options.enableParticles !== false,
            enablePostProcessing: options.enablePostProcessing !== false,
            defaultMaterial: options.defaultMaterial || 'water_pure',
            
            // UI settings
            enableUI: options.enableUI !== false,
            enableMobileUI: options.enableMobileUI !== false,
            enableKeyboardShortcuts: options.enableKeyboardShortcuts !== false,
            enableAccessibility: options.enableAccessibility !== false,
            
            // Performance settings
            enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
            enableProfiler: options.enableProfiler === true,
            memoryLimit: options.memoryLimit || 512, // MB
            
            // Development settings
            enableHotReload: options.enableHotReload === true || process.env.NODE_ENV === 'development',
            enableDebugMode: options.enableDebugMode === true || process.env.NODE_ENV === 'development',
            showStats: options.showStats === true || process.env.NODE_ENV === 'development',
            
            // Environment settings
            assetsPath: options.assetsPath || './assets/',
            shadersPath: options.shadersPath || './shaders/',
            presetsPath: options.presetsPath || './presets/'
        };
        
        // Core engine instances
        this.engines = {
            audio: null,
            render: null,
            visualizer: null,
            material: null,
            ui: null
        };
        
        // Audio processing pipeline
        this.audioProcessors = {
            fft: null,
            spectral: null,
            beat: null,
            features: null
        };
        
        // Physics systems
        this.physicsSystems = {
            particles: null,
            metaballs: null,
            fluid: null,
            material: null
        };
        
        // Application state
        this.state = {
            isInitialized: false,
            isRunning: false,
            isPaused: false,
            currentVisualizer: null,
            currentMaterial: this.config.defaultMaterial,
            audioConnected: false,
            performanceMode: 'auto',
            lastFrameTime: 0,
            frameCount: 0,
            startTime: 0
        };
        
        // Canvas and WebGL context
        this.canvas = null;
        this.gl = null;
        
        // Performance tracking
        this.performance = {
            fps: 0,
            frameTime: 0,
            renderTime: 0,
            updateTime: 0,
            memoryUsage: 0,
            gpuMemory: 0,
            audioLatency: 0,
            lastUpdate: 0
        };
        
        // Error handling
        this.errorHandler = {
            errors: [],
            warnings: [],
            maxErrors: 100,
            onError: options.onError || null,
            onWarning: options.onWarning || null
        };
        
        // Event system
        this.eventCallbacks = new Map([
            ['initialized', []],
            ['started', []],
            ['paused', []],
            ['resumed', []],
            ['stopped', []],
            ['visualizerChanged', []],
            ['materialChanged', []],
            ['audioConnected', []],
            ['audioDisconnected', []],
            ['performanceChanged', []],
            ['error', []],
            ['warning', []]
        ]);
        
        // Animation frame management
        this.animationFrame = null;
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // Bound methods
        this.update = this.update.bind(this);
        this.render = this.render.bind(this);
        this.onResize = this.onResize.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
        this.onError = this.onError.bind(this);
        
        console.log('GLSLMusicVisualizer created', {
            version: '1.0.0',
            build: process.env.NODE_ENV,
            webGL2: this.config.enableWebGL2,
            adaptiveQuality: this.config.adaptiveQuality
        });
    }
    
    /**
     * Initialize the entire application
     * @param {string|HTMLCanvasElement} canvasOrId - Canvas element or ID
     * @returns {Promise<void>}
     */
    async initialize(canvasOrId) {
        try {
            console.log('🚀 Initializing GLSL Music Visualizer...');
            this.state.startTime = performance.now();
            
            // Setup canvas and WebGL context
            await this.initializeCanvas(canvasOrId);
            
            // Initialize performance monitoring first
            if (this.config.enablePerformanceMonitoring) {
                await this.initializePerformanceMonitoring();
            }
            
            // Initialize core engines in dependency order
            await this.initializeCoreEngines();
            
            // Initialize audio processing pipeline
            await this.initializeAudioPipeline();
            
            // Initialize physics systems
            await this.initializePhysicsSystems();
            
            // Initialize material system
            await this.initializeMaterialSystem();
            
            // Initialize visualizer system
            await this.initializeVisualizerSystem();
            
            // Initialize UI system
            if (this.config.enableUI) {
                await this.initializeUISystem();
            }
            
            // Setup integrations between systems
            this.setupSystemIntegrations();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Apply initial configuration
            await this.applyInitialConfiguration();
            
            // Setup hot-reload for development
            if (this.config.enableHotReload) {
                this.setupHotReload();
            }
            
            this.state.isInitialized = true;
            
            const initTime = performance.now() - this.state.startTime;
            console.log(`✅ Application initialized in ${initTime.toFixed(2)}ms`);
            
            // Emit initialization event
            this.emit('initialized', {
                initTime,
                systems: this.getSystemStatus()
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            this.handleError('initialization', error);
            throw error;
        }
    }
    
    /**
     * Initialize canvas and WebGL context
     */
    async initializeCanvas(canvasOrId) {
        console.log('🖼️ Initializing canvas and WebGL...');
        
        // Get or create canvas
        if (typeof canvasOrId === 'string') {
            this.canvas = document.getElementById(canvasOrId);
            if (!this.canvas) {
                throw new Error(`Canvas element with ID "${canvasOrId}" not found`);
            }
        } else if (canvasOrId instanceof HTMLCanvasElement) {
            this.canvas = canvasOrId;
        } else {
            throw new Error('Invalid canvas parameter - must be string ID or HTMLCanvasElement');
        }
        
        // Set initial canvas size
        this.resizeCanvas();
        
        // Create WebGL context with optimal settings
        const contextOptions = {
            alpha: false,
            antialias: true,
            depth: true,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
            premultipliedAlpha: false
        };
        
        // Try WebGL2 first if enabled
        if (this.config.enableWebGL2) {
            this.gl = this.canvas.getContext('webgl2', contextOptions);
        }
        
        // Fallback to WebGL1
        if (!this.gl) {
            this.gl = this.canvas.getContext('webgl', contextOptions) ||
                     this.canvas.getContext('experimental-webgl', contextOptions);
        }
        
        if (!this.gl) {
            throw new Error('WebGL is not supported in this browser');
        }
        
        // Initialize WebGL utilities
        webglUtils.initialize(this.gl);
        
        console.log('✅ WebGL context created', {
            version: this.gl instanceof WebGL2RenderingContext ? '2.0' : '1.0',
            vendor: this.gl.getParameter(this.gl.VENDOR),
            renderer: this.gl.getParameter(this.gl.RENDERER),
            maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
            maxViewportDims: this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS)
        });
    }
    
    /**
     * Initialize performance monitoring
     */
    async initializePerformanceMonitoring() {
        console.log('📊 Initializing performance monitoring...');
        
        await performanceMonitor.initialize({
            targetFPS: this.config.targetFPS,
            enableProfiler: this.config.enableProfiler,
            memoryLimit: this.config.memoryLimit,
            adaptiveQuality: this.config.adaptiveQuality
        });
        
        // Setup performance callbacks
        performanceMonitor.onPerformanceChange((metrics) => {
            this.performance = { ...this.performance, ...metrics };
            this.handlePerformanceChange(metrics);
        });
        
        console.log('✅ Performance monitoring initialized');
    }
    
    /**
     * Initialize core engines
     */
    async initializeCoreEngines() {
        console.log('⚙️ Initializing core engines...');
        
        // Initialize Render Engine
        this.engines.render = new RenderEngine({
            enableHDR: this.config.enableHDR,
            enablePostProcessing: this.config.enablePostProcessing,
            targetFPS: this.config.targetFPS,
            adaptiveQuality: this.config.adaptiveQuality
        });
        
        await this.engines.render.initialize(this.canvas, {
            showStats: this.config.showStats
        });
        
        // Initialize Shader Manager
        shaderManager.initialize(this.gl);
        
        console.log('✅ Core engines initialized');
    }
    
    /**
     * Initialize audio processing pipeline
     */
    async initializeAudioPipeline() {
        console.log('🎵 Initializing audio pipeline...');
        
        // Initialize Audio Engine
        this.engines.audio = new AudioEngine({
            fftSize: this.config.defaultFFTSize,
            enableMicrophone: this.config.enableMicrophone,
            latencyHint: this.config.audioLatency
        });
        
        await this.engines.audio.initialize();
        
        // Initialize FFT Processor
        this.audioProcessors.fft = new FFTProcessor({
            fftSize: this.config.defaultFFTSize,
            audioEngine: this.engines.audio,
            algorithm: 'hybrid',
            enableOversampling: true
        });
        
        await this.audioProcessors.fft.initialize();
        
        // Initialize Spectral Analyzer
        this.audioProcessors.spectral = new SpectralAnalyzer({
            fftProcessor: this.audioProcessors.fft,
            enableMelScale: true,
            melFilterBanks: 128
        });
        
        await this.audioProcessors.spectral.initialize();
        
        // Initialize Beat Detector
        this.audioProcessors.beat = new BeatDetector({
            audioEngine: this.engines.audio,
            spectralAnalyzer: this.audioProcessors.spectral,
            sensitivity: 0.7,
            enableTempoTracking: true
        });
        
        await this.audioProcessors.beat.initialize();
        
        // Initialize Feature Extractor
        this.audioProcessors.features = new FeatureExtractor({
            audioEngine: this.engines.audio,
            fftProcessor: this.audioProcessors.fft,
            enableMFCC: true,
            enableChromagram: true
        });
        
        await this.audioProcessors.features.initialize();
        
        // Setup audio callbacks
        this.engines.audio.onAudioData((audioData) => {
            this.handleAudioData(audioData);
        });
        
        console.log('✅ Audio pipeline initialized');
    }
    
    /**
     * Initialize physics systems
     */
    async initializePhysicsSystems() {
        console.log('🌊 Initializing physics systems...');
        
        // Initialize Particle System
        this.physicsSystems.particles = new ParticleSystem({
            maxParticles: 10000,
            enableAudioReactivity: true,
            enableWebGL: true,
            updateMode: 'hybrid'
        });
        
        await this.physicsSystems.particles.initialize(this.gl);
        
        // Initialize Metaball System
        this.physicsSystems.metaballs = new MetaballSystem({
            maxMetaballs: 32,
            enableAudioReactivity: true,
            enablePhysics: true
        });
        
        await this.physicsSystems.metaballs.initialize(this.gl);
        
        // Initialize Fluid Simulation
        this.physicsSystems.fluid = new FluidSimulation({
            resolution: 512,
            enableViscosity: true,
            enableAdvection: true,
            enableAudioReactivity: true
        });
        
        await this.physicsSystems.fluid.initialize(this.gl);
        
        // Initialize Material Physics
        this.physicsSystems.material = new MaterialPhysics({
            enablePhaseTransitions: true,
            enableSurfaceTension: true,
            audioReactive: true
        });
        
        await this.physicsSystems.material.initialize();
        
        console.log('✅ Physics systems initialized');
    }
    
    /**
     * Initialize material system
     */
    async initializeMaterialSystem() {
        console.log('🧪 Initializing material system...');
        
        this.engines.material = new MaterialManager({
            enablePhysics: true,
            enableInterpolation: true,
            enablePresets: true,
            enableAudioReactivity: true,
            defaultMaterial: this.config.defaultMaterial
        });
        
        await this.engines.material.initialize({
            physics: this.physicsSystems.material
        });
        
        console.log('✅ Material system initialized');
    }
    
    /**
     * Initialize visualizer system
     */
    async initializeVisualizerSystem() {
        console.log('🎨 Initializing visualizer system...');
        
        this.engines.visualizer = new VisualizerManager({
            maxActiveVisualizers: 3,
            enableTransitions: true,
            enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
            adaptiveQuality: this.config.adaptiveQuality
        });
        
        // Create integrations object for visualizer system
        const integrations = {
            renderEngine: this.engines.render,
            audioEngine: this.engines.audio,
            materialManager: this.engines.material,
            shaderManager: shaderManager,
            particleSystem: this.physicsSystems.particles,
            metaballSystem: this.physicsSystems.metaballs,
            fluidSimulation: this.physicsSystems.fluid
        };
        
        await this.engines.visualizer.initialize(integrations, this.canvas);
        
        // Register built-in visualizers
        this.engines.visualizer.registerVisualizerType('blob', BlobVisualizer, {
            name: 'Blob Visualizer',
            description: 'Physically-accurate amorphous blob with material simulation',
            category: 'fluid',
            complexity: 'high',
            audioReactive: true
        });
        
        // Set default visualizer
        await this.engines.visualizer.setActiveVisualizer(this.config.defaultVisualizer);
        this.state.currentVisualizer = this.config.defaultVisualizer;
        
        console.log('✅ Visualizer system initialized');
    }
    
    /**
     * Initialize UI system
     */
    async initializeUISystem() {
        console.log('🖥️ Initializing UI system...');
        
        this.engines.ui = new UIManager({
            audioEngine: this.engines.audio,
            renderEngine: this.engines.render,
            visualizerManager: this.engines.visualizer,
            materialManager: this.engines.material,
            
            enableAdvancedUI: true,
            enableMobileLayout: this.config.enableMobileUI,
            enableAccessibility: this.config.enableAccessibility,
            enableKeyboardShortcuts: this.config.enableKeyboardShortcuts,
            
            enableParticleEffects: true,
            enableSpringAnimations: true,
            enableAudioReactivity: true,
            enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
            
            onParameterChange: (param, value, source) => {
                this.handleParameterChange(param, value, source);
            }
        });
        
        await this.engines.ui.initialize();
        
        console.log('✅ UI system initialized');
    }
    
    /**
     * Setup integrations between systems
     */
    setupSystemIntegrations() {
        console.log('🔗 Setting up system integrations...');
        
        // Connect audio to physics systems
        this.physicsSystems.particles.setAudioEngine(this.engines.audio);
        this.physicsSystems.metaballs.setAudioEngine(this.engines.audio);
        this.physicsSystems.fluid.setAudioEngine(this.engines.audio);
        
        // Connect material system to physics
        this.engines.material.setIntegrations({
            fluidSimulation: this.physicsSystems.fluid,
            particleSystem: this.physicsSystems.particles,
            metaballSystem: this.physicsSystems.metaballs,
            renderEngine: this.engines.render,
            audioEngine: this.engines.audio
        });
        
        // Setup performance monitoring integration
        if (this.config.enablePerformanceMonitoring) {
            performanceMonitor.addSystemMetrics('audio', this.engines.audio);
            performanceMonitor.addSystemMetrics('render', this.engines.render);
            performanceMonitor.addSystemMetrics('visualizer', this.engines.visualizer);
            performanceMonitor.addSystemMetrics('material', this.engines.material);
        }
        
        console.log('✅ System integrations complete');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        console.log('👂 Setting up event listeners...');
        
        // Window events
        window.addEventListener('resize', this.onResize);
        window.addEventListener('beforeunload', this.onBeforeUnload.bind(this));
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        
        // Canvas events
        this.canvas.addEventListener('contextlost', this.onContextLost.bind(this));
        this.canvas.addEventListener('contextrestored', this.onContextRestored.bind(this));
        
        // Error handling
        window.addEventListener('error', this.onError);
        window.addEventListener('unhandledrejection', this.onUnhandledRejection.bind(this));
        
        console.log('✅ Event listeners setup complete');
    }
    
    /**
     * Apply initial configuration
     */
    async applyInitialConfiguration() {
        console.log('⚙️ Applying initial configuration...');
        
        // Set initial material
        await this.engines.material.setMaterial(this.config.defaultMaterial);
        this.state.currentMaterial = this.config.defaultMaterial;
        
        // Configure audio system
        if (this.config.enableAudioInput) {
            // Auto-connect to microphone if enabled
            if (this.config.enableMicrophone) {
                try {
                    await this.engines.audio.connectMicrophone();
                    this.state.audioConnected = true;
                    this.emit('audioConnected', { source: 'microphone' });
                } catch (error) {
                    console.warn('Failed to connect microphone:', error);
                }
            }
        }
        
        // Apply performance settings
        this.applyPerformanceSettings();
        
        console.log('✅ Initial configuration applied');
    }
    
    /**
     * Setup hot-reload for development
     */
    setupHotReload() {
        if (typeof module !== 'undefined' && module.hot) {
            module.hot.accept('./core/ShaderManager.js', () => {
                console.log('🔥 Hot-reloading shaders...');
                shaderManager.reloadAllShaders();
            });
            
            module.hot.accept('./visualizers/blob/BlobVisualizer.js', () => {
                console.log('🔥 Hot-reloading blob visualizer...');
                this.engines.visualizer.reloadVisualizer('blob');
            });
        }
    }
    
    /**
     * Start the application
     */
    start() {
        if (!this.state.isInitialized) {
            throw new Error('Application must be initialized before starting');
        }
        
        if (this.state.isRunning) {
            console.warn('Application is already running');
            return;
        }
        
        console.log('▶️ Starting GLSL Music Visualizer...');
        
        this.state.isRunning = true;
        this.state.isPaused = false;
        this.lastTime = performance.now();
        
        // Start the main render loop
        this.animationFrame = requestAnimationFrame(this.update);
        
        // Start performance monitoring
        if (this.config.enablePerformanceMonitoring) {
            performanceMonitor.start();
        }
        
        // Start audio processing
        this.engines.audio.start();
        
        console.log('✅ Application started');
        this.emit('started', { timestamp: Date.now() });
    }
    
    /**
     * Pause the application
     */
    pause() {
        if (!this.state.isRunning || this.state.isPaused) return;
        
        console.log('⏸️ Pausing application...');
        
        this.state.isPaused = true;
        
        // Cancel animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Pause audio
        this.engines.audio.pause();
        
        // Pause performance monitoring
        if (this.config.enablePerformanceMonitoring) {
            performanceMonitor.pause();
        }
        
        console.log('✅ Application paused');
        this.emit('paused', { timestamp: Date.now() });
    }
    
    /**
     * Resume the application
     */
    resume() {
        if (!this.state.isRunning || !this.state.isPaused) return;
        
        console.log('▶️ Resuming application...');
        
        this.state.isPaused = false;
        this.lastTime = performance.now();
        
        // Resume animation frame
        this.animationFrame = requestAnimationFrame(this.update);
        
        // Resume audio
        this.engines.audio.resume();
        
        // Resume performance monitoring
        if (this.config.enablePerformanceMonitoring) {
            performanceMonitor.resume();
        }
        
        console.log('✅ Application resumed');
        this.emit('resumed', { timestamp: Date.now() });
    }
    
    /**
     * Stop the application
     */
    stop() {
        if (!this.state.isRunning) return;
        
        console.log('⏹️ Stopping application...');
        
        this.state.isRunning = false;
        this.state.isPaused = false;
        
        // Cancel animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Stop all engines
        this.engines.audio.stop();
        if (this.config.enablePerformanceMonitoring) {
            performanceMonitor.stop();
        }
        
        console.log('✅ Application stopped');
        this.emit('stopped', { timestamp: Date.now() });
    }
    
    /**
     * Main update loop
     */
    update(currentTime) {
        if (!this.state.isRunning || this.state.isPaused) return;
        
        // Calculate delta time
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        this.state.frameCount++;
        
        // Performance tracking
        const updateStart = performance.now();
        
        try {
            // Update audio processors
            this.updateAudioProcessors();
            
            // Update physics systems
            this.updatePhysicsSystems();
            
            // Update material system
            this.updateMaterialSystem();
            
            // Update visualizer
            this.updateVisualizer();
            
            // Update UI system
            if (this.engines.ui) {
                this.engines.ui.handleAudioUpdate(this.getAudioData());
            }
            
            // Record update performance
            this.performance.updateTime = performance.now() - updateStart;
            
            // Render frame
            this.render();
            
            // Schedule next frame
            this.animationFrame = requestAnimationFrame(this.update);
            
        } catch (error) {
            this.handleError('update', error);
        }
    }
    
    /**
     * Update audio processors
     */
    updateAudioProcessors() {
        if (!this.state.audioConnected) return;
        
        // Update FFT processor
        this.audioProcessors.fft.update();
        
        // Update spectral analyzer
        this.audioProcessors.spectral.update();
        
        // Update beat detector
        this.audioProcessors.beat.update();
        
        // Update feature extractor
        this.audioProcessors.features.update();
    }
    
    /**
     * Update physics systems
     */
    updatePhysicsSystems() {
        const audioData = this.getAudioData();
        
        // Update particle system
        this.physicsSystems.particles.update(this.deltaTime, audioData);
        
        // Update metaball system
        this.physicsSystems.metaballs.update(this.deltaTime, audioData);
        
        // Update fluid simulation
        this.physicsSystems.fluid.update(this.deltaTime, audioData);
        
        // Update material physics
        this.physicsSystems.material.update(this.deltaTime, audioData);
    }
    
    /**
     * Update material system
     */
    updateMaterialSystem() {
        const audioData = this.getAudioData();
        this.engines.material.update(this.deltaTime, audioData);
    }
    
    /**
     * Update visualizer
     */
    updateVisualizer() {
        const audioData = this.getAudioData();
        this.engines.visualizer.update(this.deltaTime, audioData);
    }
    
    /**
     * Render frame
     */
    render() {
        const renderStart = performance.now();
        
        try {
            // Get current material properties
            const materialProps = this.engines.material.getRenderProperties();
            
            // Render visualizer
            this.engines.visualizer.render(this.deltaTime, {
                materialProps,
                canvas: this.canvas,
                timestamp: this.lastTime
            });
            
            // Record render performance
            this.performance.renderTime = performance.now() - renderStart;
            this.performance.frameTime = this.performance.updateTime + this.performance.renderTime;
            
            // Update FPS
            if (this.state.frameCount % 60 === 0) {
                this.performance.fps = 1000 / this.performance.frameTime;
            }
            
        } catch (error) {
            this.handleError('render', error);
        }
    }
    
    /**
     * Get current audio data for systems
     */
    getAudioData() {
        if (!this.state.audioConnected || !this.engines.audio) {
            return null;
        }
        
        return {
            // Raw audio data
            frequencyData: this.engines.audio.getFrequencyData(),
            timeData: this.engines.audio.getTimeData(),
            
            // Processed audio features
            energy: this.audioProcessors.spectral?.getEnergy() || 0,
            bass: this.audioProcessors.spectral?.getBass() || 0,
            mid: this.audioProcessors.spectral?.getMid() || 0,
            treble: this.audioProcessors.spectral?.getTreble() || 0,
            
            // Beat detection
            beat: this.audioProcessors.beat?.isBeat() || false,
            beatStrength: this.audioProcessors.beat?.getBeatStrength() || 0,
            tempo: this.audioProcessors.beat?.getTempo() || 120,
            
            // Advanced features
            mfcc: this.audioProcessors.features?.getMFCC() || null,
            chromagram: this.audioProcessors.features?.getChromagram() || null,
            spectralCentroid: this.audioProcessors.features?.getSpectralCentroid() || 0,
            spectralRolloff: this.audioProcessors.features?.getSpectralRolloff() || 0,
            
            // Metadata
            timestamp: performance.now(),
            sampleRate: this.engines.audio.getSampleRate(),
            bufferSize: this.engines.audio.getBufferSize()
        };
    }
    
    /**
     * Handle audio data updates
     */
    handleAudioData(audioData) {
        // Forward to UI system
        if (this.engines.ui) {
            this.engines.ui.handleAudioUpdate(audioData);
        }
        
        // Update audio connection state
        if (!this.state.audioConnected) {
            this.state.audioConnected = true;
            this.emit('audioConnected', { data: audioData });
        }
    }
    
    /**
     * Handle parameter changes from UI
     */
    handleParameterChange(parameter, value, source) {
        console.log(`Parameter changed: ${parameter} = ${value} (from ${source})`);
        
        try {
            switch (source) {
                case 'audio':
                    this.handleAudioParameterChange(parameter, value);
                    break;
                case 'material':
                    this.handleMaterialParameterChange(parameter, value);
                    break;
                case 'visual':
                    this.handleVisualParameterChange(parameter, value);
                    break;
                case 'performance':
                    this.handlePerformanceParameterChange(parameter, value);
                    break;
            }
        } catch (error) {
            this.handleError('parameterChange', error);
        }
    }
    
    /**
     * Handle audio parameter changes
     */
    handleAudioParameterChange(parameter, value) {
        switch (parameter) {
            case 'fftSize':
                this.audioProcessors.fft.setFFTSize(value);
                break;
            case 'smoothing':
                this.engines.audio.setSmoothing(value);
                break;
            case 'gain':
                this.engines.audio.setGain(value);
                break;
            case 'beatSensitivity':
                this.audioProcessors.beat.setSensitivity(value);
                break;
        }
    }
    
    /**
     * Handle material parameter changes
     */
    handleMaterialParameterChange(parameter, value) {
        switch (parameter) {
            case 'material':
                this.setMaterial(value);
                break;
            case 'viscosity':
            case 'density':
            case 'temperature':
            case 'surfaceTension':
                this.engines.material.setProperty(parameter, value);
                break;
        }
    }
    
    /**
     * Handle visual parameter changes
     */
    handleVisualParameterChange(parameter, value) {
        switch (parameter) {
            case 'visualizer':
                this.setVisualizer(value);
                break;
            case 'quality':
                this.setQuality(value);
                break;
            case 'postProcessing':
                this.engines.render.setPostProcessing(value);
                break;
        }
    }
    
    /**
     * Handle performance parameter changes
     */
    handlePerformanceParameterChange(parameter, value) {
        switch (parameter) {
            case 'targetFPS':
                this.setTargetFPS(value);
                break;
            case 'adaptiveQuality':
                this.setAdaptiveQuality(value);
                break;
            case 'performanceMode':
                this.setPerformanceMode(value);
                break;
        }
    }
    
    /**
     * Handle performance changes
     */
    handlePerformanceChange(metrics) {
        // Update internal performance tracking
        Object.assign(this.performance, metrics);
        
        // Auto-adjust quality if needed
        if (this.config.adaptiveQuality && this.state.performanceMode === 'auto') {
            this.autoAdjustQuality(metrics);
        }
        
        // Emit performance change event
        this.emit('performanceChanged', metrics);
    }
    
    /**
     * Auto-adjust quality based on performance
     */
    autoAdjustQuality(metrics) {
        const { fps, memoryUsage, gpuMemory } = metrics;
        
        // Determine quality adjustments needed
        let adjustments = {};
        
        // FPS-based adjustments
        if (fps < this.config.targetFPS * 0.8) {
            adjustments.particleCount = Math.max(1000, this.physicsSystems.particles.getParticleCount() * 0.8);
            adjustments.fluidResolution = Math.max(256, this.physicsSystems.fluid.getResolution() * 0.9);
            adjustments.renderQuality = Math.max(0.5, this.engines.render.getQuality() * 0.9);
        } else if (fps > this.config.targetFPS * 1.1) {
            adjustments.particleCount = Math.min(10000, this.physicsSystems.particles.getParticleCount() * 1.1);
            adjustments.fluidResolution = Math.min(1024, this.physicsSystems.fluid.getResolution() * 1.05);
            adjustments.renderQuality = Math.min(1.0, this.engines.render.getQuality() * 1.05);
        }
        
        // Memory-based adjustments
        if (memoryUsage > this.config.memoryLimit * 0.9) {
            adjustments.particleCount = Math.max(500, this.physicsSystems.particles.getParticleCount() * 0.7);
            adjustments.textureQuality = Math.max(0.5, this.engines.render.getTextureQuality() * 0.8);
        }
        
        // Apply adjustments
        this.applyQualityAdjustments(adjustments);
    }
    
    /**
     * Apply quality adjustments
     */
    applyQualityAdjustments(adjustments) {
        if (adjustments.particleCount) {
            this.physicsSystems.particles.setMaxParticles(adjustments.particleCount);
        }
        
        if (adjustments.fluidResolution) {
            this.physicsSystems.fluid.setResolution(adjustments.fluidResolution);
        }
        
        if (adjustments.renderQuality) {
            this.engines.render.setQuality(adjustments.renderQuality);
        }
        
        if (adjustments.textureQuality) {
            this.engines.render.setTextureQuality(adjustments.textureQuality);
        }
        
        console.log('Quality adjusted:', adjustments);
    }
    
    /**
     * Apply performance settings
     */
    applyPerformanceSettings() {
        const mode = this.state.performanceMode;
        
        const settings = {
            low: {
                particleCount: 1000,
                fluidResolution: 256,
                renderQuality: 0.6,
                enablePostProcessing: false,
                fftSize: 2048
            },
            medium: {
                particleCount: 5000,
                fluidResolution: 512,
                renderQuality: 0.8,
                enablePostProcessing: true,
                fftSize: 4096
            },
            high: {
                particleCount: 10000,
                fluidResolution: 1024,
                renderQuality: 1.0,
                enablePostProcessing: true,
                fftSize: 8192
            },
            auto: null // Dynamic adjustment
        };
        
        const config = settings[mode];
        if (config) {
            this.applyQualityAdjustments(config);
            this.engines.render.setPostProcessing(config.enablePostProcessing);
            this.audioProcessors.fft.setFFTSize(config.fftSize);
        }
    }
    
    /**
     * Resize canvas and update systems
     */
    resizeCanvas() {
        const pixelRatio = window.devicePixelRatio || 1;
        const displayWidth = this.canvas.clientWidth * pixelRatio;
        const displayHeight = this.canvas.clientHeight * pixelRatio;
        
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            
            // Update WebGL viewport
            if (this.gl) {
                this.gl.viewport(0, 0, displayWidth, displayHeight);
            }
            
            // Update render engine
            if (this.engines.render) {
                this.engines.render.resize(displayWidth, displayHeight);
            }
            
            // Update visualizer
            if (this.engines.visualizer) {
                this.engines.visualizer.resize(displayWidth, displayHeight);
            }
            
            console.log(`Canvas resized to ${displayWidth}x${displayHeight}`);
        }
    }
    
    /**
     * Event Handlers
     */
    
    onResize() {
        this.resizeCanvas();
    }
    
    onVisibilityChange() {
        if (document.hidden) {
            this.pause();
        } else if (this.state.isInitialized) {
            this.resume();
        }
    }
    
    onBeforeUnload() {
        this.stop();
        this.cleanup();
    }
    
    onContextLost(event) {
        event.preventDefault();
        console.warn('WebGL context lost');
        this.pause();
        this.handleError('contextLost', new Error('WebGL context lost'));
    }
    
    onContextRestored() {
        console.log('WebGL context restored');
        // Reinitialize WebGL resources
        this.reinitializeWebGLResources();
        this.resume();
    }
    
    onError(event) {
        this.handleError('runtime', new Error(event.message || 'Unknown error'));
    }
    
    onUnhandledRejection(event) {
        this.handleError('promise', new Error(event.reason));
    }
    
    /**
     * Error handling
     */
    handleError(type, error) {
        const errorInfo = {
            type,
            message: error.message,
            stack: error.stack,
            timestamp: Date.now(),
            state: this.getSystemStatus()
        };
        
        this.errorHandler.errors.push(errorInfo);
        
        // Limit error history
        if (this.errorHandler.errors.length > this.errorHandler.maxErrors) {
            this.errorHandler.errors.shift();
        }
        
        console.error(`Application error (${type}):`, error);
        
        // Attempt recovery for certain error types
        this.attemptErrorRecovery(type, error);
        
        // Notify external error handler
        if (this.errorHandler.onError) {
            this.errorHandler.onError(errorInfo);
        }
        
        // Emit error event
        this.emit('error', errorInfo);
    }
    
    /**
     * Attempt error recovery
     */
    attemptErrorRecovery(type, error) {
        switch (type) {
            case 'contextLost':
                // WebGL context will be restored automatically
                break;
            case 'audio':
                // Try to reconnect audio
                this.reconnectAudio();
                break;
            case 'render':
                // Reset render state
                this.engines.render.reset();
                break;
            case 'memory':
                // Reduce quality to free memory
                this.setPerformanceMode('low');
                break;
        }
    }
    
    /**
     * Reconnect audio system
     */
    async reconnectAudio() {
        try {
            await this.engines.audio.reconnect();
            this.state.audioConnected = true;
            console.log('Audio reconnected successfully');
        } catch (error) {
            console.error('Failed to reconnect audio:', error);
        }
    }
    
    /**
     * Reinitialize WebGL resources after context restore
     */
    async reinitializeWebGLResources() {
        try {
            // Reinitialize shader manager
            shaderManager.reinitialize(this.gl);
            
            // Reinitialize render engine
            await this.engines.render.reinitialize();
            
            // Reinitialize physics systems
            await this.physicsSystems.particles.reinitialize(this.gl);
            await this.physicsSystems.metaballs.reinitialize(this.gl);
            await this.physicsSystems.fluid.reinitialize(this.gl);
            
            // Reinitialize visualizer
            await this.engines.visualizer.reinitialize();
            
            console.log('WebGL resources reinitialized');
        } catch (error) {
            this.handleError('reinitialize', error);
        }
    }
    
    /**
     * Public API methods
     */
    
    /**
     * Set active visualizer
     */
    async setVisualizer(visualizerName) {
        try {
            await this.engines.visualizer.setActiveVisualizer(visualizerName);
            this.state.currentVisualizer = visualizerName;
            this.emit('visualizerChanged', { visualizer: visualizerName });
        } catch (error) {
            this.handleError('setVisualizer', error);
        }
    }
    
    /**
     * Set material
     */
    async setMaterial(materialName) {
        try {
            await this.engines.material.setMaterial(materialName);
            this.state.currentMaterial = materialName;
            this.emit('materialChanged', { material: materialName });
        } catch (error) {
            this.handleError('setMaterial', error);
        }
    }
    
    /**
     * Load audio file
     */
    async loadAudioFile(file) {
        try {
            await this.engines.audio.loadFile(file);
            this.state.audioConnected = true;
            this.emit('audioConnected', { source: 'file', file: file.name });
        } catch (error) {
            this.handleError('loadAudio', error);
        }
    }
    
    /**
     * Connect to microphone
     */
    async connectMicrophone() {
        try {
            await this.engines.audio.connectMicrophone();
            this.state.audioConnected = true;
            this.emit('audioConnected', { source: 'microphone' });
        } catch (error) {
            this.handleError('connectMicrophone', error);
        }
    }
    
    /**
     * Set performance mode
     */
    setPerformanceMode(mode) {
        this.state.performanceMode = mode;
        this.applyPerformanceSettings();
        console.log(`Performance mode set to: ${mode}`);
    }
    
    /**
     * Set target FPS
     */
    setTargetFPS(fps) {
        this.config.targetFPS = fps;
        if (this.config.enablePerformanceMonitoring) {
            performanceMonitor.setTargetFPS(fps);
        }
    }
    
    /**
     * Set adaptive quality
     */
    setAdaptiveQuality(enabled) {
        this.config.adaptiveQuality = enabled;
        if (this.config.enablePerformanceMonitoring) {
            performanceMonitor.setAdaptiveQuality(enabled);
        }
    }
    
    /**
     * Set quality level
     */
    setQuality(quality) {
        const qualitySettings = {
            low: { mode: 'low' },
            medium: { mode: 'medium' },
            high: { mode: 'high' },
            ultra: { mode: 'high', extraFeatures: true }
        };
        
        const settings = qualitySettings[quality];
        if (settings) {
            this.setPerformanceMode(settings.mode);
        }
    }
    
    /**
     * Get application state
     */
    getState() {
        return {
            ...this.state,
            performance: this.performance,
            systems: this.getSystemStatus()
        };
    }
    
    /**
     * Get system status
     */
    getSystemStatus() {
        return {
            audio: this.engines.audio?.getStatus() || 'not initialized',
            render: this.engines.render?.getStatus() || 'not initialized',
            visualizer: this.engines.visualizer?.getStatus() || 'not initialized',
            material: this.engines.material?.getStatus() || 'not initialized',
            ui: this.engines.ui?.getState() || 'not initialized',
            webgl: this.gl ? 'active' : 'not available'
        };
    }
    
    /**
     * Event system
     */
    
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }
    
    off(event, callback) {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event callback for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Cleanup and destruction
     */
    cleanup() {
        console.log('🧹 Cleaning up application...');
        
        // Stop the application
        this.stop();
        
        // Remove event listeners
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('beforeunload', this.onBeforeUnload);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        window.removeEventListener('error', this.onError);
        window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
        
        // Cleanup engines
        if (this.engines.audio) this.engines.audio.dispose();
        if (this.engines.render) this.engines.render.dispose();
        if (this.engines.visualizer) this.engines.visualizer.dispose();
        if (this.engines.material) this.engines.material.dispose();
        if (this.engines.ui) this.engines.ui.destroy();
        
        // Cleanup physics systems
        Object.values(this.physicsSystems).forEach(system => {
            if (system && system.dispose) system.dispose();
        });
        
        // Cleanup audio processors
        Object.values(this.audioProcessors).forEach(processor => {
            if (processor && processor.dispose) processor.dispose();
        });
        
        // Cleanup shader manager
        shaderManager.dispose();
        
        // Clear references
        this.engines = {};
        this.audioProcessors = {};
        this.physicsSystems = {};
        this.canvas = null;
        this.gl = null;
        
        console.log('✅ Application cleanup complete');
    }
}

/**
 * Application Factory and Global Instance Management
 */

// Global application instance
let appInstance = null;

/**
 * Create and initialize the application
 * @param {string|HTMLCanvasElement} canvas - Canvas element or ID
 * @param {Object} options - Configuration options
 * @returns {Promise<GLSLMusicVisualizer>} Application instance
 */
export async function createApp(canvas, options = {}) {
    if (appInstance) {
        console.warn('Application instance already exists');
        return appInstance;
    }
    
    try {
        // Check browser compatibility
        checkBrowserCompatibility();
        
        // Create application instance
        appInstance = new GLSLMusicVisualizer(options);
        
        // Initialize the application
        await appInstance.initialize(canvas);
        
        // Make instance globally available for debugging
        if (process.env.NODE_ENV === 'development') {
            window.glslVisualizer = appInstance;
        }
        
        return appInstance;
        
    } catch (error) {
        console.error('Failed to create application:', error);
        throw error;
    }
}

/**
 * Get the current application instance
 * @returns {GLSLMusicVisualizer|null} Current instance or null
 */
export function getApp() {
    return appInstance;
}

/**
 * Destroy the current application instance
 */
export function destroyApp() {
    if (appInstance) {
        appInstance.cleanup();
        appInstance = null;
        
        if (typeof window !== 'undefined' && window.glslVisualizer) {
            delete window.glslVisualizer;
        }
    }
}

/**
 * Check browser compatibility
 */
function checkBrowserCompatibility() {
    const issues = [];
    
    // Check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        issues.push('WebGL is not supported');
    }
    
    // Check Web Audio API
    if (!window.AudioContext && !window.webkitAudioContext) {
        issues.push('Web Audio API is not supported');
    }
    
    // Check File API
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        issues.push('File API is not supported');
    }
    
    // Check requestAnimationFrame
    if (!window.requestAnimationFrame) {
        issues.push('requestAnimationFrame is not supported');
    }
    
    // Check WebGL extensions
    if (gl) {
        const requiredExtensions = ['OES_texture_float', 'WEBGL_depth_texture'];
        const missingExtensions = requiredExtensions.filter(ext => !gl.getExtension(ext));
        
        if (missingExtensions.length > 0) {
            issues.push(`Missing WebGL extensions: ${missingExtensions.join(', ')}`);
        }
    }
    
    if (issues.length > 0) {
        const message = 'Browser compatibility issues:\n' + issues.join('\n');
        console.warn(message);
        
        // Show user-friendly error if available
        if (window.VisualizerUI && window.VisualizerUI.showError) {
            window.VisualizerUI.showError(message);
        }
    }
    
    return issues.length === 0;
}

/**
 * Auto-initialization for simple usage
 * Automatically finds canvas and initializes with default settings
 */
export async function autoInit(options = {}) {
    // Find canvas element
    let canvas = document.getElementById('visualizer-canvas') ||
                document.querySelector('canvas') ||
                document.querySelector('#canvas');
    
    if (!canvas) {
        // Create canvas if none found
        canvas = document.createElement('canvas');
        canvas.id = 'visualizer-canvas';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 1;
            background: #000;
        `;
        document.body.appendChild(canvas);
    }
    
    // Create and start application
    const app = await createApp(canvas, options);
    app.start();
    
    return app;
}

// Export main class and utilities
export { GLSLMusicVisualizer };
export default GLSLMusicVisualizer;