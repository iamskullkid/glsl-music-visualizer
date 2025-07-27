/**
 * Visual Controls Component - Advanced Visual Enhancement Control Panel
 * Comprehensive controls for camera, lighting, post-processing, and visual effects
 * Location: src/ui/components/VisualControls.js
 */

import { SpringSystem } from '../animations/SpringSystem.js';
import { particleUI } from '../animations/ParticleUI.js';
import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';

export class VisualControls {
    constructor(options = {}) {
        this.config = {
            renderEngine: options.renderEngine || null,
            audioEngine: options.audioEngine || null,
            container: options.container || null,
            enableParticleEffects: options.enableParticleEffects !== false,
            enableSpringAnimations: options.enableSpringAnimations !== false,
            showRenderStats: options.showRenderStats !== false,
            updateThrottle: options.updateThrottle || 16,
            theme: options.theme || 'dark',
            accentColor: options.accentColor || '#00f5ff',
            enableKeyboardNavigation: options.enableKeyboardNavigation !== false
        };
        
        this.state = {
            isInitialized: false,
            isVisible: true,
            isExpanded: true,
            
            cameraSettings: {
                position: [0, 0, 5],
                target: [0, 0, 0],
                fov: 45,
                autoOrbit: false,
                orbitSpeed: 0.5,
                shakeIntensity: 0.0
            },
            
            lightingSettings: {
                ambientColor: [0.1, 0.1, 0.1],
                ambientIntensity: 0.3,
                mainLightEnabled: true,
                mainLightIntensity: 1.0,
                enableShadows: true
            },
            
            postProcessingSettings: {
                enabled: true,
                bloomEnabled: true,
                bloomThreshold: 1.0,
                bloomIntensity: 0.8,
                exposure: 1.0,
                contrast: 1.0,
                saturation: 1.0
            },
            
            environmentSettings: {
                skyboxEnabled: true,
                skyboxIntensity: 1.0,
                environmentMap: 'studio',
                aoStrength: 1.0
            },
            
            qualitySettings: {
                renderScale: 1.0,
                adaptiveQuality: true,
                targetFPS: 60
            },
            
            audioVisualMapping: {
                enabled: true,
                cameraShake: 0.3,
                lightPulse: 0.5,
                bloomReactivity: 0.7
            }
        };
        
        this.elements = {
            container: null,
            header: null,
            content: null,
            statsDisplay: null,
            controls: new Map()
        };
        
        this.springSystem = new SpringSystem({
            enableAudioReactivity: true,
            targetFPS: 60
        });
        
        this.updateThrottle = {
            lastUpdate: 0,
            pendingUpdate: null
        };
        
        this.renderStats = {
            fps: 60,
            frameTime: 16.67,
            lastUpdate: 0
        };
        
        this.callbacks = {
            onCameraChange: options.onCameraChange || null,
            onLightingChange: options.onLightingChange || null,
            onPostProcessingChange: options.onPostProcessingChange || null,
            onQualityChange: options.onQualityChange || null
        };
        
        // Bind methods
        this.handleCameraChange = this.handleCameraChange.bind(this);
        this.handleLightingChange = this.handleLightingChange.bind(this);
        this.handlePostProcessingChange = this.handlePostProcessingChange.bind(this);
        this.handleQualityChange = this.handleQualityChange.bind(this);
        this.handleKeyboardInput = this.handleKeyboardInput.bind(this);
        this.updateRenderStats = this.updateRenderStats.bind(this);
        
        console.log('VisualControls initialized');
    }
    
    async initialize() {
        try {
            this.createUIStructure();
            this.setupCameraControls();
            this.setupLightingControls();
            this.setupPostProcessingControls();
            this.setupEnvironmentControls();
            this.setupQualityControls();
            this.setupAudioVisualControls();
            
            if (this.config.showRenderStats) {
                this.initializeStatsDisplay();
            }
            
            this.setupEventListeners();
            
            if (this.config.enableParticleEffects) {
                await this.initializeParticleEffects();
            }
            
            await this.loadInitialSettings();
            
            this.state.isInitialized = true;
            console.log('VisualControls component initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize VisualControls:', error);
            throw error;
        }
    }
    
    createUIStructure() {
        const container = this.config.container || document.body;
        
        this.elements.container = document.createElement('div');
        this.elements.container.className = 'visual-controls panel glass';
        this.elements.container.setAttribute('role', 'region');
        this.elements.container.setAttribute('aria-label', 'Visual Enhancement Controls');
        
        this.elements.header = document.createElement('div');
        this.elements.header.className = 'panel-header';
        this.elements.header.innerHTML = `
            <h3 class="panel-title">Visual Controls</h3>
            <div class="panel-controls">
                <button class="visual-reset btn-ghost" aria-label="Reset to defaults">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                    </svg>
                </button>
                <button class="panel-toggle btn-ghost" aria-label="Toggle advanced controls">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                </button>
                <button class="panel-minimize btn-ghost" aria-label="Minimize panel">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
        
        this.elements.content = document.createElement('div');
        this.elements.content.className = 'panel-content visual-controls-content';
        
        if (this.config.showRenderStats) {
            this.elements.statsDisplay = document.createElement('div');
            this.elements.statsDisplay.className = 'render-stats-display';
            this.elements.content.appendChild(this.elements.statsDisplay);
        }
        
        this.elements.container.appendChild(this.elements.header);
        this.elements.container.appendChild(this.elements.content);
        container.appendChild(this.elements.container);
        
        this.elements.container.style.cssText = `
            position: absolute;
            top: 20px;
            left: 380px;
            width: 320px;
            max-height: calc(100vh - 40px);
            z-index: 100;
        `;
    }
    
    setupCameraControls() {
        const cameraSection = this.createControlSection('Camera System', 'camera-controls');
        
        // Camera position X
        const positionXControl = this.createSliderControl({
            id: 'camera-position-x',
            label: 'Position X',
            min: -20,
            max: 20,
            value: this.state.cameraSettings.position[0],
            step: 0.1,
            unit: '',
            description: 'Camera position along X axis',
            onChange: (value) => {
                this.state.cameraSettings.position[0] = value;
                this.handleCameraChange('position', this.state.cameraSettings.position);
            }
        });
        
        // Camera position Y
        const positionYControl = this.createSliderControl({
            id: 'camera-position-y',
            label: 'Position Y',
            min: -20,
            max: 20,
            value: this.state.cameraSettings.position[1],
            step: 0.1,
            unit: '',
            description: 'Camera position along Y axis',
            onChange: (value) => {
                this.state.cameraSettings.position[1] = value;
                this.handleCameraChange('position', this.state.cameraSettings.position);
            }
        });
        
        // Camera position Z
        const positionZControl = this.createSliderControl({
            id: 'camera-position-z',
            label: 'Position Z',
            min: -20,
            max: 20,
            value: this.state.cameraSettings.position[2],
            step: 0.1,
            unit: '',
            description: 'Camera position along Z axis',
            onChange: (value) => {
                this.state.cameraSettings.position[2] = value;
                this.handleCameraChange('position', this.state.cameraSettings.position);
            }
        });
        
        // Field of view control
        const fovControl = this.createSliderControl({
            id: 'camera-fov',
            label: 'Field of View',
            min: 10,
            max: 120,
            value: this.state.cameraSettings.fov,
            step: 1,
            unit: '°',
            description: 'Camera field of view angle',
            onChange: (value) => {
                this.state.cameraSettings.fov = value;
                this.handleCameraChange('fov', value);
            }
        });
        
        // Auto orbit control
        const autoOrbitToggle = this.createToggleControl({
            id: 'camera-auto-orbit',
            label: 'Auto Orbit',
            value: this.state.cameraSettings.autoOrbit,
            description: 'Automatically orbit camera around target',
            onChange: (value) => {
                this.state.cameraSettings.autoOrbit = value;
                this.handleCameraChange('autoOrbit', value);
            }
        });
        
        // Camera shake intensity
        const shakeControl = this.createSliderControl({
            id: 'camera-shake',
            label: 'Shake Intensity',
            min: 0.0,
            max: 2.0,
            value: this.state.cameraSettings.shakeIntensity,
            step: 0.1,
            unit: '',
            description: 'Audio-reactive camera shake intensity',
            onChange: (value) => {
                this.state.cameraSettings.shakeIntensity = value;
                this.handleCameraChange('shakeIntensity', value);
            }
        });
        
        cameraSection.appendChild(positionXControl);
        cameraSection.appendChild(positionYControl);
        cameraSection.appendChild(positionZControl);
        cameraSection.appendChild(fovControl);
        cameraSection.appendChild(autoOrbitToggle);
        cameraSection.appendChild(shakeControl);
        this.elements.content.appendChild(cameraSection);
    }
    
    setupLightingControls() {
        const lightingSection = this.createControlSection('Lighting Rig', 'lighting-controls');
        
        // Ambient color control
        const ambientColorControl = this.createColorControl({
            id: 'ambient-color',
            label: 'Ambient Color',
            value: [...this.state.lightingSettings.ambientColor, 1.0],
            enableAlpha: false,
            description: 'Global ambient light color',
            onChange: (color) => {
                this.state.lightingSettings.ambientColor = color.slice(0, 3);
                this.handleLightingChange('ambientColor', this.state.lightingSettings.ambientColor);
            }
        });
        
        // Ambient intensity control
        const ambientIntensityControl = this.createSliderControl({
            id: 'ambient-intensity',
            label: 'Ambient Intensity',
            min: 0.0,
            max: 2.0,
            value: this.state.lightingSettings.ambientIntensity,
            step: 0.01,
            unit: '',
            description: 'Ambient light intensity',
            onChange: (value) => {
                this.state.lightingSettings.ambientIntensity = value;
                this.handleLightingChange('ambientIntensity', value);
            }
        });
        
        // Main light toggle
        const mainLightToggle = this.createToggleControl({
            id: 'main-light-enabled',
            label: 'Enable Main Light',
            value: this.state.lightingSettings.mainLightEnabled,
            description: 'Enable/disable main directional light',
            onChange: (value) => {
                this.state.lightingSettings.mainLightEnabled = value;
                this.handleLightingChange('mainLightEnabled', value);
            }
        });
        
        // Main light intensity control
        const mainLightIntensityControl = this.createSliderControl({
            id: 'main-light-intensity',
            label: 'Main Light Intensity',
            min: 0.0,
            max: 3.0,
            value: this.state.lightingSettings.mainLightIntensity,
            step: 0.01,
            unit: '',
            description: 'Main light intensity',
            onChange: (value) => {
                this.state.lightingSettings.mainLightIntensity = value;
                this.handleLightingChange('mainLightIntensity', value);
            }
        });
        
        // Shadow controls
        const shadowToggle = this.createToggleControl({
            id: 'shadows-enabled',
            label: 'Enable Shadows',
            value: this.state.lightingSettings.enableShadows,
            description: 'Enable shadow casting',
            onChange: (value) => {
                this.state.lightingSettings.enableShadows = value;
                this.handleLightingChange('enableShadows', value);
            }
        });
        
        lightingSection.appendChild(ambientColorControl);
        lightingSection.appendChild(ambientIntensityControl);
        lightingSection.appendChild(mainLightToggle);
        lightingSection.appendChild(mainLightIntensityControl);
        lightingSection.appendChild(shadowToggle);
        this.elements.content.appendChild(lightingSection);
    }
    
    setupPostProcessingControls() {
        const postProcessingSection = this.createControlSection('Post-Processing', 'post-processing-controls');
        
        // Post-processing toggle
        const postProcessingToggle = this.createToggleControl({
            id: 'post-processing-enabled',
            label: 'Enable Post-Processing',
            value: this.state.postProcessingSettings.enabled,
            description: 'Enable post-processing pipeline',
            onChange: (value) => {
                this.state.postProcessingSettings.enabled = value;
                this.handlePostProcessingChange('enabled', value);
            }
        });
        
        // Bloom toggle
        const bloomToggle = this.createToggleControl({
            id: 'bloom-enabled',
            label: 'Enable Bloom',
            value: this.state.postProcessingSettings.bloomEnabled,
            description: 'Enable bloom effect for bright areas',
            onChange: (value) => {
                this.state.postProcessingSettings.bloomEnabled = value;
                this.handlePostProcessingChange('bloomEnabled', value);
            }
        });
        
        // Bloom threshold control
        const bloomThresholdControl = this.createSliderControl({
            id: 'bloom-threshold',
            label: 'Bloom Threshold',
            min: 0.1,
            max: 3.0,
            value: this.state.postProcessingSettings.bloomThreshold,
            step: 0.01,
            unit: '',
            description: 'Brightness threshold for bloom effect',
            onChange: (value) => {
                this.state.postProcessingSettings.bloomThreshold = value;
                this.handlePostProcessingChange('bloomThreshold', value);
            }
        });
        
        // Bloom intensity control
        const bloomIntensityControl = this.createSliderControl({
            id: 'bloom-intensity',
            label: 'Bloom Intensity',
            min: 0.0,
            max: 2.0,
            value: this.state.postProcessingSettings.bloomIntensity,
            step: 0.01,
            unit: '',
            description: 'Bloom effect intensity',
            onChange: (value) => {
                this.state.postProcessingSettings.bloomIntensity = value;
                this.handlePostProcessingChange('bloomIntensity', value);
            }
        });
        
        // Exposure control
        const exposureControl = this.createSliderControl({
            id: 'exposure',
            label: 'Exposure',
            min: 0.1,
            max: 3.0,
            value: this.state.postProcessingSettings.exposure,
            step: 0.01,
            unit: '',
            description: 'Overall exposure adjustment',
            onChange: (value) => {
                this.state.postProcessingSettings.exposure = value;
                this.handlePostProcessingChange('exposure', value);
            }
        });
        
        // Contrast control
        const contrastControl = this.createSliderControl({
            id: 'contrast',
            label: 'Contrast',
            min: 0.0,
            max: 2.0,
            value: this.state.postProcessingSettings.contrast,
            step: 0.01,
            unit: '',
            description: 'Image contrast adjustment',
            onChange: (value) => {
                this.state.postProcessingSettings.contrast = value;
                this.handlePostProcessingChange('contrast', value);
            }
        });
        
        // Saturation control
        const saturationControl = this.createSliderControl({
            id: 'saturation',
            label: 'Saturation',
            min: 0.0,
            max: 2.0,
            value: this.state.postProcessingSettings.saturation,
            step: 0.01,
            unit: '',
            description: 'Color saturation adjustment',
            onChange: (value) => {
                this.state.postProcessingSettings.saturation = value;
                this.handlePostProcessingChange('saturation', value);
            }
        });
        
        postProcessingSection.appendChild(postProcessingToggle);
        postProcessingSection.appendChild(bloomToggle);
        postProcessingSection.appendChild(bloomThresholdControl);
        postProcessingSection.appendChild(bloomIntensityControl);
        postProcessingSection.appendChild(exposureControl);
        postProcessingSection.appendChild(contrastControl);
        postProcessingSection.appendChild(saturationControl);
        this.elements.content.appendChild(postProcessingSection);
    }
    
    setupEnvironmentControls() {
        const environmentSection = this.createControlSection('Environment', 'environment-controls');
        
        // Skybox toggle
        const skyboxToggle = this.createToggleControl({
            id: 'skybox-enabled',
            label: 'Enable Skybox',
            value: this.state.environmentSettings.skyboxEnabled,
            description: 'Enable environment skybox',
            onChange: (value) => {
                this.state.environmentSettings.skyboxEnabled = value;
                this.handleEnvironmentChange('skyboxEnabled', value);
            }
        });
        
        // Skybox intensity control
        const skyboxIntensityControl = this.createSliderControl({
            id: 'skybox-intensity',
            label: 'Skybox Intensity',
            min: 0.0,
            max: 2.0,
            value: this.state.environmentSettings.skyboxIntensity,
            step: 0.01,
            unit: '',
            description: 'Environment map intensity',
            onChange: (value) => {
                this.state.environmentSettings.skyboxIntensity = value;
                this.handleEnvironmentChange('skyboxIntensity', value);
            }
        });
        
        // Environment map selector
        const environmentMapControl = this.createSelectControl({
            id: 'environment-map',
            label: 'Environment Map',
            options: [
                { value: 'studio', label: 'Studio' },
                { value: 'outdoor', label: 'Outdoor' },
                { value: 'sunset', label: 'Sunset' },
                { value: 'night', label: 'Night Sky' },
                { value: 'abstract', label: 'Abstract' }
            ],
            value: this.state.environmentSettings.environmentMap,
            description: 'Select environment map preset',
            onChange: (value) => {
                this.state.environmentSettings.environmentMap = value;
                this.handleEnvironmentChange('environmentMap', value);
            }
        });
        
        // Ambient occlusion
        const aoStrengthControl = this.createSliderControl({
            id: 'ao-strength',
            label: 'AO Strength',
            min: 0.0,
            max: 2.0,
            value: this.state.environmentSettings.aoStrength,
            step: 0.01,
            unit: '',
            description: 'Ambient occlusion strength',
            onChange: (value) => {
                this.state.environmentSettings.aoStrength = value;
                this.handleEnvironmentChange('aoStrength', value);
            }
        });
        
        environmentSection.appendChild(skyboxToggle);
        environmentSection.appendChild(skyboxIntensityControl);
        environmentSection.appendChild(environmentMapControl);
        environmentSection.appendChild(aoStrengthControl);
        this.elements.content.appendChild(environmentSection);
    }
    
    setupQualityControls() {
        const qualitySection = this.createControlSection('Performance', 'quality-controls');
        
        // Render scale control
        const renderScaleControl = this.createSliderControl({
            id: 'render-scale',
            label: 'Render Scale',
            min: 0.25,
            max: 1.0,
            value: this.state.qualitySettings.renderScale,
            step: 0.05,
            unit: '',
            valueFormatter: (val) => `${Math.round(val * 100)}%`,
            description: 'Rendering resolution scale',
            onChange: (value) => {
                this.state.qualitySettings.renderScale = value;
                this.handleQualityChange('renderScale', value);
            }
        });
        
        // Adaptive quality toggle
        const adaptiveQualityToggle = this.createToggleControl({
            id: 'adaptive-quality',
            label: 'Adaptive Quality',
            value: this.state.qualitySettings.adaptiveQuality,
            description: 'Automatically adjust quality based on performance',
            onChange: (value) => {
                this.state.qualitySettings.adaptiveQuality = value;
                this.handleQualityChange('adaptiveQuality', value);
            }
        });
        
        // Target FPS control
        const targetFPSControl = this.createSliderControl({
            id: 'target-fps',
            label: 'Target FPS',
            min: 30,
            max: 120,
            value: this.state.qualitySettings.targetFPS,
            step: 15,
            unit: ' fps',
            description: 'Target frame rate for adaptive quality',
            onChange: (value) => {
                this.state.qualitySettings.targetFPS = value;
                this.handleQualityChange('targetFPS', value);
            }
        });
        
        qualitySection.appendChild(renderScaleControl);
        qualitySection.appendChild(adaptiveQualityToggle);
        qualitySection.appendChild(targetFPSControl);
        this.elements.content.appendChild(qualitySection);
    }
    
    setupAudioVisualControls() {
        const audioVisualSection = this.createControlSection('Audio-Visual', 'audio-visual-controls');
        
        // Audio-visual mapping toggle
        const audioVisualToggle = this.createToggleControl({
            id: 'audio-visual-enabled',
            label: 'Enable Audio-Visual Mapping',
            value: this.state.audioVisualMapping.enabled,
            description: 'Enable audio-driven visual effects',
            onChange: (value) => {
                this.state.audioVisualMapping.enabled = value;
                this.handleAudioVisualChange('enabled', value);
            }
        });
        
        // Camera shake reactivity
        const cameraShakeControl = this.createSliderControl({
            id: 'camera-shake-reactivity',
            label: 'Camera Shake Reactivity',
            min: 0.0,
            max: 1.0,
            value: this.state.audioVisualMapping.cameraShake,
            step: 0.01,
            unit: '',
            description: 'How much camera responds to audio beats',
            onChange: (value) => {
                this.state.audioVisualMapping.cameraShake = value;
                this.handleAudioVisualChange('cameraShake', value);
            }
        });
        
        // Light pulse reactivity
        const lightPulseControl = this.createSliderControl({
            id: 'light-pulse-reactivity',
            label: 'Light Pulse Reactivity',
            min: 0.0,
            max: 1.0,
            value: this.state.audioVisualMapping.lightPulse,
            step: 0.01,
            unit: '',
            description: 'How much lights pulse with audio',
            onChange: (value) => {
                this.state.audioVisualMapping.lightPulse = value;
                this.handleAudioVisualChange('lightPulse', value);
            }
        });
        
        // Bloom reactivity
        const bloomReactivityControl = this.createSliderControl({
            id: 'bloom-reactivity',
            label: 'Bloom Reactivity',
            min: 0.0,
            max: 1.0,
            value: this.state.audioVisualMapping.bloomReactivity,
            step: 0.01,
            unit: '',
            description: 'How much bloom responds to audio energy',
            onChange: (value) => {
                this.state.audioVisualMapping.bloomReactivity = value;
                this.handleAudioVisualChange('bloomReactivity', value);
            }
        });
        
        audioVisualSection.appendChild(audioVisualToggle);
        audioVisualSection.appendChild(cameraShakeControl);
        audioVisualSection.appendChild(lightPulseControl);
        audioVisualSection.appendChild(bloomReactivityControl);
        this.elements.content.appendChild(audioVisualSection);
    }
    
    initializeStatsDisplay() {
        if (!this.elements.statsDisplay) return;
        
        this.elements.statsDisplay.innerHTML = `
            <div class="stats-header">
                <h4>Render Statistics</h4>
            </div>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">FPS:</span>
                    <span class="stat-value" id="fps-display">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Frame Time:</span>
                    <span class="stat-value" id="frame-time-display">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Render Scale:</span>
                    <span class="stat-value" id="render-scale-display">--</span>
                </div>
            </div>
        `;
        
        this.startStatsUpdate();
    }
    
    startStatsUpdate() {
        const updateStats = () => {
            if (this.state.isInitialized && this.config.renderEngine) {
                this.updateRenderStats();
            }
            setTimeout(updateStats, 1000);
        };
        updateStats();
    }
    
    updateRenderStats() {
        if (!this.config.renderEngine || !this.elements.statsDisplay) return;
        
        const now = performance.now();
        
        if (this.renderStats.lastUpdate > 0) {
            const deltaTime = now - this.renderStats.lastUpdate;
            this.renderStats.fps = 1000 / deltaTime;
            this.renderStats.frameTime = deltaTime;
        }
        this.renderStats.lastUpdate = now;
        
        const fpsElement = this.elements.statsDisplay.querySelector('#fps-display');
        const frameTimeElement = this.elements.statsDisplay.querySelector('#frame-time-display');
        const renderScaleElement = this.elements.statsDisplay.querySelector('#render-scale-display');
        
        if (fpsElement) {
            fpsElement.textContent = Math.round(this.renderStats.fps);
            fpsElement.style.color = this.renderStats.fps >= 55 ? '#00ff00' : 
                                   this.renderStats.fps >= 30 ? '#ffaa00' : '#ff0040';
        }
        
        if (frameTimeElement) {
            frameTimeElement.textContent = `${this.renderStats.frameTime.toFixed(1)}ms`;
        }
        
        if (renderScaleElement) {
            renderScaleElement.textContent = `${Math.round(this.state.qualitySettings.renderScale * 100)}%`;
        }
    }
    
    createControlSection(title, className) {
        const section = document.createElement('div');
        section.className = `control-group ${className}`;
        
        const header = document.createElement('div');
        header.className = 'control-group-header';
        header.innerHTML = `
            <h4 class="control-group-title">${title}</h4>
            <button class="section-toggle btn-ghost" aria-label="Toggle section">▼</button>
        `;
        
        section.appendChild(header);
        
        const toggleButton = header.querySelector('.section-toggle');
        toggleButton.addEventListener('click', () => {
            section.classList.toggle('collapsed');
            toggleButton.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        });
        
        return section;
    }
    
    createSliderControl(options) {
        const container = document.createElement('div');
        container.className = 'control-item slider-control';
        
        const label = document.createElement('label');
        label.className = 'control-label';
        label.textContent = options.label;
        label.setAttribute('for', options.id);
        
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = options.id;
        slider.className = 'slider';
        slider.min = options.min;
        slider.max = options.max;
        slider.value = options.value;
        slider.step = options.step;
        
        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'slider-value';
        
        const updateDisplay = (value) => {
            valueDisplay.textContent = options.valueFormatter ? 
                options.valueFormatter(value) : 
                `${value}${options.unit || ''}`;
        };
        
        updateDisplay(options.value);
        
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            updateDisplay(value);
            
            if (options.onChange) {
                this.throttledUpdate(() => {
                    options.onChange(value);
                });
            }
        });
        
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);
        container.appendChild(label);
        container.appendChild(sliderContainer);
        
        if (options.description) {
            const description = document.createElement('div');
            description.className = 'control-description';
            description.textContent = options.description;
            container.appendChild(description);
        }
        
        this.elements.controls.set(options.id, { slider, valueDisplay, container });
        return container;
    }
    
    createColorControl(options) {
        const container = document.createElement('div');
        container.className = 'control-item color-control';
        
        const label = document.createElement('label');
        label.className = 'control-label';
        label.textContent = options.label;
        label.setAttribute('for', options.id);
        
        const colorContainer = document.createElement('div');
        colorContainer.className = 'color-container';
        
        const colorSwatch = document.createElement('div');
        colorSwatch.className = 'color-swatch';
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = options.id;
        colorInput.className = 'color-input';
        
        const updateColor = (color) => {
            const rgba = Array.isArray(color) ? color : [1, 1, 1, 1];
            const r = Math.round(rgba[0] * 255);
            const g = Math.round(rgba[1] * 255);
            const b = Math.round(rgba[2] * 255);
            const a = rgba[3] || 1;
            
            colorSwatch.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
            
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            colorInput.value = hex;
        };
        
        updateColor(options.value);
        
        colorInput.addEventListener('change', (e) => {
            const hex = e.target.value;
            const r = parseInt(hex.substr(1, 2), 16) / 255;
            const g = parseInt(hex.substr(3, 2), 16) / 255;
            const b = parseInt(hex.substr(5, 2), 16) / 255;
            const a = options.enableAlpha ? (options.value[3] || 1) : 1;
            
            const newColor = [r, g, b, a];
            updateColor(newColor);
            
            if (options.onChange) {
                options.onChange(newColor);
            }
        });
        
        colorSwatch.addEventListener('click', () => {
            colorInput.click();
        });
        
        colorContainer.appendChild(colorSwatch);
        colorContainer.appendChild(colorInput);
        container.appendChild(label);
        container.appendChild(colorContainer);
        
        if (options.description) {
            const description = document.createElement('div');
            description.className = 'control-description';
            description.textContent = options.description;
            container.appendChild(description);
        }
        
        this.elements.controls.set(options.id, { colorInput, colorSwatch, container });
        return container;
    }
    
    createSelectControl(options) {
        const container = document.createElement('div');
        container.className = 'control-item select-control';
        
        const label = document.createElement('label');
        label.className = 'control-label';
        label.textContent = options.label;
        label.setAttribute('for', options.id);
        
        const select = document.createElement('select');
        select.id = options.id;
        select.className = 'input select';
        
        options.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            if (option.value === options.value) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });
        
        select.addEventListener('change', (e) => {
            if (options.onChange) {
                options.onChange(e.target.value);
            }
        });
        
        container.appendChild(label);
        container.appendChild(select);
        
        if (options.description) {
            const description = document.createElement('div');
            description.className = 'control-description';
            description.textContent = options.description;
            container.appendChild(description);
        }
        
        this.elements.controls.set(options.id, { select, container });
        return container;
    }
    
    createToggleControl(options) {
        const container = document.createElement('div');
        container.className = 'control-item toggle-control';
        
        const label = document.createElement('label');
        label.className = 'toggle-label';
        label.setAttribute('for', options.id);
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = options.id;
        checkbox.className = 'toggle-input';
        checkbox.checked = options.value;
        
        const toggleSwitch = document.createElement('div');
        toggleSwitch.className = 'toggle-switch';
        
        const labelText = document.createElement('span');
        labelText.className = 'toggle-text';
        labelText.textContent = options.label;
        
        checkbox.addEventListener('change', (e) => {
            if (options.onChange) {
                options.onChange(e.target.checked);
            }
        });
        
        label.appendChild(checkbox);
        label.appendChild(toggleSwitch);
        label.appendChild(labelText);
        container.appendChild(label);
        
        if (options.description) {
            const description = document.createElement('div');
            description.className = 'control-description';
            description.textContent = options.description;
            container.appendChild(description);
        }
        
        this.elements.controls.set(options.id, { checkbox, toggleSwitch, container });
        return container;
    }
    
    setupEventListeners() {
        const resetButton = this.elements.header.querySelector('.visual-reset');
        const toggleButton = this.elements.header.querySelector('.panel-toggle');
        const minimizeButton = this.elements.header.querySelector('.panel-minimize');
        
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }
        
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.toggleAdvancedControls();
            });
        }
        
        if (minimizeButton) {
            minimizeButton.addEventListener('click', () => {
                this.toggleVisibility();
            });
        }
        
        if (this.config.enableKeyboardNavigation) {
            this.elements.container.addEventListener('keydown', this.handleKeyboardInput);
        }
        
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    async initializeParticleEffects() {
        try {
            await particleUI.initialize();
            
            this.elements.controls.forEach((control, id) => {
                if (control.slider) {
                    particleUI.attachToElement(control.slider, {
                        type: 'adjustment',
                        particleCount: 3,
                        lifetime: 0.8,
                        color: this.config.accentColor
                    });
                }
                
                if (control.toggleSwitch) {
                    particleUI.attachToElement(control.toggleSwitch, {
                        type: 'toggle',
                        particleCount: 6,
                        lifetime: 1.2,
                        color: this.config.accentColor
                    });
                }
                
                if (control.colorSwatch) {
                    particleUI.attachToElement(control.colorSwatch, {
                        type: 'colorPick',
                        particleCount: 8,
                        lifetime: 1.5,
                        color: 'dynamic'
                    });
                }
            });
            
            console.log('VisualControls particle effects initialized');
            
        } catch (error) {
            console.warn('Failed to initialize particle effects:', error);
        }
    }
    
    async loadInitialSettings() {
        if (this.config.renderEngine) {
            try {
                this.config.renderEngine.setCameraPosition(this.state.cameraSettings.position);
                this.config.renderEngine.setCameraFOV(this.state.cameraSettings.fov * Math.PI / 180);
                this.config.renderEngine.setRenderScale(this.state.qualitySettings.renderScale);
                this.config.renderEngine.setQuality(this.state.qualitySettings);
                
            } catch (error) {
                console.warn('Failed to load initial visual settings:', error);
            }
        }
    }
    
    handleCameraChange(property, value) {
        console.log(`VisualControls camera changed: ${property} = ${value}`);
        
        if (this.config.renderEngine) {
            switch (property) {
                case 'position':
                    this.config.renderEngine.setCameraPosition(value);
                    break;
                case 'fov':
                    this.config.renderEngine.setCameraFOV(value * Math.PI / 180);
                    break;
            }
        }
        
        if (this.callbacks.onCameraChange) {
            this.callbacks.onCameraChange(property, value);
        }
        
        if (this.config.enableSpringAnimations) {
            this.animatePropertyChange(property, value);
        }
    }
    
    handleLightingChange(property, value) {
        console.log(`VisualControls lighting changed: ${property} = ${value}`);
        
        if (this.callbacks.onLightingChange) {
            this.callbacks.onLightingChange(property, value);
        }
    }
    
    handlePostProcessingChange(property, value) {
        console.log(`VisualControls post-processing changed: ${property} = ${value}`);
        
        if (this.callbacks.onPostProcessingChange) {
            this.callbacks.onPostProcessingChange(property, value);
        }
    }
    
    handleEnvironmentChange(property, value) {
        console.log(`VisualControls environment changed: ${property} = ${value}`);
    }
    
    handleQualityChange(property, value) {
        console.log(`VisualControls quality changed: ${property} = ${value}`);
        
        if (this.config.renderEngine) {
            switch (property) {
                case 'renderScale':
                    this.config.renderEngine.setRenderScale(value);
                    break;
                case 'adaptiveQuality':
                case 'targetFPS':
                    this.config.renderEngine.setQuality({ [property]: value });
                    break;
            }
        }
        
        if (this.callbacks.onQualityChange) {
            this.callbacks.onQualityChange(property, value);
        }
    }
    
    handleAudioVisualChange(property, value) {
        console.log(`VisualControls audio-visual changed: ${property} = ${value}`);
    }
    
    throttledUpdate(callback) {
        const now = performance.now();
        
        if (now - this.updateThrottle.lastUpdate > this.config.updateThrottle) {
            callback();
            this.updateThrottle.lastUpdate = now;
        } else {
            if (this.updateThrottle.pendingUpdate) {
                clearTimeout(this.updateThrottle.pendingUpdate);
            }
            
            this.updateThrottle.pendingUpdate = setTimeout(() => {
                callback();
                this.updateThrottle.lastUpdate = performance.now();
                this.updateThrottle.pendingUpdate = null;
            }, this.config.updateThrottle);
        }
    }
    
    animatePropertyChange(property, value) {
        if (!this.config.enableSpringAnimations) return;
        
        const control = this.elements.controls.get(property) || 
                       this.elements.controls.get(property.replace(/([A-Z])/g, '-$1').toLowerCase());
        
        if (!control || !control.container) return;
        
        this.springSystem.createSpring({
            from: 0,
            to: 1,
            tension: 250,
            friction: 15,
            onUpdate: (progress) => {
                const intensity = Math.sin(progress * Math.PI);
                const glowColor = ColorUtils.hexToRgba(this.config.accentColor, intensity * 0.4);
                control.container.style.boxShadow = `0 0 ${intensity * 15}px ${glowColor}`;
            },
            onRest: () => {
                control.container.style.boxShadow = '';
            }
        });
    }
    
    resetToDefaults() {
        this.state.cameraSettings = {
            position: [0, 0, 5],
            target: [0, 0, 0],
            fov: 45,
            autoOrbit: false,
            orbitSpeed: 0.5,
            shakeIntensity: 0.0
        };
        
        this.state.lightingSettings.ambientColor = [0.1, 0.1, 0.1];
        this.state.lightingSettings.ambientIntensity = 0.3;
        this.state.lightingSettings.mainLightIntensity = 1.0;
        this.state.lightingSettings.enableShadows = true;
        
        this.state.postProcessingSettings.enabled = true;
        this.state.postProcessingSettings.bloomEnabled = true;
        this.state.postProcessingSettings.bloomThreshold = 1.0;
        this.state.postProcessingSettings.bloomIntensity = 0.8;
        this.state.postProcessingSettings.exposure = 1.0;
        this.state.postProcessingSettings.contrast = 1.0;
        this.state.postProcessingSettings.saturation = 1.0;
        
        this.state.qualitySettings.renderScale = 1.0;
        this.state.qualitySettings.adaptiveQuality = true;
        this.state.qualitySettings.targetFPS = 60;
        
        this.updateUIFromState();
        this.loadInitialSettings();
        
        console.log('Visual controls reset to defaults');
    }
    
    updateUIFromState() {
        this.elements.controls.forEach((control, id) => {
            const stateValue = this.getStateValueForControl(id);
            if (stateValue !== undefined) {
                if (control.slider) {
                    control.slider.value = stateValue;
                    if (control.valueDisplay) {
                        const formatter = this.getFormatterForControl(id);
                        control.valueDisplay.textContent = formatter ? 
                            formatter(stateValue) : 
                            stateValue.toString();
                    }
                }
                
                if (control.select) {
                    control.select.value = stateValue;
                }
                
                if (control.checkbox) {
                    control.checkbox.checked = stateValue;
                }
                
                if (control.colorSwatch && Array.isArray(stateValue)) {
                    const [r, g, b, a] = stateValue;
                    control.colorSwatch.style.backgroundColor = 
                        `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a || 1})`;
                }
            }
        });
    }
    
    getStateValueForControl(controlId) {
        const stateMap = {
            'camera-position-x': this.state.cameraSettings.position[0],
            'camera-position-y': this.state.cameraSettings.position[1],
            'camera-position-z': this.state.cameraSettings.position[2],
            'camera-fov': this.state.cameraSettings.fov,
            'camera-auto-orbit': this.state.cameraSettings.autoOrbit,
            'camera-shake': this.state.cameraSettings.shakeIntensity,
            'ambient-color': this.state.lightingSettings.ambientColor,
            'ambient-intensity': this.state.lightingSettings.ambientIntensity,
            'main-light-enabled': this.state.lightingSettings.mainLightEnabled,
            'main-light-intensity': this.state.lightingSettings.mainLightIntensity,
            'shadows-enabled': this.state.lightingSettings.enableShadows,
            'post-processing-enabled': this.state.postProcessingSettings.enabled,
            'bloom-enabled': this.state.postProcessingSettings.bloomEnabled,
            'bloom-threshold': this.state.postProcessingSettings.bloomThreshold,
            'bloom-intensity': this.state.postProcessingSettings.bloomIntensity,
            'exposure': this.state.postProcessingSettings.exposure,
            'contrast': this.state.postProcessingSettings.contrast,
            'saturation': this.state.postProcessingSettings.saturation,
            'skybox-enabled': this.state.environmentSettings.skyboxEnabled,
            'skybox-intensity': this.state.environmentSettings.skyboxIntensity,
            'environment-map': this.state.environmentSettings.environmentMap,
            'ao-strength': this.state.environmentSettings.aoStrength,
            'render-scale': this.state.qualitySettings.renderScale,
            'adaptive-quality': this.state.qualitySettings.adaptiveQuality,
            'target-fps': this.state.qualitySettings.targetFPS,
            'audio-visual-enabled': this.state.audioVisualMapping.enabled,
            'camera-shake-reactivity': this.state.audioVisualMapping.cameraShake,
            'light-pulse-reactivity': this.state.audioVisualMapping.lightPulse,
            'bloom-reactivity': this.state.audioVisualMapping.bloomReactivity
        };
        
        return stateMap[controlId];
    }
    
    getFormatterForControl(controlId) {
        const formatterMap = {
            'camera-fov': (val) => `${val}°`,
            'render-scale': (val) => `${Math.round(val * 100)}%`,
            'target-fps': (val) => `${val} fps`
        };
        
        return formatterMap[controlId];
    }
    
    toggleAdvancedControls() {
        this.state.isExpanded = !this.state.isExpanded;
        
        const content = this.elements.content;
        const toggleButton = this.elements.header.querySelector('.panel-toggle');
        
        if (this.state.isExpanded) {
            content.style.maxHeight = content.scrollHeight + 'px';
            toggleButton.style.transform = 'rotate(180deg)';
            content.classList.add('expanded');
        } else {
            content.style.maxHeight = '200px';
            toggleButton.style.transform = 'rotate(0deg)';
            content.classList.remove('expanded');
        }
    }
    
    toggleVisibility() {
        this.state.isVisible = !this.state.isVisible;
        
        if (this.state.isVisible) {
            this.elements.container.classList.remove('collapsed');
            this.elements.container.classList.add('expanded');
        } else {
            this.elements.container.classList.add('collapsed');
            this.elements.container.classList.remove('expanded');
        }
    }
    
    handleKeyboardInput(event) {
        switch (event.key) {
            case 'Escape':
                this.toggleVisibility();
                break;
            case 'r':
            case 'R':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.resetToDefaults();
                }
                break;
        }
    }
    
    handleResize() {
        if (this.config.renderEngine) {
            // Render engine should handle its own resize logic
        }
    }
    
    getState() {
        return {
            camera: { ...this.state.cameraSettings },
            lighting: { ...this.state.lightingSettings },
            postProcessing: { ...this.state.postProcessingSettings },
            environment: { ...this.state.environmentSettings },
            quality: { ...this.state.qualitySettings },
            audioVisual: { ...this.state.audioVisualMapping }
        };
    }
    
    update(deltaTime) {
        if (!this.state.isInitialized) return;
        
        if (this.config.enableSpringAnimations) {
            this.springSystem.update(deltaTime);
        }
        
        if (this.state.audioVisualMapping.enabled && this.config.audioEngine) {
            this.processAudioVisualMapping();
        }
        
        if (this.state.cameraSettings.autoOrbit) {
            this.updateAutoOrbit(deltaTime);
        }
    }
    
    processAudioVisualMapping() {
        const audioData = this.config.audioEngine.getAudioData();
        if (!audioData) return;
        
        const { bassLevel, midLevel, trebleLevel, energy, beat, beatStrength } = audioData;
        
        if (this.state.audioVisualMapping.cameraShake > 0 && beat) {
            const shakeAmount = beatStrength * this.state.audioVisualMapping.cameraShake * 0.1;
            this.applyCameraShake(shakeAmount);
        }
        
        if (this.state.audioVisualMapping.lightPulse > 0) {
            const pulseAmount = energy * this.state.audioVisualMapping.lightPulse;
            this.applyLightPulse(pulseAmount);
        }
        
        if (this.state.audioVisualMapping.bloomReactivity > 0) {
            const baseIntensity = this.state.postProcessingSettings.bloomIntensity;
            const audioBoost = energy * this.state.audioVisualMapping.bloomReactivity * 0.5;
            const newIntensity = baseIntensity + audioBoost;
            
            if (this.config.renderEngine) {
                // Apply bloom intensity change to render engine
            }
        }
    }
    
    applyCameraShake(intensity) {
        if (!this.config.renderEngine) return;
        
        const currentPos = this.state.cameraSettings.position;
        const shakeX = (Math.random() - 0.5) * intensity;
        const shakeY = (Math.random() - 0.5) * intensity;
        const shakeZ = (Math.random() - 0.5) * intensity;
        
        const shakenPos = [
            currentPos[0] + shakeX,
            currentPos[1] + shakeY,
            currentPos[2] + shakeZ
        ];
        
        this.config.renderEngine.setCameraPosition(shakenPos);
        
        setTimeout(() => {
            this.config.renderEngine.setCameraPosition(currentPos);
        }, 50);
    }
    
    applyLightPulse(intensity) {
        const baseIntensity = this.state.lightingSettings.mainLightIntensity;
        const pulseIntensity = baseIntensity * (1 + intensity * 0.3);
        
        if (this.config.renderEngine) {
            // Apply light intensity change to render engine
        }
        
        setTimeout(() => {
            if (this.config.renderEngine) {
                // Restore base intensity
            }
        }, 100);
    }
    
    updateAutoOrbit(deltaTime) {
        if (!this.config.renderEngine) return;
        
        const orbitSpeed = this.state.cameraSettings.orbitSpeed;
        const time = performance.now() * 0.001;
        
        const x = Math.cos(time * orbitSpeed) * 5;
        const z = Math.sin(time * orbitSpeed) * 5;
        const y = this.state.cameraSettings.position[1];
        
        this.state.cameraSettings.position = [x, y, z];
        this.config.renderEngine.setCameraPosition([x, y, z]);
    }
    
    destroy() {
        if (this.springSystem) {
            this.springSystem.destroy();
        }
        
        if (this.config.enableParticleEffects && particleUI) {
            this.elements.controls.forEach((control) => {
                if (control.slider) {
                    particleUI.detachFromElement(control.slider);
                }
                if (control.toggleSwitch) {
                    particleUI.detachFromElement(control.toggleSwitch);
                }
                if (control.colorSwatch) {
                    particleUI.detachFromElement(control.colorSwatch);
                }
            });
        }
        
        if (this.updateThrottle.pendingUpdate) {
            clearTimeout(this.updateThrottle.pendingUpdate);
        }
        
        window.removeEventListener('resize', this.handleResize);
        
        if (this.elements.container && this.elements.container.parentNode) {
            this.elements.container.parentNode.removeChild(this.elements.container);
        }
        
        this.elements.controls.clear();
        this.elements = {};
        this.state.isInitialized = false;
        
        console.log('VisualControls component destroyed');
    }
}

export default VisualControls;