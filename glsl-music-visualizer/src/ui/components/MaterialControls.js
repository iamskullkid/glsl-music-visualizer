/**
 * Material Controls Component - Advanced Material Property Control Panel
 * Comprehensive material parameter controls for the GLSL music visualizer
 * Location: src/ui/components/MaterialControls.js
 */

import { SpringSystem } from '../animations/SpringSystem.js';
import { particleUI } from '../animations/ParticleUI.js';
import { MorphTransitions } from '../animations/MorphTransitions.js';
import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';

export class MaterialControls {
    constructor(options = {}) {
        this.config = {
            materialManager: options.materialManager || null,
            audioEngine: options.audioEngine || null,
            renderEngine: options.renderEngine || null,
            container: options.container || null,
            enableParticleEffects: options.enableParticleEffects !== false,
            enableSpringAnimations: options.enableSpringAnimations !== false,
            showMaterialPreview: options.showMaterialPreview !== false,
            defaultMaterial: options.defaultMaterial || 'water_pure',
            updateThrottle: options.updateThrottle || 16,
            theme: options.theme || 'dark',
            accentColor: options.accentColor || '#00f5ff',
            enableKeyboardNavigation: options.enableKeyboardNavigation !== false
        };
        
        this.state = {
            isInitialized: false,
            isVisible: true,
            isExpanded: true,
            currentMaterial: this.config.defaultMaterial,
            materialType: 'builtin',
            materialPhase: 'liquid',
            
            physicalProperties: {
                density: 1000.0,
                viscosity: 0.001,
                surfaceTension: 0.072,
                temperature: 293.15
            },
            
            opticalProperties: {
                baseColor: [0.2, 0.7, 1.0, 0.8],
                emission: [0.0, 0.0, 0.0],
                transparency: 0.85,
                metallic: 0.0,
                roughness: 0.1
            },
            
            electricalProperties: {
                conductivity: 5.5e-6,
                ionization: 0.0
            },
            
            audioReactivity: {
                enabled: true,
                globalSensitivity: 0.7,
                viscosityResponse: 0.5,
                temperatureResponse: 0.8,
                colorResponse: 0.6,
                emissionResponse: 0.9,
                ionizationResponse: 0.7
            },
            
            transitionSettings: {
                enabled: true,
                duration: 2.0,
                easing: 'smoothstep'
            }
        };
        
        this.elements = {
            container: null,
            header: null,
            content: null,
            materialPreview: null,
            controls: new Map()
        };
        
        this.springSystem = new SpringSystem({
            enableAudioReactivity: true,
            targetFPS: 60
        });
        
        this.materialPreview = {
            isActive: false,
            canvas: null,
            context: null,
            animationFrame: null,
            lastUpdate: 0
        };
        
        this.updateThrottle = {
            lastUpdate: 0,
            pendingUpdate: null
        };
        
        this.callbacks = {
            onMaterialChange: options.onMaterialChange || null,
            onPropertyChange: options.onPropertyChange || null,
            onPresetChange: options.onPresetChange || null
        };
        
        // Bind methods
        this.handlePropertyChange = this.handlePropertyChange.bind(this);
        this.handlePresetChange = this.handlePresetChange.bind(this);
        this.handleKeyboardInput = this.handleKeyboardInput.bind(this);
        this.updateMaterialPreview = this.updateMaterialPreview.bind(this);
        
        console.log('MaterialControls initialized');
    }
    
    async initialize() {
        try {
            this.createUIStructure();
            this.setupPresetControls();
            this.setupPhysicalControls();
            this.setupOpticalControls();
            this.setupElectricalControls();
            this.setupAudioReactivityControls();
            this.setupTransitionControls();
            
            if (this.config.showMaterialPreview) {
                this.initializeMaterialPreview();
            }
            
            this.setupEventListeners();
            
            if (this.config.enableParticleEffects) {
                await this.initializeParticleEffects();
            }
            
            await this.loadMaterialState();
            
            this.state.isInitialized = true;
            console.log('MaterialControls component initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize MaterialControls:', error);
            throw error;
        }
    }
    
    createUIStructure() {
        const container = this.config.container || document.body;
        
        this.elements.container = document.createElement('div');
        this.elements.container.className = 'material-controls panel glass';
        this.elements.container.setAttribute('role', 'region');
        this.elements.container.setAttribute('aria-label', 'Material Property Controls');
        
        this.elements.header = document.createElement('div');
        this.elements.header.className = 'panel-header';
        this.elements.header.innerHTML = `
            <h3 class="panel-title">Material Properties</h3>
            <div class="panel-controls">
                <button class="material-reset btn-ghost" aria-label="Reset to defaults">
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
        this.elements.content.className = 'panel-content material-controls-content';
        
        if (this.config.showMaterialPreview) {
            this.elements.materialPreview = document.createElement('div');
            this.elements.materialPreview.className = 'material-preview';
            this.elements.content.appendChild(this.elements.materialPreview);
        }
        
        this.elements.container.appendChild(this.elements.header);
        this.elements.container.appendChild(this.elements.content);
        container.appendChild(this.elements.container);
        
        this.elements.container.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 350px;
            max-height: calc(100vh - 40px);
            z-index: 100;
        `;
    }
    
    setupPresetControls() {
        const presetSection = this.createControlSection('Material Presets', 'preset-controls');
        
        const currentMaterialDisplay = document.createElement('div');
        currentMaterialDisplay.className = 'current-material-display';
        currentMaterialDisplay.innerHTML = `
            <div class="material-info">
                <span class="material-name">${this.state.currentMaterial}</span>
                <span class="material-type">(${this.state.materialType})</span>
                <span class="material-phase">${this.state.materialPhase}</span>
            </div>
        `;
        
        const presetSelector = this.createSelectControl({
            id: 'material-preset',
            label: 'Material Preset',
            options: this.getMaterialPresetOptions(),
            value: this.state.currentMaterial,
            description: 'Select a predefined material configuration',
            onChange: (value) => {
                this.handlePresetChange(value);
            }
        });
        
        const phaseSelector = this.createSelectControl({
            id: 'material-phase',
            label: 'Material Phase',
            options: [
                { value: 'liquid', label: 'Liquid' },
                { value: 'gas', label: 'Gas/Plasma' },
                { value: 'solid', label: 'Solid' },
                { value: 'transition', label: 'Phase Transition' }
            ],
            value: this.state.materialPhase,
            description: 'Current phase state of the material',
            onChange: (value) => {
                this.state.materialPhase = value;
                this.handlePropertyChange('phase', value);
            }
        });
        
        presetSection.appendChild(currentMaterialDisplay);
        presetSection.appendChild(presetSelector);
        presetSection.appendChild(phaseSelector);
        this.elements.content.appendChild(presetSection);
    }
    
    setupPhysicalControls() {
        const physicalSection = this.createControlSection('Physical Properties', 'physical-controls');
        
        const densityControl = this.createSliderControl({
            id: 'density',
            label: 'Density',
            min: 0.1,
            max: 20000,
            value: this.state.physicalProperties.density,
            step: 1,
            unit: ' kg/m³',
            description: 'Material density affecting inertia and buoyancy',
            onChange: (value) => {
                this.state.physicalProperties.density = value;
                this.handlePropertyChange('physical.density', value);
            }
        });
        
        const viscosityControl = this.createSliderControl({
            id: 'viscosity',
            label: 'Dynamic Viscosity',
            min: 0.0001,
            max: 1000,
            value: this.state.physicalProperties.viscosity,
            step: 0.0001,
            unit: ' Pa·s',
            description: 'Fluid viscosity controlling flow resistance',
            onChange: (value) => {
                this.state.physicalProperties.viscosity = value;
                this.handlePropertyChange('physical.viscosity', value);
            }
        });
        
        const surfaceTensionControl = this.createSliderControl({
            id: 'surface-tension',
            label: 'Surface Tension',
            min: 0.001,
            max: 0.5,
            value: this.state.physicalProperties.surfaceTension,
            step: 0.001,
            unit: ' N/m',
            description: 'Surface tension affecting droplet formation',
            onChange: (value) => {
                this.state.physicalProperties.surfaceTension = value;
                this.handlePropertyChange('physical.surfaceTension', value);
            }
        });
        
        const temperatureControl = this.createSliderControl({
            id: 'temperature',
            label: 'Temperature',
            min: 173.15,
            max: 2273.15,
            value: this.state.physicalProperties.temperature,
            step: 1,
            unit: ' K',
            description: 'Material temperature affecting phase transitions',
            onChange: (value) => {
                this.state.physicalProperties.temperature = value;
                this.handlePropertyChange('physical.temperature', value);
            }
        });
        
        physicalSection.appendChild(densityControl);
        physicalSection.appendChild(viscosityControl);
        physicalSection.appendChild(surfaceTensionControl);
        physicalSection.appendChild(temperatureControl);
        this.elements.content.appendChild(physicalSection);
    }
    
    setupOpticalControls() {
        const opticalSection = this.createControlSection('Optical Properties', 'optical-controls');
        
        const baseColorControl = this.createColorControl({
            id: 'base-color',
            label: 'Base Color',
            value: this.state.opticalProperties.baseColor,
            enableAlpha: true,
            description: 'Primary color of the material',
            onChange: (color) => {
                this.state.opticalProperties.baseColor = color;
                this.handlePropertyChange('optical.baseColor', color);
            }
        });
        
        const transparencyControl = this.createSliderControl({
            id: 'transparency',
            label: 'Transparency',
            min: 0.0,
            max: 1.0,
            value: this.state.opticalProperties.transparency,
            step: 0.01,
            unit: '',
            description: 'Material opacity and light transmission',
            onChange: (value) => {
                this.state.opticalProperties.transparency = value;
                this.handlePropertyChange('optical.transparency', value);
            }
        });
        
        const metallicControl = this.createSliderControl({
            id: 'metallic',
            label: 'Metallic Factor',
            min: 0.0,
            max: 1.0,
            value: this.state.opticalProperties.metallic,
            step: 0.01,
            unit: '',
            description: 'Metallic vs dielectric surface properties',
            onChange: (value) => {
                this.state.opticalProperties.metallic = value;
                this.handlePropertyChange('optical.metallic', value);
            }
        });
        
        opticalSection.appendChild(baseColorControl);
        opticalSection.appendChild(transparencyControl);
        opticalSection.appendChild(metallicControl);
        this.elements.content.appendChild(opticalSection);
    }
    
    setupElectricalControls() {
        const electricalSection = this.createControlSection('Electrical Properties', 'electrical-controls');
        
        const conductivityControl = this.createSliderControl({
            id: 'conductivity',
            label: 'Electrical Conductivity',
            min: 1e-15,
            max: 1e8,
            value: this.state.electricalProperties.conductivity,
            step: 1e-15,
            unit: ' S/m',
            description: 'Electrical conductivity determining current flow',
            onChange: (value) => {
                this.state.electricalProperties.conductivity = value;
                this.handlePropertyChange('electrical.conductivity', value);
            }
        });
        
        const ionizationControl = this.createSliderControl({
            id: 'ionization-level',
            label: 'Ionization Level',
            min: 0.0,
            max: 1.0,
            value: this.state.electricalProperties.ionization,
            step: 0.001,
            unit: '',
            description: 'Degree of ionization for plasma effects',
            onChange: (value) => {
                this.state.electricalProperties.ionization = value;
                this.handlePropertyChange('electrical.ionization', value);
            }
        });
        
        electricalSection.appendChild(conductivityControl);
        electricalSection.appendChild(ionizationControl);
        this.elements.content.appendChild(electricalSection);
    }
    
    setupAudioReactivityControls() {
        const audioSection = this.createControlSection('Audio Reactivity', 'audio-controls');
        
        const audioToggle = this.createToggleControl({
            id: 'audio-reactivity',
            label: 'Enable Audio Reactivity',
            value: this.state.audioReactivity.enabled,
            description: 'Enable real-time audio-driven material property modulation',
            onChange: (value) => {
                this.state.audioReactivity.enabled = value;
                this.handlePropertyChange('audioReactivity.enabled', value);
            }
        });
        
        const sensitivityControl = this.createSliderControl({
            id: 'audio-sensitivity',
            label: 'Global Sensitivity',
            min: 0.0,
            max: 2.0,
            value: this.state.audioReactivity.globalSensitivity,
            step: 0.01,
            unit: '',
            description: 'Overall sensitivity to audio input changes',
            onChange: (value) => {
                this.state.audioReactivity.globalSensitivity = value;
                this.handlePropertyChange('audioReactivity.globalSensitivity', value);
            }
        });
        
        audioSection.appendChild(audioToggle);
        audioSection.appendChild(sensitivityControl);
        this.elements.content.appendChild(audioSection);
    }
    
    setupTransitionControls() {
        const transitionSection = this.createControlSection('Transitions', 'transition-controls');
        
        const transitionToggle = this.createToggleControl({
            id: 'transitions-enabled',
            label: 'Enable Transitions',
            value: this.state.transitionSettings.enabled,
            description: 'Enable smooth transitions between material states',
            onChange: (value) => {
                this.state.transitionSettings.enabled = value;
                this.handlePropertyChange('transitions.enabled', value);
            }
        });
        
        const durationControl = this.createSliderControl({
            id: 'transition-duration',
            label: 'Transition Duration',
            min: 0.1,
            max: 10.0,
            value: this.state.transitionSettings.duration,
            step: 0.1,
            unit: ' s',
            description: 'Duration of material property transitions',
            onChange: (value) => {
                this.state.transitionSettings.duration = value;
                this.handlePropertyChange('transitions.duration', value);
            }
        });
        
        transitionSection.appendChild(transitionToggle);
        transitionSection.appendChild(durationControl);
        this.elements.content.appendChild(transitionSection);
    }
    
    initializeMaterialPreview() {
        if (!this.elements.materialPreview) return;
        
        this.elements.materialPreview.innerHTML = `
            <div class="preview-header">
                <h4>Material Preview</h4>
                <div class="preview-controls">
                    <button class="btn-small preview-play" data-state="playing">Pause</button>
                    <button class="btn-small preview-reset">Reset</button>
                </div>
            </div>
            <div class="preview-canvas-container">
                <canvas class="preview-canvas" width="280" height="160"></canvas>
            </div>
        `;
        
        this.materialPreview.canvas = this.elements.materialPreview.querySelector('.preview-canvas');
        this.materialPreview.context = this.materialPreview.canvas.getContext('2d');
        
        const playButton = this.elements.materialPreview.querySelector('.preview-play');
        const resetButton = this.elements.materialPreview.querySelector('.preview-reset');
        
        playButton.addEventListener('click', () => {
            this.toggleMaterialPreview();
        });
        
        resetButton.addEventListener('click', () => {
            this.resetMaterialPreview();
        });
        
        this.materialPreview.isActive = true;
        this.startMaterialPreviewAnimation();
    }
    
    startMaterialPreviewAnimation() {
        const animate = (timestamp) => {
            if (this.materialPreview.isActive) {
                this.updateMaterialPreview(timestamp);
                this.renderMaterialPreview();
            }
            this.materialPreview.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }
    
    updateMaterialPreview(timestamp) {
        this.materialPreview.lastUpdate = timestamp;
    }
    
    renderMaterialPreview() {
        if (!this.materialPreview.context) return;
        
        const canvas = this.materialPreview.canvas;
        const ctx = this.materialPreview.context;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
        ctx.fillRect(0, 0, width, height);
        
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 40;
        
        const baseColor = this.state.opticalProperties.baseColor;
        const transparency = this.state.opticalProperties.transparency;
        
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        const rgbaColor = `rgba(${Math.round(baseColor[0] * 255)}, ${Math.round(baseColor[1] * 255)}, ${Math.round(baseColor[2] * 255)}, ${transparency})`;
        
        gradient.addColorStop(0, rgbaColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
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
        valueDisplay.textContent = `${options.value}${options.unit || ''}`;
        
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueDisplay.textContent = `${value}${options.unit || ''}`;
            
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
    
    getMaterialPresetOptions() {
        return [
            { value: 'water_pure', label: 'Pure Water' },
            { value: 'water_murky', label: 'Murky Water' },
            { value: 'mercury', label: 'Mercury' },
            { value: 'lava', label: 'Lava' },
            { value: 'plasma_cold', label: 'Cold Plasma' },
            { value: 'plasma_hot', label: 'Hot Plasma' },
            { value: 'oil_crude', label: 'Crude Oil' },
            { value: 'honey', label: 'Honey' },
            { value: 'glass_molten', label: 'Molten Glass' },
            { value: 'metal_liquid', label: 'Liquid Metal' }
        ];
    }
    
    setupEventListeners() {
        const resetButton = this.elements.header.querySelector('.material-reset');
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
            
            console.log('MaterialControls particle effects initialized');
            
        } catch (error) {
            console.warn('Failed to initialize particle effects:', error);
        }
    }
    
    async loadMaterialState() {
        if (this.config.materialManager) {
            try {
                const currentMaterial = this.config.materialManager.getCurrentMaterial();
                if (currentMaterial && currentMaterial.properties) {
                    this.updateStateFromMaterial(currentMaterial);
                }
            } catch (error) {
                console.warn('Failed to load initial material state:', error);
            }
        }
    }
    
    handlePropertyChange(property, value) {
        console.log(`MaterialControls property changed: ${property} = ${value}`);
        
        if (this.config.materialManager) {
            this.updateMaterialManager(property, value);
        }
        
        if (this.callbacks.onPropertyChange) {
            this.callbacks.onPropertyChange(property, value);
        }
        
        if (this.config.enableSpringAnimations) {
            this.animatePropertyChange(property, value);
        }
    }
    
    async handlePresetChange(presetId) {
        console.log(`MaterialControls preset changed: ${presetId}`);
        
        if (this.config.materialManager) {
            try {
                await this.config.materialManager.setMaterial(presetId);
                const newMaterial = this.config.materialManager.getCurrentMaterial();
                this.updateStateFromMaterial(newMaterial);
                this.updateUIFromState();
                
                if (this.callbacks.onPresetChange) {
                    this.callbacks.onPresetChange(presetId, newMaterial);
                }
            } catch (error) {
                console.error('Failed to change material preset:', error);
            }
        }
    }
    
    updateMaterialManager(property, value) {
        const propertyPath = property.split('.');
        const category = propertyPath[0];
        const prop = propertyPath[1];
        
        if (this.config.materialManager && this.config.materialManager.setProperty) {
            this.config.materialManager.setProperty(category, prop, value);
        }
    }
    
    updateStateFromMaterial(material) {
        if (!material || !material.properties) return;
        
        const props = material.properties;
        
        if (props.physical) {
            Object.assign(this.state.physicalProperties, props.physical);
        }
        
        if (props.optical) {
            Object.assign(this.state.opticalProperties, props.optical);
        }
        
        if (props.electrical) {
            Object.assign(this.state.electricalProperties, props.electrical);
        }
        
        if (props.audioReactivity) {
            Object.assign(this.state.audioReactivity, props.audioReactivity);
        }
        
        this.state.currentMaterial = material.id || material.materialId;
        this.state.materialType = material.type || material.materialType;
        this.state.materialPhase = material.phase || 'liquid';
    }
    
    updateUIFromState() {
        const materialNameElement = this.elements.container.querySelector('.material-name');
        const materialTypeElement = this.elements.container.querySelector('.material-type');
        const materialPhaseElement = this.elements.container.querySelector('.material-phase');
        
        if (materialNameElement) {
            materialNameElement.textContent = this.state.currentMaterial;
        }
        if (materialTypeElement) {
            materialTypeElement.textContent = `(${this.state.materialType})`;
        }
        if (materialPhaseElement) {
            materialPhaseElement.textContent = this.state.materialPhase;
        }
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
        
        const controlId = this.getControlIdForProperty(property);
        const control = this.elements.controls.get(controlId);
        
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
        if (this.config.materialManager) {
            this.config.materialManager.setMaterial(this.config.defaultMaterial);
        }
        
        this.state.physicalProperties = {
            density: 1000.0,
            viscosity: 0.001,
            surfaceTension: 0.072,
            temperature: 293.15
        };
        
        this.state.opticalProperties = {
            baseColor: [0.2, 0.7, 1.0, 0.8],
            emission: [0.0, 0.0, 0.0],
            transparency: 0.85,
            metallic: 0.0,
            roughness: 0.1
        };
        
        this.state.electricalProperties = {
            conductivity: 5.5e-6,
            ionization: 0.0
        };
        
        this.updateUIFromState();
        console.log('Material properties reset to defaults');
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
    
    toggleMaterialPreview() {
        this.materialPreview.isActive = !this.materialPreview.isActive;
        
        const playButton = this.elements.materialPreview.querySelector('.preview-play');
        if (this.materialPreview.isActive) {
            playButton.textContent = 'Pause';
            playButton.dataset.state = 'playing';
        } else {
            playButton.textContent = 'Play';
            playButton.dataset.state = 'paused';
        }
    }
    
    resetMaterialPreview() {
        this.materialPreview.lastUpdate = 0;
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
        if (this.materialPreview.canvas) {
            const container = this.elements.materialPreview;
            const rect = container.getBoundingClientRect();
            
            this.materialPreview.canvas.width = Math.floor(rect.width - 20);
            this.materialPreview.canvas.height = 160;
        }
    }
    
    getControlIdForProperty(property) {
        const propertyMap = {
            'physical.density': 'density',
            'physical.viscosity': 'viscosity',
            'physical.surfaceTension': 'surface-tension',
            'physical.temperature': 'temperature',
            'optical.baseColor': 'base-color',
            'optical.transparency': 'transparency',
            'optical.metallic': 'metallic',
            'electrical.conductivity': 'conductivity',
            'electrical.ionization': 'ionization-level'
        };
        
        return propertyMap[property] || property;
    }
    
    getState() {
        return {
            currentMaterial: this.state.currentMaterial,
            materialType: this.state.materialType,
            materialPhase: this.state.materialPhase,
            physical: { ...this.state.physicalProperties },
            optical: { ...this.state.opticalProperties },
            electrical: { ...this.state.electricalProperties },
            audioReactivity: { ...this.state.audioReactivity },
            transitions: { ...this.state.transitionSettings }
        };
    }
    
    update(deltaTime) {
        if (!this.state.isInitialized) return;
        
        if (this.config.enableSpringAnimations) {
            this.springSystem.update(deltaTime);
        }
        
        if (this.materialPreview.isActive) {
            this.updateMaterialPreview(performance.now());
        }
        
        if (this.state.audioReactivity.enabled && this.config.audioEngine) {
            this.processAudioReactivity();
        }
    }
    
    processAudioReactivity() {
        const audioData = this.config.audioEngine.getAudioData();
        if (!audioData) return;
        
        const { bassLevel, midLevel, trebleLevel, energy, beat, beatStrength } = audioData;
        const sensitivity = this.state.audioReactivity.globalSensitivity;
        
        // Simple audio reactivity - modulate properties based on audio
        if (bassLevel && this.state.audioReactivity.viscosityResponse) {
            const modulation = bassLevel * sensitivity * this.state.audioReactivity.viscosityResponse;
            this.modulateProperty('physical', 'viscosity', modulation, 0.001, 100);
        }
        
        if (energy && this.state.audioReactivity.temperatureResponse) {
            const modulation = energy * sensitivity * this.state.audioReactivity.temperatureResponse;
            this.modulateProperty('physical', 'temperature', modulation, 173.15, 2273.15);
        }
    }
    
    modulateProperty(category, property, modulation, min, max) {
        const baseValue = this.state[`${category}Properties`][property];
        const variation = modulation * (max - min) * 0.1;
        const newValue = MathUtils.clamp(baseValue + variation, min, max);
        
        this.state[`${category}Properties`][property] = newValue;
        
        if (this.config.materialManager) {
            this.config.materialManager.setProperty(category, property, newValue);
        }
    }
    
    destroy() {
        if (this.materialPreview.animationFrame) {
            cancelAnimationFrame(this.materialPreview.animationFrame);
        }
        
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
        
        console.log('MaterialControls component destroyed');
    }
}

export default MaterialControls;