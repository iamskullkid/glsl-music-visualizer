/**
 * UI Manager - Central UI Coordination System for GLSL Music Visualizer
 * Manages all UI components, layouts, and user interactions
 * Location: src/ui/UIManager.js
 *
 * Features:
 * - Central coordination of all UI components
 * - Layout management and responsive design
 * - Theme and styling coordination
 * - Event handling and component communication
 * - Performance monitoring and optimization
 * - Audio-reactive UI animations
 * - Accessibility and internationalization support
 * - Mobile and touch interface handling
 */

import { ControlPanel } from './components/ControlPanel.js';
import { SpringSystem } from './animations/SpringSystem.js';
import { MorphTransitions } from './animations/MorphTransitions.js';
import { particleUI } from './animations/ParticleUI.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class UIManager {
    constructor(options = {}) {
        // Configuration
        this.config = {
            // Core integrations
            audioEngine: options.audioEngine || null,
            renderEngine: options.renderEngine || null,
            visualizerManager: options.visualizerManager || null,
            materialManager: options.materialManager || null,
            
            // UI settings
            enableAdvancedUI: options.enableAdvancedUI !== false,
            enableMobileLayout: options.enableMobileLayout !== false,
            enableAccessibility: options.enableAccessibility !== false,
            enableInternationalization: options.enableInternationalization === true,
            
            // Visual effects
            enableParticleEffects: options.enableParticleEffects !== false,
            enableSpringAnimations: options.enableSpringAnimations !== false,
            enableMorphTransitions: options.enableMorphTransitions !== false,
            enableAudioReactivity: options.enableAudioReactivity !== false,
            
            // Performance
            enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
            adaptiveQuality: options.adaptiveQuality !== false,
            maxUIParticles: options.maxUIParticles || 300,
            uiUpdateFrequency: options.uiUpdateFrequency || 60,
            
            // Layout
            defaultLayout: options.defaultLayout || 'default',
            enableLayoutPersistence: options.enableLayoutPersistence !== false,
            enableResponsiveDesign: options.enableResponsiveDesign !== false,
            
            // Theming
            defaultTheme: options.defaultTheme || 'dark',
            enableThemePersistence: options.enableThemePersistence !== false,
            accentColor: options.accentColor || '#00f5ff',
            enableColorBlindnessSupport: options.enableColorBlindnessSupport === true,
            
            // Audio integration
            audioVisualizationLevel: options.audioVisualizationLevel || 0.7,
            enableBeatSync: options.enableBeatSync !== false,
            enableSpectrumDisplay: options.enableSpectrumDisplay !== false,
            
            // Input handling
            enableKeyboardShortcuts: options.enableKeyboardShortcuts !== false,
            enableTouchGestures: options.enableTouchGestures !== false,
            enableMouseInteraction: options.enableMouseInteraction !== false
        };
        
        // Component management
        this.components = {
            controlPanel: null
        };
        
        // UI state
        this.state = {
            isInitialized: false,
            currentTheme: this.config.defaultTheme,
            currentLayout: this.config.defaultLayout,
            isFullscreen: false,
            isMobile: window.innerWidth < 768,
            isVisible: true,
            performanceMode: 'auto',
            audioConnected: false,
            lastInteraction: Date.now()
        };
        
        // Animation systems
        this.animationSystems = {
            springs: null,
            morphs: null,
            particles: null
        };
        
        // Layout management
        this.layoutManager = {
            layouts: new Map(),
            breakpoints: {
                mobile: 768,
                tablet: 1024,
                desktop: 1440,
                ultrawide: 1920
            },
            currentBreakpoint: this.calculateBreakpoint(),
            resizeObserver: null,
            orientationObserver: null
        };
        
        // Theme management
        this.themeManager = {
            themes: new Map(),
            currentTheme: this.config.defaultTheme,
            colorScheme: 'dark',
            accentColor: this.config.accentColor,
            systemPreference: window.matchMedia('(prefers-color-scheme: dark)').matches
        };
        
        // Input handling
        this.inputManager = {
            keyboard: new Map(),
            mouse: { x: 0, y: 0, buttons: 0 },
            touch: new Map(),
            gestureRecognizer: null,
            keyboardShortcuts: new Map()
        };
        
        // Performance tracking
        this.performanceTracker = {
            uiFrameRate: 60,
            uiUpdateTime: 0,
            animationLoad: 0,
            memoryUsage: 0,
            lastUpdate: 0,
            adaptiveQualityEnabled: false
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
            features: {},
            isAnalyzing: false,
            lastUpdate: 0
        };
        
        // Event system
        this.eventBus = {
            listeners: new Map(),
            eventQueue: [],
            isProcessing: false
        };
        
        // Accessibility
        this.accessibility = {
            screenReader: null,
            highContrast: false,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            fontSize: 'normal',
            focusManager: null
        };
        
        // Internationalization
        this.i18n = {
            currentLanguage: 'en',
            translations: new Map(),
            formatters: new Map(),
            rtl: false
        };
        
        // Component callbacks
        this.callbacks = {
            onInitialized: options.onInitialized || null,
            onThemeChange: options.onThemeChange || null,
            onLayoutChange: options.onLayoutChange || null,
            onParameterChange: options.onParameterChange || null,
            onError: options.onError || null
        };
        
        // Bound methods
        this.handleResize = this.handleResize.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleAudioUpdate = this.handleAudioUpdate.bind(this);
        this.updateUI = this.updateUI.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        console.log('UIManager initialized', {
            theme: this.config.defaultTheme,
            layout: this.config.defaultLayout,
            mobile: this.state.isMobile,
            audioReactivity: this.config.enableAudioReactivity
        });
    }
    
    /**
     * Initialize the UI manager and all subsystems
     */
    async initialize() {
        try {
            console.log('UIManager initializing...');
            
            // Initialize animation systems
            await this.initializeAnimationSystems();
            
            // Initialize theme system
            await this.initializeThemeSystem();
            
            // Initialize layout management
            this.initializeLayoutManager();
            
            // Initialize input handling
            this.initializeInputHandling();
            
            // Initialize accessibility features
            if (this.config.enableAccessibility) {
                this.initializeAccessibility();
            }
            
            // Initialize internationalization
            if (this.config.enableInternationalization) {
                await this.initializeI18n();
            }
            
            // Initialize performance monitoring
            if (this.config.enablePerformanceMonitoring) {
                this.initializePerformanceMonitoring();
            }
            
            // Initialize main control panel
            await this.initializeControlPanel();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load persisted settings
            await this.loadPersistedSettings();
            
            // Start UI update loop
            this.startUIUpdateLoop();
            
            this.state.isInitialized = true;
            
            console.log('UIManager initialization complete');
            
            // Trigger initialization callback
            if (this.callbacks.onInitialized) {
                this.callbacks.onInitialized(this);
            }
            
        } catch (error) {
            console.error('Failed to initialize UIManager:', error);
            this.handleError('initialization', error);
            throw error;
        }
    }
    
    /**
     * Initialize animation systems
     */
    async initializeAnimationSystems() {
        // Initialize SpringSystem
        this.animationSystems.springs = new SpringSystem({
            enableAudioReactivity: this.config.enableAudioReactivity,
            targetFPS: this.config.uiUpdateFrequency,
            audioInfluence: this.config.audioVisualizationLevel * 0.3
        });
        
        // Initialize MorphTransitions
        this.animationSystems.morphs = new MorphTransitions({
            enableAudioReactivity: this.config.enableAudioReactivity,
            audioInfluence: this.config.audioVisualizationLevel * 0.2
        });
        
        // Initialize ParticleUI
        if (this.config.enableParticleEffects) {
            this.animationSystems.particles = particleUI;
            await this.animationSystems.particles.initialize();
        }
        
        console.log('Animation systems initialized');
    }
    
    /**
     * Initialize theme management system
     */
    async initializeThemeSystem() {
    // Try to load themes from JSON first
    const themeConfig = await this.loadThemesFromJSON();
    
    if (!themeConfig) {
        // Fallback to built-in themes if JSON loading failed
        this.initializeBuiltInThemes();
    }
    
    // Setup system theme preference listener
    if (themeConfig?.systemThemeDetection) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', this.handleSystemThemeChange.bind(this));
        this.themeManager.systemPreference = mediaQuery.matches;
    }
    
    // Setup reduced motion preference listener
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionQuery.addEventListener('change', this.handleReducedMotionChange.bind(this));
    this.accessibility.reducedMotion = reducedMotionQuery.matches;
    
    // Apply initial theme
    const initialTheme = this.config.defaultTheme;
    this.setTheme(initialTheme);
    
    console.log('Advanced theme system initialized');
}
    
    /**
     * Initialize layout management
     */
    initializeLayoutManager() {
        // Setup resize observer
        if (window.ResizeObserver) {
            this.layoutManager.resizeObserver = new ResizeObserver(this.handleResize);
            this.layoutManager.resizeObserver.observe(document.documentElement);
        }
        
        // Setup orientation change observer
        if (screen.orientation) {
            screen.orientation.addEventListener('change', this.handleOrientationChange.bind(this));
        }
        
        // Calculate initial breakpoint
        this.layoutManager.currentBreakpoint = this.calculateBreakpoint();
        
        console.log('Layout manager initialized');
    }
    
    /**
     * Initialize input handling
     */
    initializeInputHandling() {
        // Setup keyboard shortcuts
        if (this.config.enableKeyboardShortcuts) {
            this.setupKeyboardShortcuts();
        }
        
        // Setup gesture recognition
        if (this.config.enableTouchGestures && 'ontouchstart' in window) {
            this.setupGestureRecognition();
        }
        
        console.log('Input handling initialized');
    }
    
    /**
     * Initialize accessibility features
     */
    initializeAccessibility() {
        // Check for screen reader
        this.accessibility.screenReader = this.detectScreenReader();
        
        // Check for high contrast preference
        this.accessibility.highContrast = window.matchMedia('(prefers-contrast: high)').matches;
        
        // Setup focus management
        this.accessibility.focusManager = this.createFocusManager();
        
        // Apply accessibility settings
        this.applyAccessibilitySettings();
        
        console.log('Accessibility features initialized');
    }
    
    /**
     * Initialize internationalization
     */
    async initializeI18n() {
        // Detect user language
        const userLanguage = navigator.language.split('-')[0];
        this.i18n.currentLanguage = userLanguage;
        
        // Load translations for detected language
        try {
            await this.loadTranslations(userLanguage);
        } catch (error) {
            console.warn(`Failed to load translations for ${userLanguage}, falling back to English`);
            await this.loadTranslations('en');
        }
        
        // Setup RTL support
        this.i18n.rtl = ['ar', 'he', 'fa', 'ur'].includes(userLanguage);
        
        console.log('Internationalization initialized');
    }
    
    /**
     * Initialize performance monitoring
     */
    initializePerformanceMonitoring() {
        // Setup performance tracking
        setInterval(() => {
            this.updatePerformanceMetrics();
        }, 1000);
        
        // Setup adaptive quality
        if (this.config.adaptiveQuality) {
            this.enableAdaptiveQuality();
        }
        
        console.log('Performance monitoring initialized');
    }
    
    /**
     * Initialize main control panel
     */
    async initializeControlPanel() {
        this.components.controlPanel = new ControlPanel({
            audioEngine: this.config.audioEngine,
            renderEngine: this.config.renderEngine,
            visualizerManager: this.config.visualizerManager,
            materialManager: this.config.materialManager,
            
            theme: this.state.currentTheme,
            accentColor: this.themeManager.accentColor,
            
            enableParticleEffects: this.config.enableParticleEffects,
            enableSpringAnimations: this.config.enableSpringAnimations,
            enableAudioReactivity: this.config.enableAudioReactivity,
            enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
            
            onLayoutChange: this.handleLayoutChange.bind(this),
            onParameterChange: this.handleParameterChange.bind(this)
        });
        
        await this.components.controlPanel.initialize();
        
        console.log('Control panel initialized');
    }
    
    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Window events
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('keydown', this.handleKeydown);
        window.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Fullscreen events
        document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
        
        // Theme preference changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', 
            this.handleSystemThemeChange.bind(this));
        
        // Reduced motion preference
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',
            this.handleReducedMotionChange.bind(this));
        
        console.log('Event listeners setup complete');
    }
    
    /**
     * Start UI update loop
     */
    startUIUpdateLoop() {
        const updateLoop = () => {
            this.updateUI();
            requestAnimationFrame(updateLoop);
        };
        
        requestAnimationFrame(updateLoop);
        console.log('UI update loop started');
    }
    
    /**
     * Main UI update method
     */
    updateUI() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.performanceTracker.lastUpdate) / 1000;
        
        // Update animation systems
        if (this.animationSystems.springs) {
            this.animationSystems.springs.update(deltaTime);
        }
        
        // Update audio-reactive elements
        if (this.config.enableAudioReactivity && this.audioState.isAnalyzing) {
            this.updateAudioReactiveElements();
        }
        
        // Update performance metrics
        this.performanceTracker.lastUpdate = currentTime;
        this.performanceTracker.uiUpdateTime = performance.now() - currentTime;
    }
    
    /**
     * Handle audio data updates
     */
    handleAudioUpdate(audioData) {
        if (!audioData) return;
        
        // Update audio state
        this.audioState = {
            ...this.audioState,
            energy: audioData.energy || 0,
            bass: audioData.bass || 0,
            mid: audioData.mid || 0,
            treble: audioData.treble || 0,
            beat: audioData.beat || false,
            beatStrength: audioData.beatStrength || 0,
            spectrum: audioData.spectrum || this.audioState.spectrum,
            features: audioData.features || {},
            isAnalyzing: true,
            lastUpdate: performance.now()
        };
        
        // Forward to control panel
        if (this.components.controlPanel) {
            this.components.controlPanel.handleAudioUpdate(audioData);
        }
        
        // Update CSS variables for audio reactivity
        this.updateAudioCSSVariables();
    }
    
    /**
     * Update CSS variables for audio reactivity
     */
    updateAudioCSSVariables() {
        const root = document.documentElement;
        root.style.setProperty('--ui-audio-energy', this.audioState.energy);
        root.style.setProperty('--ui-audio-bass', this.audioState.bass);
        root.style.setProperty('--ui-audio-mid', this.audioState.mid);
        root.style.setProperty('--ui-audio-treble', this.audioState.treble);
        root.style.setProperty('--ui-audio-beat', this.audioState.beat ? 1 : 0);
        root.style.setProperty('--ui-beat-strength', this.audioState.beatStrength);
    }
    
    /**
     * Update audio-reactive UI elements
     */
    updateAudioReactiveElements() {
        const elements = document.querySelectorAll('.audio-reactive');
        
        elements.forEach(element => {
            const reactivity = parseFloat(element.dataset.audioReactivity || '1.0');
            const type = element.dataset.audioType || 'energy';
            
            let value = 0;
            switch (type) {
                case 'bass':
                    value = this.audioState.bass;
                    break;
                case 'mid':
                    value = this.audioState.mid;
                    break;
                case 'treble':
                    value = this.audioState.treble;
                    break;
                case 'beat':
                    value = this.audioState.beatStrength;
                    break;
                default:
                    value = this.audioState.energy;
            }
            
            // Apply audio-reactive styling
            const intensity = value * reactivity;
            element.style.setProperty('--audio-intensity', intensity);
            
            // Optional: Add beat pulse class
            if (this.audioState.beat && type === 'beat') {
                element.classList.add('beat-pulse');
                setTimeout(() => element.classList.remove('beat-pulse'), 100);
            }
        });
    }
    
    /**
     * Event Handlers
     */
    
    handleResize() {
        const wasMobile = this.state.isMobile;
        const newBreakpoint = this.calculateBreakpoint();
        
        this.state.isMobile = window.innerWidth < this.layoutManager.breakpoints.mobile;
        this.layoutManager.currentBreakpoint = newBreakpoint;
        
        // Handle mobile/desktop transition
        if (wasMobile !== this.state.isMobile) {
            this.handleMobileTransition();
        }
        
        // Update layout
        if (this.components.controlPanel) {
            this.components.controlPanel.handleResize();
        }
        
        console.log(`Breakpoint changed to: ${newBreakpoint}`);
    }
    
    handleKeydown(event) {
        // Handle keyboard shortcuts
        if (this.config.enableKeyboardShortcuts) {
            this.processKeyboardShortcut(event);
        }
        
        // Forward to control panel
        if (this.components.controlPanel) {
            this.components.controlPanel.handleKeyboardInput(event);
        }
        
        // Update last interaction time
        this.state.lastInteraction = Date.now();
    }
    
    handleMouseMove(event) {
        this.inputManager.mouse.x = event.clientX;
        this.inputManager.mouse.y = event.clientY;
        
        // Update last interaction time
        this.state.lastInteraction = Date.now();
    }
    
    handleVisibilityChange() {
        this.state.isVisible = !document.hidden;
        
        if (this.state.isVisible) {
            // Resume animations
            this.resumeAnimations();
        } else {
            // Pause non-essential animations
            this.pauseAnimations();
        }
    }
    
    handleFullscreenChange() {
        this.state.isFullscreen = !!document.fullscreenElement;
        
        // Update layout for fullscreen
        if (this.components.controlPanel) {
            this.components.controlPanel.state.isFullscreen = this.state.isFullscreen;
        }
    }
    
    handleSystemThemeChange(event) {
        this.themeManager.systemPreference = event.matches;
        
        // Auto-switch theme if using system preference
        if (this.config.followSystemTheme) {
            this.setTheme(event.matches ? 'dark' : 'light');
        }
    }
    
    handleReducedMotionChange(event) {
        this.accessibility.reducedMotion = event.matches;
        this.updateAnimationSettings();
    }
    
    handleLayoutChange(layoutId, layout) {
        this.state.currentLayout = layoutId;
        
        // Persist layout change
        if (this.config.enableLayoutPersistence) {
            this.persistSetting('layout', layoutId);
        }
        
        // Trigger callback
        if (this.callbacks.onLayoutChange) {
            this.callbacks.onLayoutChange(layoutId, layout);
        }
    }
    
    handleParameterChange(parameter, value, source) {
        // Forward parameter changes to appropriate systems
        switch (source) {
            case 'audio':
                if (this.config.audioEngine) {
                    this.config.audioEngine.setParameter(parameter, value);
                }
                break;
            case 'material':
                if (this.config.materialManager) {
                    this.config.materialManager.setProperty(parameter, value);
                }
                break;
            case 'visual':
                if (this.config.renderEngine) {
                    this.config.renderEngine.setParameter(parameter, value);
                }
                break;
        }
        
        // Trigger callback
        if (this.callbacks.onParameterChange) {
            this.callbacks.onParameterChange(parameter, value, source);
        }
    }
    
    /**
     * Public API Methods
     */
    
    setTheme(themeId) {
        const theme = this.themeManager.themes.get(themeId);
        if (!theme) {
            console.warn(`Theme ${themeId} not found`);
            return;
        }
        
        this.state.currentTheme = themeId;
        this.themeManager.currentTheme = themeId;
        
        // Apply theme to DOM
        this.applyTheme(theme);
        
        // Update control panel theme
        if (this.components.controlPanel) {
            this.components.controlPanel.setTheme(themeId);
        }
        
        // Persist theme change
        if (this.config.enableThemePersistence) {
            this.persistSetting('theme', themeId);
        }
        
        // Trigger callback
        if (this.callbacks.onThemeChange) {
            this.callbacks.onThemeChange(themeId, theme);
        }
        
        console.log(`Theme changed to: ${themeId}`);
    }
    
    setLayout(layoutId) {
        if (this.components.controlPanel) {
            this.components.controlPanel.setLayout(layoutId);
        }
    }
    
    setAudioEngine(audioEngine) {
        this.config.audioEngine = audioEngine;
        
        if (this.components.controlPanel) {
            this.components.controlPanel.setAudioEngine(audioEngine);
        }
        
        this.state.audioConnected = !!audioEngine;
    }
    
    setAccentColor(color) {
        this.themeManager.accentColor = color;
        
        // Update CSS variables
        document.documentElement.style.setProperty('--accent-color', color);
        
        // Update control panel
        if (this.components.controlPanel) {
            this.components.controlPanel.config.accentColor = color;
        }
    }
    
    /**
     * Utility Methods
     */
    
    calculateBreakpoint() {
        const width = window.innerWidth;
        const breakpoints = this.layoutManager.breakpoints;
        
        if (width < breakpoints.mobile) return 'mobile';
        if (width < breakpoints.tablet) return 'tablet';
        if (width < breakpoints.desktop) return 'desktop';
        return 'ultrawide';
    }
    
    /**
     * Load themes from JSON configuration
     */
    async loadThemesFromJSON() {
        try {
            const response = await fetch('assets/presets/global/ui-themes.json');
            if (!response.ok) {
                throw new Error(`Failed to load ui-themes.json: ${response.status}`);
            }
            
            const themeConfig = await response.json();
            
            // Store theme configuration
            this.themeConfig = themeConfig;
            
            // Load all themes from JSON
            Object.entries(themeConfig.themes).forEach(([themeId, themeData]) => {
                this.themeManager.themes.set(themeId, themeData);
            });
            
            // Set default theme from config
            this.config.defaultTheme = themeConfig.defaultTheme || 'cyberpunk_neon';
            
            console.log(`Loaded ${Object.keys(themeConfig.themes).length} themes from JSON`);
            
            return themeConfig;
        } catch (error) {
            console.warn('Failed to load themes from JSON, using built-in themes:', error);
            
            // Fallback to built-in themes
            this.initializeBuiltInThemes();
            return null;
        }
    }

    /**
     * Initialize built-in themes as fallback
     */
    initializeBuiltInThemes() {
        const darkTheme = {
            id: 'dark_fallback',
            name: 'Dark (Fallback)',
            colors: {
                primary: {
                    background: '#0a0a0a',
                    surface: '#1a1a1a',
                    elevated: '#2a2a2a',
                    accent: '#3a3a3a'
                },
                text: {
                    primary: '#ffffff',
                    secondary: '#cccccc',
                    muted: '#999999',
                    disabled: '#666666'
                },
                accent: {
                    primary: this.config.accentColor,
                    secondary: '#357ABD',
                    tertiary: '#2E5A87'
                },
                glass: {
                    primary: 'rgba(255, 255, 255, 0.1)',
                    secondary: 'rgba(255, 255, 255, 0.05)',
                    accent: 'rgba(74, 144, 226, 0.12)',
                    border: 'rgba(255, 255, 255, 0.16)',
                    shadow: 'rgba(0, 0, 0, 0.25)'
                }
            }
        };
        
        this.themeManager.themes.set('dark_fallback', darkTheme);
    }

    /**
     * Enhanced theme application method that handles nested theme structure
     */
    applyTheme(theme) {
        const root = document.documentElement;
        
        if (!theme || !theme.colors) {
            console.warn('Invalid theme structure:', theme);
            return;
        }
        
        // Helper function to flatten nested objects with prefix
        const flattenColors = (obj, prefix = '') => {
            const flattened = {};
            
            for (const [key, value] of Object.entries(obj)) {
                const newKey = prefix ? `${prefix}-${key}` : key;
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Recursively flatten nested objects
                    Object.assign(flattened, flattenColors(value, newKey));
                } else {
                    // Set the CSS variable
                    flattened[newKey] = value;
                    root.style.setProperty(`--theme-${newKey}`, value);
                }
            }
            
            return flattened;
        };
        
        // Flatten and apply color variables
        const flattenedColors = flattenColors(theme.colors);
        
        // Apply additional theme properties if they exist
        if (theme.effects) {
            Object.entries(theme.effects).forEach(([category, values]) => {
                if (typeof values === 'object') {
                    Object.entries(values).forEach(([key, value]) => {
                        root.style.setProperty(`--theme-effect-${category}-${key}`, value);
                    });
                } else {
                    root.style.setProperty(`--theme-effect-${category}`, values);
                }
            });
        }
        
        // Apply accessibility settings
        if (theme.accessibility) {
            root.classList.toggle('reduced-motion', theme.accessibility.reducedMotion);
            root.classList.toggle('high-contrast', theme.accessibility.highContrast);
            root.setAttribute('data-contrast-ratio', theme.accessibility.contrastRatio || 'AA');
        }
        
        // Apply audio-reactive settings
        if (theme.audioReactive && this.config.enableAudioReactivity) {
            this.setupAudioReactiveTheme(theme.audioReactive);
        }
        
        // Apply theme class to body
        document.body.className = document.body.className.replace(/theme-[\w-]+/g, '');
        document.body.classList.add(`theme-${theme.id}`);
        
        // Store flattened colors for component access
        this.themeManager.currentColors = flattenedColors;
        
        console.log(`Applied theme: ${theme.name} (${theme.id})`);
    }

    /**
     * Setup audio-reactive theme features
     */
    setupAudioReactiveTheme(audioReactiveConfig) {
        if (!this.config.audioEngine) return;
        
        this.audioReactiveTheme = {
            config: audioReactiveConfig,
            isActive: true,
            lastUpdate: 0,
            smoothingFactor: this.themeConfig?.integration?.audioReactiveIntegration?.smoothingFactor || 0.8
        };
        
        // Setup audio data listener
        if (this.config.audioEngine.addEventListener) {
            this.config.audioEngine.addEventListener('audioData', (audioData) => {
                this.updateAudioReactiveTheme(audioData);
            });
        }
    }

    /**
     * Update theme colors based on audio data
     */
    updateAudioReactiveTheme(audioData) {
        if (!this.audioReactiveTheme?.isActive) return;
        
        const now = Date.now();
        const deltaTime = now - this.audioReactiveTheme.lastUpdate;
        
        // Throttle updates to 60fps
        if (deltaTime < 16) return;
        
        const config = this.audioReactiveTheme.config;
        const root = document.documentElement;
        
        // Update color shifts based on frequency bands
        if (config.colorShift && audioData.frequencyBands) {
            const { bass, mid, treble } = audioData.frequencyBands;
            
            // Apply smoothing
            const smoothing = this.audioReactiveTheme.smoothingFactor;
            
            // Update CSS variables with audio-reactive values
            if (config.colorShift.bass) {
                const bassHue = config.colorShift.bass.hue + (bass * 60);
                const bassSat = Math.min(config.colorShift.bass.saturation * (1 + bass), 2.0);
                root.style.setProperty('--audio-bass-hue', `${bassHue}deg`);
                root.style.setProperty('--audio-bass-saturation', `${bassSat * 100}%`);
            }
            
            if (config.colorShift.mid) {
                const midHue = config.colorShift.mid.hue + (mid * 60);
                const midSat = Math.min(config.colorShift.mid.saturation * (1 + mid), 2.0);
                root.style.setProperty('--audio-mid-hue', `${midHue}deg`);
                root.style.setProperty('--audio-mid-saturation', `${midSat * 100}%`);
            }
            
            if (config.colorShift.treble) {
                const trebleHue = config.colorShift.treble.hue + (treble * 60);
                const trebleSat = Math.min(config.colorShift.treble.saturation * (1 + treble), 2.0);
                root.style.setProperty('--audio-treble-hue', `${trebleHue}deg`);
                root.style.setProperty('--audio-treble-saturation', `${trebleSat * 100}%`);
            }
        }
        
        // Update glow intensity
        if (config.glowIntensity && audioData.energy) {
            const glowMin = config.glowIntensity.min;
            const glowMax = config.glowIntensity.max;
            const responsiveness = config.glowIntensity.responsiveness;
            
            const glowIntensity = glowMin + (audioData.energy * responsiveness * (glowMax - glowMin));
            root.style.setProperty('--audio-glow-intensity', glowIntensity);
        }
        
        // Update particle emission if enabled
        if (config.particleEmission?.enabled && this.animationSystems.particles) {
            const densityMultiplier = config.particleEmission.densityMultiplier || 1.0;
            const particleCount = Math.floor(audioData.energy * densityMultiplier * 100);
            
            this.animationSystems.particles.setEmissionRate(particleCount);
            
            if (config.particleEmission.colorSync) {
                this.animationSystems.particles.setAudioColors({
                    bass: `hsl(${root.style.getPropertyValue('--audio-bass-hue')}, ${root.style.getPropertyValue('--audio-bass-saturation')}, 60%)`,
                    mid: `hsl(${root.style.getPropertyValue('--audio-mid-hue')}, ${root.style.getPropertyValue('--audio-mid-saturation')}, 60%)`,
                    treble: `hsl(${root.style.getPropertyValue('--audio-treble-hue')}, ${root.style.getPropertyValue('--audio-treble-saturation')}, 60%)`
                });
            }
        }
        
        this.audioReactiveTheme.lastUpdate = now;
    }

    /**
     * Enhanced setTheme method with validation and fallbacks
     */
    setTheme(themeId) {
        // Validate theme exists
        const theme = this.themeManager.themes.get(themeId);
        if (!theme) {
            console.warn(`Theme ${themeId} not found, falling back to default`);
            
            // Try fallback themes
            const fallbacks = ['cyberpunk_neon', 'dark_professional', 'dark_fallback'];
            for (const fallbackId of fallbacks) {
                const fallbackTheme = this.themeManager.themes.get(fallbackId);
                if (fallbackTheme) {
                    this.setTheme(fallbackId);
                    return;
                }
            }
            
            console.error('No valid themes available');
            return;
        }
        
        // Check accessibility requirements
        if (this.accessibility.reducedMotion && theme.accessibility?.epilepsyWarning) {
            console.warn(`Theme ${themeId} may cause seizures, applying reduced motion`);
            document.documentElement.classList.add('force-reduced-motion');
        }
        
        // Update state
        this.state.currentTheme = themeId;
        this.themeManager.currentTheme = themeId;
        
        // Apply theme to DOM
        this.applyTheme(theme);
        
        // Update control panel theme
        if (this.components.controlPanel) {
            this.components.controlPanel.setTheme(themeId);
        }
        
        // Update material system integration if available
        if (this.config.materialManager && theme.colors.accent) {
            this.config.materialManager.setAccentColor(theme.colors.accent.primary);
        }
        
        // Persist theme change
        if (this.config.enableThemePersistence) {
            this.persistSetting('theme', themeId);
        }
        
        // Trigger callback
        if (this.callbacks.onThemeChange) {
            this.callbacks.onThemeChange(themeId, theme);
        }
        
        console.log(`Theme changed to: ${theme.name} (${themeId})`);
    }

    /**
     * Get available themes with categories
     */
    getAvailableThemes() {
        const themes = [];
        
        for (const [themeId, theme] of this.themeManager.themes) {
            themes.push({
                id: themeId,
                name: theme.name,
                category: theme.category || 'uncategorized',
                description: theme.description || '',
                preview: theme.preview || theme.colors?.accent?.primary || '#ffffff',
                supportedFeatures: theme.supportedFeatures || []
            });
        }
        
        return themes;
    }

    /**
     * Get themes grouped by category
     */
    getThemesByCategory() {
        const categories = {};
        
        for (const [themeId, theme] of this.themeManager.themes) {
            const category = theme.category || 'uncategorized';
            
            if (!categories[category]) {
                categories[category] = {
                    name: this.themeConfig?.themeCategories?.[category]?.name || category,
                    description: this.themeConfig?.themeCategories?.[category]?.description || '',
                    themes: []
                };
            }
            
            categories[category].themes.push({
                id: themeId,
                name: theme.name,
                description: theme.description || '',
                preview: theme.preview || theme.colors?.accent?.primary || '#ffffff'
            });
        }
        
        return categories;
    }

    /**
     * Performance optimization for theme switching
     */
    enablePerformanceMode() {
        document.documentElement.classList.add('performance-mode');
        
        // Disable audio-reactive features in performance mode
        if (this.audioReactiveTheme) {
            this.audioReactiveTheme.isActive = false;
        }
        
        // Reduce particle count
        if (this.animationSystems.particles) {
            this.animationSystems.particles.setMaxParticles(50);
        }
        
        console.log('Theme performance mode enabled');
    }

    /**
     * Disable performance mode and restore full theme features
     */
    disablePerformanceMode() {
        document.documentElement.classList.remove('performance-mode');
        
        // Re-enable audio-reactive features
        if (this.audioReactiveTheme) {
            this.audioReactiveTheme.isActive = true;
        }
        
        // Restore full particle effects
        if (this.animationSystems.particles) {
            this.animationSystems.particles.setMaxParticles(this.config.maxUIParticles);
        }
        
        console.log('Theme performance mode disabled');
    }
    
    updatePerformanceMetrics() {
        if (performanceMonitor) {
            const metrics = performanceMonitor.getMetrics();
            
            this.performanceTracker = {
                ...this.performanceTracker,
                uiFrameRate: metrics.uiFrameRate || 60,
                animationLoad: metrics.animationLoad || 0,
                memoryUsage: metrics.memoryUsage || 0
            };
            
            // Auto-adjust quality if needed
            if (this.config.adaptiveQuality) {
                this.adjustQualityBasedOnPerformance();
            }
        }
    }
    
    adjustQualityBasedOnPerformance() {
        const fps = this.performanceTracker.uiFrameRate;
        
        if (fps < 30 && !this.performanceTracker.adaptiveQualityEnabled) {
            this.enableLowPerformanceMode();
        } else if (fps > 55 && this.performanceTracker.adaptiveQualityEnabled) {
            this.disableLowPerformanceMode();
        }
    }
    
    enableLowPerformanceMode() {
        document.documentElement.classList.add('low-performance');
        this.performanceTracker.adaptiveQualityEnabled = true;
        
        // Reduce particle count
        if (this.animationSystems.particles) {
            this.animationSystems.particles.setMaxParticles(100);
        }
        
        console.log('Low performance mode enabled');
    }
    
    disableLowPerformanceMode() {
        document.documentElement.classList.remove('low-performance');
        this.performanceTracker.adaptiveQualityEnabled = false;
        
        // Restore particle count
        if (this.animationSystems.particles) {
            this.animationSystems.particles.setMaxParticles(this.config.maxUIParticles);
        }
        
        console.log('Low performance mode disabled');
    }
    
    pauseAnimations() {
        if (this.animationSystems.springs) {
            this.animationSystems.springs.pause();
        }
        
        if (this.animationSystems.particles) {
            this.animationSystems.particles.pause();
        }
    }
    
    resumeAnimations() {
        if (this.animationSystems.springs) {
            this.animationSystems.springs.resume();
        }
        
        if (this.animationSystems.particles) {
            this.animationSystems.particles.resume();
        }
    }
    
    persistSetting(key, value) {
        try {
            localStorage.setItem(`glsl-visualizer-${key}`, JSON.stringify(value));
        } catch (error) {
            console.warn(`Failed to persist setting ${key}:`, error);
        }
    }
    
    loadPersistedSetting(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem(`glsl-visualizer-${key}`);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (error) {
            console.warn(`Failed to load setting ${key}:`, error);
            return defaultValue;
        }
    }
    
    async loadPersistedSettings() {
        // Load persisted theme
        if (this.config.enableThemePersistence) {
            const savedTheme = this.loadPersistedSetting('theme', this.config.defaultTheme);
            if (savedTheme && this.themeManager.themes.has(savedTheme)) {
                this.setTheme(savedTheme);
            }
        }
        
        // Load persisted layout
        if (this.config.enableLayoutPersistence) {
            const savedLayout = this.loadPersistedSetting('layout', this.config.defaultLayout);
            if (savedLayout) {
                this.state.currentLayout = savedLayout;
            }
        }
        
        // Load persisted accent color
        const savedAccentColor = this.loadPersistedSetting('accentColor');
        if (savedAccentColor) {
            this.setAccentColor(savedAccentColor);
        }
        
        console.log('Persisted settings loaded');
    }
    
    /**
     * Keyboard shortcuts setup
     */
    setupKeyboardShortcuts() {
        const shortcuts = new Map([
            ['KeyF', { ctrl: true, action: 'toggleFullscreen', description: 'Toggle fullscreen' }],
            ['Space', { ctrl: true, action: 'togglePlayPause', description: 'Play/Pause audio' }],
            ['KeyM', { ctrl: true, action: 'cycleMaterial', description: 'Cycle materials' }],
            ['KeyT', { ctrl: true, action: 'cycleTheme', description: 'Cycle themes' }],
            ['KeyL', { ctrl: true, action: 'cycleLayout', description: 'Cycle layouts' }],
            ['KeyP', { ctrl: true, shift: true, action: 'togglePerformanceMonitor', description: 'Toggle performance monitor' }],
            ['Digit1', { ctrl: true, action: 'setLayout1', description: 'Set layout 1' }],
            ['Digit2', { ctrl: true, action: 'setLayout2', description: 'Set layout 2' }],
            ['Digit3', { ctrl: true, action: 'setLayout3', description: 'Set layout 3' }],
            ['Escape', { action: 'closeModals', description: 'Close open modals' }]
        ]);
        
        this.inputManager.keyboardShortcuts = shortcuts;
        console.log('Keyboard shortcuts initialized');
    }
    
    processKeyboardShortcut(event) {
        const shortcut = this.inputManager.keyboardShortcuts.get(event.code);
        if (!shortcut) return;
        
        // Check modifiers
        if (shortcut.ctrl && !event.ctrlKey) return;
        if (shortcut.shift && !event.shiftKey) return;
        if (shortcut.alt && !event.altKey) return;
        
        // Prevent default behavior
        event.preventDefault();
        
        // Execute action
        this.executeShortcutAction(shortcut.action);
    }
    
    executeShortcutAction(action) {
        switch (action) {
            case 'toggleFullscreen':
                this.toggleFullscreen();
                break;
            case 'togglePlayPause':
                this.togglePlayPause();
                break;
            case 'cycleMaterial':
                this.cycleMaterial();
                break;
            case 'cycleTheme':
                this.cycleTheme();
                break;
            case 'cycleLayout':
                this.cycleLayout();
                break;
            case 'togglePerformanceMonitor':
                this.togglePerformanceMonitor();
                break;
            case 'setLayout1':
                this.setLayout('default');
                break;
            case 'setLayout2':
                this.setLayout('minimalist');
                break;
            case 'setLayout3':
                this.setLayout('performance');
                break;
            case 'closeModals':
                this.closeAllModals();
                break;
        }
    }
    
    /**
     * Gesture recognition setup
     */
    setupGestureRecognition() {
        let startX, startY, startTime;
        
        document.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            startTime = Date.now();
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            const deltaTime = Date.now() - startTime;
            
            // Swipe gesture detection
            const minSwipeDistance = 50;
            const maxSwipeTime = 300;
            
            if (Math.abs(deltaX) > minSwipeDistance && deltaTime < maxSwipeTime) {
                if (deltaX > 0) {
                    this.handleSwipeRight();
                } else {
                    this.handleSwipeLeft();
                }
            }
            
            if (Math.abs(deltaY) > minSwipeDistance && deltaTime < maxSwipeTime) {
                if (deltaY > 0) {
                    this.handleSwipeDown();
                } else {
                    this.handleSwipeUp();
                }
            }
            
            // Reset
            startX = startY = null;
        }, { passive: true });
        
        console.log('Gesture recognition initialized');
    }
    
    handleSwipeLeft() {
        // Cycle to next material
        this.cycleMaterial();
    }
    
    handleSwipeRight() {
        // Cycle to previous material
        this.cycleMaterial(-1);
    }
    
    handleSwipeUp() {
        // Show/hide UI
        this.toggleUIVisibility();
    }
    
    handleSwipeDown() {
        // Toggle fullscreen
        this.toggleFullscreen();
    }
    
    /**
     * Accessibility helpers
     */
    detectScreenReader() {
        // Basic screen reader detection
        return !!(
            window.speechSynthesis ||
            window.navigator.userAgent.match(/NVDA|JAWS|DRAGON|ZoomText/i) ||
            document.querySelector('[aria-live]')
        );
    }
    
    createFocusManager() {
        return {
            focusableElements: [],
            currentIndex: -1,
            
            updateFocusableElements() {
                this.focusableElements = Array.from(document.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )).filter(el => !el.disabled && el.offsetParent !== null);
            },
            
            focusNext() {
                this.updateFocusableElements();
                this.currentIndex = (this.currentIndex + 1) % this.focusableElements.length;
                this.focusableElements[this.currentIndex]?.focus();
            },
            
            focusPrevious() {
                this.updateFocusableElements();
                this.currentIndex = this.currentIndex <= 0 ? 
                    this.focusableElements.length - 1 : this.currentIndex - 1;
                this.focusableElements[this.currentIndex]?.focus();
            }
        };
    }
    
    applyAccessibilitySettings() {
        const root = document.documentElement;
        
        if (this.accessibility.highContrast) {
            root.classList.add('high-contrast');
        }
        
        if (this.accessibility.reducedMotion) {
            root.classList.add('reduced-motion');
        }
        
        if (this.accessibility.screenReader) {
            root.classList.add('screen-reader');
        }
        
        console.log('Accessibility settings applied');
    }
    
    updateAnimationSettings() {
        const root = document.documentElement;
        
        if (this.accessibility.reducedMotion) {
            root.classList.add('reduced-motion');
            
            // Disable particle effects
            if (this.animationSystems.particles) {
                this.animationSystems.particles.setEnabled(false);
            }
        } else {
            root.classList.remove('reduced-motion');
            
            // Re-enable particle effects
            if (this.animationSystems.particles) {
                this.animationSystems.particles.setEnabled(true);
            }
        }
    }
    
    /**
     * Translation loading
     */
    async loadTranslations(language) {
        try {
            // In a real implementation, this would load from external files
            const translations = await this.fetchTranslations(language);
            this.i18n.translations.set(language, translations);
            
            // Update DOM with translations
            this.updateTranslations();
            
            console.log(`Translations loaded for: ${language}`);
        } catch (error) {
            console.error(`Failed to load translations for ${language}:`, error);
            throw error;
        }
    }
    
    async fetchTranslations(language) {
        // Mock translation data - in real implementation, load from files
        const translations = {
            en: {
                'ui.title': 'GLSL Music Visualizer',
                'ui.audio.controls': 'Audio Controls',
                'ui.material.properties': 'Material Properties',
                'ui.visual.controls': 'Visual Controls',
                'ui.performance': 'Performance',
                'ui.settings': 'Settings',
                'ui.help': 'Help'
            },
            es: {
                'ui.title': 'Visualizador de Música GLSL',
                'ui.audio.controls': 'Controles de Audio',
                'ui.material.properties': 'Propiedades del Material',
                'ui.visual.controls': 'Controles Visuales',
                'ui.performance': 'Rendimiento',
                'ui.settings': 'Configuración',
                'ui.help': 'Ayuda'
            }
        };
        
        return translations[language] || translations.en;
    }
    
    updateTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        const currentTranslations = this.i18n.translations.get(this.i18n.currentLanguage);
        
        if (!currentTranslations) return;
        
        elements.forEach(element => {
            const key = element.dataset.i18n;
            const translation = currentTranslations[key];
            
            if (translation) {
                element.textContent = translation;
            }
        });
    }
    
    /**
     * Action methods
     */
    toggleFullscreen() {
        if (this.components.controlPanel) {
            this.components.controlPanel.toggleFullscreen();
        }
    }
    
    togglePlayPause() {
        if (this.components.controlPanel) {
            this.components.controlPanel.togglePlayPause();
        }
    }
    
    cycleMaterial(direction = 1) {
        if (this.components.controlPanel) {
            this.components.controlPanel.cycleMaterial();
        }
    }
    
    cycleTheme() {
        const themes = Array.from(this.themeManager.themes.keys());
        const currentIndex = themes.indexOf(this.state.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.setTheme(themes[nextIndex]);
    }
    
    cycleLayout() {
        const layouts = ['default', 'minimalist', 'performance'];
        const currentIndex = layouts.indexOf(this.state.currentLayout);
        const nextIndex = (currentIndex + 1) % layouts.length;
        this.setLayout(layouts[nextIndex]);
    }
    
    togglePerformanceMonitor() {
        if (this.components.controlPanel) {
            this.components.controlPanel.togglePerformanceDashboard();
        }
    }
    
    toggleUIVisibility() {
        this.state.isVisible = !this.state.isVisible;
        
        if (this.components.controlPanel) {
            this.components.controlPanel.elements.container.style.opacity = 
                this.state.isVisible ? '1' : '0';
        }
    }
    
    closeAllModals() {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => modal.classList.remove('active'));
    }
    
    handleMobileTransition() {
        if (this.state.isMobile) {
            // Switch to mobile layout
            document.body.classList.add('mobile-layout');
            this.setLayout('mobile');
        } else {
            // Switch back to desktop layout
            document.body.classList.remove('mobile-layout');
            this.setLayout(this.loadPersistedSetting('layout', 'default'));
        }
        
        console.log(`Switched to ${this.state.isMobile ? 'mobile' : 'desktop'} layout`);
    }
    
    handleOrientationChange() {
        // Handle orientation changes on mobile
        setTimeout(() => {
            this.handleResize();
        }, 100); // Small delay to ensure dimensions are updated
    }
    
    /**
     * Error handling
     */
    handleError(type, error) {
        console.error(`UIManager ${type} error:`, error);
        
        // Trigger error callback
        if (this.callbacks.onError) {
            this.callbacks.onError(type, error);
        }
        
        // Show user-friendly error message
        this.showErrorMessage(`An error occurred: ${error.message}`);
    }
    
    showErrorMessage(message) {
        // Create simple error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
    
    /**
     * Public API for external integration
     */
    getState() {
        return {
            theme: this.state.currentTheme,
            layout: this.state.currentLayout,
            isFullscreen: this.state.isFullscreen,
            isMobile: this.state.isMobile,
            isVisible: this.state.isVisible,
            audioConnected: this.state.audioConnected,
            performance: this.performanceTracker,
            audioState: this.audioState
        };
    }
    
    getComponent(name) {
        return this.components[name] || null;
    }
    
    addEventListener(event, callback) {
        if (!this.eventBus.listeners.has(event)) {
            this.eventBus.listeners.set(event, []);
        }
        this.eventBus.listeners.get(event).push(callback);
    }
    
    removeEventListener(event, callback) {
        const listeners = this.eventBus.listeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        const listeners = this.eventBus.listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Cleanup and destruction
     */
    destroy() {
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('keydown', this.handleKeydown);
        window.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Destroy components
        if (this.components.controlPanel) {
            this.components.controlPanel.destroy();
        }
        
        // Destroy animation systems
        if (this.animationSystems.springs) {
            this.animationSystems.springs.destroy();
        }
        
        if (this.animationSystems.morphs) {
            this.animationSystems.morphs.destroy();
        }
        
        // Disconnect observers
        if (this.layoutManager.resizeObserver) {
            this.layoutManager.resizeObserver.disconnect();
        }
        
        // Clear maps and references
        this.components = {};
        this.themeManager.themes.clear();
        this.inputManager.keyboardShortcuts.clear();
        this.eventBus.listeners.clear();
        
        console.log('UIManager destroyed');
    }
}

// Export the UIManager class
export { UIManager };