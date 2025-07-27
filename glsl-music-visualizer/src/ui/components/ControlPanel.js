/**
 * Control Panel Component - Main Control Interface for GLSL Music Visualizer
 * Central coordination hub for all UI components and system controls
 * Location: src/ui/components/ControlPanel.js
 *
 * Features:
 * - Unified control interface managing all sub-components
 * - Advanced layout management with docking and floating panels
 * - Real-time audio analysis integration and display
 * - Material property matrix with physics simulation controls
 * - Visual enhancement pipeline controls
 * - Performance monitoring and optimization dashboard
 * - Preset management and configuration saving/loading
 * - Audio-reactive UI animations and particle effects
 * - Accessibility compliance and keyboard navigation
 * - Mobile-responsive design with touch interactions
 */

import { AudioControls } from './AudioControls.js';
import { MaterialControls } from './MaterialControls.js';
import { VisualControls } from './VisualControls.js';
import { FileUpload } from './FileUpload.js';
import { SpringSystem } from '../animations/SpringSystem.js';
import { MorphTransitions } from '../animations/MorphTransitions.js';
import { particleUI } from '../animations/ParticleUI.js';
import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';

export class ControlPanel {
    constructor(options = {}) {
        // Configuration
        this.config = {
            // Integration points
            audioEngine: options.audioEngine || null,
            renderEngine: options.renderEngine || null,
            visualizerManager: options.visualizerManager || null,
            materialManager: options.materialManager || null,
            container: options.container || null,
            
            // UI Layout settings
            enableDockingSystem: options.enableDockingSystem !== false,
            enableFloatingPanels: options.enableFloatingPanels !== false,
            enableMobileLayout: options.enableMobileLayout !== false,
            enablePanelMinimization: options.enablePanelMinimization !== false,
            
            // Visual effects
            enableParticleEffects: options.enableParticleEffects !== false,
            enableSpringAnimations: options.enableSpringAnimations !== false,
            enableMorphTransitions: options.enableMorphTransitions !== false,
            enableGlassmorphism: options.enableGlassmorphism !== false,
            
            // Performance settings
            enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
            maxActiveParticles: options.maxActiveParticles || 500,
            animationQuality: options.animationQuality || 'high',
            
            // Audio integration
            enableAudioReactivity: options.enableAudioReactivity !== false,
            audioVisualizationLevel: options.audioVisualizationLevel || 0.7,
            enableBeatSync: options.enableBeatSync !== false,
            
            // Preset management
            enablePresets: options.enablePresets !== false,
            maxPresets: options.maxPresets || 50,
            enableAutoSave: options.enableAutoSave !== false,
            autoSaveInterval: options.autoSaveInterval || 30000,
            
            // Styling
            theme: options.theme || 'dark',
            accentColor: options.accentColor || '#00f5ff',
            panelSpacing: options.panelSpacing || 20,
            borderRadius: options.borderRadius || '12px',
            
            // Accessibility
            enableKeyboardNavigation: options.enableKeyboardNavigation !== false,
            enableScreenReader: options.enableScreenReader !== false,
            enableHighContrast: options.enableHighContrast === true,
            enableReducedMotion: options.enableReducedMotion === true
        };
        
        // Component state
        this.state = {
            isInitialized: false,
            isVisible: true,
            currentLayout: 'default',
            activePanel: null,
            panelStates: new Map(),
            isFullscreen: false,
            isMobile: window.innerWidth < 768,
            audioConnected: false,
            performanceMode: 'auto'
        };
        
        // Component instances
        this.components = {
            audioControls: null,
            materialControls: null,
            visualControls: null,
            fileUpload: null
        };
        
        // UI elements
        this.elements = {
            container: null,
            header: null,
            content: null,
            sidebar: null,
            statusBar: null,
            presetManager: null,
            performanceDashboard: null,
            floatingControls: null,
            mobileMenu: null
        };
        
        // Animation systems
        this.springSystem = new SpringSystem({
            enableAudioReactivity: this.config.enableAudioReactivity,
            audioInfluence: this.config.audioVisualizationLevel * 0.3
        });
        
        this.morphTransitions = new MorphTransitions({
            enableAudioReactivity: this.config.enableAudioReactivity,
            audioInfluence: this.config.audioVisualizationLevel * 0.2
        });
        
        // Layout management
        this.layoutManager = {
            layouts: new Map(),
            currentLayoutId: 'default',
            panelPositions: new Map(),
            dockingZones: new Map(),
            resizeObserver: null
        };
        
        // Preset system
        this.presetSystem = {
            presets: new Map(),
            currentPreset: null,
            modified: false,
            autoSaveTimer: null,
            changeHistory: []
        };
        
        // Performance tracking
        this.performanceTracker = {
            frameRate: 60,
            panelUpdateTime: 0,
            animationLoad: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            lastUpdate: 0
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
            lastUpdate: 0
        };
        
        // Event callbacks
        this.callbacks = {
            onLayoutChange: options.onLayoutChange || null,
            onPresetChange: options.onPresetChange || null,
            onPanelToggle: options.onPanelToggle || null,
            onParameterChange: options.onParameterChange || null,
            onPerformanceChange: options.onPerformanceChange || null
        };
        
        // Bound methods for event handling
        this.handleResize = this.handleResize.bind(this);
        this.handleKeyboardInput = this.handleKeyboardInput.bind(this);
        this.handleAudioUpdate = this.handleAudioUpdate.bind(this);
        this.updatePerformanceMetrics = this.updatePerformanceMetrics.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        console.log('ControlPanel initialized', {
            theme: this.config.theme,
            audioReactivity: this.config.enableAudioReactivity,
            particleEffects: this.config.enableParticleEffects,
            mobile: this.state.isMobile
        });
    }
    
    /**
     * Initialize the control panel system
     */
    async initialize() {
        try {
            // Create main UI structure
            this.createUIStructure();
            
            // Initialize layout system
            this.initializeLayoutSystem();
            
            // Initialize component subsystems
            await this.initializeComponents();
            
            // Setup animation systems
            if (this.config.enableSpringAnimations) {
                await this.initializeAnimationSystems();
            }
            
            // Initialize preset management
            if (this.config.enablePresets) {
                this.initializePresetSystem();
            }
            
            // Setup performance monitoring
            if (this.config.enablePerformanceMonitoring) {
                this.initializePerformanceMonitoring();
            }
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize accessibility features
            this.initializeAccessibility();
            
            // Apply initial layout
            this.applyLayout('default');
            
            // Start animation loops
            this.startAnimationSystems();
            
            this.state.isInitialized = true;
            
            console.log('ControlPanel initialization complete');
            
            // Trigger initialization callback
            if (this.callbacks.onLayoutChange) {
                this.callbacks.onLayoutChange('default', this.layoutManager.layouts.get('default'));
            }
            
        } catch (error) {
            console.error('Failed to initialize ControlPanel:', error);
            throw error;
        }
    }
    
    /**
     * Create the main UI structure
     */
    createUIStructure() {
        const container = this.config.container || document.body;
        
        // Main container
        this.elements.container = document.createElement('div');
        this.elements.container.className = 'control-panel-container';
        this.elements.container.setAttribute('role', 'application');
        this.elements.container.setAttribute('aria-label', 'GLSL Music Visualizer Control Panel');
        
        // Apply theme classes
        this.elements.container.classList.add(`theme-${this.config.theme}`);
        if (this.config.enableGlassmorphism) {
            this.elements.container.classList.add('glassmorphism');
        }
        
        // Header section
        this.createHeaderSection();
        
        // Main content area
        this.createContentArea();
        
        // Sidebar for quick controls
        this.createSidebarSection();
        
        // Status bar
        this.createStatusBar();
        
        // Floating controls for mobile
        if (this.state.isMobile || this.config.enableFloatingPanels) {
            this.createFloatingControls();
        }
        
        // Mobile menu
        if (this.state.isMobile) {
            this.createMobileMenu();
        }
        
        // Preset manager overlay
        if (this.config.enablePresets) {
            this.createPresetManager();
        }
        
        // Performance dashboard
        if (this.config.enablePerformanceMonitoring) {
            this.createPerformanceDashboard();
        }
        
        // Assemble main structure
        container.appendChild(this.elements.container);
        
        // Apply initial styling
        this.applyInitialStyling();
    }
    
    /**
     * Create header section with title and global controls
     */
    createHeaderSection() {
        this.elements.header = document.createElement('header');
        this.elements.header.className = 'control-panel-header';
        this.elements.header.innerHTML = `
            <div class="header-left">
                <h1 class="app-title">
                    <span class="title-main">GLSL Music Visualizer</span>
                    <span class="title-version">v1.0</span>
                </h1>
                <div class="audio-status-indicator" role="status" aria-live="polite">
                    <div class="status-dot"></div>
                    <span class="status-text">No Audio</span>
                </div>
            </div>
            
            <div class="header-center">
                <div class="preset-selector">
                    <select class="preset-dropdown" aria-label="Select preset">
                        <option value="default">Default</option>
                    </select>
                    <button class="preset-save btn-ghost" aria-label="Save current preset">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                            <polyline points="17,21 17,13 7,13 7,21"/>
                            <polyline points="7,3 7,8 15,8"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="header-right">
                <div class="performance-indicator">
                    <span class="fps-counter">60 FPS</span>
                    <div class="performance-bar">
                        <div class="performance-fill"></div>
                    </div>
                </div>
                
                <div class="global-controls">
                    <button class="fullscreen-toggle btn-ghost" aria-label="Toggle fullscreen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                        </svg>
                    </button>
                    
                    <button class="settings-toggle btn-ghost" aria-label="Open settings">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                        </svg>
                    </button>
                    
                    <button class="help-toggle btn-ghost" aria-label="Show help">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                            <point cx="12" cy="17"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        this.elements.container.appendChild(this.elements.header);
    }
    
    /**
     * Create main content area for component panels
     */
    createContentArea() {
        this.elements.content = document.createElement('main');
        this.elements.content.className = 'control-panel-content';
        this.elements.content.setAttribute('role', 'main');
        
        // Create docking zones for panels
        if (this.config.enableDockingSystem) {
            const dockingZones = ['left', 'right', 'bottom'];
            dockingZones.forEach(zone => {
                const dockZone = document.createElement('div');
                dockZone.className = `dock-zone dock-${zone}`;
                dockZone.setAttribute('data-zone', zone);
                this.elements.content.appendChild(dockZone);
                this.layoutManager.dockingZones.set(zone, dockZone);
            });
        }
        
        this.elements.container.appendChild(this.elements.content);
    }
    
    /**
     * Create sidebar for quick access controls
     */
    createSidebarSection() {
        this.elements.sidebar = document.createElement('aside');
        this.elements.sidebar.className = 'control-panel-sidebar';
        this.elements.sidebar.setAttribute('role', 'complementary');
        this.elements.sidebar.innerHTML = `
            <div class="sidebar-tabs">
                <button class="tab-button active" data-tab="audio" aria-label="Audio controls">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                </button>
                
                <button class="tab-button" data-tab="material" aria-label="Material controls">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                    </svg>
                </button>
                
                <button class="tab-button" data-tab="visual" aria-label="Visual controls">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                </button>
                
                <button class="tab-button" data-tab="file" aria-label="File controls">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10,9 9,9 8,9"/>
                    </svg>
                </button>
            </div>
            
            <div class="sidebar-content">
                <div class="quick-controls">
                    <h3 class="section-title">Quick Controls</h3>
                    <div class="quick-control-grid"></div>
                </div>
                
                <div class="audio-visualizer">
                    <h3 class="section-title">Audio Spectrum</h3>
                    <canvas class="mini-spectrum" width="200" height="80"></canvas>
                </div>
            </div>
        `;
        
        this.elements.container.appendChild(this.elements.sidebar);
    }
    
    /**
     * Create status bar with system information
     */
    createStatusBar() {
        this.elements.statusBar = document.createElement('div');
        this.elements.statusBar.className = 'control-panel-status-bar';
        this.elements.statusBar.setAttribute('role', 'status');
        this.elements.statusBar.innerHTML = `
            <div class="status-left">
                <span class="status-item" id="audio-info">No audio loaded</span>
                <span class="status-separator">|</span>
                <span class="status-item" id="material-info">Default material</span>
            </div>
            
            <div class="status-center">
                <div class="beat-indicator">
                    <div class="beat-pulse"></div>
                </div>
            </div>
            
            <div class="status-right">
                <span class="status-item" id="render-info">WebGL Ready</span>
                <span class="status-separator">|</span>
                <span class="status-item" id="performance-info">Performance: Good</span>
            </div>
        `;
        
        this.elements.container.appendChild(this.elements.statusBar);
    }
    
    /**
     * Create floating controls for mobile/touch interfaces
     */
    createFloatingControls() {
        this.elements.floatingControls = document.createElement('div');
        this.elements.floatingControls.className = 'floating-controls';
        this.elements.floatingControls.innerHTML = `
            <button class="floating-btn primary" id="play-pause" aria-label="Play/Pause">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
            </button>
            
            <button class="floating-btn secondary" id="material-cycle" aria-label="Cycle materials">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                </svg>
            </button>
            
            <button class="floating-btn secondary" id="fullscreen" aria-label="Toggle fullscreen">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
            </button>
        `;
        
        this.elements.container.appendChild(this.elements.floatingControls);
    }
    
    /**
     * Create mobile hamburger menu
     */
    createMobileMenu() {
        this.elements.mobileMenu = document.createElement('div');
        this.elements.mobileMenu.className = 'mobile-menu';
        this.elements.mobileMenu.innerHTML = `
            <button class="mobile-menu-toggle" aria-label="Open menu">
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
            </button>
            
            <div class="mobile-menu-overlay">
                <div class="mobile-menu-content">
                    <button class="mobile-menu-close" aria-label="Close menu">×</button>
                    <nav class="mobile-menu-nav">
                        <a href="#audio" class="menu-item">Audio Controls</a>
                        <a href="#material" class="menu-item">Materials</a>
                        <a href="#visual" class="menu-item">Visual Effects</a>
                        <a href="#presets" class="menu-item">Presets</a>
                        <a href="#settings" class="menu-item">Settings</a>
                    </nav>
                </div>
            </div>
        `;
        
        this.elements.container.appendChild(this.elements.mobileMenu);
    }
    
    /**
     * Create preset manager interface
     */
    createPresetManager() {
        this.elements.presetManager = document.createElement('div');
        this.elements.presetManager.className = 'preset-manager modal';
        this.elements.presetManager.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Preset Manager</h2>
                    <button class="modal-close" aria-label="Close preset manager">×</button>
                </div>
                
                <div class="modal-body">
                    <div class="preset-grid"></div>
                    
                    <div class="preset-actions">
                        <button class="btn btn-primary" id="save-preset">Save Current</button>
                        <button class="btn btn-secondary" id="export-presets">Export All</button>
                        <button class="btn btn-secondary" id="import-presets">Import</button>
                    </div>
                </div>
            </div>
        `;
        
        this.elements.container.appendChild(this.elements.presetManager);
    }
    
    /**
     * Create performance monitoring dashboard
     */
    createPerformanceDashboard() {
        this.elements.performanceDashboard = document.createElement('div');
        this.elements.performanceDashboard.className = 'performance-dashboard panel';
        this.elements.performanceDashboard.innerHTML = `
            <div class="panel-header">
                <h3>Performance Monitor</h3>
                <button class="panel-minimize" aria-label="Minimize performance panel">−</button>
            </div>
            
            <div class="performance-metrics">
                <div class="metric">
                    <label>FPS</label>
                    <span id="fps-display">60</span>
                </div>
                
                <div class="metric">
                    <label>Frame Time</label>
                    <span id="frame-time-display">16.7ms</span>
                </div>
                
                <div class="metric">
                    <label>Memory</label>
                    <span id="memory-display">--MB</span>
                </div>
                
                <div class="metric">
                    <label>CPU Load</label>
                    <span id="cpu-display">--%</span>
                </div>
            </div>
            
            <div class="performance-graph">
                <canvas id="performance-graph" width="300" height="100"></canvas>
            </div>
        `;
        
        this.elements.container.appendChild(this.elements.performanceDashboard);
    }
    
    /**
     * Initialize all UI components
     */
    async initializeComponents() {
        const componentConfig = {
            theme: this.config.theme,
            accentColor: this.config.accentColor,
            enableParticleEffects: this.config.enableParticleEffects,
            enableSpringAnimations: this.config.enableSpringAnimations,
            enableKeyboardNavigation: this.config.enableKeyboardNavigation,
            enableScreenReader: this.config.enableScreenReader
        };
        
        // Initialize AudioControls
        this.components.audioControls = new AudioControls({
            ...componentConfig,
            audioEngine: this.config.audioEngine,
            container: this.layoutManager.dockingZones.get('left'),
            onParameterChange: this.handleParameterChange.bind(this),
            onFFTSettingsChange: this.handleFFTSettingsChange.bind(this),
            onBeatSettingsChange: this.handleBeatSettingsChange.bind(this)
        });
        
        await this.components.audioControls.initialize();
        console.log('AudioControls component initialized');
        
        // Initialize MaterialControls
        this.components.materialControls = new MaterialControls({
            ...componentConfig,
            materialManager: this.config.materialManager,
            container: this.layoutManager.dockingZones.get('left'),
            onMaterialChange: this.handleMaterialChange.bind(this),
            onPropertyChange: this.handlePropertyChange.bind(this)
        });
        
        await this.components.materialControls.initialize();
        console.log('MaterialControls component initialized');
        
        // Initialize VisualControls
        this.components.visualControls = new VisualControls({
            ...componentConfig,
            renderEngine: this.config.renderEngine,
            container: this.layoutManager.dockingZones.get('right'),
            onVisualChange: this.handleVisualChange.bind(this),
            onEffectToggle: this.handleEffectToggle.bind(this)
        });
        
        await this.components.visualControls.initialize();
        console.log('VisualControls component initialized');
        
        // Initialize FileUpload
        this.components.fileUpload = new FileUpload({
            ...componentConfig,
            audioEngine: this.config.audioEngine,
            container: this.layoutManager.dockingZones.get('bottom'),
            onFileLoad: this.handleFileLoad.bind(this),
            onAudioReady: this.handleAudioReady.bind(this)
        });
        
        await this.components.fileUpload.initialize();
        console.log('FileUpload component initialized');
    }
    
    /**
     * Initialize layout management system
     */
    initializeLayoutSystem() {
        // Define default layouts
        const defaultLayout = {
            id: 'default',
            name: 'Default Layout',
            panels: {
                audioControls: { zone: 'left', position: { x: 20, y: 20 }, size: { width: 320, height: 400 } },
                materialControls: { zone: 'left', position: { x: 20, y: 440 }, size: { width: 320, height: 300 } },
                visualControls: { zone: 'right', position: { x: -340, y: 20 }, size: { width: 320, height: 400 } },
                fileUpload: { zone: 'bottom', position: { x: 20, y: -200 }, size: { width: 400, height: 180 } }
            }
        };
        
        const minimalistLayout = {
            id: 'minimalist',
            name: 'Minimalist',
            panels: {
                audioControls: { zone: 'left', position: { x: 20, y: 20 }, size: { width: 280, height: 200 } },
                materialControls: { zone: 'left', position: { x: 20, y: 240 }, size: { width: 280, height: 150 } },
                visualControls: { zone: 'right', position: { x: -300, y: 20 }, size: { width: 280, height: 200 } },
                fileUpload: { zone: 'bottom', position: { x: 20, y: -120 }, size: { width: 300, height: 100 } }
            }
        };
        
        const performanceLayout = {
            id: 'performance',
            name: 'Performance Focus',
            panels: {
                audioControls: { zone: 'left', position: { x: 20, y: 20 }, size: { width: 300, height: 300 } },
                materialControls: { zone: 'left', position: { x: 20, y: 340 }, size: { width: 300, height: 200 } },
                visualControls: { zone: 'right', position: { x: -320, y: 20 }, size: { width: 300, height: 250 } },
                fileUpload: { zone: 'bottom', position: { x: 20, y: -150 }, size: { width: 350, height: 130 } }
            }
        };
        
        // Store layouts
        this.layoutManager.layouts.set('default', defaultLayout);
        this.layoutManager.layouts.set('minimalist', minimalistLayout);
        this.layoutManager.layouts.set('performance', performanceLayout);
        
        // Setup resize observer
        if (window.ResizeObserver) {
            this.layoutManager.resizeObserver = new ResizeObserver(this.handleResize);
            this.layoutManager.resizeObserver.observe(this.elements.container);
        }
    }
    
    /**
     * Initialize animation systems
     */
    async initializeAnimationSystems() {
        // Start spring system
        this.springSystem.start();
        
        // Initialize particle UI if enabled
        if (this.config.enableParticleEffects) {
            await particleUI.initialize();
            
            // Attach particle effects to interactive elements
            this.attachParticleEffects();
        }
        
        // Setup audio-reactive animations
        if (this.config.enableAudioReactivity) {
            this.setupAudioReactiveAnimations();
        }
        
        console.log('Animation systems initialized');
    }
    
    /**
     * Initialize preset management system
     */
    initializePresetSystem() {
        // Load default presets
        this.loadDefaultPresets();
        
        // Setup auto-save if enabled
        if (this.config.enableAutoSave) {
            this.presetSystem.autoSaveTimer = setInterval(() => {
                if (this.presetSystem.modified) {
                    this.autoSaveCurrentState();
                }
            }, this.config.autoSaveInterval);
        }
        
        console.log('Preset system initialized');
    }
    
    /**
     * Initialize performance monitoring
     */
    initializePerformanceMonitoring() {
        // Setup performance tracking
        setInterval(this.updatePerformanceMetrics, 1000);
        
        // Initialize performance graphs
        this.initializePerformanceGraphs();
        
        console.log('Performance monitoring initialized');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Window events
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('keydown', this.handleKeyboardInput);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Header controls
        const fullscreenBtn = this.elements.header.querySelector('.fullscreen-toggle');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', this.toggleFullscreen.bind(this));
        }
        
        const settingsBtn = this.elements.header.querySelector('.settings-toggle');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', this.showSettings.bind(this));
        }
        
        // Preset controls
        const presetDropdown = this.elements.header.querySelector('.preset-dropdown');
        if (presetDropdown) {
            presetDropdown.addEventListener('change', this.handlePresetChange.bind(this));
        }
        
        const presetSaveBtn = this.elements.header.querySelector('.preset-save');
        if (presetSaveBtn) {
            presetSaveBtn.addEventListener('click', this.showPresetSaveDialog.bind(this));
        }
        
        // Sidebar tab switching
        const tabButtons = this.elements.sidebar.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', this.handleTabSwitch.bind(this));
        });
        
        // Mobile menu
        if (this.elements.mobileMenu) {
            const menuToggle = this.elements.mobileMenu.querySelector('.mobile-menu-toggle');
            const menuClose = this.elements.mobileMenu.querySelector('.mobile-menu-close');
            const menuOverlay = this.elements.mobileMenu.querySelector('.mobile-menu-overlay');
            
            if (menuToggle) {
                menuToggle.addEventListener('click', this.toggleMobileMenu.bind(this));
            }
            
            if (menuClose) {
                menuClose.addEventListener('click', this.closeMobileMenu.bind(this));
            }
            
            if (menuOverlay) {
                menuOverlay.addEventListener('click', (e) => {
                    if (e.target === menuOverlay) {
                        this.closeMobileMenu();
                    }
                });
            }
        }
        
        // Floating controls
        if (this.elements.floatingControls) {
            const playPauseBtn = this.elements.floatingControls.querySelector('#play-pause');
            const materialCycleBtn = this.elements.floatingControls.querySelector('#material-cycle');
            const fullscreenBtn2 = this.elements.floatingControls.querySelector('#fullscreen');
            
            if (playPauseBtn) {
                playPauseBtn.addEventListener('click', this.togglePlayPause.bind(this));
            }
            
            if (materialCycleBtn) {
                materialCycleBtn.addEventListener('click', this.cycleMaterial.bind(this));
            }
            
            if (fullscreenBtn2) {
                fullscreenBtn2.addEventListener('click', this.toggleFullscreen.bind(this));
            }
        }
        
        // Performance dashboard
        if (this.elements.performanceDashboard) {
            const minimizeBtn = this.elements.performanceDashboard.querySelector('.panel-minimize');
            if (minimizeBtn) {
                minimizeBtn.addEventListener('click', this.togglePerformanceDashboard.bind(this));
            }
        }
    }
    
    /**
     * Initialize accessibility features
     */
    initializeAccessibility() {
        // Setup screen reader support
        if (this.config.enableScreenReader) {
            this.setupScreenReaderSupport();
        }
        
        // Setup keyboard navigation
        if (this.config.enableKeyboardNavigation) {
            this.setupKeyboardNavigation();
        }
        
        // Setup high contrast mode
        if (this.config.enableHighContrast) {
            this.elements.container.classList.add('high-contrast');
        }
        
        // Setup reduced motion
        if (this.config.enableReducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.elements.container.classList.add('reduced-motion');
        }
        
        console.log('Accessibility features initialized');
    }
    
    /**
     * Apply layout configuration
     */
    applyLayout(layoutId) {
        const layout = this.layoutManager.layouts.get(layoutId);
        if (!layout) {
            console.warn(`Layout ${layoutId} not found`);
            return;
        }
        
        this.layoutManager.currentLayoutId = layoutId;
        
        // Apply panel positions and sizes
        Object.entries(layout.panels).forEach(([componentName, config]) => {
            const component = this.components[componentName];
            if (component && component.elements.container) {
                this.applyPanelLayout(component.elements.container, config);
            }
        });
        
        // Update layout state
        this.state.currentLayout = layoutId;
        
        // Trigger layout change callback
        if (this.callbacks.onLayoutChange) {
            this.callbacks.onLayoutChange(layoutId, layout);
        }
        
        console.log(`Applied layout: ${layoutId}`);
    }
    
    /**
     * Apply panel layout configuration
     */
    applyPanelLayout(panel, config) {
        const { position, size } = config;
        
        // Apply position
        panel.style.left = position.x >= 0 ? `${position.x}px` : `calc(100% + ${position.x}px)`;
        panel.style.top = position.y >= 0 ? `${position.y}px` : `calc(100% + ${position.y}px)`;
        
        // Apply size
        if (size.width) panel.style.width = `${size.width}px`;
        if (size.height) panel.style.height = `${size.height}px`;
        
        // Add layout transition
        if (this.config.enableSpringAnimations) {
            this.springSystem.createSpring({
                from: 0,
                to: 1,
                tension: 200,
                friction: 25,
                onUpdate: (progress) => {
                    panel.style.opacity = progress;
                    panel.style.transform = `scale(${0.9 + progress * 0.1})`;
                }
            });
        }
    }
    
    /**
     * Start animation systems
     */
    startAnimationSystems() {
        // Start spring system
        this.springSystem.start();
        
        // Start audio update loop
        if (this.config.enableAudioReactivity) {
            this.startAudioUpdateLoop();
        }
        
        // Start performance monitoring
        if (this.config.enablePerformanceMonitoring) {
            this.startPerformanceLoop();
        }
    }
    
    /**
     * Start audio update loop for reactive animations
     */
    startAudioUpdateLoop() {
        const updateAudio = () => {
            if (this.config.audioEngine && this.config.audioEngine.isActive) {
                const audioData = this.config.audioEngine.getAudioData();
                this.handleAudioUpdate(audioData);
            }
            
            requestAnimationFrame(updateAudio);
        };
        
        requestAnimationFrame(updateAudio);
    }
    
    /**
     * Handle audio data updates for reactive UI
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
            lastUpdate: performance.now()
        };
        
        // Update UI elements
        this.updateAudioVisualization();
        this.updateBeatIndicator();
        this.updateAudioReactiveAnimations();
        
        // Update status bar
        this.updateAudioStatus();
    }
    
    /**
     * Update audio visualization in sidebar
     */
    updateAudioVisualization() {
        const canvas = this.elements.sidebar.querySelector('.mini-spectrum');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        
        // Clear canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);
        
        // Draw spectrum
        const spectrum = this.audioState.spectrum;
        const barWidth = width / spectrum.length;
        
        ctx.fillStyle = this.config.accentColor;
        
        for (let i = 0; i < spectrum.length; i++) {
            const barHeight = spectrum[i] * height;
            ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
    }
    
    /**
     * Update beat indicator in status bar
     */
    updateBeatIndicator() {
        const beatIndicator = this.elements.statusBar.querySelector('.beat-indicator');
        if (!beatIndicator) return;
        
        if (this.audioState.beat) {
            beatIndicator.classList.add('active');
            setTimeout(() => beatIndicator.classList.remove('active'), 100);
        }
        
        // Update beat pulse intensity
        const beatPulse = beatIndicator.querySelector('.beat-pulse');
        if (beatPulse) {
            beatPulse.style.opacity = this.audioState.beatStrength;
            beatPulse.style.transform = `scale(${1 + this.audioState.beatStrength * 0.5})`;
        }
    }
    
    /**
     * Update audio-reactive animations
     */
    updateAudioReactiveAnimations() {
        if (!this.config.enableAudioReactivity) return;
        
        // Update CSS variables for audio reactivity
        const root = document.documentElement;
        root.style.setProperty('--audio-energy', this.audioState.energy);
        root.style.setProperty('--audio-bass', this.audioState.bass);
        root.style.setProperty('--audio-mid', this.audioState.mid);
        root.style.setProperty('--audio-treble', this.audioState.treble);
        root.style.setProperty('--audio-beat', this.audioState.beat ? 1 : 0);
        
        // Trigger particle effects on beat
        if (this.audioState.beat && this.config.enableParticleEffects) {
            this.triggerBeatParticles();
        }
        
        // Update panel glow effects
        this.updatePanelGlowEffects();
    }
    
    /**
     * Trigger particle effects on beat
     */
    triggerBeatParticles() {
        const intensity = this.audioState.beatStrength;
        
        particleUI.emit({
            position: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
            count: Math.floor(intensity * 20),
            velocity: { min: 50 * intensity, max: 150 * intensity },
            lifetime: 1.0 + intensity,
            color: this.config.accentColor,
            size: 2 + intensity * 3,
            type: 'burst'
        });
    }
    
    /**
     * Update panel glow effects based on audio
     */
    updatePanelGlowEffects() {
        const panels = this.elements.container.querySelectorAll('.panel');
        const glowIntensity = this.audioState.energy * this.config.audioVisualizationLevel;
        
        panels.forEach(panel => {
            const glowColor = ColorUtils.hexToRgba(this.config.accentColor, glowIntensity * 0.3);
            panel.style.boxShadow = `0 0 ${glowIntensity * 30}px ${glowColor}`;
        });
    }
    
    /**
     * Update performance metrics display
     */
    updatePerformanceMetrics() {
        if (!performanceMonitor) return;
        
        const metrics = performanceMonitor.getMetrics();
        
        // Update tracker
        this.performanceTracker = {
            frameRate: metrics.frameRate || 60,
            panelUpdateTime: metrics.panelUpdateTime || 0,
            animationLoad: metrics.animationLoad || 0,
            memoryUsage: metrics.memoryUsage || 0,
            cpuUsage: metrics.cpuUsage || 0,
            lastUpdate: performance.now()
        };
        
        // Update UI elements
        this.updatePerformanceUI();
        this.updatePerformanceGraph();
        
        // Auto-adjust quality if needed
        this.autoAdjustPerformance();
    }
    
    /**
     * Update performance UI elements
     */
    updatePerformanceUI() {
        // Update FPS counter in header
        const fpsCounter = this.elements.header.querySelector('.fps-counter');
        if (fpsCounter) {
            fpsCounter.textContent = `${Math.round(this.performanceTracker.frameRate)} FPS`;
        }
        
        // Update performance bar
        const performanceBar = this.elements.header.querySelector('.performance-fill');
        if (performanceBar) {
            const performance = Math.min(this.performanceTracker.frameRate / 60, 1);
            performanceBar.style.width = `${performance * 100}%`;
            
            // Color coding
            if (performance > 0.8) {
                performanceBar.style.background = '#00ff88';
            } else if (performance > 0.6) {
                performanceBar.style.background = '#ffaa00';
            } else {
                performanceBar.style.background = '#ff4444';
            }
        }
        
        // Update detailed dashboard if visible
        if (this.elements.performanceDashboard && !this.elements.performanceDashboard.classList.contains('minimized')) {
            const fpsDisplay = this.elements.performanceDashboard.querySelector('#fps-display');
            const frameTimeDisplay = this.elements.performanceDashboard.querySelector('#frame-time-display');
            const memoryDisplay = this.elements.performanceDashboard.querySelector('#memory-display');
            const cpuDisplay = this.elements.performanceDashboard.querySelector('#cpu-display');
            
            if (fpsDisplay) fpsDisplay.textContent = Math.round(this.performanceTracker.frameRate);
            if (frameTimeDisplay) frameTimeDisplay.textContent = `${(1000 / this.performanceTracker.frameRate).toFixed(1)}ms`;
            if (memoryDisplay) memoryDisplay.textContent = `${Math.round(this.performanceTracker.memoryUsage)}MB`;
            if (cpuDisplay) cpuDisplay.textContent = `${Math.round(this.performanceTracker.cpuUsage)}%`;
        }
        
        // Update status bar
        const performanceInfo = this.elements.statusBar.querySelector('#performance-info');
        if (performanceInfo) {
            const status = this.performanceTracker.frameRate > 50 ? 'Good' : 
                          this.performanceTracker.frameRate > 30 ? 'Fair' : 'Poor';
            performanceInfo.textContent = `Performance: ${status}`;
        }
    }
    
    /**
     * Auto-adjust performance settings
     */
    autoAdjustPerformance() {
        if (this.state.performanceMode !== 'auto') return;
        
        const fps = this.performanceTracker.frameRate;
        
        // Reduce quality if performance is poor
        if (fps < 30 && this.config.animationQuality !== 'low') {
            this.setAnimationQuality('low');
            console.log('Auto-reduced animation quality for performance');
        }
        
        // Increase quality if performance is good
        if (fps > 55 && this.config.animationQuality === 'low') {
            this.setAnimationQuality('medium');
            console.log('Auto-increased animation quality');
        }
    }
    
    /**
     * Set animation quality level
     */
    setAnimationQuality(quality) {
        this.config.animationQuality = quality;
        
        // Update particle systems
        if (particleUI) {
            const particleCount = quality === 'low' ? 100 : quality === 'medium' ? 300 : 500;
            particleUI.setMaxParticles(particleCount);
        }
        
        // Update spring system
        if (this.springSystem) {
            const updateRate = quality === 'low' ? 30 : quality === 'medium' ? 45 : 60;
            this.springSystem.setTargetFPS(updateRate);
        }
        
        // Update CSS animations
        const root = document.documentElement;
        root.classList.remove('quality-low', 'quality-medium', 'quality-high');
        root.classList.add(`quality-${quality}`);
    }
    
    /**
     * Event Handlers
     */
    
    handleResize() {
        const wasMobile = this.state.isMobile;
        this.state.isMobile = window.innerWidth < 768;
        
        // Switch to mobile layout if needed
        if (!wasMobile && this.state.isMobile) {
            this.switchToMobileLayout();
        } else if (wasMobile && !this.state.isMobile) {
            this.switchToDesktopLayout();
        }
        
        // Reapply current layout
        this.applyLayout(this.layoutManager.currentLayoutId);
    }
    
    handleKeyboardInput(event) {
        if (!this.config.enableKeyboardNavigation) return;
        
        // Global shortcuts
        switch (event.code) {
            case 'Space':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.togglePlayPause();
                }
                break;
                
            case 'KeyF':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.toggleFullscreen();
                }
                break;
                
            case 'KeyM':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.cycleMaterial();
                }
                break;
                
            case 'KeyP':
                if (event.ctrlKey && event.shiftKey) {
                    event.preventDefault();
                    this.showPresetManager();
                }
                break;
                
            case 'Escape':
                this.closeMobileMenu();
                this.closePresetManager();
                break;
        }
    }
    
    handleVisibilityChange() {
        if (document.hidden) {
            // Pause animations when tab is not visible
            this.pauseAnimations();
        } else {
            // Resume animations when tab becomes visible
            this.resumeAnimations();
        }
    }
    
    /**
     * Component Event Handlers
     */
    
    handleParameterChange(parameter, value, source) {
        // Update audio engine parameters
        if (this.config.audioEngine && source === 'audio') {
            this.config.audioEngine.setParameter(parameter, value);
        }
        
        // Mark preset as modified
        this.presetSystem.modified = true;
        
        // Trigger callback
        if (this.callbacks.onParameterChange) {
            this.callbacks.onParameterChange(parameter, value, source);
        }
    }
    
    handleMaterialChange(materialId, properties) {
        // Update material manager
        if (this.config.materialManager) {
            this.config.materialManager.setMaterial(materialId, properties);
        }
        
        // Update status bar
        const materialInfo = this.elements.statusBar.querySelector('#material-info');
        if (materialInfo) {
            materialInfo.textContent = `Material: ${materialId}`;
        }
        
        // Mark preset as modified
        this.presetSystem.modified = true;
        
        // Trigger callback
        if (this.callbacks.onParameterChange) {
            this.callbacks.onParameterChange('material', materialId, 'material');
        }
    }
    
    handleVisualChange(effect, value, source) {
        // Update render engine
        if (this.config.renderEngine) {
            this.config.renderEngine.setEffect(effect, value);
        }
        
        // Mark preset as modified
        this.presetSystem.modified = true;
        
        // Trigger callback
        if (this.callbacks.onParameterChange) {
            this.callbacks.onParameterChange(effect, value, 'visual');
        }
    }
    
    handleFileLoad(file, metadata) {
        // Update status bar
        const audioInfo = this.elements.statusBar.querySelector('#audio-info');
        if (audioInfo) {
            audioInfo.textContent = `${file.name} - ${metadata.duration}s`;
        }
        
        // Update audio connection status
        this.state.audioConnected = true;
        this.updateAudioConnectionStatus();
    }
    
    handleAudioReady(audioData) {
        // Update audio status indicator
        this.updateAudioConnectionStatus();
        
        // Start audio-reactive animations
        if (this.config.enableAudioReactivity) {
            this.startAudioReactiveAnimations();
        }
    }
    
    /**
     * UI Action Methods
     */
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.elements.container.requestFullscreen().catch(err => {
                console.warn('Failed to enter fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
        
        this.state.isFullscreen = !this.state.isFullscreen;
    }
    
    togglePlayPause() {
        if (this.config.audioEngine) {
            if (this.config.audioEngine.isPlaying) {
                this.config.audioEngine.pause();
            } else {
                this.config.audioEngine.play();
            }
        }
        
        // Update play/pause button
        const playPauseBtn = this.elements.floatingControls?.querySelector('#play-pause svg');
        if (playPauseBtn) {
            if (this.config.audioEngine?.isPlaying) {
                playPauseBtn.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
            } else {
                playPauseBtn.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
            }
        }
    }
    
    cycleMaterial() {
        if (this.config.materialManager) {
            this.config.materialManager.cycleMaterial();
        }
    }
    
    toggleMobileMenu() {
        const menuOverlay = this.elements.mobileMenu.querySelector('.mobile-menu-overlay');
        if (menuOverlay) {
            menuOverlay.classList.toggle('active');
        }
    }
    
    closeMobileMenu() {
        const menuOverlay = this.elements.mobileMenu?.querySelector('.mobile-menu-overlay');
        if (menuOverlay) {
            menuOverlay.classList.remove('active');
        }
    }
    
    showPresetManager() {
        if (this.elements.presetManager) {
            this.elements.presetManager.classList.add('active');
            this.populatePresetGrid();
        }
    }
    
    closePresetManager() {
        if (this.elements.presetManager) {
            this.elements.presetManager.classList.remove('active');
        }
    }
    
    /**
     * Update UI status indicators
     */
    updateAudioConnectionStatus() {
        const statusIndicator = this.elements.header.querySelector('.audio-status-indicator');
        const statusDot = statusIndicator?.querySelector('.status-dot');
        const statusText = statusIndicator?.querySelector('.status-text');
        
        if (this.state.audioConnected) {
            statusDot?.classList.add('connected');
            if (statusText) statusText.textContent = 'Audio Connected';
        } else {
            statusDot?.classList.remove('connected');
            if (statusText) statusText.textContent = 'No Audio';
        }
    }
    
    /**
     * Apply initial styling
     */
    applyInitialStyling() {
        // Set CSS custom properties
        const root = document.documentElement;
        root.style.setProperty('--accent-color', this.config.accentColor);
        root.style.setProperty('--panel-spacing', `${this.config.panelSpacing}px`);
        root.style.setProperty('--border-radius', this.config.borderRadius);
        
        // Apply theme
        this.elements.container.classList.add(`theme-${this.config.theme}`);
        
        // Apply mobile class if needed
        if (this.state.isMobile) {
            this.elements.container.classList.add('mobile-layout');
        }
    }
    
    /**
     * Cleanup and destroy
     */
    destroy() {
        // Stop all timers
        if (this.presetSystem.autoSaveTimer) {
            clearInterval(this.presetSystem.autoSaveTimer);
        }
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('keydown', this.handleKeyboardInput);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Destroy components
        Object.values(this.components).forEach(component => {
            if (component && component.destroy) {
                component.destroy();
            }
        });
        
        // Destroy animation systems
        this.springSystem.destroy();
        this.morphTransitions.destroy();
        
        // Remove DOM elements
        if (this.elements.container && this.elements.container.parentNode) {
            this.elements.container.parentNode.removeChild(this.elements.container);
        }
        
        console.log('ControlPanel destroyed');
    }
    
    /**
     * Public API methods for external integration
     */
    
    setLayout(layoutId) {
        this.applyLayout(layoutId);
    }
    
    getLayout() {
        return this.layoutManager.currentLayoutId;
    }
    
    setTheme(theme) {
        this.config.theme = theme;
        this.elements.container.classList.remove('theme-light', 'theme-dark');
        this.elements.container.classList.add(`theme-${theme}`);
    }
    
    setAudioEngine(audioEngine) {
        this.config.audioEngine = audioEngine;
        
        // Update all components
        Object.values(this.components).forEach(component => {
            if (component.setAudioEngine) {
                component.setAudioEngine(audioEngine);
            }
        });
    }
    
    getState() {
        return {
            layout: this.layoutManager.currentLayoutId,
            theme: this.config.theme,
            audioConnected: this.state.audioConnected,
            performance: this.performanceTracker,
            audioState: this.audioState
        };
    }
}

// Export the ControlPanel class
export { ControlPanel };