/**
 * Morph Transitions - Advanced Shape Morphing Animation System
 * Provides seamless geometric transformations and organic shape transitions
 * Location: src/ui/animations/MorphTransitions.js
 *
 * Features:
 * - Real-time shape morphing between different UI geometries
 * - Audio-reactive morphing parameters
 * - Bezier curve-based path interpolation
 * - SVG path morphing capabilities
 * - Physics-based organic transitions
 * - Integration with SpringSystem for natural movement
 * - Performance-optimized morphing algorithms
 * - CSS clip-path and mask integration
 */

import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { SpringSystem } from './SpringSystem.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';

export class MorphTransitions {
    constructor(options = {}) {
        // Configuration
        this.config = {
            // Morphing parameters
            defaultDuration: options.defaultDuration || 1500,
            morphingQuality: options.morphingQuality || 'high', // 'low', 'medium', 'high', 'ultra'
            enableAudioReactivity: options.enableAudioReactivity !== false,
            enablePhysicsEffects: options.enablePhysicsEffects !== false,
            
            // Performance settings
            maxConcurrentMorphs: options.maxConcurrentMorphs || 16,
            updateFrequency: options.updateFrequency || 60,
            enableOptimizations: options.enableOptimizations !== false,
            
            // Visual settings
            enableSmoothInterpolation: options.enableSmoothInterpolation !== false,
            morphingPrecision: options.morphingPrecision || 0.01,
            edgeSmoothness: options.edgeSmoothness || 0.1,
            
            // Audio integration
            audioInfluence: options.audioInfluence || 0.3,
            beatSensitivity: options.beatSensitivity || 0.7,
            frequencyMapping: options.frequencyMapping || 'logarithmic'
        };
        
        // Spring system integration
        this.springSystem = new SpringSystem({
            enableAudioReactivity: this.config.enableAudioReactivity,
            targetFPS: this.config.updateFrequency
        });
        
        // Active morph tracking
        this.activeMorphs = new Map();
        this.morphCounter = 0;
        
        // Morphing algorithms
        this.morphingAlgorithms = {
            linear: this.linearMorph.bind(this),
            bezier: this.bezierMorph.bind(this),
            elastic: this.elasticMorph.bind(this),
            organic: this.organicMorph.bind(this),
            liquid: this.liquidMorph.bind(this),
            crystalline: this.crystallineMorph.bind(this),
            plasma: this.plasmaMorph.bind(this),
            magnetic: this.magneticMorph.bind(this)
        };
        
        // Shape libraries
        this.shapeLibrary = {
            basic: this.generateBasicShapes(),
            organic: this.generateOrganicShapes(),
            geometric: this.generateGeometricShapes(),
            fluid: this.generateFluidShapes(),
            crystalline: this.generateCrystallineShapes()
        };
        
        // Audio-reactive state
        this.audioState = {
            energy: 0,
            bass: 0,
            mid: 0,
            treble: 0,
            beat: false,
            beatStrength: 0,
            spectrum: new Float32Array(32),
            lastUpdate: 0
        };
        
        // Performance metrics
        this.performanceMetrics = {
            activeMorphCount: 0,
            averageFrameTime: 0,
            morphCalculationTime: 0,
            memoryUsage: 0,
            lastMetricUpdate: 0
        };
        
        // CSS integration
        this.cssIntegration = {
            useClipPath: true,
            useMasks: true,
            useTransforms: true,
            useFilters: true
        };
        
        console.log('MorphTransitions initialized', {
            quality: this.config.morphingQuality,
            maxMorphs: this.config.maxConcurrentMorphs,
            audioReactive: this.config.enableAudioReactivity
        });
        
        this.initializeSystem();
    }
    
    /**
     * Initialize the morphing system
     */
    initializeSystem() {
        // Start spring system
        this.springSystem.start();
        
        // Setup performance monitoring
        if (performanceMonitor) {
            performanceMonitor.addCategory('morphTransitions');
        }
        
        // Initialize CSS utilities
        this.initializeCSSUtilities();
    }
    
    /**
     * Initialize CSS utilities for morphing
     */
    initializeCSSUtilities() {
        // Add CSS variables for morphing
        const root = document.documentElement;
        root.style.setProperty('--morph-progress', '0');
        root.style.setProperty('--morph-audio-energy', '0');
        root.style.setProperty('--morph-beat-strength', '0');
        
        // Add morphing CSS classes if not present
        this.addMorphingStyles();
    }
    
    /**
     * Add required CSS styles for morphing
     */
    addMorphingStyles() {
        const styleId = 'morph-transitions-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .morph-container {
                position: relative;
                overflow: hidden;
                will-change: clip-path, transform, filter;
            }
            
            .morph-element {
                transition: none;
                will-change: clip-path, border-radius, transform, filter;
            }
            
            .morph-organic {
                clip-path: polygon(var(--morph-path));
            }
            
            .morph-liquid {
                border-radius: var(--morph-radius);
                filter: blur(var(--morph-blur, 0px));
            }
            
            .morph-crystalline {
                clip-path: polygon(var(--morph-crystal-path));
                filter: drop-shadow(0 0 10px rgba(255, 255, 255, var(--morph-glow, 0)));
            }
        `;
        document.head.appendChild(style);
    }
    
    // ===== CORE MORPHING API =====
    
    /**
     * Create a new morphing transition
     */
    createMorph(config = {}) {
        const morphId = `morph_${++this.morphCounter}`;
        
        // Parse configuration
        const morphConfig = this.parseMorphConfig(config);
        
        // Create morph instance
        const morph = {
            id: morphId,
            ...morphConfig,
            
            // State tracking
            startTime: performance.now(),
            progress: 0,
            isActive: true,
            isPaused: false,
            
            // Current shape data
            currentPath: null,
            currentRadius: null,
            currentTransform: null,
            
            // Springs for physics-based morphing
            springs: {
                main: this.springSystem.createSpring({
                    tension: morphConfig.springTension,
                    friction: morphConfig.springFriction,
                    mass: morphConfig.springMass
                }),
                secondary: this.springSystem.createSpring({
                    tension: morphConfig.springTension * 0.7,
                    friction: morphConfig.springFriction * 1.2,
                    mass: morphConfig.springMass * 0.8
                })
            },
            
            // Audio reactivity
            audioReactive: morphConfig.audioReactive,
            audioProperty: morphConfig.audioProperty,
            audioInfluence: morphConfig.audioInfluence,
            
            // Performance tracking
            lastUpdateTime: 0,
            calculationTime: 0
        };
        
        // Setup spring callbacks
        morph.springs.main.onUpdate((value) => {
            morph.progress = value;
            this.updateMorphVisuals(morph);
        });
        
        morph.springs.main.onRest(() => {
            this.completeMorph(morph);
        });
        
        // Store morph
        this.activeMorphs.set(morphId, morph);
        
        console.log(`Morph ${morphId} created:`, morphConfig.type);
        return morphId;
    }
    
    /**
     * Start a morphing transition
     */
    startMorph(morphId, targetShape = null) {
        const morph = this.activeMorphs.get(morphId);
        if (!morph) return false;
        
        // Set target shape if provided
        if (targetShape) {
            morph.targetShape = targetShape;
        }
        
        // Start spring animation
        morph.springs.main.setTarget(1.0);
        morph.isActive = true;
        morph.startTime = performance.now();
        
        // Call start callback
        if (morph.onStart) {
            morph.onStart(morph);
        }
        
        return true;
    }
    
    /**
     * Update audio state for reactive morphing
     */
    updateAudioState(audioData) {
        if (!this.config.enableAudioReactivity) return;
        
        const currentTime = performance.now();
        
        // Update audio properties
        this.audioState.energy = audioData.energy || 0;
        this.audioState.bass = audioData.bass || 0;
        this.audioState.mid = audioData.mid || 0;
        this.audioState.treble = audioData.treble || 0;
        this.audioState.beat = audioData.beat || false;
        this.audioState.beatStrength = audioData.beatStrength || 0;
        
        if (audioData.spectrum) {
            this.audioState.spectrum.set(audioData.spectrum);
        }
        
        this.audioState.lastUpdate = currentTime;
        
        // Update CSS variables
        this.updateAudioCSSVariables();
        
        // Update active morphs with audio data
        this.updateAudioReactiveMorphs();
    }
    
    /**
     * Update CSS variables with audio data
     */
    updateAudioCSSVariables() {
        const root = document.documentElement;
        root.style.setProperty('--morph-audio-energy', this.audioState.energy.toString());
        root.style.setProperty('--morph-beat-strength', this.audioState.beatStrength.toString());
        
        // Frequency-based variables
        root.style.setProperty('--morph-bass', this.audioState.bass.toString());
        root.style.setProperty('--morph-mid', this.audioState.mid.toString());
        root.style.setProperty('--morph-treble', this.audioState.treble.toString());
    }
    
    /**
     * Update audio-reactive morphs
     */
    updateAudioReactiveMorphs() {
        for (const morph of this.activeMorphs.values()) {
            if (!morph.audioReactive || !morph.isActive) continue;
            
            // Apply audio influence to morph parameters
            this.applyAudioInfluence(morph);
        }
    }
    
    /**
     * Apply audio influence to a specific morph
     */
    applyAudioInfluence(morph) {
        const audioValue = this.getAudioValue(morph.audioProperty);
        const influence = morph.audioInfluence * this.config.audioInfluence;
        
        // Modulate spring parameters
        const baseTension = morph.springs.main.tension;
        const audioTension = baseTension * (1 + audioValue * influence);
        morph.springs.main.setParams(audioTension);
        
        // Update shape parameters based on audio
        if (morph.type === 'organic') {
            this.updateOrganicAudioReactivity(morph, audioValue, influence);
        } else if (morph.type === 'liquid') {
            this.updateLiquidAudioReactivity(morph, audioValue, influence);
        } else if (morph.type === 'crystalline') {
            this.updateCrystallineAudioReactivity(morph, audioValue, influence);
        }
    }
    
    /**
     * Get audio value by property name
     */
    getAudioValue(property) {
        switch (property) {
            case 'energy': return this.audioState.energy;
            case 'bass': return this.audioState.bass;
            case 'mid': return this.audioState.mid;
            case 'treble': return this.audioState.treble;
            case 'beat': return this.audioState.beatStrength;
            default: return this.audioState.energy;
        }
    }
    
    // ===== MORPHING ALGORITHMS =====
    
    /**
     * Linear morphing between two shapes
     */
    linearMorph(fromShape, toShape, progress) {
        const points = [];
        
        // Ensure both shapes have the same number of points
        const maxPoints = Math.max(fromShape.points.length, toShape.points.length);
        
        for (let i = 0; i < maxPoints; i++) {
            const fromPoint = fromShape.points[i % fromShape.points.length];
            const toPoint = toShape.points[i % toShape.points.length];
            
            const x = MathUtils.lerp(fromPoint.x, toPoint.x, progress);
            const y = MathUtils.lerp(fromPoint.y, toPoint.y, progress);
            
            points.push({ x, y });
        }
        
        return { points, type: 'polygon' };
    }
    
    /**
     * Bezier curve-based morphing for smooth transitions
     */
    bezierMorph(fromShape, toShape, progress) {
        const smoothedProgress = MathUtils.smootherstep(0, 1, progress);
        const points = [];
        
        const maxPoints = Math.max(fromShape.points.length, toShape.points.length);
        
        for (let i = 0; i < maxPoints; i++) {
            const fromPoint = fromShape.points[i % fromShape.points.length];
            const toPoint = toShape.points[i % toShape.points.length];
            
            // Calculate control points for smooth curves
            const controlOffset = 0.3;
            const nextFromPoint = fromShape.points[(i + 1) % fromShape.points.length];
            const nextToPoint = toShape.points[(i + 1) % toShape.points.length];
            
            const controlX1 = fromPoint.x + (nextFromPoint.x - fromPoint.x) * controlOffset;
            const controlY1 = fromPoint.y + (nextFromPoint.y - fromPoint.y) * controlOffset;
            const controlX2 = toPoint.x + (nextToPoint.x - toPoint.x) * controlOffset;
            const controlY2 = toPoint.y + (nextToPoint.y - toPoint.y) * controlOffset;
            
            // Interpolate control points
            const interpControlX = MathUtils.lerp(controlX1, controlX2, smoothedProgress);
            const interpControlY = MathUtils.lerp(controlY1, controlY2, smoothedProgress);
            
            // Calculate final point using bezier interpolation
            const x = this.bezierInterpolate(fromPoint.x, interpControlX, toPoint.x, smoothedProgress);
            const y = this.bezierInterpolate(fromPoint.y, interpControlY, toPoint.y, smoothedProgress);
            
            points.push({ x, y });
        }
        
        return { points, type: 'bezier' };
    }
    
    /**
     * Elastic morphing with overshoot effects
     */
    elasticMorph(fromShape, toShape, progress) {
        const elasticProgress = MathUtils.easeOutElastic(progress);
        return this.linearMorph(fromShape, toShape, elasticProgress);
    }
    
    /**
     * Organic morphing simulating biological growth
     */
    organicMorph(fromShape, toShape, progress) {
        const points = [];
        const maxPoints = Math.max(fromShape.points.length, toShape.points.length);
        
        // Add organic randomness and growth patterns
        const time = performance.now() * 0.001;
        const noiseScale = 0.02;
        const growthFactor = MathUtils.smootherstep(0, 1, progress);
        
        for (let i = 0; i < maxPoints; i++) {
            const fromPoint = fromShape.points[i % fromShape.points.length];
            const toPoint = toShape.points[i % toShape.points.length];
            
            // Base interpolation
            let x = MathUtils.lerp(fromPoint.x, toPoint.x, growthFactor);
            let y = MathUtils.lerp(fromPoint.y, toPoint.y, growthFactor);
            
            // Add organic noise
            const noiseOffset = (i / maxPoints) * Math.PI * 2;
            const noiseX = Math.sin(time + noiseOffset) * noiseScale * growthFactor;
            const noiseY = Math.cos(time + noiseOffset * 1.3) * noiseScale * growthFactor;
            
            x += noiseX;
            y += noiseY;
            
            // Add pulsing effect based on audio
            if (this.audioState.beat && this.config.enableAudioReactivity) {
                const pulseAmount = this.audioState.beatStrength * 0.05;
                const distanceFromCenter = Math.sqrt(x * x + y * y);
                const normalizedDistance = distanceFromCenter / 100; // Normalize
                
                x += Math.cos(noiseOffset) * pulseAmount * normalizedDistance;
                y += Math.sin(noiseOffset) * pulseAmount * normalizedDistance;
            }
            
            points.push({ x, y });
        }
        
        return { points, type: 'organic' };
    }
    
    /**
     * Liquid morphing with fluid dynamics
     */
    liquidMorph(fromShape, toShape, progress) {
        const viscosity = 0.8;
        const surfaceTension = 0.3;
        const fluidProgress = this.calculateFluidProgress(progress, viscosity, surfaceTension);
        
        const points = [];
        const maxPoints = Math.max(fromShape.points.length, toShape.points.length);
        
        for (let i = 0; i < maxPoints; i++) {
            const fromPoint = fromShape.points[i % fromShape.points.length];
            const toPoint = toShape.points[i % toShape.points.length];
            
            // Apply fluid motion with smoothing
            let x = MathUtils.lerp(fromPoint.x, toPoint.x, fluidProgress);
            let y = MathUtils.lerp(fromPoint.y, toPoint.y, fluidProgress);
            
            // Add fluid ripple effects
            const time = performance.now() * 0.003;
            const rippleFreq = 0.1;
            const rippleAmp = 2 * (1 - surfaceTension);
            
            const rippleX = Math.sin(time + i * rippleFreq) * rippleAmp * progress;
            const rippleY = Math.cos(time + i * rippleFreq * 1.2) * rippleAmp * progress;
            
            x += rippleX;
            y += rippleY;
            
            points.push({ x, y });
        }
        
        return { points, type: 'liquid', blur: progress * 2 };
    }
    
    /**
     * Crystalline morphing with sharp, geometric transitions
     */
    crystallineMorph(fromShape, toShape, progress) {
        const crystallineProgress = this.calculateCrystallineProgress(progress);
        const points = [];
        
        // Generate crystalline fracture pattern
        const fractureLines = this.generateFracturePattern(fromShape, toShape, progress);
        
        // Apply morphing along fracture lines
        const maxPoints = Math.max(fromShape.points.length, toShape.points.length);
        
        for (let i = 0; i < maxPoints; i++) {
            const fromPoint = fromShape.points[i % fromShape.points.length];
            const toPoint = toShape.points[i % toShape.points.length];
            
            let x = MathUtils.lerp(fromPoint.x, toPoint.x, crystallineProgress);
            let y = MathUtils.lerp(fromPoint.y, toPoint.y, crystallineProgress);
            
            // Apply crystalline distortion
            const angleToCenter = Math.atan2(y, x);
            const distanceFromCenter = Math.sqrt(x * x + y * y);
            
            const crystalFactor = Math.sin(angleToCenter * 6 + progress * Math.PI) * 0.1 * progress;
            x += Math.cos(angleToCenter) * crystalFactor * distanceFromCenter * 0.01;
            y += Math.sin(angleToCenter) * crystalFactor * distanceFromCenter * 0.01;
            
            points.push({ x, y });
        }
        
        return { 
            points, 
            type: 'crystalline', 
            glow: progress * 0.8,
            fractureLines 
        };
    }
    
    /**
     * Plasma morphing with electromagnetic effects
     */
    plasmaMorph(fromShape, toShape, progress) {
        const plasmaEnergy = MathUtils.clamp(progress * 2, 0, 2);
        const points = [];
        
        const maxPoints = Math.max(fromShape.points.length, toShape.points.length);
        const time = performance.now() * 0.005;
        
        for (let i = 0; i < maxPoints; i++) {
            const fromPoint = fromShape.points[i % fromShape.points.length];
            const toPoint = toShape.points[i % toShape.points.length];
            
            let x = MathUtils.lerp(fromPoint.x, toPoint.x, progress);
            let y = MathUtils.lerp(fromPoint.y, toPoint.y, progress);
            
            // Add plasma field distortion
            const fieldStrength = plasmaEnergy * 0.1;
            const plasmaX = Math.sin(time * 2 + i * 0.5) * fieldStrength;
            const plasmaY = Math.cos(time * 1.7 + i * 0.3) * fieldStrength;
            
            x += plasmaX;
            y += plasmaY;
            
            // Add electromagnetic oscillation
            if (this.audioState.treble > 0.5) {
                const oscillation = this.audioState.treble * 5;
                x += Math.sin(time * 10 + i) * oscillation;
                y += Math.cos(time * 10 + i) * oscillation;
            }
            
            points.push({ x, y });
        }
        
        return { 
            points, 
            type: 'plasma', 
            energy: plasmaEnergy,
            glow: plasmaEnergy * 0.6 
        };
    }
    
    /**
     * Magnetic morphing with field line effects
     */
    magneticMorph(fromShape, toShape, progress) {
        const magneticStrength = MathUtils.smoothstep(0, 1, progress);
        const points = [];
        
        // Calculate magnetic field center
        const centerX = (fromShape.center.x + toShape.center.x) * 0.5;
        const centerY = (fromShape.center.y + toShape.center.y) * 0.5;
        
        const maxPoints = Math.max(fromShape.points.length, toShape.points.length);
        
        for (let i = 0; i < maxPoints; i++) {
            const fromPoint = fromShape.points[i % fromShape.points.length];
            const toPoint = toShape.points[i % toShape.points.length];
            
            // Calculate distance and angle from magnetic center
            const dx = fromPoint.x - centerX;
            const dy = fromPoint.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            // Apply magnetic field influence
            const fieldInfluence = magneticStrength * (1 / (1 + distance * 0.01));
            const fieldAngle = angle + magneticStrength * Math.PI * 0.1;
            
            let x = MathUtils.lerp(fromPoint.x, toPoint.x, progress);
            let y = MathUtils.lerp(fromPoint.y, toPoint.y, progress);
            
            // Add magnetic distortion
            x += Math.cos(fieldAngle) * fieldInfluence * 10;
            y += Math.sin(fieldAngle) * fieldInfluence * 10;
            
            points.push({ x, y });
        }
        
        return { points, type: 'magnetic', fieldStrength: magneticStrength };
    }
    
    // ===== HELPER METHODS =====
    
    /**
     * Bezier interpolation
     */
    bezierInterpolate(p0, p1, p2, t) {
        const oneMinusT = 1 - t;
        return oneMinusT * oneMinusT * p0 + 2 * oneMinusT * t * p1 + t * t * p2;
    }
    
    /**
     * Calculate fluid progress with viscosity
     */
    calculateFluidProgress(progress, viscosity, surfaceTension) {
        const dampedProgress = progress * viscosity;
        return MathUtils.smootherstep(0, 1, dampedProgress) * (1 + surfaceTension * 0.1);
    }
    
    /**
     * Calculate crystalline progress with sharp transitions
     */
    calculateCrystallineProgress(progress) {
        // Create stepped progression for crystalline effect
        const steps = 8;
        const stepSize = 1 / steps;
        const stepIndex = Math.floor(progress * steps);
        const stepProgress = (progress - stepIndex * stepSize) / stepSize;
        
        return (stepIndex + MathUtils.smootherstep(0, 1, stepProgress)) / steps;
    }
    
    /**
     * Generate fracture pattern for crystalline morphing
     */
    generateFracturePattern(fromShape, toShape, progress) {
        const lines = [];
        const numFractures = Math.floor(progress * 6) + 2;
        
        for (let i = 0; i < numFractures; i++) {
            const angle = (i / numFractures) * Math.PI * 2;
            const startRadius = 20 + progress * 50;
            const endRadius = 60 + progress * 100;
            
            lines.push({
                start: {
                    x: Math.cos(angle) * startRadius,
                    y: Math.sin(angle) * startRadius
                },
                end: {
                    x: Math.cos(angle) * endRadius,
                    y: Math.sin(angle) * endRadius
                },
                intensity: progress
            });
        }
        
        return lines;
    }
    
    /**
     * Parse morph configuration
     */
    parseMorphConfig(config) {
        return {
            type: config.type || 'linear',
            fromShape: config.fromShape || this.shapeLibrary.basic.circle,
            toShape: config.toShape || this.shapeLibrary.basic.square,
            duration: config.duration || this.config.defaultDuration,
            easing: config.easing || 'smoothstep',
            algorithm: config.algorithm || config.type,
            
            // Element targeting
            target: config.target || null,
            selector: config.selector || null,
            
            // Spring parameters
            springTension: config.springTension || 200,
            springFriction: config.springFriction || 15,
            springMass: config.springMass || 1,
            
            // Audio reactivity
            audioReactive: config.audioReactive === true,
            audioProperty: config.audioProperty || 'energy',
            audioInfluence: config.audioInfluence || 0.3,
            
            // Visual properties
            preserveAspectRatio: config.preserveAspectRatio !== false,
            enableSmoothEdges: config.enableSmoothEdges !== false,
            
            // Callbacks
            onStart: config.onStart || null,
            onUpdate: config.onUpdate || null,
            onComplete: config.onComplete || null
        };
    }
    
    /**
     * Update morph visuals based on current progress
     */
    updateMorphVisuals(morph) {
        const startTime = performance.now();
        
        // Calculate current shape
        const algorithm = this.morphingAlgorithms[morph.algorithm] || this.morphingAlgorithms.linear;
        const currentShape = algorithm(morph.fromShape, morph.toShape, morph.progress);
        
        // Apply shape to target element
        if (morph.target || morph.selector) {
            this.applyShapeToElement(morph, currentShape);
        }
        
        // Update CSS variables
        this.updateMorphCSSVariables(morph, currentShape);
        
        // Call update callback
        if (morph.onUpdate) {
            morph.onUpdate(morph, currentShape);
        }
        
        // Track performance
        morph.calculationTime = performance.now() - startTime;
    }
    
    /**
     * Apply shape to DOM element
     */
    applyShapeToElement(morph, shape) {
        const element = morph.target || document.querySelector(morph.selector);
        if (!element) return;
        
        // Apply based on shape type
        switch (shape.type) {
            case 'polygon':
            case 'organic':
            case 'crystalline':
            case 'magnetic':
                this.applyPolygonShape(element, shape);
                break;
            case 'liquid':
                this.applyLiquidShape(element, shape);
                break;
            case 'plasma':
                this.applyPlasmaShape(element, shape);
                break;
            case 'bezier':
                this.applyBezierShape(element, shape);
                break;
            default:
                this.applyPolygonShape(element, shape);
        }
    }
    
    /**
     * Apply polygon-based shape to element
     */
    applyPolygonShape(element, shape) {
        if (!this.cssIntegration.useClipPath) return;
        
        // Convert points to CSS polygon format
        const polygonPoints = shape.points.map(point => 
            `${point.x}px ${point.y}px`
        ).join(', ');
        
        element.style.clipPath = `polygon(${polygonPoints})`;
        
        // Apply additional effects
        if (shape.glow !== undefined) {
            const glowIntensity = shape.glow;
            element.style.filter = `drop-shadow(0 0 ${glowIntensity * 15}px rgba(255, 255, 255, ${glowIntensity}))`;
        }
        
        if (shape.type === 'crystalline' && shape.fractureLines) {
            this.renderFractureLines(element, shape.fractureLines);
        }
    }
    
    /**
     * Apply liquid-based shape to element
     */
    applyLiquidShape(element, shape) {
        // Use border-radius for liquid effects
        const radiusValues = this.calculateLiquidRadius(shape.points);
        element.style.borderRadius = radiusValues;
        
        // Apply blur for liquid effect
        if (shape.blur !== undefined) {
            element.style.filter = `blur(${shape.blur}px)`;
        }
        
        // Add liquid animation class
        element.classList.add('morph-liquid');
    }
    
    /**
     * Apply plasma-based shape to element
     */
    applyPlasmaShape(element, shape) {
        // Combine polygon clipping with plasma effects
        this.applyPolygonShape(element, shape);
        
        // Add plasma glow and energy effects
        if (shape.energy !== undefined) {
            const energy = shape.energy;
            const glowColor = this.calculatePlasmaColor(energy);
            
            element.style.filter = `
                drop-shadow(0 0 ${energy * 20}px ${glowColor})
                brightness(${1 + energy * 0.5})
                saturate(${1 + energy * 0.3})
            `;
            
            // Add plasma animation
            element.style.animation = `plasma-pulse ${0.5 / energy}s infinite alternate`;
        }
    }
    
    /**
     * Apply bezier-based shape to element
     */
    applyBezierShape(element, shape) {
        // Create SVG path for bezier curves
        const svgPath = this.generateSVGPath(shape.points);
        const svgDataUrl = this.createSVGMask(svgPath);
        
        if (this.cssIntegration.useMasks) {
            element.style.mask = `url("${svgDataUrl}")`;
            element.style.webkitMask = `url("${svgDataUrl}")`;
        } else {
            // Fallback to clip-path approximation
            this.applyPolygonShape(element, shape);
        }
    }
    
    /**
     * Calculate liquid radius values for border-radius
     */
    calculateLiquidRadius(points) {
        const numPoints = points.length;
        const radiusValues = [];
        
        // Generate organic border-radius values
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const pointIndex = Math.floor((i / 8) * numPoints);
            const point = points[pointIndex];
            
            // Calculate radius based on distance from center
            const distance = Math.sqrt(point.x * point.x + point.y * point.y);
            const radius = Math.max(10, distance * 0.3);
            
            radiusValues.push(`${radius}px`);
        }
        
        return radiusValues.join(' ');
    }
    
    /**
     * Calculate plasma color based on energy level
     */
    calculatePlasmaColor(energy) {
        // Map energy to plasma color spectrum
        const hue = MathUtils.lerp(240, 300, energy); // Blue to purple
        const saturation = 100;
        const lightness = MathUtils.lerp(50, 80, energy);
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
    
    /**
     * Generate SVG path from points
     */
    generateSVGPath(points) {
        if (points.length === 0) return '';
        
        let path = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            const prevPoint = points[i - 1];
            const nextPoint = points[(i + 1) % points.length];
            
            // Calculate control points for smooth curves
            const controlPoint1 = {
                x: prevPoint.x + (point.x - prevPoint.x) * 0.3,
                y: prevPoint.y + (point.y - prevPoint.y) * 0.3
            };
            
            const controlPoint2 = {
                x: point.x - (nextPoint.x - point.x) * 0.3,
                y: point.y - (nextPoint.y - point.y) * 0.3
            };
            
            path += ` C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${point.x} ${point.y}`;
        }
        
        path += ' Z';
        return path;
    }
    
    /**
     * Create SVG mask data URL
     */
    createSVGMask(pathData) {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
                <path d="${pathData}" fill="white"/>
            </svg>
        `;
        
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }
    
    /**
     * Render fracture lines for crystalline morphing
     */
    renderFractureLines(element, fractureLines) {
        // Create overlay element for fracture lines if it doesn't exist
        let fractureOverlay = element.querySelector('.fracture-overlay');
        if (!fractureOverlay) {
            fractureOverlay = document.createElement('div');
            fractureOverlay.className = 'fracture-overlay';
            fractureOverlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 1;
            `;
            element.appendChild(fractureOverlay);
        }
        
        // Generate SVG for fracture lines
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.cssText = 'width: 100%; height: 100%; position: absolute;';
        
        fractureLines.forEach(line => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            path.setAttribute('x1', line.start.x + 100);
            path.setAttribute('y1', line.start.y + 100);
            path.setAttribute('x2', line.end.x + 100);
            path.setAttribute('y2', line.end.y + 100);
            path.setAttribute('stroke', `rgba(255, 255, 255, ${line.intensity})`);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('filter', 'drop-shadow(0 0 3px white)');
            
            svg.appendChild(path);
        });
        
        fractureOverlay.innerHTML = '';
        fractureOverlay.appendChild(svg);
    }
    
    /**
     * Update CSS variables for current morph
     */
    updateMorphCSSVariables(morph, shape) {
        const root = document.documentElement;
        
        // Update progress variable
        root.style.setProperty('--morph-progress', morph.progress.toString());
        
        // Update shape-specific variables
        if (shape.glow !== undefined) {
            root.style.setProperty('--morph-glow', shape.glow.toString());
        }
        
        if (shape.blur !== undefined) {
            root.style.setProperty('--morph-blur', `${shape.blur}px`);
        }
        
        if (shape.energy !== undefined) {
            root.style.setProperty('--morph-energy', shape.energy.toString());
        }
        
        // Update path variables for polygon shapes
        if (shape.points && shape.points.length > 0) {
            const pathString = shape.points.map(point => 
                `${((point.x + 100) / 200 * 100)}% ${((point.y + 100) / 200 * 100)}%`
            ).join(', ');
            
            root.style.setProperty('--morph-path', pathString);
        }
    }
    
    /**
     * Complete a morph transition
     */
    completeMorph(morph) {
        // Mark as completed
        morph.isActive = false;
        
        // Call completion callback
        if (morph.onComplete) {
            morph.onComplete(morph);
        }
        
        // Clean up springs
        morph.springs.main.destroy();
        morph.springs.secondary.destroy();
        
        // Remove from active morphs
        this.activeMorphs.delete(morph.id);
        
        console.log(`Morph ${morph.id} completed`);
    }
    
    // ===== AUDIO-REACTIVE UPDATES =====
    
    /**
     * Update organic morphing with audio reactivity
     */
    updateOrganicAudioReactivity(morph, audioValue, influence) {
        // Modulate organic noise parameters
        morph.organicNoise = (morph.organicNoise || 0.02) * (1 + audioValue * influence);
        morph.growthRate = (morph.growthRate || 1.0) * (1 + audioValue * influence * 0.5);
        
        // Beat-reactive pulsing
        if (this.audioState.beat) {
            const pulseSpring = this.springSystem.createSpring({
                tension: 400,
                friction: 10,
                mass: 0.5
            });
            
            pulseSpring.setTarget(1.2);
            pulseSpring.onUpdate((value) => {
                morph.beatPulse = value;
            });
            
            setTimeout(() => {
                pulseSpring.setTarget(1.0);
                setTimeout(() => pulseSpring.destroy(), 500);
            }, 100);
        }
    }
    
    /**
     * Update liquid morphing with audio reactivity
     */
    updateLiquidAudioReactivity(morph, audioValue, influence) {
        // Modulate viscosity and surface tension
        morph.viscosity = MathUtils.clamp(0.5 + audioValue * influence, 0.1, 1.0);
        morph.surfaceTension = MathUtils.clamp(0.3 + audioValue * influence * 0.5, 0.1, 0.8);
        
        // Frequency-based ripple effects
        morph.rippleFrequency = 0.1 + this.audioState.treble * influence * 0.2;
        morph.rippleAmplitude = 1 + this.audioState.bass * influence * 3;
    }
    
    /**
     * Update crystalline morphing with audio reactivity
     */
    updateCrystallineAudioReactivity(morph, audioValue, influence) {
        // Modulate fracture generation
        morph.fractureIntensity = audioValue * influence;
        morph.crystalGlow = audioValue * influence * 0.8;
        
        // Beat-triggered fracture effects
        if (this.audioState.beat && this.audioState.beatStrength > 0.7) {
            morph.triggerFracture = true;
            
            setTimeout(() => {
                morph.triggerFracture = false;
            }, 200);
        }
    }
    
    // ===== SHAPE LIBRARIES =====
    
    /**
     * Generate basic geometric shapes
     */
    generateBasicShapes() {
        return {
            circle: this.generateCircle(50, 32),
            square: this.generateSquare(80),
            triangle: this.generateTriangle(70),
            pentagon: this.generateRegularPolygon(5, 60),
            hexagon: this.generateRegularPolygon(6, 55),
            star: this.generateStar(5, 60, 30)
        };
    }
    
    /**
     * Generate organic shapes
     */
    generateOrganicShapes() {
        return {
            blob: this.generateBlob(50, 16),
            amoeba: this.generateAmoeba(45, 20),
            cell: this.generateCell(40, 18),
            leaf: this.generateLeaf(60, 24),
            flower: this.generateFlower(5, 50, 25)
        };
    }
    
    /**
     * Generate geometric shapes
     */
    generateGeometricShapes() {
        return {
            diamond: this.generateDiamond(70),
            arrow: this.generateArrow(80, 40),
            cross: this.generateCross(60, 20),
            gear: this.generateGear(8, 50, 30),
            spiral: this.generateSpiral(3, 50, 16)
        };
    }
    
    /**
     * Generate fluid shapes
     */
    generateFluidShapes() {
        return {
            wave: this.generateWave(80, 20, 4),
            ripple: this.generateRipple(60, 3),
            splash: this.generateSplash(70, 12),
            droplet: this.generateDroplet(50),
            bubble: this.generateBubble(45)
        };
    }
    
    /**
     * Generate crystalline shapes
     */
    generateCrystallineShapes() {
        return {
            crystal: this.generateCrystal(6, 60),
            gem: this.generateGem(8, 50),
            prism: this.generatePrism(3, 70),
            shard: this.generateShard(8, 80),
            lattice: this.generateLattice(4, 55)
        };
    }
    
    // ===== SHAPE GENERATION METHODS =====
    
    /**
     * Generate circle points
     */
    generateCircle(radius, segments) {
        const points = [];
        const center = { x: 0, y: 0 };
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        return { points, center, type: 'circle' };
    }
    
    /**
     * Generate square points
     */
    generateSquare(size) {
        const half = size / 2;
        return {
            points: [
                { x: -half, y: -half },
                { x: half, y: -half },
                { x: half, y: half },
                { x: -half, y: half }
            ],
            center: { x: 0, y: 0 },
            type: 'square'
        };
    }
    
    /**
     * Generate triangle points
     */
    generateTriangle(size) {
        const height = size * Math.sqrt(3) / 2;
        return {
            points: [
                { x: 0, y: -height / 2 },
                { x: -size / 2, y: height / 2 },
                { x: size / 2, y: height / 2 }
            ],
            center: { x: 0, y: 0 },
            type: 'triangle'
        };
    }
    
    /**
     * Generate regular polygon
     */
    generateRegularPolygon(sides, radius) {
        const points = [];
        const center = { x: 0, y: 0 };
        
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        return { points, center, type: 'polygon' };
    }
    
    /**
     * Generate star shape
     */
    generateStar(points, outerRadius, innerRadius) {
        const starPoints = [];
        const center = { x: 0, y: 0 };
        
        for (let i = 0; i < points * 2; i++) {
            const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            
            starPoints.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        return { points: starPoints, center, type: 'star' };
    }
    
    /**
     * Generate organic blob shape
     */
    generateBlob(baseRadius, segments) {
        const points = [];
        const center = { x: 0, y: 0 };
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const randomness = 0.3;
            const radiusVariation = 1 + (Math.random() - 0.5) * randomness;
            const radius = baseRadius * radiusVariation;
            
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        return { points, center, type: 'organic' };
    }
    
    /**
     * Generate amoeba-like shape
     */
    generateAmoeba(baseRadius, segments) {
        const points = [];
        const center = { x: 0, y: 0 };
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const noise1 = Math.sin(angle * 3) * 0.3;
            const noise2 = Math.cos(angle * 5) * 0.2;
            const radiusVariation = 1 + noise1 + noise2;
            const radius = baseRadius * radiusVariation;
            
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        return { points, center, type: 'organic' };
    }
    
    /**
     * Generate wave shape
     */
    generateWave(width, amplitude, frequency) {
        const points = [];
        const segments = 32;
        const center = { x: 0, y: 0 };
        
        for (let i = 0; i <= segments; i++) {
            const x = (i / segments - 0.5) * width;
            const y = Math.sin((i / segments) * Math.PI * 2 * frequency) * amplitude;
            points.push({ x, y });
        }
        
        // Close the shape
        for (let i = segments; i >= 0; i--) {
            const x = (i / segments - 0.5) * width;
            const y = -amplitude - 10; // Bottom edge
            points.push({ x, y });
        }
        
        return { points, center, type: 'wave' };
    }
    
    /**
     * Generate crystal shape
     */
    generateCrystal(faces, radius) {
        const points = [];
        const center = { x: 0, y: 0 };
        
        for (let i = 0; i < faces; i++) {
            const angle = (i / faces) * Math.PI * 2;
            const faceRadius = radius * (0.8 + Math.random() * 0.4);
            
            points.push({
                x: Math.cos(angle) * faceRadius,
                y: Math.sin(angle) * faceRadius
            });
        }
        
        return { points, center, type: 'crystalline' };
    }
    
    // ===== PERFORMANCE MONITORING =====
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        const currentTime = performance.now();
        
        this.performanceMetrics.activeMorphCount = this.activeMorphs.size;
        
        // Calculate average calculation time
        let totalCalculationTime = 0;
        for (const morph of this.activeMorphs.values()) {
            totalCalculationTime += morph.calculationTime || 0;
        }
        
        this.performanceMetrics.morphCalculationTime = 
            this.activeMorphs.size > 0 ? totalCalculationTime / this.activeMorphs.size : 0;
        
        // Estimate memory usage
        this.performanceMetrics.memoryUsage = this.activeMorphs.size * 512; // Rough estimate
        
        this.performanceMetrics.lastMetricUpdate = currentTime;
        
        // Report to performance monitor
        if (performanceMonitor) {
            performanceMonitor.recordCPUTime('morphTransitions', this.performanceMetrics.morphCalculationTime);
            performanceMonitor.recordMemoryUsage('morphTransitions', this.performanceMetrics.memoryUsage);
        }
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        this.updatePerformanceMetrics();
        return {
            ...this.performanceMetrics,
            isRunning: this.springSystem.isRunning,
            springSystemMetrics: this.springSystem.getPerformanceMetrics()
        };
    }
    
    // ===== PUBLIC API METHODS =====
    
    /**
     * Create and start a quick morph
     */
    quickMorph(element, toShape, options = {}) {
        const morphId = this.createMorph({
            target: element,
            toShape: toShape,
            duration: options.duration || 800,
            type: options.type || 'organic',
            audioReactive: options.audioReactive || false,
            onComplete: options.onComplete
        });
        
        this.startMorph(morphId);
        return morphId;
    }
    
    /**
     * Stop a specific morph
     */
    stopMorph(morphId) {
        const morph = this.activeMorphs.get(morphId);
        if (morph) {
            morph.isActive = false;
            this.completeMorph(morph);
            return true;
        }
        return false;
    }
    
    /**
     * Pause/resume a morph
     */
    pauseMorph(morphId, paused = true) {
        const morph = this.activeMorphs.get(morphId);
        if (morph) {
            morph.isPaused = paused;
            return true;
        }
        return false;
    }
    
    /**
     * Get all active morphs
     */
    getActiveMorphs() {
        return Array.from(this.activeMorphs.keys());
    }
    
    /**
     * Stop all active morphs
     */
    stopAllMorphs() {
        for (const morphId of this.activeMorphs.keys()) {
            this.stopMorph(morphId);
        }
    }
    
    /**
     * Cleanup and destroy the system
     */
    destroy() {
        // Stop all morphs
        this.stopAllMorphs();
        
        // Destroy spring system
        this.springSystem.destroy();
        
        // Clear data structures
        this.activeMorphs.clear();
        
        // Remove CSS styles
        const styleElement = document.getElementById('morph-transitions-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        console.log('MorphTransitions destroyed');
    }
}

// Export singleton instance for convenience
export const morphTransitions = new MorphTransitions();

// Export class for custom instances
export { MorphTransitions as MorphTransitionsClass };