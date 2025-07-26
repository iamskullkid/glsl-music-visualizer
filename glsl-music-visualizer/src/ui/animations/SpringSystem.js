/**
 * Spring System - Physics-based Animation Engine
 * Advanced spring-damper system for natural UI animations
 * Location: src/ui/animations/SpringSystem.js
 *
 * Features:
 * - Physics-accurate spring-damper calculations
 * - Multiple spring types (tension, friction, mass)
 * - Audio-reactive spring parameters
 * - Performance-optimized animation loops
 * - Automatic cleanup and memory management
 * - Integration with CSS transforms and properties
 */

import { MathUtils } from '../../utils/MathUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';

export class SpringSystem {
    constructor(options = {}) {
        // System configuration
        this.config = {
            // Default spring parameters
            defaultTension: options.defaultTension || 300,
            defaultFriction: options.defaultFriction || 20,
            defaultMass: options.defaultMass || 1,
            
            // Performance settings
            targetFPS: options.targetFPS || 60,
            enableOptimizations: options.enableOptimizations !== false,
            maxSprings: options.maxSprings || 1000,
            
            // Audio reactivity
            enableAudioReactivity: options.enableAudioReactivity !== false,
            audioInfluence: options.audioInfluence || 0.3,
            
            // Quality settings
            restThreshold: options.restThreshold || 0.001,
            velocityThreshold: options.velocityThreshold || 0.001,
            
            // Debug options
            enableDebug: options.enableDebug === true,
            showForces: options.showForces === true
        };
        
        // Spring registry
        this.springs = new Map();
        this.springCounter = 0;
        
        // Animation loop management
        this.isRunning = false;
        this.animationFrame = null;
        this.lastTime = 0;
        this.targetFrameTime = 1000 / this.config.targetFPS;
        
        // Performance tracking
        this.performanceMetrics = {
            frameTime: 0,
            springCount: 0,
            activeSprings: 0,
            updateTime: 0,
            memoryUsage: 0,
            frameRate: 60
        };
        
        // Audio-reactive state
        this.audioState = {
            energy: 0,
            bass: 0,
            mid: 0,
            treble: 0,
            beat: false,
            beatStrength: 0,
            lastUpdate: 0
        };
        
        // Preset spring configurations
        this.presets = {
            // UI element presets
            gentle: { tension: 120, friction: 14, mass: 1 },
            wobbly: { tension: 180, friction: 12, mass: 1 },
            stiff: { tension: 400, friction: 28, mass: 1 },
            slow: { tension: 280, friction: 60, mass: 1 },
            
            // Audio-reactive presets
            bassReactive: { tension: 200, friction: 15, mass: 1.2 },
            beatSync: { tension: 350, friction: 10, mass: 0.8 },
            energyFollower: { tension: 250, friction: 18, mass: 1 },
            
            // Material-inspired presets
            liquid: { tension: 150, friction: 25, mass: 1.5 },
            elastic: { tension: 320, friction: 8, mass: 0.7 },
            viscous: { tension: 100, friction: 40, mass: 2.0 },
            
            // Performance presets
            fast: { tension: 500, friction: 30, mass: 0.5 },
            smooth: { tension: 200, friction: 20, mass: 1 },
            bouncy: { tension: 400, friction: 5, mass: 0.8 }
        };
        
        console.log('SpringSystem initialized', {
            maxSprings: this.config.maxSprings,
            targetFPS: this.config.targetFPS,
            audioReactivity: this.config.enableAudioReactivity
        });
    }
    
    /**
     * Create a new spring animation
     */
    createSpring(config = {}) {
        const springId = `spring_${++this.springCounter}`;
        
        // Parse configuration
        const springConfig = this.parseSpringConfig(config);
        
        // Create spring instance
        const spring = {
            id: springId,
            
            // Spring properties
            tension: springConfig.tension,
            friction: springConfig.friction,
            mass: springConfig.mass,
            
            // Current state
            currentValue: springConfig.from || 0,
            targetValue: springConfig.to || 0,
            velocity: 0,
            
            // Animation properties
            isActive: false,
            isResting: false,
            startTime: 0,
            lastUpdateTime: 0,
            
            // Element and property binding
            element: springConfig.element || null,
            property: springConfig.property || 'transform',
            unit: springConfig.unit || '',
            transform: springConfig.transform || null,
            
            // Callbacks
            onUpdate: springConfig.onUpdate || null,
            onRest: springConfig.onRest || null,
            onStart: springConfig.onStart || null,
            
            // Audio reactivity
            audioReactive: springConfig.audioReactive === true,
            audioProperty: springConfig.audioProperty || 'energy',
            audioInfluence: springConfig.audioInfluence || this.config.audioInfluence,
            
            // Performance tracking
            updateCount: 0,
            averageUpdateTime: 0
        };
        
        // Store spring
        this.springs.set(springId, spring);
        
        // Start animation loop if needed
        if (!this.isRunning) {
            this.start();
        }
        
        return new SpringController(this, springId);
    }
    
    /**
     * Parse spring configuration with presets
     */
    parseSpringConfig(config) {
        let springConfig = {
            tension: this.config.defaultTension,
            friction: this.config.defaultFriction,
            mass: this.config.defaultMass,
            ...config
        };
        
        // Apply preset if specified
        if (config.preset && this.presets[config.preset]) {
            const preset = this.presets[config.preset];
            springConfig = {
                ...springConfig,
                tension: preset.tension,
                friction: preset.friction,
                mass: preset.mass
            };
        }
        
        return springConfig;
    }
    
    /**
     * Start the animation loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animate();
        
        console.log('SpringSystem animation loop started');
    }
    
    /**
     * Stop the animation loop
     */
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        console.log('SpringSystem animation loop stopped');
    }
    
    /**
     * Main animation loop
     */
    animate() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        const deltaTime = Math.min(currentTime - this.lastTime, this.targetFrameTime * 2) / 1000;
        this.lastTime = currentTime;
        
        // Update all springs
        this.updateSprings(deltaTime);
        
        // Update performance metrics
        this.updatePerformanceMetrics(currentTime);
        
        // Schedule next frame
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
    
    /**
     * Update all active springs
     */
    updateSprings(deltaTime) {
        const updateStartTime = performance.now();
        let activeSprings = 0;
        let springsToRemove = [];
        
        for (const [springId, spring] of this.springs) {
            if (!spring.isActive && spring.isResting) {
                continue;
            }
            
            // Update spring physics
            this.updateSpring(spring, deltaTime);
            
            // Check if spring is at rest
            if (this.isSpringAtRest(spring)) {
                this.setSpringToRest(spring);
            } else {
                activeSprings++;
                spring.isActive = true;
                spring.isResting = false;
            }
            
            // Apply spring value to element/callback
            this.applySpringValue(spring);
            
            // Track update performance
            spring.updateCount++;
        }
        
        // Clean up inactive springs if needed
        if (springsToRemove.length > 0) {
            springsToRemove.forEach(springId => this.springs.delete(springId));
        }
        
        // Update metrics
        this.performanceMetrics.updateTime = performance.now() - updateStartTime;
        this.performanceMetrics.activeSprings = activeSprings;
        this.performanceMetrics.springCount = this.springs.size;
        
        // Stop animation loop if no active springs
        if (activeSprings === 0 && this.springs.size === 0) {
            this.stop();
        }
    }
    
    /**
     * Update individual spring using physics simulation
     */
    updateSpring(spring, deltaTime) {
        // Get current spring parameters (may be audio-reactive)
        const params = this.getSpringParameters(spring);
        
        // Calculate spring force: F = -k * (x - target)
        const displacement = spring.currentValue - spring.targetValue;
        const springForce = -params.tension * displacement;
        
        // Calculate damping force: F = -c * velocity
        const dampingForce = -params.friction * spring.velocity;
        
        // Total force
        const totalForce = springForce + dampingForce;
        
        // Calculate acceleration: a = F / m
        const acceleration = totalForce / params.mass;
        
        // Integrate using Verlet integration for better stability
        const newVelocity = spring.velocity + acceleration * deltaTime;
        const newValue = spring.currentValue + newVelocity * deltaTime;
        
        // Update spring state
        spring.velocity = newVelocity;
        spring.currentValue = newValue;
        spring.lastUpdateTime = performance.now();
        
        // Apply audio-reactive modifications if enabled
        if (spring.audioReactive && this.config.enableAudioReactivity) {
            this.applyAudioReactivity(spring);
        }
    }
    
    /**
     * Get current spring parameters (may be modified by audio)
     */
    getSpringParameters(spring) {
        let tension = spring.tension;
        let friction = spring.friction;
        let mass = spring.mass;
        
        // Apply audio reactivity if enabled
        if (spring.audioReactive && this.config.enableAudioReactivity) {
            const audioValue = this.getAudioPropertyValue(spring.audioProperty);
            const influence = spring.audioInfluence;
            
            switch (spring.audioProperty) {
                case 'energy':
                    tension += audioValue * influence * 200;
                    break;
                case 'bass':
                    mass += audioValue * influence * 0.5;
                    friction += audioValue * influence * 5;
                    break;
                case 'beat':
                    if (this.audioState.beat) {
                        tension += this.audioState.beatStrength * influence * 300;
                        friction *= 0.8; // Reduce damping on beats
                    }
                    break;
                case 'mid':
                    tension += audioValue * influence * 150;
                    break;
                case 'treble':
                    friction += audioValue * influence * 10;
                    break;
            }
        }
        
        return { tension, friction, mass };
    }
    
    /**
     * Get audio property value
     */
    getAudioPropertyValue(property) {
        switch (property) {
            case 'energy': return this.audioState.energy;
            case 'bass': return this.audioState.bass;
            case 'mid': return this.audioState.mid;
            case 'treble': return this.audioState.treble;
            case 'beat': return this.audioState.beat ? this.audioState.beatStrength : 0;
            default: return 0;
        }
    }
    
    /**
     * Apply audio reactivity effects to spring
     */
    applyAudioReactivity(spring) {
        // Add subtle oscillations based on audio
        const audioValue = this.getAudioPropertyValue(spring.audioProperty);
        const influence = spring.audioInfluence * 0.1;
        
        // Add small perturbations to create audio-reactive behavior
        spring.velocity += (Math.random() - 0.5) * audioValue * influence;
        
        // Beat-reactive impulses
        if (this.audioState.beat && spring.audioProperty === 'beat') {
            const impulse = this.audioState.beatStrength * spring.audioInfluence * 0.5;
            spring.velocity += impulse * (Math.random() - 0.5);
        }
    }
    
    /**
     * Check if spring is at rest
     */
    isSpringAtRest(spring) {
        const displacement = Math.abs(spring.currentValue - spring.targetValue);
        const velocity = Math.abs(spring.velocity);
        
        return displacement < this.config.restThreshold && 
               velocity < this.config.velocityThreshold;
    }
    
    /**
     * Set spring to rest state
     */
    setSpringToRest(spring) {
        spring.currentValue = spring.targetValue;
        spring.velocity = 0;
        spring.isActive = false;
        spring.isResting = true;
        
        // Call rest callback
        if (spring.onRest) {
            spring.onRest(spring.currentValue, spring);
        }
    }
    
    /**
     * Apply spring value to element or callback
     */
    applySpringValue(spring) {
        if (spring.onUpdate) {
            spring.onUpdate(spring.currentValue, spring);
        }
        
        if (spring.element) {
            this.applyToElement(spring);
        }
    }
    
    /**
     * Apply spring value to DOM element
     */
    applyToElement(spring) {
        const element = spring.element;
        const value = spring.currentValue;
        const unit = spring.unit;
        
        switch (spring.property) {
            case 'transform':
                if (spring.transform) {
                    const transformValue = spring.transform.replace('{value}', value + unit);
                    element.style.transform = transformValue;
                }
                break;
                
            case 'opacity':
                element.style.opacity = MathUtils.clamp(value, 0, 1);
                break;
                
            case 'scale':
                element.style.transform = `scale(${value})`;
                break;
                
            case 'translateX':
                element.style.transform = `translateX(${value}${unit})`;
                break;
                
            case 'translateY':
                element.style.transform = `translateY(${value}${unit})`;
                break;
                
            case 'rotate':
                element.style.transform = `rotate(${value}${unit})`;
                break;
                
            default:
                if (spring.property.startsWith('--')) {
                    // CSS custom property
                    element.style.setProperty(spring.property, value + unit);
                } else {
                    // Regular CSS property
                    element.style[spring.property] = value + unit;
                }
        }
    }
    
    /**
     * Update audio state for audio-reactive springs
     */
    updateAudioState(audioData) {
        if (!audioData) return;
        
        this.audioState = {
            energy: audioData.features?.energy || 0,
            bass: audioData.features?.bass || 0,
            mid: audioData.features?.mid || 0,
            treble: audioData.features?.treble || 0,
            beat: audioData.features?.beat || false,
            beatStrength: audioData.features?.beatStrength || 0,
            lastUpdate: performance.now()
        };
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(currentTime) {
        // Calculate frame rate
        if (this.performanceMetrics.lastFrameTime) {
            const frameTime = currentTime - this.performanceMetrics.lastFrameTime;
            this.performanceMetrics.frameTime = frameTime;
            this.performanceMetrics.frameRate = 1000 / frameTime;
        }
        this.performanceMetrics.lastFrameTime = currentTime;
        
        // Calculate memory usage estimate
        this.performanceMetrics.memoryUsage = this.springs.size * 200; // Rough estimate
        
        // Report to performance monitor
        if (performanceMonitor) {
            performanceMonitor.recordCPUTime('springSystem', this.performanceMetrics.updateTime);
        }
    }
    
    /**
     * Get spring by ID
     */
    getSpring(springId) {
        return this.springs.get(springId);
    }
    
    /**
     * Remove spring
     */
    removeSpring(springId) {
        const spring = this.springs.get(springId);
        if (spring) {
            this.springs.delete(springId);
            console.log(`Spring ${springId} removed`);
        }
    }
    
    /**
     * Clear all springs
     */
    clearAllSprings() {
        this.springs.clear();
        this.stop();
        console.log('All springs cleared');
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            isRunning: this.isRunning,
            totalSprings: this.springs.size
        };
    }
    
    /**
     * Create preset configurations
     */
    createPreset(name, config) {
        this.presets[name] = config;
    }
    
    /**
     * Get available presets
     */
    getPresets() {
        return Object.keys(this.presets);
    }
    
    /**
     * Cleanup and destroy
     */
    destroy() {
        this.stop();
        this.clearAllSprings();
        console.log('SpringSystem destroyed');
    }
}

/**
 * Spring Controller - Interface for individual spring control
 */
class SpringController {
    constructor(springSystem, springId) {
        this.springSystem = springSystem;
        this.springId = springId;
    }
    
    /**
     * Set target value
     */
    setTarget(value) {
        const spring = this.springSystem.getSpring(this.springId);
        if (spring) {
            spring.targetValue = value;
            spring.isActive = true;
            spring.isResting = false;
            spring.startTime = performance.now();
            
            // Call start callback
            if (spring.onStart) {
                spring.onStart(spring.currentValue, spring);
            }
            
            // Restart animation loop if needed
            if (!this.springSystem.isRunning) {
                this.springSystem.start();
            }
        }
        return this;
    }
    
    /**
     * Set current value
     */
    setValue(value) {
        const spring = this.springSystem.getSpring(this.springId);
        if (spring) {
            spring.currentValue = value;
        }
        return this;
    }
    
    /**
     * Set spring parameters
     */
    setParams(tension, friction, mass) {
        const spring = this.springSystem.getSpring(this.springId);
        if (spring) {
            if (tension !== undefined) spring.tension = tension;
            if (friction !== undefined) spring.friction = friction;
            if (mass !== undefined) spring.mass = mass;
        }
        return this;
    }
    
    /**
     * Set audio reactivity
     */
    setAudioReactive(enabled, property = 'energy', influence = 0.3) {
        const spring = this.springSystem.getSpring(this.springId);
        if (spring) {
            spring.audioReactive = enabled;
            spring.audioProperty = property;
            spring.audioInfluence = influence;
        }
        return this;
    }
    
    /**
     * Set callbacks
     */
    onUpdate(callback) {
        const spring = this.springSystem.getSpring(this.springId);
        if (spring) {
            spring.onUpdate = callback;
        }
        return this;
    }
    
    onRest(callback) {
        const spring = this.springSystem.getSpring(this.springId);
        if (spring) {
            spring.onRest = callback;
        }
        return this;
    }
    
    onStart(callback) {
        const spring = this.springSystem.getSpring(this.springId);
        if (spring) {
            spring.onStart = callback;
        }
        return this;
    }
    
    /**
     * Get current value
     */
    getValue() {
        const spring = this.springSystem.getSpring(this.springId);
        return spring ? spring.currentValue : 0;
    }
    
    /**
     * Get current velocity
     */
    getVelocity() {
        const spring = this.springSystem.getSpring(this.springId);
        return spring ? spring.velocity : 0;
    }
    
    /**
     * Check if spring is at rest
     */
    isAtRest() {
        const spring = this.springSystem.getSpring(this.springId);
        return spring ? spring.isResting : true;
    }
    
    /**
     * Stop and remove this spring
     */
    destroy() {
        this.springSystem.removeSpring(this.springId);
    }
}

// Static helper methods
SpringSystem.createSystem = (options) => new SpringSystem(options);

SpringSystem.presets = {
    gentle: { tension: 120, friction: 14, mass: 1 },
    wobbly: { tension: 180, friction: 12, mass: 1 },
    stiff: { tension: 400, friction: 28, mass: 1 },
    slow: { tension: 280, friction: 60, mass: 1 },
    bassReactive: { tension: 200, friction: 15, mass: 1.2 },
    beatSync: { tension: 350, friction: 10, mass: 0.8 },
    liquid: { tension: 150, friction: 25, mass: 1.5 },
    elastic: { tension: 320, friction: 8, mass: 0.7 }
};

export { SpringController };