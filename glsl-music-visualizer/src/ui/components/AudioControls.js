/**
 * Audio Controls Component - Advanced Audio Analysis Control Panel
 * Comprehensive controls for FFT analysis, beat detection, and audio processing
 * Location: src/ui/components/AudioControls.js
 *
 * Features:
 * - Real-time FFT resolution and algorithm controls
 * - Advanced beat detection sensitivity tuning
 * - Frequency response curve editor with EQ visualization
 * - Audio feature weighting and emphasis controls
 * - Latency compensation and timing controls
 * - Live spectrum display with multiple scales
 * - Audio-reactive parameter adjustment
 * - Performance monitoring and optimization
 * - Integration with existing SpringSystem and ParticleUI
 */

import { SpringSystem } from '../animations/SpringSystem.js';
import { particleUI } from '../animations/ParticleUI.js';
import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';

export class AudioControls {
    constructor(options = {}) {
        // Configuration
        this.config = {
            // Integration points
            audioEngine: options.audioEngine || null,
            fftProcessor: options.fftProcessor || null,
            beatDetector: options.beatDetector || null,
            container: options.container || null,
            
            // UI settings
            enableParticleEffects: options.enableParticleEffects !== false,
            enableSpringAnimations: options.enableSpringAnimations !== false,
            showAdvancedControls: options.showAdvancedControls !== false,
            showSpectrumDisplay: options.showSpectrumDisplay !== false,
            
            // Audio analysis defaults
            defaultFFTSize: options.defaultFFTSize || 4096,
            defaultAlgorithm: options.defaultAlgorithm || 'hybrid',
            defaultSensitivity: options.defaultSensitivity || 0.7,
            
            // Styling
            theme: options.theme || 'dark',
            accentColor: options.accentColor || '#00f5ff',
            
            // Accessibility
            enableKeyboardNavigation: options.enableKeyboardNavigation !== false,
            enableScreenReader: options.enableScreenReader !== false
        };
        
        // Component state
        this.state = {
            isInitialized: false,
            isVisible: true,
            isExpanded: false,
            
            // Audio analysis parameters
            fftSize: this.config.defaultFFTSize,
            fftAlgorithm: this.config.defaultAlgorithm,
            windowFunction: 'hann',
            overlapRatio: 0.75,
            
            // Beat detection settings
            beatSensitivity: this.config.defaultSensitivity,
            tempoRange: { min: 60, max: 200 },
            beatThreshold: 0.6,
            onsetDetection: true,
            
            // Frequency analysis
            frequencyRange: { min: 20, max: 20000 },
            binning: 'logarithmic',
            smoothing: 0.3,
            
            // Audio features
            featureWeights: {
                spectral: 0.5,
                temporal: 0.5,
                harmonic: 0.3,
                rhythmic: 0.7
            },
            
            // Performance settings
            latencyCompensation: 0,
            adaptiveQuality: true,
            targetFPS: 60
        };
        
        // UI elements
        this.elements = {
            container: null,
            header: null,
            content: null,
            spectrumDisplay: null,
            
            // Control sections
            fftSection: null,
            beatSection: null,
            frequencySection: null,
            performanceSection: null,
            
            // Individual controls
            controls: new Map()
        };
        
        // Spring system for animations
        this.springSystem = new SpringSystem({
            enableAudioReactivity: true,
            targetFPS: 60
        });
        
        // Audio data visualization
        this.spectrumData = {
            frequencyData: new Float32Array(1024),
            frequencyDataDb: new Float32Array(1024),
            peaks: new Array(1024).fill(0),
            peakDecay: 0.95,
            
            // Visualization settings
            scale: 'logarithmic',
            colorMode: 'frequency',
            showPeaks: true,
            showGrid: true
        };
        
        // Performance monitoring
        this.performanceMetrics = {
            updateTime: 0,
            renderTime: 0,
            lastUpdate: 0,
            frameCount: 0,
            averageFPS: 60
        };
        
        // Event callbacks
        this.callbacks = {
            onParameterChange: options.onParameterChange || null,
            onFFTSettingsChange: options.onFFTSettingsChange || null,
            onBeatSettingsChange: options.onBeatSettingsChange || null,
            onPerformanceChange: options.onPerformanceChange || null
        };
        
        // Bound methods for event handling
        this.handleParameterChange = this.handleParameterChange.bind(this);
        this.handleKeyboardInput = this.handleKeyboardInput.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.updateSpectrum = this.updateSpectrum.bind(this);
        
        console.log('AudioControls initialized', {
            defaultFFTSize: this.config.defaultFFTSize,
            algorithm: this.config.defaultAlgorithm,
            particleEffects: this.config.enableParticleEffects
        });
    }
    
    /**
     * Initialize the audio controls component
     */
    async initialize() {
        try {
            // Create UI structure
            this.createUIStructure();
            
            // Setup control panels
            this.setupFFTControls();
            this.setupBeatDetectionControls();
            this.setupFrequencyControls();
            this.setupPerformanceControls();
            
            // Initialize spectrum display
            if (this.config.showSpectrumDisplay) {
                this.initializeSpectrumDisplay();
            }
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize particle effects
            if (this.config.enableParticleEffects) {
                await this.initializeParticleEffects();
            }
            
            // Apply initial settings to audio engines
            this.applyInitialSettings();
            
            this.state.isInitialized = true;
            
            console.log('AudioControls component initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize AudioControls:', error);
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
        this.elements.container.className = 'audio-controls panel glass';
        this.elements.container.setAttribute('role', 'region');
        this.elements.container.setAttribute('aria-label', 'Audio Analysis Controls');
        
        // Header section
        this.elements.header = document.createElement('div');
        this.elements.header.className = 'panel-header';
        this.elements.header.innerHTML = `
            <h3 class="panel-title">Audio Analysis</h3>
            <div class="panel-controls">
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
        
        // Content container
        this.elements.content = document.createElement('div');
        this.elements.content.className = 'panel-content audio-controls-content';
        
        // Add live spectrum display if enabled
        if (this.config.showSpectrumDisplay) {
            this.elements.spectrumDisplay = document.createElement('div');
            this.elements.spectrumDisplay.className = 'spectrum-display';
            this.elements.content.appendChild(this.elements.spectrumDisplay);
        }
        
        // Assemble structure
        this.elements.container.appendChild(this.elements.header);
        this.elements.container.appendChild(this.elements.content);
        container.appendChild(this.elements.container);
        
        // Apply CSS positioning
        this.elements.container.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            width: 320px;
            max-height: calc(100vh - 40px);
            z-index: 100;
        `;
    }
    
    /**
     * Setup FFT analysis controls
     */
    setupFFTControls() {
        this.elements.fftSection = this.createControlSection('FFT Analysis', 'fft-controls');
        
        // FFT Size Control
        const fftSizeControl = this.createSliderControl({
            id: 'fft-size',
            label: 'FFT Resolution',
            min: 10, // 2^10 = 1024
            max: 13, // 2^13 = 8192
            value: Math.log2(this.state.fftSize),
            step: 1,
            unit: ' samples',
            valueFormatter: (val) => Math.pow(2, val).toLocaleString(),
            description: 'Higher values provide better frequency resolution but increased latency',
            onChange: (value) => {
                this.state.fftSize = Math.pow(2, value);
                this.handleParameterChange('fftSize', this.state.fftSize);
            }
        });
        
        // Algorithm Selection
        const algorithmControl = this.createSelectControl({
            id: 'fft-algorithm',
            label: 'FFT Algorithm',
            options: [
                { value: 'native', label: 'Native (Web Audio)', description: 'Fast, basic accuracy' },
                { value: 'custom', label: 'Custom JS', description: 'Medium speed, good accuracy' },
                { value: 'hybrid', label: 'Hybrid', description: 'Adaptive algorithm selection' }
            ],
            value: this.state.fftAlgorithm,
            description: 'Algorithm used for frequency analysis computation',
            onChange: (value) => {
                this.state.fftAlgorithm = value;
                this.handleParameterChange('fftAlgorithm', value);
            }
        });
        
        // Window Function
        const windowControl = this.createSelectControl({
            id: 'window-function',
            label: 'Window Function',
            options: [
                { value: 'hann', label: 'Hann', description: 'Good general purpose' },
                { value: 'hamming', label: 'Hamming', description: 'Better side-lobe suppression' },
                { value: 'blackman', label: 'Blackman', description: 'Excellent side-lobe suppression' },
                { value: 'rectangular', label: 'Rectangular', description: 'No windowing' }
            ],
            value: this.state.windowFunction,
            description: 'Windowing function applied before FFT to reduce spectral leakage',
            onChange: (value) => {
                this.state.windowFunction = value;
                this.handleParameterChange('windowFunction', value);
            }
        });
        
        // Overlap Ratio
        const overlapControl = this.createSliderControl({
            id: 'overlap-ratio',
            label: 'Overlap Ratio',
            min: 0,
            max: 0.9,
            value: this.state.overlapRatio,
            step: 0.05,
            unit: '',
            valueFormatter: (val) => `${Math.round(val * 100)}%`,
            description: 'Overlap between consecutive FFT frames for smoother analysis',
            onChange: (value) => {
                this.state.overlapRatio = value;
                this.handleParameterChange('overlapRatio', value);
            }
        });
        
        // Add controls to section
        this.elements.fftSection.appendChild(fftSizeControl);
        this.elements.fftSection.appendChild(algorithmControl);
        this.elements.fftSection.appendChild(windowControl);
        this.elements.fftSection.appendChild(overlapControl);
        
        this.elements.content.appendChild(this.elements.fftSection);
    }
    
    /**
     * Setup beat detection controls
     */
    setupBeatDetectionControls() {
        this.elements.beatSection = this.createControlSection('Beat Detection', 'beat-controls');
        
        // Beat Sensitivity
        const sensitivityControl = this.createSliderControl({
            id: 'beat-sensitivity',
            label: 'Beat Sensitivity',
            min: 0.1,
            max: 1.0,
            value: this.state.beatSensitivity,
            step: 0.05,
            unit: '',
            valueFormatter: (val) => `${Math.round(val * 100)}%`,
            description: 'Sensitivity of beat detection algorithm',
            onChange: (value) => {
                this.state.beatSensitivity = value;
                this.handleParameterChange('beatSensitivity', value);
            }
        });
        
        // Tempo Range
        const tempoMinControl = this.createSliderControl({
            id: 'tempo-min',
            label: 'Min Tempo',
            min: 40,
            max: 180,
            value: this.state.tempoRange.min,
            step: 5,
            unit: ' BPM',
            description: 'Minimum expected tempo for beat tracking',
            onChange: (value) => {
                this.state.tempoRange.min = value;
                this.handleParameterChange('tempoRangeMin', value);
            }
        });
        
        const tempoMaxControl = this.createSliderControl({
            id: 'tempo-max',
            label: 'Max Tempo',
            min: 100,
            max: 240,
            value: this.state.tempoRange.max,
            step: 5,
            unit: ' BPM',
            description: 'Maximum expected tempo for beat tracking',
            onChange: (value) => {
                this.state.tempoRange.max = value;
                this.handleParameterChange('tempoRangeMax', value);
            }
        });
        
        // Beat Threshold
        const thresholdControl = this.createSliderControl({
            id: 'beat-threshold',
            label: 'Beat Threshold',
            min: 0.1,
            max: 1.0,
            value: this.state.beatThreshold,
            step: 0.05,
            unit: '',
            valueFormatter: (val) => `${Math.round(val * 100)}%`,
            description: 'Threshold for beat detection triggers',
            onChange: (value) => {
                this.state.beatThreshold = value;
                this.handleParameterChange('beatThreshold', value);
            }
        });
        
        // Onset Detection Toggle
        const onsetToggle = this.createToggleControl({
            id: 'onset-detection',
            label: 'Onset Detection',
            value: this.state.onsetDetection,
            description: 'Enable advanced onset detection for better beat accuracy',
            onChange: (value) => {
                this.state.onsetDetection = value;
                this.handleParameterChange('onsetDetection', value);
            }
        });
        
        // Add controls to section
        this.elements.beatSection.appendChild(sensitivityControl);
        this.elements.beatSection.appendChild(tempoMinControl);
        this.elements.beatSection.appendChild(tempoMaxControl);
        this.elements.beatSection.appendChild(thresholdControl);
        this.elements.beatSection.appendChild(onsetToggle);
        
        this.elements.content.appendChild(this.elements.beatSection);
    }
    
    /**
     * Setup frequency analysis controls
     */
    setupFrequencyControls() {
        this.elements.frequencySection = this.createControlSection('Frequency Analysis', 'frequency-controls');
        
        // Frequency Range
        const freqMinControl = this.createSliderControl({
            id: 'freq-min',
            label: 'Min Frequency',
            min: 10,
            max: 1000,
            value: this.state.frequencyRange.min,
            step: 10,
            unit: ' Hz',
            description: 'Minimum frequency for analysis',
            onChange: (value) => {
                this.state.frequencyRange.min = value;
                this.handleParameterChange('frequencyRangeMin', value);
            }
        });
        
        const freqMaxControl = this.createSliderControl({
            id: 'freq-max',
            label: 'Max Frequency',
            min: 5000,
            max: 22000,
            value: this.state.frequencyRange.max,
            step: 100,
            unit: ' Hz',
            description: 'Maximum frequency for analysis',
            onChange: (value) => {
                this.state.frequencyRange.max = value;
                this.handleParameterChange('frequencyRangeMax', value);
            }
        });
        
        // Frequency Binning
        const binningControl = this.createSelectControl({
            id: 'frequency-binning',
            label: 'Frequency Scale',
            options: [
                { value: 'linear', label: 'Linear', description: 'Equal Hz spacing' },
                { value: 'logarithmic', label: 'Logarithmic', description: 'Perceptually uniform' },
                { value: 'mel', label: 'Mel Scale', description: 'Perceptual pitch scale' },
                { value: 'bark', label: 'Bark Scale', description: 'Critical band scale' }
            ],
            value: this.state.binning,
            description: 'Frequency scale for analysis and visualization',
            onChange: (value) => {
                this.state.binning = value;
                this.handleParameterChange('frequencyBinning', value);
            }
        });
        
        // Smoothing
        const smoothingControl = this.createSliderControl({
            id: 'frequency-smoothing',
            label: 'Temporal Smoothing',
            min: 0,
            max: 0.9,
            value: this.state.smoothing,
            step: 0.05,
            unit: '',
            valueFormatter: (val) => `${Math.round(val * 100)}%`,
            description: 'Temporal smoothing applied to frequency data',
            onChange: (value) => {
                this.state.smoothing = value;
                this.handleParameterChange('frequencySmoothing', value);
            }
        });
        
        // Add controls to section
        this.elements.frequencySection.appendChild(freqMinControl);
        this.elements.frequencySection.appendChild(freqMaxControl);
        this.elements.frequencySection.appendChild(binningControl);
        this.elements.frequencySection.appendChild(smoothingControl);
        
        this.elements.content.appendChild(this.elements.frequencySection);
    }
    
    /**
     * Setup performance and optimization controls
     */
    setupPerformanceControls() {
        this.elements.performanceSection = this.createControlSection('Performance', 'performance-controls');
        
        // Latency Compensation
        const latencyControl = this.createSliderControl({
            id: 'latency-compensation',
            label: 'Latency Compensation',
            min: -50,
            max: 50,
            value: this.state.latencyCompensation,
            step: 1,
            unit: ' ms',
            description: 'Compensate for audio processing latency',
            onChange: (value) => {
                this.state.latencyCompensation = value;
                this.handleParameterChange('latencyCompensation', value);
            }
        });
        
        // Adaptive Quality Toggle
        const adaptiveToggle = this.createToggleControl({
            id: 'adaptive-quality',
            label: 'Adaptive Quality',
            value: this.state.adaptiveQuality,
            description: 'Automatically adjust quality based on performance',
            onChange: (value) => {
                this.state.adaptiveQuality = value;
                this.handleParameterChange('adaptiveQuality', value);
            }
        });
        
        // Target FPS
        const fpsControl = this.createSliderControl({
            id: 'target-fps',
            label: 'Target FPS',
            min: 30,
            max: 120,
            value: this.state.targetFPS,
            step: 15,
            unit: ' fps',
            description: 'Target frame rate for audio analysis',
            onChange: (value) => {
                this.state.targetFPS = value;
                this.handleParameterChange('targetFPS', value);
            }
        });
        
        // Performance Monitor Display
        const performanceDisplay = document.createElement('div');
        performanceDisplay.className = 'performance-monitor';
        performanceDisplay.innerHTML = `
            <div class="performance-metrics">
                <div class="metric">
                    <span class="metric-label">Update Time:</span>
                    <span class="metric-value" id="update-time">--</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Average FPS:</span>
                    <span class="metric-value" id="average-fps">--</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Memory Usage:</span>
                    <span class="metric-value" id="memory-usage">--</span>
                </div>
            </div>
        `;
        
        // Add controls to section
        this.elements.performanceSection.appendChild(latencyControl);
        this.elements.performanceSection.appendChild(adaptiveToggle);
        this.elements.performanceSection.appendChild(fpsControl);
        this.elements.performanceSection.appendChild(performanceDisplay);
        
        this.elements.content.appendChild(this.elements.performanceSection);
    }
    
    /**
     * Create a control section with header
     */
    createControlSection(title, className) {
        const section = document.createElement('div');
        section.className = `control-group ${className}`;
        
        const header = document.createElement('h4');
        header.className = 'control-group-title';
        header.textContent = title;
        
        section.appendChild(header);
        return section;
    }
    
    /**
     * Create a slider control
     */
    createSliderControl(options) {
        const container = document.createElement('div');
        container.className = 'control-item';
        
        const labelElement = document.createElement('label');
        labelElement.className = 'control-label';
        labelElement.textContent = options.label;
        labelElement.setAttribute('for', options.id);
        
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
        valueDisplay.textContent = options.valueFormatter ? 
            options.valueFormatter(options.value) : 
            `${options.value}${options.unit || ''}`;
        
        // Event listener
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueDisplay.textContent = options.valueFormatter ? 
                options.valueFormatter(value) : 
                `${value}${options.unit || ''}`;
            
            if (options.onChange) {
                options.onChange(value);
            }
            
            // Trigger particle effect if enabled
            if (this.config.enableParticleEffects) {
                this.triggerParticleEffect(slider, 'adjustment');
            }
        });
        
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);
        
        container.appendChild(labelElement);
        container.appendChild(sliderContainer);
        
        // Add description if provided
        if (options.description) {
            const description = document.createElement('div');
            description.className = 'control-description';
            description.textContent = options.description;
            container.appendChild(description);
        }
        
        // Store control reference
        this.elements.controls.set(options.id, { slider, valueDisplay, container });
        
        return container;
    }
    
    /**
     * Create a select control
     */
    createSelectControl(options) {
        const container = document.createElement('div');
        container.className = 'control-item';
        
        const labelElement = document.createElement('label');
        labelElement.className = 'control-label';
        labelElement.textContent = options.label;
        labelElement.setAttribute('for', options.id);
        
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
        
        // Event listener
        select.addEventListener('change', (e) => {
            if (options.onChange) {
                options.onChange(e.target.value);
            }
            
            // Trigger particle effect if enabled
            if (this.config.enableParticleEffects) {
                this.triggerParticleEffect(select, 'selection');
            }
        });
        
        container.appendChild(labelElement);
        container.appendChild(select);
        
        // Add description if provided
        if (options.description) {
            const description = document.createElement('div');
            description.className = 'control-description';
            description.textContent = options.description;
            container.appendChild(description);
        }
        
        // Store control reference
        this.elements.controls.set(options.id, { select, container });
        
        return container;
    }
    
    /**
     * Create a toggle control
     */
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
        
        // Event listener
        checkbox.addEventListener('change', (e) => {
            if (options.onChange) {
                options.onChange(e.target.checked);
            }
            
            // Trigger particle effect if enabled
            if (this.config.enableParticleEffects) {
                this.triggerParticleEffect(toggleSwitch, 'toggle');
            }
        });
        
        label.appendChild(checkbox);
        label.appendChild(toggleSwitch);
        label.appendChild(labelText);
        container.appendChild(label);
        
        // Add description if provided
        if (options.description) {
            const description = document.createElement('div');
            description.className = 'control-description';
            description.textContent = options.description;
            container.appendChild(description);
        }
        
        // Store control reference
        this.elements.controls.set(options.id, { checkbox, toggleSwitch, container });
        
        return container;
    }
    
    /**
     * Initialize spectrum display
     */
    initializeSpectrumDisplay() {
        if (!this.elements.spectrumDisplay) return;
        
        this.elements.spectrumDisplay.innerHTML = `
            <div class="spectrum-header">
                <h4>Live Spectrum</h4>
                <div class="spectrum-controls">
                    <button class="btn-small" data-scale="linear">Linear</button>
                    <button class="btn-small active" data-scale="logarithmic">Log</button>
                    <button class="btn-small" data-scale="mel">Mel</button>
                </div>
            </div>
            <div class="spectrum-canvas-container">
                <canvas class="spectrum-canvas" width="280" height="120"></canvas>
                <div class="spectrum-overlay">
                    <div class="frequency-labels"></div>
                    <div class="amplitude-labels"></div>
                </div>
            </div>
        `;
        
        const canvas = this.elements.spectrumDisplay.querySelector('.spectrum-canvas');
        this.spectrumCanvas = canvas;
        this.spectrumContext = canvas.getContext('2d');
        
        // Setup spectrum controls
        const scaleButtons = this.elements.spectrumDisplay.querySelectorAll('[data-scale]');
        scaleButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                scaleButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.spectrumData.scale = e.target.dataset.scale;
            });
        });
        
        // Start spectrum animation
        this.startSpectrumAnimation();
    }
    
    /**
     * Start spectrum visualization animation loop
     */
    startSpectrumAnimation() {
        const animate = () => {
            if (this.state.isInitialized && this.spectrumCanvas) {
                this.updateSpectrum();
                this.renderSpectrum();
            }
            requestAnimationFrame(animate);
        };
        animate();
    }
    
    /**
     * Update spectrum data from audio engine
     */
    updateSpectrum() {
        if (!this.config.audioEngine) return;
        
        const audioData = this.config.audioEngine.getAudioData();
        if (!audioData || !audioData.frequencyData) return;
        
        // Copy frequency data
        this.spectrumData.frequencyData.set(audioData.frequencyData);
        this.spectrumData.frequencyDataDb.set(audioData.frequencyDataDb || audioData.frequencyData);
        
        // Update peak detection
        for (let i = 0; i < this.spectrumData.frequencyData.length; i++) {
            const current = this.spectrumData.frequencyData[i];
            if (current > this.spectrumData.peaks[i]) {
                this.spectrumData.peaks[i] = current;
            } else {
                this.spectrumData.peaks[i] *= this.spectrumData.peakDecay;
            }
        }
    }
    
    /**
     * Render spectrum visualization
     */
    renderSpectrum() {
        if (!this.spectrumContext) return;
        
        const canvas = this.spectrumCanvas;
        const ctx = this.spectrumContext;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
        ctx.fillRect(0, 0, width, height);
        
        // Setup gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(0, 245, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(0, 255, 159, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 0, 127, 0.4)');
        
        // Draw spectrum bars
        const barWidth = width / this.spectrumData.frequencyData.length;
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        
        for (let i = 0; i < this.spectrumData.frequencyData.length; i++) {
            const value = this.spectrumData.frequencyData[i] / 255;
            const barHeight = value * height;
            const x = i * barWidth;
            const y = height - barHeight;
            
            if (i === 0) {
                ctx.moveTo(x, height);
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        
        // Draw peaks if enabled
        if (this.spectrumData.showPeaks) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            for (let i = 0; i < this.spectrumData.peaks.length; i++) {
                const peak = this.spectrumData.peaks[i] / 255;
                const peakHeight = peak * height;
                const x = i * barWidth;
                const y = height - peakHeight;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
        }
        
        // Draw grid if enabled
        if (this.spectrumData.showGrid) {
            this.drawSpectrumGrid(ctx, width, height);
        }
    }
    
    /**
     * Draw spectrum grid overlay
     */
    drawSpectrumGrid(ctx, width, height) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        
        // Horizontal lines (amplitude)
        for (let i = 1; i < 4; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Vertical lines (frequency)
        for (let i = 1; i < 8; i++) {
            const x = (width / 8) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }
    
    /**
     * Initialize particle effects system
     */
    async initializeParticleEffects() {
        try {
            await particleUI.initialize();
            
            // Setup particle emitters for controls
            this.elements.controls.forEach((control, id) => {
                if (control.slider) {
                    particleUI.attachToElement(control.slider, {
                        type: 'adjustment',
                        particleCount: 5,
                        lifetime: 1.0,
                        color: this.config.accentColor
                    });
                }
                
                if (control.toggleSwitch) {
                    particleUI.attachToElement(control.toggleSwitch, {
                        type: 'toggle',
                        particleCount: 8,
                        lifetime: 1.5,
                        color: this.config.accentColor
                    });
                }
            });
            
            console.log('AudioControls particle effects initialized');
            
        } catch (error) {
            console.warn('Failed to initialize particle effects:', error);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Panel header controls
        const toggleButton = this.elements.header.querySelector('.panel-toggle');
        const minimizeButton = this.elements.header.querySelector('.panel-minimize');
        
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
        
        // Keyboard navigation
        if (this.config.enableKeyboardNavigation) {
            this.elements.container.addEventListener('keydown', this.handleKeyboardInput);
        }
        
        // Window resize handling
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Performance monitoring
        if (performanceMonitor) {
            performanceMonitor.addEventListener('performanceChange', (data) => {
                this.updatePerformanceDisplay(data);
            });
        }
    }
    
    /**
     * Apply initial settings to audio engines
     */
    applyInitialSettings() {
        // Apply FFT settings
        if (this.config.fftProcessor) {
            this.config.fftProcessor.updateSettings({
                fftSize: this.state.fftSize,
                algorithm: this.state.fftAlgorithm,
                windowFunction: this.state.windowFunction,
                overlapRatio: this.state.overlapRatio
            });
        }
        
        // Apply beat detection settings
        if (this.config.beatDetector) {
            this.config.beatDetector.updateSettings({
                sensitivity: this.state.beatSensitivity,
                tempoRange: this.state.tempoRange,
                threshold: this.state.beatThreshold,
                onsetDetection: this.state.onsetDetection
            });
        }
        
        // Apply frequency analysis settings
        if (this.config.audioEngine) {
            this.config.audioEngine.updateSettings({
                frequencyRange: this.state.frequencyRange,
                binning: this.state.binning,
                smoothing: this.state.smoothing,
                latencyCompensation: this.state.latencyCompensation
            });
        }
    }
    
    /**
     * Handle parameter changes
     */
    handleParameterChange(parameter, value) {
        console.log(`AudioControls parameter changed: ${parameter} = ${value}`);
        
        // Update audio engines based on parameter
        switch (parameter) {
            case 'fftSize':
            case 'fftAlgorithm':
            case 'windowFunction':
            case 'overlapRatio':
                if (this.config.fftProcessor) {
                    this.config.fftProcessor.updateSettings({
                        [parameter]: value
                    });
                }
                if (this.callbacks.onFFTSettingsChange) {
                    this.callbacks.onFFTSettingsChange({ [parameter]: value });
                }
                break;
                
            case 'beatSensitivity':
            case 'beatThreshold':
            case 'onsetDetection':
            case 'tempoRangeMin':
            case 'tempoRangeMax':
                if (this.config.beatDetector) {
                    const updateObj = {};
                    if (parameter === 'tempoRangeMin') {
                        updateObj.tempoRange = { ...this.state.tempoRange, min: value };
                    } else if (parameter === 'tempoRangeMax') {
                        updateObj.tempoRange = { ...this.state.tempoRange, max: value };
                    } else {
                        updateObj[parameter.replace('beat', '').toLowerCase()] = value;
                    }
                    this.config.beatDetector.updateSettings(updateObj);
                }
                if (this.callbacks.onBeatSettingsChange) {
                    this.callbacks.onBeatSettingsChange({ [parameter]: value });
                }
                break;
                
            case 'frequencyRangeMin':
            case 'frequencyRangeMax':
            case 'frequencyBinning':
            case 'frequencySmoothing':
                if (this.config.audioEngine) {
                    const updateObj = {};
                    if (parameter === 'frequencyRangeMin') {
                        updateObj.frequencyRange = { ...this.state.frequencyRange, min: value };
                    } else if (parameter === 'frequencyRangeMax') {
                        updateObj.frequencyRange = { ...this.state.frequencyRange, max: value };
                    } else {
                        updateObj[parameter.replace('frequency', '').toLowerCase()] = value;
                    }
                    this.config.audioEngine.updateSettings(updateObj);
                }
                break;
                
            case 'latencyCompensation':
            case 'adaptiveQuality':
            case 'targetFPS':
                if (this.config.audioEngine) {
                    this.config.audioEngine.updateSettings({
                        [parameter]: value
                    });
                }
                if (this.callbacks.onPerformanceChange) {
                    this.callbacks.onPerformanceChange({ [parameter]: value });
                }
                break;
        }
        
        // Generic parameter change callback
        if (this.callbacks.onParameterChange) {
            this.callbacks.onParameterChange(parameter, value);
        }
        
        // Update spring animations
        if (this.config.enableSpringAnimations) {
            this.animateParameterChange(parameter, value);
        }
    }
    
    /**
     * Handle keyboard input for accessibility
     */
    handleKeyboardInput(event) {
        switch (event.key) {
            case 'Escape':
                this.toggleVisibility();
                break;
            case 'Tab':
                // Enhanced tab navigation handled by browser
                break;
            case 'Enter':
            case ' ':
                if (event.target.classList.contains('panel-toggle')) {
                    this.toggleAdvancedControls();
                    event.preventDefault();
                }
                break;
            case 'ArrowUp':
            case 'ArrowDown':
                if (event.target.type === 'range') {
                    // Enhanced slider control
                    const increment = event.shiftKey ? 10 : 1;
                    const direction = event.key === 'ArrowUp' ? 1 : -1;
                    const slider = event.target;
                    const step = parseFloat(slider.step) || 1;
                    const newValue = parseFloat(slider.value) + (step * increment * direction);
                    
                    slider.value = Math.max(
                        parseFloat(slider.min),
                        Math.min(parseFloat(slider.max), newValue)
                    );
                    
                    slider.dispatchEvent(new Event('input'));
                    event.preventDefault();
                }
                break;
        }
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        if (this.spectrumCanvas) {
            const container = this.elements.spectrumDisplay;
            const rect = container.getBoundingClientRect();
            
            // Update canvas size
            this.spectrumCanvas.width = Math.floor(rect.width - 20);
            this.spectrumCanvas.height = 120;
        }
    }
    
    /**
     * Toggle advanced controls visibility
     */
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
        
        // Animate with spring system
        if (this.config.enableSpringAnimations) {
            this.springSystem.createSpring({
                from: this.state.isExpanded ? 0 : 1,
                to: this.state.isExpanded ? 1 : 0,
                tension: 200,
                friction: 20,
                onUpdate: (value) => {
                    const opacity = 0.5 + (value * 0.5);
                    content.style.opacity = opacity;
                }
            });
        }
    }
    
    /**
     * Toggle panel visibility
     */
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
    
    /**
     * Trigger particle effect for control interaction
     */
    triggerParticleEffect(element, type) {
        if (!this.config.enableParticleEffects || !particleUI) return;
        
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const effectConfig = {
            position: { x: centerX, y: centerY },
            type: type,
            color: this.config.accentColor,
            particleCount: type === 'toggle' ? 8 : 5,
            lifetime: type === 'adjustment' ? 1.0 : 1.5,
            velocity: { min: 20, max: 60 },
            audioReactive: true
        };
        
        particleUI.emit(effectConfig);
    }
    
    /**
     * Animate parameter changes with spring system
     */
    animateParameterChange(parameter, value) {
        if (!this.config.enableSpringAnimations) return;
        
        const control = this.elements.controls.get(parameter) || 
                       this.elements.controls.get(parameter.replace(/([A-Z])/g, '-$1').toLowerCase());
        
        if (!control || !control.container) return;
        
        // Create subtle glow animation
        this.springSystem.createSpring({
            from: 0,
            to: 1,
            tension: 300,
            friction: 20,
            onUpdate: (progress) => {
                const intensity = Math.sin(progress * Math.PI);
                const glowColor = ColorUtils.hexToRgba(this.config.accentColor, intensity * 0.3);
                control.container.style.boxShadow = `0 0 ${intensity * 20}px ${glowColor}`;
            },
            onRest: () => {
                control.container.style.boxShadow = '';
            }
        });
    }
    
    /**
     * Update performance display
     */
    updatePerformanceDisplay(performanceData) {
        const updateTimeElement = this.elements.container.querySelector('#update-time');
        const avgFpsElement = this.elements.container.querySelector('#average-fps');
        const memoryElement = this.elements.container.querySelector('#memory-usage');
        
        if (updateTimeElement && performanceData.updateTime !== undefined) {
            updateTimeElement.textContent = `${performanceData.updateTime.toFixed(2)}ms`;
        }
        
        if (avgFpsElement && performanceData.averageFPS !== undefined) {
            avgFpsElement.textContent = `${Math.round(performanceData.averageFPS)}`;
            
            // Color-code based on performance
            if (performanceData.averageFPS >= 55) {
                avgFpsElement.style.color = '#00ff00';
            } else if (performanceData.averageFPS >= 30) {
                avgFpsElement.style.color = '#ffaa00';
            } else {
                avgFpsElement.style.color = '#ff0040';
            }
        }
        
        if (memoryElement && performanceData.memoryUsage !== undefined) {
            const memoryMB = performanceData.memoryUsage / (1024 * 1024);
            memoryElement.textContent = `${memoryMB.toFixed(1)}MB`;
        }
    }
    
    /**
     * Update component state
     */
    update(deltaTime) {
        if (!this.state.isInitialized) return;
        
        // Update performance metrics
        this.performanceMetrics.frameCount++;
        const now = performance.now();
        
        if (now - this.performanceMetrics.lastUpdate > 1000) {
            this.performanceMetrics.averageFPS = 
                this.performanceMetrics.frameCount / 
                ((now - this.performanceMetrics.lastUpdate) / 1000);
            
            this.performanceMetrics.frameCount = 0;
            this.performanceMetrics.lastUpdate = now;
        }
        
        // Update spring animations
        if (this.config.enableSpringAnimations) {
            this.springSystem.update(deltaTime);
        }
        
        // Update spectrum display
        if (this.config.showSpectrumDisplay) {
            this.updateSpectrum();
        }
    }
    
    /**
     * Get current configuration state
     */
    getState() {
        return {
            ...this.state,
            performanceMetrics: { ...this.performanceMetrics }
        };
    }
    
    /**
     * Set configuration state
     */
    setState(newState) {
        const oldState = { ...this.state };
        
        Object.assign(this.state, newState);
        
        // Update UI controls to match new state
        this.updateUIFromState(oldState);
        
        // Apply settings to audio engines
        this.applyInitialSettings();
    }
    
    /**
     * Update UI controls to match current state
     */
    updateUIFromState(oldState) {
        this.elements.controls.forEach((control, id) => {
            if (control.slider) {
                const stateKey = this.getStateKeyForControl(id);
                if (stateKey && this.state[stateKey] !== undefined) {
                    control.slider.value = this.state[stateKey];
                    
                    // Update value display
                    if (control.valueDisplay) {
                        const formatter = this.getFormatterForControl(id);
                        control.valueDisplay.textContent = formatter ? 
                            formatter(this.state[stateKey]) : 
                            this.state[stateKey].toString();
                    }
                }
            }
            
            if (control.select) {
                const stateKey = this.getStateKeyForControl(id);
                if (stateKey && this.state[stateKey] !== undefined) {
                    control.select.value = this.state[stateKey];
                }
            }
            
            if (control.checkbox) {
                const stateKey = this.getStateKeyForControl(id);
                if (stateKey && this.state[stateKey] !== undefined) {
                    control.checkbox.checked = this.state[stateKey];
                }
            }
        });
    }
    
    /**
     * Get state key for control ID
     */
    getStateKeyForControl(controlId) {
        const keyMap = {
            'fft-size': 'fftSize',
            'fft-algorithm': 'fftAlgorithm',
            'window-function': 'windowFunction',
            'overlap-ratio': 'overlapRatio',
            'beat-sensitivity': 'beatSensitivity',
            'tempo-min': 'tempoRange.min',
            'tempo-max': 'tempoRange.max',
            'beat-threshold': 'beatThreshold',
            'onset-detection': 'onsetDetection',
            'freq-min': 'frequencyRange.min',
            'freq-max': 'frequencyRange.max',
            'frequency-binning': 'binning',
            'frequency-smoothing': 'smoothing',
            'latency-compensation': 'latencyCompensation',
            'adaptive-quality': 'adaptiveQuality',
            'target-fps': 'targetFPS'
        };
        
        return keyMap[controlId];
    }
    
    /**
     * Get formatter function for control
     */
    getFormatterForControl(controlId) {
        const formatterMap = {
            'fft-size': (val) => Math.pow(2, val).toLocaleString(),
            'overlap-ratio': (val) => `${Math.round(val * 100)}%`,
            'beat-sensitivity': (val) => `${Math.round(val * 100)}%`,
            'beat-threshold': (val) => `${Math.round(val * 100)}%`,
            'frequency-smoothing': (val) => `${Math.round(val * 100)}%`,
            'tempo-min': (val) => `${val} BPM`,
            'tempo-max': (val) => `${val} BPM`,
            'freq-min': (val) => `${val} Hz`,
            'freq-max': (val) => `${val} Hz`,
            'latency-compensation': (val) => `${val} ms`,
            'target-fps': (val) => `${val} fps`
        };
        
        return formatterMap[controlId];
    }
    
    /**
     * Destroy component and cleanup resources
     */
    destroy() {
        // Stop spring animations
        if (this.springSystem) {
            this.springSystem.destroy();
        }
        
        // Cleanup particle effects
        if (this.config.enableParticleEffects && particleUI) {
            this.elements.controls.forEach((control) => {
                if (control.slider) {
                    particleUI.detachFromElement(control.slider);
                }
                if (control.toggleSwitch) {
                    particleUI.detachFromElement(control.toggleSwitch);
                }
            });
        }
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        
        if (performanceMonitor) {
            performanceMonitor.removeEventListener('performanceChange', this.updatePerformanceDisplay);
        }
        
        // Remove DOM elements
        if (this.elements.container && this.elements.container.parentNode) {
            this.elements.container.parentNode.removeChild(this.elements.container);
        }
        
        // Clear references
        this.elements.controls.clear();
        this.elements = {};
        this.state.isInitialized = false;
        
        console.log('AudioControls component destroyed');
    }
}

export default AudioControls;