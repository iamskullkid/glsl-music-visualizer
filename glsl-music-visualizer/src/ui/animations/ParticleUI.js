/**
 * Particle UI - Interactive Particle Effects for User Interface
 * Advanced particle system integration for UI elements and interactions
 * Location: src/ui/animations/ParticleUI.js
 *
 * Features:
 * - Interactive particle effects for UI elements
 * - Audio-reactive particle behaviors
 * - WebGL-based high-performance particle rendering
 * - Integration with existing SpringSystem and MorphTransitions
 * - CSS-based fallback particle systems
 * - Touch and mouse interaction particles
 * - Contextual particle effects (hover, click, drag)
 * - Performance-optimized with adaptive quality
 */

import { ParticleSystem } from '../../physics/ParticleSystem.js';
import { SpringSystem } from './SpringSystem.js';
import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { webglUtils } from '../../utils/WebGLUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';

export class ParticleUI {
    constructor(options = {}) {
        // Configuration
        this.config = {
            // System settings
            enableWebGL: options.enableWebGL !== false,
            enableCSS: options.enableCSS !== false,
            maxParticles: options.maxParticles || 2000,
            maxEmitters: options.maxEmitters || 50,
            
            // Performance settings
            enableAdaptiveQuality: options.enableAdaptiveQuality !== false,
            targetFPS: options.targetFPS || 60,
            lowPerformanceThreshold: options.lowPerformanceThreshold || 45,
            highPerformanceThreshold: options.highPerformanceThreshold || 55,
            
            // Audio integration
            enableAudioReactivity: options.enableAudioReactivity !== false,
            audioInfluence: options.audioInfluence || 0.4,
            beatReactivity: options.beatReactivity || 0.8,
            
            // Visual settings
            defaultParticleSize: options.defaultParticleSize || 3,
            defaultLifetime: options.defaultLifetime || 2.0,
            enableBlending: options.enableBlending !== false,
            enablePhysics: options.enablePhysics !== false,
            
            // Interaction settings
            enableMouseInteraction: options.enableMouseInteraction !== false,
            enableTouchInteraction: options.enableTouchInteraction !== false,
            interactionRadius: options.interactionRadius || 100,
            interactionStrength: options.interactionStrength || 0.5,
            
            // UI integration
            autoAttachToElements: options.autoAttachToElements !== false,
            watchForNewElements: options.watchForNewElements !== false,
            elementSelector: options.elementSelector || '.particle-ui',
            
            // Debug options
            enableDebug: options.enableDebug === true,
            showBounds: options.showBounds === true,
            showEmitters: options.showEmitters === true
        };
        
        // Core systems
        this.particleSystem = null;
        this.springSystem = null;
        this.isWebGLEnabled = false;
        
        // Rendering
        this.canvas = null;
        this.gl = null;
        this.renderProgram = null;
        this.particleTexture = null;
        this.programLocations = null;
        
        // UI Integration
        this.attachedElements = new Map();
        this.emitters = new Map();
        this.emitterCounter = 0;
        this.elementObserver = null;
        
        // Interaction system
        this.interactionState = {
            mouse: { x: 0, y: 0, isDown: false },
            touches: new Map(),
            lastInteraction: 0,
            interactionParticles: []
        };
        
        // Audio-reactive state
        this.audioState = {
            energy: 0,
            bass: 0,
            mid: 0,
            treble: 0,
            beat: false,
            beatStrength: 0,
            spectrum: new Float32Array(64),
            lastUpdate: 0
        };
        
        // Particle effect presets
        this.effectPresets = {
            // Interaction effects
            hover: {
                type: 'continuous',
                emission: { rate: 5, burst: 0 },
                particle: { size: 2, lifetime: 1.5, fadeIn: 0.2, fadeOut: 0.8 },
                physics: { velocity: [0, -20, 0], spread: Math.PI / 6, gravity: [0, 10, 0] },
                visual: { color: [0.2, 0.8, 1.0, 0.8], blendMode: 'additive' }
            },
            
            click: {
                type: 'burst',
                emission: { rate: 0, burst: 25 },
                particle: { size: 4, lifetime: 0.8, fadeIn: 0.1, fadeOut: 0.5 },
                physics: { velocity: [0, 0, 0], spread: Math.PI, gravity: [0, 50, 0] },
                visual: { color: [1.0, 0.5, 0.2, 1.0], blendMode: 'additive' }
            },
            
            trail: {
                type: 'continuous',
                emission: { rate: 15, burst: 0 },
                particle: { size: 1.5, lifetime: 2.0, fadeIn: 0.0, fadeOut: 1.0 },
                physics: { velocity: [0, 0, 0], spread: 0, gravity: [0, 0, 0] },
                visual: { color: [0.8, 0.2, 1.0, 0.6], blendMode: 'alpha' }
            },
            
            // Audio-reactive effects
            beatPulse: {
                type: 'burst',
                emission: { rate: 0, burst: 15 },
                particle: { size: 3, lifetime: 1.0, fadeIn: 0.0, fadeOut: 0.7 },
                physics: { velocity: [0, -30, 0], spread: Math.PI / 4, gravity: [0, 20, 0] },
                visual: { color: [1.0, 0.2, 0.8, 0.9], blendMode: 'additive' },
                audioReactive: { property: 'beat', influence: 1.0 }
            },
            
            energyFlow: {
                type: 'continuous',
                emission: { rate: 20, burst: 0 },
                particle: { size: 2, lifetime: 3.0, fadeIn: 0.3, fadeOut: 1.5 },
                physics: { velocity: [0, -15, 0], spread: Math.PI / 8, gravity: [0, 5, 0] },
                visual: { color: [0.2, 1.0, 0.8, 0.7], blendMode: 'additive' },
                audioReactive: { property: 'energy', influence: 0.8 }
            },
            
            // UI state effects
            loading: {
                type: 'continuous',
                emission: { rate: 8, burst: 0 },
                particle: { size: 2.5, lifetime: 2.0, fadeIn: 0.5, fadeOut: 1.0 },
                physics: { velocity: [0, -25, 0], spread: 0, gravity: [0, 0, 0] },
                visual: { color: [0.6, 0.9, 1.0, 0.9], blendMode: 'additive' },
                pattern: 'orbital'
            },
            
            success: {
                type: 'burst',
                emission: { rate: 0, burst: 30 },
                particle: { size: 3, lifetime: 1.5, fadeIn: 0.0, fadeOut: 1.0 },
                physics: { velocity: [0, -40, 0], spread: Math.PI, gravity: [0, 30, 0] },
                visual: { color: [0.2, 1.0, 0.3, 1.0], blendMode: 'additive' }
            },
            
            error: {
                type: 'burst',
                emission: { rate: 0, burst: 20 },
                particle: { size: 4, lifetime: 1.0, fadeIn: 0.0, fadeOut: 0.6 },
                physics: { velocity: [0, -20, 0], spread: Math.PI / 2, gravity: [0, 40, 0] },
                visual: { color: [1.0, 0.2, 0.2, 1.0], blendMode: 'additive' }
            }
        };
        
        // Performance tracking
        this.performanceMetrics = {
            frameTime: 0,
            particleCount: 0,
            emitterCount: 0,
            drawCalls: 0,
            memoryUsage: 0,
            lastUpdate: 0
        };
        
        // Quality levels for adaptive performance
        this.qualityLevels = {
            low: {
                maxParticles: 500,
                particleSize: 0.7,
                emissionRate: 0.5,
                enablePhysics: false,
                blendMode: 'alpha'
            },
            medium: {
                maxParticles: 1000,
                particleSize: 0.85,
                emissionRate: 0.75,
                enablePhysics: true,
                blendMode: 'additive'
            },
            high: {
                maxParticles: 2000,
                particleSize: 1.0,
                emissionRate: 1.0,
                enablePhysics: true,
                blendMode: 'additive'
            }
        };
        
        this.currentQuality = 'high';
        this.isRendering = false;
        this.lastRenderTime = 0;
        
        // Bind methods to preserve context
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.renderLoop = this.renderLoop.bind(this);
        
        console.log('ParticleUI initialized', {
            webGL: this.config.enableWebGL,
            maxParticles: this.config.maxParticles,
            audioReactive: this.config.enableAudioReactivity
        });
        
        this.initializeSystem();
    }
    
    /**
     * Initialize the particle UI system
     */
    async initializeSystem() {
        try {
            // Initialize WebGL rendering if enabled
            if (this.config.enableWebGL) {
                await this.initializeWebGL();
            }
            
            // Initialize CSS fallback system
            if (this.config.enableCSS) {
                this.initializeCSSParticles();
            }
            
            // Initialize core subsystems
            this.initializeCoreSubsystems();
            
            // Setup interaction handlers
            this.setupInteractionHandlers();
            
            // Setup UI element observation
            if (this.config.autoAttachToElements) {
                this.setupElementObservation();
            }
            
            // Start render loop
            this.startRenderLoop();
            
            console.log('ParticleUI system initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize ParticleUI:', error);
            this.fallbackToCSS();
        }
    }
    
    /**
     * Initialize WebGL rendering system
     */
    async initializeWebGL() {
        try {
            // Create canvas for particle rendering
            this.canvas = document.createElement('canvas');
            this.canvas.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                pointer-events: none;
                z-index: 1000;
            `;
            document.body.appendChild(this.canvas);
            
            // Initialize WebGL context
            this.gl = webglUtils.createContext(this.canvas, {
                alpha: true,
                premultipliedAlpha: false,
                antialias: true
            });
            
            if (!this.gl) {
                throw new Error('Failed to create WebGL context');
            }
            
            // Initialize particle system
            this.particleSystem = new ParticleSystem({
                maxParticles: this.config.maxParticles,
                enableWebGL: true,
                enableAudioReactivity: this.config.enableAudioReactivity,
                updateMode: 'cpu'
            });
            
            await this.particleSystem.initialize(this.gl);
            
            // Create render program for particles
            await this.createParticleRenderProgram();
            
            // Setup WebGL state
            this.setupWebGLState();
            
            this.isWebGLEnabled = true;
            console.log('WebGL particle rendering initialized');
            
        } catch (error) {
            console.warn('WebGL initialization failed:', error);
            this.isWebGLEnabled = false;
            throw error;
        }
    }
    
    /**
     * Initialize CSS particle fallback system
     */
    initializeCSSParticles() {
        // Add CSS styles for CSS-based particles
        this.addCSSParticleStyles();
        
        // Create CSS particle container
        this.cssContainer = document.createElement('div');
        this.cssContainer.className = 'particle-ui-css-container';
        this.cssContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 999;
            overflow: hidden;
        `;
        document.body.appendChild(this.cssContainer);
        
        console.log('CSS particle fallback initialized');
    }
    
    /**
     * Initialize core subsystems
     */
    initializeCoreSubsystems() {
        // Initialize spring system for particle animations
        this.springSystem = new SpringSystem({
            enableAudioReactivity: this.config.enableAudioReactivity,
            targetFPS: this.config.targetFPS
        });
        
        // Start spring system
        this.springSystem.start();
    }
    
    /**
     * Create WebGL particle rendering program
     */
    async createParticleRenderProgram() {
        const vertexShaderSource = `
            attribute vec3 a_position;
            attribute vec4 a_color;
            attribute float a_size;
            attribute float a_rotation;
            attribute float a_opacity;
            
            uniform mat4 u_viewProjection;
            uniform vec2 u_resolution;
            uniform float u_pixelRatio;
            
            varying vec4 v_color;
            varying float v_opacity;
            varying float v_rotation;
            
            void main() {
                gl_Position = u_viewProjection * vec4(a_position, 1.0);
                gl_PointSize = a_size * u_pixelRatio;
                
                v_color = a_color;
                v_opacity = a_opacity;
                v_rotation = a_rotation;
            }
        `;
        
        const fragmentShaderSource = `
            precision highp float;
            
            varying vec4 v_color;
            varying float v_opacity;
            varying float v_rotation;
            
            uniform sampler2D u_texture;
            uniform float u_time;
            
            void main() {
                vec2 coord = gl_PointCoord;
                
                // Apply rotation
                if (v_rotation != 0.0) {
                    float s = sin(v_rotation);
                    float c = cos(v_rotation);
                    coord = vec2(
                        c * (coord.x - 0.5) - s * (coord.y - 0.5) + 0.5,
                        s * (coord.x - 0.5) + c * (coord.y - 0.5) + 0.5
                    );
                }
                
                // Sample texture
                vec4 textureColor = texture2D(u_texture, coord);
                
                // Apply color and opacity
                gl_FragColor = v_color * textureColor * v_opacity;
                
                // Discard transparent pixels
                if (gl_FragColor.a < 0.01) {
                    discard;
                }
            }
        `;
        
        // Compile shaders
        const vertexShader = webglUtils.compileShader(this.gl, vertexShaderSource, this.gl.VERTEX_SHADER, 'ParticleVertex');
        const fragmentShader = webglUtils.compileShader(this.gl, fragmentShaderSource, this.gl.FRAGMENT_SHADER, 'ParticleFragment');
        
        // Create and link program
        this.renderProgram = webglUtils.createProgram(this.gl, vertexShader, fragmentShader, 'ParticleProgram');
        
        // Get uniform and attribute locations
        this.programLocations = {
            // Attributes
            position: this.gl.getAttribLocation(this.renderProgram, 'a_position'),
            color: this.gl.getAttribLocation(this.renderProgram, 'a_color'),
            size: this.gl.getAttribLocation(this.renderProgram, 'a_size'),
            rotation: this.gl.getAttribLocation(this.renderProgram, 'a_rotation'),
            opacity: this.gl.getAttribLocation(this.renderProgram, 'a_opacity'),
            
            // Uniforms
            viewProjection: this.gl.getUniformLocation(this.renderProgram, 'u_viewProjection'),
            resolution: this.gl.getUniformLocation(this.renderProgram, 'u_resolution'),
            pixelRatio: this.gl.getUniformLocation(this.renderProgram, 'u_pixelRatio'),
            texture: this.gl.getUniformLocation(this.renderProgram, 'u_texture'),
            time: this.gl.getUniformLocation(this.renderProgram, 'u_time')
        };
        
        // Create default particle texture
        await this.createParticleTexture();
    }
    
    /**
     * Create default particle texture
     */
    async createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Create radial gradient for soft particle
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        // Create WebGL texture
        this.particleTexture = webglUtils.createTexture(this.gl, canvas, {
            generateMipmaps: true,
            flipY: true
        });
    }
    
    /**
     * Setup WebGL rendering state
     */
    setupWebGLState() {
        const gl = this.gl;
        
        // Enable blending for particle transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Enable depth testing but disable depth writes for particles
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        
        // Disable face culling for particles
        gl.disable(gl.CULL_FACE);
    }
    
    /**
     * Add CSS styles for CSS-based particles
     */
    addCSSParticleStyles() {
        const styleId = 'particle-ui-css-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .particle-ui-css-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                pointer-events: none;
                z-index: 999;
                overflow: hidden;
            }
            
            .css-particle {
                position: absolute;
                border-radius: 50%;
                pointer-events: none;
                will-change: transform, opacity;
                transform-origin: center;
            }
            
            .css-particle.additive {
                mix-blend-mode: screen;
            }
            
            .css-particle.glow {
                box-shadow: 0 0 10px currentColor;
                filter: blur(0.5px);
            }
            
            @keyframes sparkle {
                0% {
                    transform: scale(0) rotate(0deg);
                    opacity: 0;
                }
                50% {
                    transform: scale(1.2) rotate(180deg);
                    opacity: 1;
                }
                100% {
                    transform: scale(0) rotate(360deg);
                    opacity: 0;
                }
            }
            
            @keyframes trail {
                0% {
                    opacity: 1;
                    transform: scale(1);
                }
                100% {
                    opacity: 0;
                    transform: scale(0.1);
                }
            }
            
            @keyframes pulse {
                0% {
                    transform: scale(0);
                    opacity: 1;
                }
                50% {
                    transform: scale(1.5);
                    opacity: 0.8;
                }
                100% {
                    transform: scale(2);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Setup interaction event handlers
     */
    setupInteractionHandlers() {
        if (!this.config.enableMouseInteraction && !this.config.enableTouchInteraction) {
            return;
        }
        
        // Mouse events
        if (this.config.enableMouseInteraction) {
            document.addEventListener('mousemove', this.handleMouseMove, { passive: true });
            document.addEventListener('mousedown', this.handleMouseDown, { passive: true });
            document.addEventListener('mouseup', this.handleMouseUp, { passive: true });
        }
        
        // Touch events
        if (this.config.enableTouchInteraction) {
            document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
            document.addEventListener('touchmove', this.handleTouchMove, { passive: true });
            document.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        }
    }
    
    /**
     * Setup element observation for auto-attachment
     */
    setupElementObservation() {
        if (!this.config.watchForNewElements || typeof MutationObserver === 'undefined') {
            this.scanForElements();
            return;
        }
        
        this.elementObserver = new MutationObserver((mutations) => {
            let needsRescan = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            needsRescan = true;
                        }
                    });
                }
            });
            
            if (needsRescan) {
                this.scanForElements();
            }
        });
        
        this.elementObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this.scanForElements();
    }
    
    /**
     * Scan for elements to attach particle effects
     */
    scanForElements() {
        const elements = document.querySelectorAll(this.config.elementSelector);
        
        elements.forEach((element) => {
            if (!this.attachedElements.has(element)) {
                this.attachToElement(element);
            }
        });
    }
    
    // ===== PUBLIC API METHODS =====
    
    /**
     * Attach particle effects to a DOM element
     */
    attachToElement(element, effects = []) {
        if (this.attachedElements.has(element)) {
            console.warn('Element already has particle effects attached');
            return;
        }
        
        if (effects.length === 0) {
            effects = this.parseElementEffects(element);
        }
        
        const attachment = {
            element: element,
            effects: new Map(),
            emitters: new Map(),
            bounds: null,
            isActive: true,
            eventListeners: new Map()
        };
        
        effects.forEach((effectConfig) => {
            this.addEffectToElement(attachment, effectConfig);
        });
        
        this.setupElementEventListeners(attachment);
        this.attachedElements.set(element, attachment);
        
        console.log('Attached particle effects to element:', element, effects);
    }
    
    /**
     * Detach particle effects from element
     */
    detachFromElement(element) {
        const attachment = this.attachedElements.get(element);
        if (!attachment) return;
        
        attachment.emitters.forEach((emitter) => {
            this.stopEmitter(emitter.id);
        });
        
        this.removeElementEventListeners(attachment);
        this.attachedElements.delete(element);
        
        console.log('Detached particle effects from element:', element);
    }
    
    /**
     * Create a particle emitter
     */
    createEmitter(config = {}) {
        const emitterId = `emitter_${++this.emitterCounter}`;
        const emitterConfig = this.parseEmitterConfig(config);
        
        const emitter = {
            id: emitterId,
            ...emitterConfig,
            isActive: false,
            isPlaying: false,
            particleCount: 0,
            emissionTimer: 0,
            audioReactive: emitterConfig.audioReactive,
            audioProperty: emitterConfig.audioProperty,
            audioInfluence: emitterConfig.audioInfluence,
            lastEmission: 0,
            totalEmitted: 0
        };
        
        this.emitters.set(emitterId, emitter);
        
        console.log(`Particle emitter ${emitterId} created:`, emitterConfig.type);
        return emitterId;
    }
    
    /**
     * Start an emitter
     */
    startEmitter(emitterId) {
        const emitter = this.emitters.get(emitterId);
        if (!emitter) return false;
        
        emitter.isActive = true;
        emitter.isPlaying = true;
        emitter.emissionTimer = 0;
        
        return true;
    }
    
    /**
     * Stop an emitter
     */
    stopEmitter(emitterId) {
        const emitter = this.emitters.get(emitterId);
        if (!emitter) return false;
        
        emitter.isPlaying = false;
        return true;
    }
    
    /**
     * Emit particle burst at position
     */
    emitAt(x, y, z = 0, effectName = 'click', count = null) {
        const preset = this.effectPresets[effectName];
        if (!preset) {
            console.warn('Unknown effect preset:', effectName);
            return;
        }
        
        const emissionCount = count || preset.emission.burst || 10;
        
        if (this.isWebGLEnabled && this.particleSystem) {
            console.log('WebGL particle emission at:', x, y, z, effectName, emissionCount);
        } else {
            this.emitCSSParticles(x, y, preset, emissionCount);
        }
    }
    
    /**
     * Update audio state for reactive particles
     */
    updateAudioState(audioData) {
        if (!this.config.enableAudioReactivity) return;
        
        this.audioState.energy = audioData.energy || 0;
        this.audioState.bass = audioData.bass || 0;
        this.audioState.mid = audioData.mid || 0;
        this.audioState.treble = audioData.treble || 0;
        this.audioState.beat = audioData.beat || false;
        this.audioState.beatStrength = audioData.beatStrength || 0;
        
        if (audioData.spectrum) {
            this.audioState.spectrum.set(audioData.spectrum.slice(0, 64));
        }
        
        this.audioState.lastUpdate = performance.now();
        
        if (this.particleSystem && this.particleSystem.updateAudioInfluence) {
            this.particleSystem.updateAudioInfluence(audioData);
        }
        
        if (this.audioState.beat && this.audioState.beatStrength > 0.6) {
            this.triggerBeatEffects();
        }
    }
    
    // ===== INTERACTION HANDLERS =====
    
    handleMouseMove(event) {
        this.interactionState.mouse.x = event.clientX;
        this.interactionState.mouse.y = event.clientY;
        this.interactionState.lastInteraction = performance.now();
        
        if (this.interactionState.mouse.isDown) {
            this.emitAt(event.clientX, event.clientY, 0, 'trail', 2);
        }
    }
    
    handleMouseDown(event) {
        this.interactionState.mouse.isDown = true;
        this.interactionState.lastInteraction = performance.now();
        this.emitAt(event.clientX, event.clientY, 0, 'click');
    }
    
    handleMouseUp(event) {
        this.interactionState.mouse.isDown = false;
    }
    
    handleTouchStart(event) {
        Array.from(event.changedTouches).forEach((touch) => {
            this.interactionState.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startTime: performance.now()
            });
            
            this.emitAt(touch.clientX, touch.clientY, 0, 'click');
        });
        
        this.interactionState.lastInteraction = performance.now();
    }
    
    handleTouchMove(event) {
        Array.from(event.changedTouches).forEach((touch) => {
            const touchData = this.interactionState.touches.get(touch.identifier);
            if (touchData) {
                touchData.x = touch.clientX;
                touchData.y = touch.clientY;
                this.emitAt(touch.clientX, touch.clientY, 0, 'trail', 1);
            }
        });
        
        this.interactionState.lastInteraction = performance.now();
    }
    
    handleTouchEnd(event) {
        Array.from(event.changedTouches).forEach((touch) => {
            this.interactionState.touches.delete(touch.identifier);
        });
    }
    
    // ===== ELEMENT EFFECT MANAGEMENT =====
    
    parseElementEffects(element) {
        const effects = [];
        
        if (element.dataset.particleHover) {
            effects.push({
                trigger: 'hover',
                effect: element.dataset.particleHover || 'hover'
            });
        }
        
        if (element.dataset.particleClick) {
            effects.push({
                trigger: 'click',
                effect: element.dataset.particleClick || 'click'
            });
        }
        
        if (element.dataset.particleAudio) {
            effects.push({
                trigger: 'audio',
                effect: element.dataset.particleAudio || 'energyFlow',
                audioProperty: element.dataset.particleAudioProperty || 'energy'
            });
        }
        
        if (element.dataset.particleState) {
            effects.push({
                trigger: 'state',
                effect: element.dataset.particleState || 'loading',
                state: element.dataset.particleStateValue || 'active'
            });
        }
        
        return effects;
    }
    
    addEffectToElement(attachment, effectConfig) {
        const effectId = `effect_${attachment.element.id || 'anonymous'}_${effectConfig.trigger}`;
        const emitterConfig = this.createEmitterConfigFromEffect(effectConfig, attachment.element);
        const emitterId = this.createEmitter(emitterConfig);
        
        attachment.effects.set(effectConfig.trigger, {
            id: effectId,
            emitterId: emitterId,
            config: effectConfig,
            isActive: false
        });
        
        attachment.emitters.set(emitterId, {
            id: emitterId,
            trigger: effectConfig.trigger,
            element: attachment.element
        });
    }
    
    setupElementEventListeners(attachment) {
        const element = attachment.element;
        
        if (attachment.effects.has('hover')) {
            const mouseEnterHandler = (event) => {
                this.triggerElementEffect(attachment, 'hover', event);
            };
            
            const mouseLeaveHandler = (event) => {
                this.stopElementEffect(attachment, 'hover');
            };
            
            element.addEventListener('mouseenter', mouseEnterHandler);
            element.addEventListener('mouseleave', mouseLeaveHandler);
            
            attachment.eventListeners.set('mouseenter', mouseEnterHandler);
            attachment.eventListeners.set('mouseleave', mouseLeaveHandler);
        }
        
        if (attachment.effects.has('click')) {
            const clickHandler = (event) => {
                this.triggerElementEffect(attachment, 'click', event);
            };
            
            element.addEventListener('click', clickHandler);
            attachment.eventListeners.set('click', clickHandler);
        }
    }
    
    removeElementEventListeners(attachment) {
        if (attachment.eventListeners) {
            attachment.eventListeners.forEach((listener, event) => {
                attachment.element.removeEventListener(event, listener);
            });
            attachment.eventListeners.clear();
        }
    }
    
    triggerElementEffect(attachment, trigger, event = null) {
        const effect = attachment.effects.get(trigger);
        if (!effect) return;
        
        const bounds = attachment.element.getBoundingClientRect();
        const emitter = this.emitters.get(effect.emitterId);
        
        if (emitter) {
            emitter.position = [
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
                0
            ];
            
            this.startEmitter(effect.emitterId);
            effect.isActive = true;
            
            if (emitter.type === 'burst') {
                setTimeout(() => {
                    this.stopElementEffect(attachment, trigger);
                }, 100);
            }
        }
    }
    
    stopElementEffect(attachment, trigger) {
        const effect = attachment.effects.get(trigger);
        if (!effect || !effect.isActive) return;
        
        this.stopEmitter(effect.emitterId);
        effect.isActive = false;
    }
    
    createEmitterConfigFromEffect(effectConfig, element) {
        const preset = this.effectPresets[effectConfig.effect];
        if (!preset) {
            console.warn('Unknown effect preset:', effectConfig.effect);
            return this.effectPresets.hover;
        }
        
        const bounds = element.getBoundingClientRect();
        
        return {
            ...preset,
            position: [
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
                0
            ],
            bounds: {
                width: bounds.width,
                height: bounds.height
            },
            audioReactive: effectConfig.trigger === 'audio',
            audioProperty: effectConfig.audioProperty || 'energy'
        };
    }
    
    // ===== PARTICLE EMISSION =====
    
    emitCSSParticles(x, y, preset, count) {
        if (!this.cssContainer) return;
        
        for (let i = 0; i < count; i++) {
            const particle = this.createCSSParticle(x, y, preset, i);
            this.cssContainer.appendChild(particle);
            
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, (preset.particle.lifetime || 2) * 1000);
        }
    }
    
    createCSSParticle(x, y, preset, index) {
        const particle = document.createElement('div');
        particle.className = 'css-particle';
        
        const size = (preset.particle.size || 3) * this.getCurrentQualityMultiplier();
        const lifetime = preset.particle.lifetime || 2;
        const color = preset.visual.color || [1, 1, 1, 1];
        const spread = preset.physics.spread || 0;
        const velocity = preset.physics.velocity || [0, -20, 0];
        
        const angle = (Math.random() - 0.5) * spread;
        const speed = Math.random() * 0.5 + 0.5;
        const vx = velocity[0] + Math.cos(angle) * speed * 20;
        const vy = velocity[1] + Math.sin(angle) * speed * 20;
        
        particle.style.cssText = `
            left: ${x - size/2}px;
            top: ${y - size/2}px;
            width: ${size}px;
            height: ${size}px;
            background: rgba(${color[0]*255}, ${color[1]*255}, ${color[2]*255}, ${color[3]});
            transform: translate3d(0, 0, 0);
            opacity: 1;
            transition: transform ${lifetime}s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                       opacity ${lifetime}s ease-out;
        `;
        
        if (preset.visual.blendMode === 'additive') {
            particle.classList.add('additive');
        }
        
        if (preset.visual.glow) {
            particle.classList.add('glow');
        }
        
        requestAnimationFrame(() => {
            particle.style.transform = `translate3d(${vx * lifetime}px, ${vy * lifetime}px, 0) scale(0.1)`;
            particle.style.opacity = '0';
        });
        
        return particle;
    }
    
    // ===== AUDIO-REACTIVE EFFECTS =====
    
    triggerBeatEffects() {
        this.emitters.forEach((emitter) => {
            if (emitter.audioReactive && emitter.audioProperty === 'beat') {
                this.emitCSSParticles(
                    window.innerWidth / 2, 
                    window.innerHeight / 2, 
                    this.effectPresets.beatPulse, 
                    Math.floor(this.audioState.beatStrength * 15)
                );
            }
        });
        
        this.attachedElements.forEach((attachment) => {
            const beatEffect = attachment.effects.get('audio');
            if (beatEffect && beatEffect.config.audioProperty === 'beat') {
                this.triggerElementEffect(attachment, 'audio');
            }
        });
    }
    
    getAudioValue(property) {
        switch (property) {
            case 'energy': return this.audioState.energy;
            case 'bass': return this.audioState.bass;
            case 'mid': return this.audioState.mid;
            case 'treble': return this.audioState.treble;
            case 'beat': return this.audioState.beatStrength;
            case 'spectrum': {
                let sum = 0;
                for (let i = 0; i < this.audioState.spectrum.length; i++) {
                    sum += this.audioState.spectrum[i];
                }
                return sum / this.audioState.spectrum.length;
            }
            default: return this.audioState.energy;
        }
    }
    
    // ===== RENDERING =====
    
    startRenderLoop() {
        this.isRendering = true;
        this.renderLoop();
    }
    
    renderLoop() {
        if (!this.isRendering) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - (this.lastRenderTime || currentTime)) / 1000;
        this.lastRenderTime = currentTime;
        
        this.update(deltaTime);
        
        if (this.isWebGLEnabled) {
            this.renderWebGL(deltaTime);
        }
        
        this.updatePerformanceMetrics(currentTime);
        
        if (this.config.enableAdaptiveQuality) {
            this.updateAdaptiveQuality();
        }
        
        requestAnimationFrame(this.renderLoop);
    }
    
    update(deltaTime) {
        if (this.particleSystem && this.particleSystem.update) {
            this.particleSystem.update(deltaTime, this.audioState);
        }
        
        this.updateEmitters(deltaTime);
        this.updateElementAttachments(deltaTime);
    }
    
    updateEmitters(deltaTime) {
        this.emitters.forEach((emitter) => {
            if (!emitter.isPlaying) return;
            
            emitter.emissionTimer += deltaTime;
            
            if (emitter.audioReactive) {
                this.updateEmitterAudioReactivity(emitter);
            }
        });
    }
    
    updateEmitterAudioReactivity(emitter) {
        const audioValue = this.getAudioValue(emitter.audioProperty);
        const influence = emitter.audioInfluence * this.config.audioInfluence;
        
        if (emitter.emission && emitter.emission.rate) {
            const baseRate = emitter.emission.rate;
            emitter.emission.rate = baseRate * (1 + audioValue * influence);
        }
        
        if (emitter.particle && emitter.particle.size) {
            const baseSize = emitter.particle.size;
            emitter.particle.size = baseSize * (1 + audioValue * influence * 0.5);
        }
    }
    
    updateElementAttachments(deltaTime) {
        this.attachedElements.forEach((attachment) => {
            const newBounds = attachment.element.getBoundingClientRect();
            if (!this.boundsEqual(attachment.bounds, newBounds)) {
                attachment.bounds = newBounds;
                this.updateAttachmentEmitterPositions(attachment);
            }
            
            attachment.effects.forEach((effect) => {
                if (effect.config.trigger === 'audio' && effect.isActive) {
                    this.updateAudioReactiveEffect(effect);
                }
            });
        });
    }
    
    updateAttachmentEmitterPositions(attachment) {
        const bounds = attachment.bounds;
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        
        attachment.emitters.forEach((emitterRef) => {
            const emitter = this.emitters.get(emitterRef.id);
            if (emitter) {
                emitter.position = [centerX, centerY, 0];
            }
        });
    }
    
    updateAudioReactiveEffect(effect) {
        const emitter = this.emitters.get(effect.emitterId);
        if (!emitter) return;
        
        const audioValue = this.getAudioValue(effect.config.audioProperty || 'energy');
        
        if (audioValue > 0.3 && !effect.isActive) {
            this.startEmitter(effect.emitterId);
            effect.isActive = true;
        } else if (audioValue < 0.1 && effect.isActive) {
            this.stopEmitter(effect.emitterId);
            effect.isActive = false;
        }
    }
    
    renderWebGL(deltaTime) {
        if (!this.gl || !this.renderProgram) return;
        
        const gl = this.gl;
        
        this.updateCanvasSize();
        
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(this.renderProgram);
        this.setParticleUniforms(deltaTime);
        
        this.performanceMetrics.drawCalls++;
    }
    
    updateCanvasSize() {
        const width = window.innerWidth * window.devicePixelRatio;
        const height = window.innerHeight * window.devicePixelRatio;
        
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';
            
            this.gl.viewport(0, 0, width, height);
        }
    }
    
    setParticleUniforms(deltaTime) {
        const gl = this.gl;
        
        const viewProjection = MathUtils.mat4Identity();
        
        const left = -window.innerWidth / 2;
        const right = window.innerWidth / 2;
        const bottom = window.innerHeight / 2;
        const top = -window.innerHeight / 2;
        const near = -1000;
        const far = 1000;
        
        viewProjection[0] = 2 / (right - left);
        viewProjection[5] = 2 / (top - bottom);
        viewProjection[10] = -2 / (far - near);
        viewProjection[12] = -(right + left) / (right - left);
        viewProjection[13] = -(top + bottom) / (top - bottom);
        viewProjection[14] = -(far + near) / (far - near);
        viewProjection[15] = 1;
        
        gl.uniformMatrix4fv(this.programLocations.viewProjection, false, viewProjection);
        gl.uniform2f(this.programLocations.resolution, window.innerWidth, window.innerHeight);
        gl.uniform1f(this.programLocations.pixelRatio, window.devicePixelRatio);
        gl.uniform1f(this.programLocations.time, performance.now() * 0.001);
        
        if (this.particleTexture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.particleTexture);
            gl.uniform1i(this.programLocations.texture, 0);
        }
    }
    
    // ===== PERFORMANCE AND QUALITY =====
    
    updatePerformanceMetrics(currentTime) {
        const frameTime = currentTime - (this.performanceMetrics.lastUpdate || currentTime);
        this.performanceMetrics.frameTime = frameTime;
        this.performanceMetrics.particleCount = this.particleSystem ? 
            (this.particleSystem.getActiveParticleCount ? this.particleSystem.getActiveParticleCount() : 0) : 0;
        this.performanceMetrics.emitterCount = this.emitters.size;
        this.performanceMetrics.lastUpdate = currentTime;
        
        if (performanceMonitor && performanceMonitor.recordCPUTime) {
            performanceMonitor.recordCPUTime('particleUI', frameTime);
        }
    }
    
    updateAdaptiveQuality() {
        const currentFPS = 1000 / this.performanceMetrics.frameTime;
        
        if (currentFPS < this.config.lowPerformanceThreshold && this.currentQuality !== 'low') {
            this.setQualityLevel('low');
        } else if (currentFPS > this.config.highPerformanceThreshold && this.currentQuality !== 'high') {
            if (this.currentQuality === 'low') {
                this.setQualityLevel('medium');
            } else {
                this.setQualityLevel('high');
            }
        }
    }
    
    setQualityLevel(level) {
        if (!this.qualityLevels[level]) return;
        
        this.currentQuality = level;
        const quality = this.qualityLevels[level];
        
        if (this.particleSystem && this.particleSystem.setConfiguration) {
            this.particleSystem.setConfiguration({
                maxParticles: quality.maxParticles,
                enablePhysics: quality.enablePhysics
            });
        }
        
        this.emitters.forEach((emitter) => {
            if (emitter.emission) {
                emitter.emission.rate *= quality.emissionRate;
            }
            if (emitter.particle) {
                emitter.particle.size *= quality.particleSize;
            }
        });
        
        console.log(`Particle UI quality set to: ${level}`);
    }
    
    getCurrentQualityMultiplier() {
        const quality = this.qualityLevels[this.currentQuality];
        return quality ? quality.particleSize : 1.0;
    }
    
    // ===== UTILITY METHODS =====
    
    parseEmitterConfig(config) {
        return {
            type: config.type || 'continuous',
            position: config.position || [0, 0, 0],
            emission: config.emission || { rate: 10, burst: 0 },
            particle: config.particle || { size: 3, lifetime: 2 },
            physics: config.physics || { velocity: [0, -20, 0], spread: 0 },
            visual: config.visual || { color: [1, 1, 1, 1], blendMode: 'additive' },
            audioReactive: config.audioReactive === true,
            audioProperty: config.audioProperty || 'energy',
            audioInfluence: config.audioInfluence || 0.5
        };
    }
    
    boundsEqual(bounds1, bounds2) {
        if (!bounds1 || !bounds2) return false;
        
        return bounds1.left === bounds2.left &&
               bounds1.top === bounds2.top &&
               bounds1.width === bounds2.width &&
               bounds1.height === bounds2.height;
    }
    
    fallbackToCSS() {
        console.warn('WebGL not available, falling back to CSS particles');
        this.isWebGLEnabled = false;
        
        if (this.particleSystem && this.particleSystem.destroy) {
            this.particleSystem.destroy();
            this.particleSystem = null;
        }
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
            this.canvas = null;
        }
        
        if (!this.cssContainer) {
            this.initializeCSSParticles();
        }
    }
    
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            qualityLevel: this.currentQuality,
            isWebGLEnabled: this.isWebGLEnabled,
            attachedElements: this.attachedElements.size
        };
    }
    
    destroy() {
        this.isRendering = false;
        
        if (this.particleSystem && this.particleSystem.destroy) {
            this.particleSystem.destroy();
        }
        
        if (this.springSystem && this.springSystem.destroy) {
            this.springSystem.destroy();
        }
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        if (this.cssContainer && this.cssContainer.parentNode) {
            this.cssContainer.parentNode.removeChild(this.cssContainer);
        }
        
        if (this.handleMouseMove) {
            document.removeEventListener('mousemove', this.handleMouseMove);
        }
        if (this.handleMouseDown) {
            document.removeEventListener('mousedown', this.handleMouseDown);
        }
        if (this.handleMouseUp) {
            document.removeEventListener('mouseup', this.handleMouseUp);
        }
        if (this.handleTouchStart) {
            document.removeEventListener('touchstart', this.handleTouchStart);
        }
        if (this.handleTouchMove) {
            document.removeEventListener('touchmove', this.handleTouchMove);
        }
        if (this.handleTouchEnd) {
            document.removeEventListener('touchend', this.handleTouchEnd);
        }
        
        if (this.elementObserver) {
            this.elementObserver.disconnect();
        }
        
        this.attachedElements.forEach((attachment, element) => {
            this.detachFromElement(element);
        });
        
        this.emitters.clear();
        this.attachedElements.clear();
        
        const styleElement = document.getElementById('particle-ui-css-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        console.log('ParticleUI destroyed');
    }
}

// ===== PRESET CONFIGURATIONS =====

export const ParticlePresets = {
    buttonHover: {
        type: 'continuous',
        emission: { rate: 8, burst: 0 },
        particle: { size: 2, lifetime: 1.5, fadeIn: 0.2, fadeOut: 1.0 },
        physics: { velocity: [0, -15, 0], spread: Math.PI / 8, gravity: [0, 8, 0] },
        visual: { color: [0.3, 0.8, 1.0, 0.7], blendMode: 'additive' }
    },
    
    buttonClick: {
        type: 'burst',
        emission: { rate: 0, burst: 20 },
        particle: { size: 3, lifetime: 0.8, fadeIn: 0.0, fadeOut: 0.6 },
        physics: { velocity: [0, 0, 0], spread: Math.PI, gravity: [0, 40, 0] },
        visual: { color: [1.0, 0.6, 0.2, 1.0], blendMode: 'additive' }
    },
    
    beatVisualization: {
        type: 'burst',
        emission: { rate: 0, burst: 12 },
        particle: { size: 4, lifetime: 1.0, fadeIn: 0.0, fadeOut: 0.8 },
        physics: { velocity: [0, -25, 0], spread: Math.PI / 3, gravity: [0, 20, 0] },
        visual: { color: [1.0, 0.2, 0.8, 1.0], blendMode: 'additive' },
        audioReactive: { property: 'beat', influence: 1.0 }
    }
};

export class ParticleHelpers {
    constructor(particleUI) {
        this.particleUI = particleUI;
    }
    
    addHoverEffect(element, preset = 'buttonHover') {
        element.dataset.particleHover = preset;
        this.particleUI.attachToElement(element);
    }
    
    addClickEffect(element, preset = 'buttonClick') {
        element.dataset.particleClick = preset;
        this.particleUI.attachToElement(element);
    }
    
    addAudioEffect(element, preset = 'energyFlow', audioProperty = 'energy') {
        element.dataset.particleAudio = preset;
        element.dataset.particleAudioProperty = audioProperty;
        this.particleUI.attachToElement(element);
    }
    
    enableCursorTrail(preset = 'trail') {
        document.addEventListener('mousemove', (event) => {
            this.particleUI.emitAt(event.clientX, event.clientY, 0, preset, 1);
        });
    }
    
    showLoading(element, preset = 'loading') {
        const bounds = element.getBoundingClientRect();
        const emitterId = this.particleUI.createEmitter({
            ...ParticlePresets[preset] || this.particleUI.effectPresets.loading,
            position: [
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
                0
            ]
        });
        
        this.particleUI.startEmitter(emitterId);
        element._loadingEmitterId = emitterId;
        return emitterId;
    }
    
    hideLoading(element) {
        if (element._loadingEmitterId) {
            this.particleUI.stopEmitter(element._loadingEmitterId);
            delete element._loadingEmitterId;
        }
    }
    
    showSuccess(element, preset = 'success') {
        const bounds = element.getBoundingClientRect();
        this.particleUI.emitAt(
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
            0,
            preset
        );
    }
    
    showError(element, preset = 'error') {
        const bounds = element.getBoundingClientRect();
        this.particleUI.emitAt(
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
            0,
            preset
        );
    }
    
    enableBeatBackground(preset = 'beatVisualization') {
        const emitterId = this.particleUI.createEmitter({
            ...ParticlePresets[preset] || this.particleUI.effectPresets.beatPulse,
            position: [window.innerWidth / 2, window.innerHeight / 2, 0],
            audioReactive: true,
            audioProperty: 'beat'
        });
        
        this.particleUI.startEmitter(emitterId);
        return emitterId;
    }
}

export const particleUI = new ParticleUI();
export const particleHelpers = new ParticleHelpers(particleUI);

export { ParticleUI as ParticleUIClass };