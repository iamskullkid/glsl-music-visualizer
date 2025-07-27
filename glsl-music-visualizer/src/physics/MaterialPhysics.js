/**
 * Material Physics
 * Advanced material-specific physics behaviors for the GLSL music visualizer
 * Implements realistic physics properties for water, metals, plasma, and other materials
 * Location: src/physics/MaterialPhysics.js
 */

import { MathUtils } from '../utils/MathUtils.js';
import { webglUtils } from '../utils/WebGLUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class MaterialPhysics {
    constructor(options = {}) {
        // Material physics configuration
        this.config = {
            surfaceTensionAccuracy: options.surfaceTensionAccuracy || 'high', // 'low', 'medium', 'high'
            viscosityModel: options.viscosityModel || 'newtonian', // 'newtonian', 'non-newtonian', 'thixotropic'
            temperatureEffects: options.temperatureEffects !== false,
            electricalConductivity: options.electricalConductivity !== false,
            magneticProperties: options.magneticProperties !== false,
            phaseTransitions: options.phaseTransitions !== false
        };
        
        // Material property definitions with comprehensive physics parameters
        this.materialProperties = {
            water: {
                // Basic properties
                density: 1000.0,            // kg/m³
                viscosity: 0.001002,        // Pa·s at 20°C
                surfaceTension: 0.0728,     // N/m at 20°C
                bulkModulus: 2.15e9,        // Pa (compressibility)
                
                // Thermal properties
                specificHeat: 4186,         // J/(kg·K)
                thermalConductivity: 0.598, // W/(m·K)
                thermalExpansion: 2.14e-4,  // 1/K
                freezingPoint: 273.15,      // K
                boilingPoint: 373.15,       // K
                
                // Optical properties
                refractionIndex: 1.333,
                absorption: [0.45, 0.74, 4.62], // RGB absorption coefficients
                scattering: 0.001,
                
                // Electrical properties
                electricalConductivity: 5.5e-6, // S/m (pure water)
                dielectricConstant: 81,
                
                // Audio interaction
                soundSpeed: 1482,           // m/s
                acousticImpedance: 1.48e6,  // Pa·s/m
                
                // Phase transition
                phaseTransitionEnergy: 334000, // J/kg (latent heat of fusion)
                
                // Surface tension gradients (Marangoni effect)
                surfaceTensionTemperatureCoeff: -1.5e-4, // N/(m·K)
                
                // Non-Newtonian properties (minimal for water)
                shearThinning: 0.0,
                yieldStress: 0.0
            },
            
            mercury: {
                density: 13534.0,
                viscosity: 0.001526,
                surfaceTension: 0.4865,
                bulkModulus: 25.3e9,
                
                specificHeat: 139.5,
                thermalConductivity: 8.30,
                thermalExpansion: 1.82e-4,
                freezingPoint: 234.32,
                boilingPoint: 629.88,
                
                refractionIndex: 1.00,      // Nearly perfect reflector
                absorption: [0.0, 0.0, 0.0], // Perfect conductor
                scattering: 0.0,
                
                electricalConductivity: 1.04e6,
                dielectricConstant: 1.0,
                
                soundSpeed: 1450,
                acousticImpedance: 19.6e6,
                
                phaseTransitionEnergy: 11280,
                surfaceTensionTemperatureCoeff: -2.3e-4,
                
                // Metallic properties
                magneticPermeability: 1.0,
                skinDepth: 0.5e-6,          // Electromagnetic skin depth
                
                shearThinning: 0.0,
                yieldStress: 0.0
            },
            
            plasma: {
                density: 1.225,             // Varies with ionization
                viscosity: 1.8e-5,          // Highly variable
                surfaceTension: 0.0,        // No surface tension
                bulkModulus: 1.42e5,        // Highly compressible
                
                specificHeat: 1005,
                thermalConductivity: 0.024,
                thermalExpansion: 3.43e-3,
                freezingPoint: 0,           // No freezing
                boilingPoint: 10000,        // Arbitrary high temperature
                
                refractionIndex: 0.999,     // Slightly less than 1
                absorption: [0.1, 0.1, 0.1],
                scattering: 0.1,
                
                electricalConductivity: 1e4, // Highly conductive
                dielectricConstant: 1.0,
                
                soundSpeed: 343,
                acousticImpedance: 420,
                
                phaseTransitionEnergy: 0,
                surfaceTensionTemperatureCoeff: 0,
                
                // Plasma-specific properties
                ionizationEnergy: 13.6,     // eV
                plasmaDensity: 1e12,        // particles/m³
                debyeLength: 1e-5,          // m
                plasmaFrequency: 1e9,       // Hz
                
                // Electromagnetic properties
                magneticField: 0.001,       // Tesla
                cyclotronFrequency: 28e6,   // Hz
                
                shearThinning: 0.2,
                yieldStress: 0.0
            },
            
            oil: {
                density: 920.0,
                viscosity: 0.084,           // SAE 30 motor oil
                surfaceTension: 0.035,
                bulkModulus: 1.5e9,
                
                specificHeat: 1900,
                thermalConductivity: 0.145,
                thermalExpansion: 7e-4,
                freezingPoint: 233,
                boilingPoint: 573,
                
                refractionIndex: 1.47,
                absorption: [0.2, 0.5, 0.8],
                scattering: 0.01,
                
                electricalConductivity: 1e-12, // Insulator
                dielectricConstant: 2.3,
                
                soundSpeed: 1324,
                acousticImpedance: 1.22e6,
                
                phaseTransitionEnergy: 180000,
                surfaceTensionTemperatureCoeff: -8e-5,
                
                // Non-Newtonian properties
                shearThinning: 0.3,
                yieldStress: 0.0,
                
                // Additional hydrocarbon properties
                flashPoint: 473,            // K
                autoIgnitionTemp: 533       // K
            },
            
            lava: {
                density: 2800.0,
                viscosity: 1000.0,          // Highly variable (10-1e8 Pa·s)
                surfaceTension: 0.4,
                bulkModulus: 50e9,
                
                specificHeat: 1150,
                thermalConductivity: 2.0,
                thermalExpansion: 3e-5,
                freezingPoint: 1373,        // Solidification temperature
                boilingPoint: 3000,
                
                refractionIndex: 1.6,
                absorption: [0.0, 0.1, 0.9], // Red-hot emission
                scattering: 0.05,
                
                electricalConductivity: 0.1, // Semiconductor when hot
                dielectricConstant: 12,
                
                soundSpeed: 3000,
                acousticImpedance: 8.4e6,
                
                phaseTransitionEnergy: 400000,
                surfaceTensionTemperatureCoeff: -1e-4,
                
                // Non-Newtonian properties (pseudoplastic)
                shearThinning: 0.8,
                yieldStress: 100,           // Pa
                
                // Volcanic properties
                gasContent: 0.02,           // Volume fraction
                crystallinity: 0.3,
                vesicularity: 0.1
            }
        };
        
        // Current material state
        this.currentMaterial = 'water';
        this.materialState = {
            temperature: 293.15,        // K (20°C)
            pressure: 101325,           // Pa (1 atm)
            ionization: 0.0,            // Plasma ionization degree
            shearRate: 0.0,             // s⁻¹
            magneticField: 0.0,         // Tesla
            electricField: 0.0,         // V/m
            pH: 7.0,                    // For aqueous solutions
            salinity: 0.0              // For water-based materials
        };
        
        // Phase transition tracking
        this.phaseState = {
            currentPhase: 'liquid',     // 'solid', 'liquid', 'gas', 'plasma'
            transitionProgress: 0.0,    // 0-1 for ongoing transitions
            nucleationSites: [],        // Points where phase change initiates
            transitionEnergy: 0.0       // Energy accumulated for phase change
        };
        
        // Surface tension calculation cache
        this.surfaceTensionCache = new Map();
        this.surfaceTensionGrid = null;
        this.surfaceTensionResolution = 64;
        
        // Viscosity field calculation
        this.viscosityField = null;
        this.viscosityGradient = null;
        
        // Audio reactivity parameters
        this.audioReactivity = {
            enabled: options.audioReactive !== false,
            temperatureResponse: options.temperatureResponse || 0.5,
            viscosityResponse: options.viscosityResponse || 0.3,
            surfaceTensionResponse: options.surfaceTensionResponse || 0.2,
            ionizationResponse: options.ionizationResponse || 0.8,
            magneticResponse: options.magneticResponse || 0.6
        };
        
        // Performance tracking
        this.performanceMetrics = {
            surfaceTensionTime: 0,
            viscosityTime: 0,
            phaseTransitionTime: 0,
            electromagTime: 0,
            totalTime: 0
        };
        
        // Initialize systems
        this.initialize();
        
        console.log('MaterialPhysics initialized', {
            material: this.currentMaterial,
            temperature: this.materialState.temperature,
            surfaceTensionAccuracy: this.config.surfaceTensionAccuracy,
            viscosityModel: this.config.viscosityModel
        });
    }
    
    /**
     * Initialize material physics system
     */
    initialize() {
        // Initialize surface tension calculation grid
        this.initializeSurfaceTensionGrid();
        
        // Initialize viscosity field
        this.initializeViscosityField();
        
        // Set initial material properties
        this.updateMaterialProperties();
    }
    
    /**
     * Initialize surface tension calculation grid
     */
    initializeSurfaceTensionGrid() {
        const resolution = this.surfaceTensionResolution;
        const totalCells = resolution * resolution * resolution;
        
        this.surfaceTensionGrid = {
            curvature: new Float32Array(totalCells),
            gradient: new Float32Array(totalCells * 3),
            force: new Float32Array(totalCells * 3),
            resolution: resolution
        };
    }
    
    /**
     * Initialize viscosity field
     */
    initializeViscosityField() {
        const resolution = 32; // Lower resolution for performance
        const totalCells = resolution * resolution * resolution;
        
        this.viscosityField = {
            values: new Float32Array(totalCells),
            gradient: new Float32Array(totalCells * 3),
            shearRate: new Float32Array(totalCells),
            resolution: resolution
        };
    }
    
    /**
     * Update material physics for one simulation step
     */
    update(deltaTime, fluidSimulation, audioData = null) {
        const startTime = performance.now();
        
        // Process audio input for material reactivity
        if (audioData && this.audioReactivity.enabled) {
            this.processAudioMaterialEffects(audioData);
        }
        
        // Update material state based on environment
        this.updateMaterialState(deltaTime, fluidSimulation);
        
        // Calculate surface tension effects
        const surfaceStartTime = performance.now();
        this.calculateSurfaceTensionForces(fluidSimulation);
        this.performanceMetrics.surfaceTensionTime = performance.now() - surfaceStartTime;
        
        // Calculate viscosity effects
        const viscosityStartTime = performance.now();
        this.calculateViscosityEffects(fluidSimulation);
        this.performanceMetrics.viscosityTime = performance.now() - viscosityStartTime;
        
        // Handle phase transitions
        const phaseStartTime = performance.now();
        this.updatePhaseTransitions(deltaTime, fluidSimulation);
        this.performanceMetrics.phaseTransitionTime = performance.now() - phaseStartTime;
        
        // Calculate electromagnetic effects (for conductive materials)
        const emagStartTime = performance.now();
        this.calculateElectromagneticEffects(fluidSimulation);
        this.performanceMetrics.electromagTime = performance.now() - emagStartTime;
        
        // Update performance metrics
        this.performanceMetrics.totalTime = performance.now() - startTime;
        
        if (performanceMonitor) {
            performanceMonitor.recordCPUTime('physics', this.performanceMetrics.totalTime);
        }
    }
    
    /**
     * Process audio data for material property modulation
     */
    processAudioMaterialEffects(audioData) {
        const { bassLevel, midLevel, trebleLevel, energy, beat, beatStrength, temperature } = audioData;
        
        // Temperature modulation based on audio energy
        if (this.audioReactivity.temperatureResponse > 0) {
            const baseTemp = this.materialProperties[this.currentMaterial].freezingPoint + 20;
            const tempVariation = energy * 200 * this.audioReactivity.temperatureResponse;
            this.materialState.temperature = baseTemp + tempVariation;
            
            // Beat creates temperature spikes
            if (beat) {
                this.materialState.temperature += beatStrength * 50;
            }
        }
        
        // Viscosity modulation (non-Newtonian behavior)
        if (this.audioReactivity.viscosityResponse > 0) {
            const baseViscosity = this.materialProperties[this.currentMaterial].viscosity;
            
            // High-frequency sounds reduce viscosity (shear thinning)
            const viscosityReduction = trebleLevel * this.audioReactivity.viscosityResponse;
            this.currentViscosity = baseViscosity * (1 - viscosityReduction * 0.5);
            
            // Bass increases effective viscosity
            const viscosityIncrease = bassLevel * this.audioReactivity.viscosityResponse;
            this.currentViscosity *= (1 + viscosityIncrease * 0.3);
        }
        
        // Surface tension modulation
        if (this.audioReactivity.surfaceTensionResponse > 0) {
            const baseSurfaceTension = this.materialProperties[this.currentMaterial].surfaceTension;
            const tensionVariation = (midLevel + trebleLevel) * 0.5 * this.audioReactivity.surfaceTensionResponse;
            this.currentSurfaceTension = baseSurfaceTension * (1 + tensionVariation * 0.2);
        }
        
        // Ionization for plasma materials
        if (this.currentMaterial === 'plasma' && this.audioReactivity.ionizationResponse > 0) {
            this.materialState.ionization = Math.min(1.0, 
                energy * this.audioReactivity.ionizationResponse + 
                beatStrength * 0.1
            );
        }
        
        // Magnetic field modulation
        if (this.audioReactivity.magneticResponse > 0) {
            const baseMagField = this.materialProperties[this.currentMaterial].magneticField || 0;
            this.materialState.magneticField = baseMagField + 
                bassLevel * 0.001 * this.audioReactivity.magneticResponse;
        }
    }
    
    /**
     * Update material state based on simulation conditions
     */
    updateMaterialState(deltaTime, fluidSimulation) {
        const props = this.materialProperties[this.currentMaterial];
        
        // Temperature-dependent property updates
        if (this.config.temperatureEffects) {
            this.updateTemperatureDependentProperties();
        }
        
        // Pressure-dependent updates
        this.updatePressureDependentProperties(fluidSimulation);
        
        // Shear rate calculation for non-Newtonian behavior
        if (this.config.viscosityModel !== 'newtonian') {
            this.calculateShearRateField(fluidSimulation);
        }
    }
    
    /**
     * Update properties that depend on temperature
     */
    updateTemperatureDependentProperties() {
        const props = this.materialProperties[this.currentMaterial];
        const T = this.materialState.temperature;
        const T0 = 293.15; // Reference temperature (20°C)
        
        // Viscosity temperature dependence (Arrhenius-like)
        const viscosityActivationEnergy = 1000; // J/mol (simplified)
        const R = 8.314; // Gas constant
        this.currentViscosity = props.viscosity * Math.exp(
            viscosityActivationEnergy / R * (1/T - 1/T0)
        );
        
        // Surface tension temperature dependence
        this.currentSurfaceTension = props.surfaceTension + 
            props.surfaceTensionTemperatureCoeff * (T - T0);
        
        // Density temperature dependence (thermal expansion)
        this.currentDensity = props.density * 
            (1 - props.thermalExpansion * (T - T0));
    }
    
    /**
     * Update properties that depend on pressure
     */
    updatePressureDependentProperties(fluidSimulation) {
        const props = this.materialProperties[this.currentMaterial];
        const P = this.materialState.pressure;
        const P0 = 101325; // Reference pressure (1 atm)
        
        // Compressibility effects
        const deltaP = P - P0;
        const densityIncrease = deltaP / props.bulkModulus;
        this.currentDensity = (this.currentDensity || props.density) * (1 + densityIncrease);
        
        // Pressure-dependent viscosity (for extreme pressures)
        if (Math.abs(deltaP) > 1e6) { // Above 10 bar difference
            const pressureViscosityCoeff = 1e-9; // Simplified coefficient
            this.currentViscosity *= (1 + pressureViscosityCoeff * deltaP);
        }
    }
    
    /**
     * Calculate shear rate field for non-Newtonian behavior
     */
    calculateShearRateField(fluidSimulation) {
        const viscField = this.viscosityField;
        const resolution = viscField.resolution;
        
        for (let k = 1; k < resolution - 1; k++) {
            for (let j = 1; j < resolution - 1; j++) {
                for (let i = 1; i < resolution - 1; i++) {
                    const index = k * resolution * resolution + j * resolution + i;
                    
                    // Sample velocity from fluid simulation
                    const worldX = (i / resolution - 0.5) * 10;
                    const worldY = (j / resolution - 0.5) * 10;
                    const worldZ = (k / resolution - 0.5) * 10;
                    
                    const velocity = fluidSimulation.getVelocityAt(worldX, worldY, worldZ);
                    
                    // Calculate velocity gradients (simplified)
                    const dx = 10 / resolution;
                    const velocityX1 = fluidSimulation.getVelocityAt(worldX + dx, worldY, worldZ);
                    const velocityY1 = fluidSimulation.getVelocityAt(worldX, worldY + dx, worldZ);
                    const velocityZ1 = fluidSimulation.getVelocityAt(worldX, worldY, worldZ + dx);
                    
                    // Shear rate tensor components
                    const dudx = (velocityX1.x - velocity.x) / dx;
                    const dudy = (velocityY1.x - velocity.x) / dx;
                    const dudz = (velocityZ1.x - velocity.x) / dx;
                    const dvdx = (velocityX1.y - velocity.y) / dx;
                    const dvdy = (velocityY1.y - velocity.y) / dx;
                    const dvdz = (velocityZ1.y - velocity.y) / dx;
                    const dwdx = (velocityX1.z - velocity.z) / dx;
                    const dwdy = (velocityY1.z - velocity.z) / dx;
                    const dwdz = (velocityZ1.z - velocity.z) / dx;
                    
                    // Shear rate magnitude
                    const shearRate = Math.sqrt(
                        2 * (dudx*dudx + dvdy*dvdy + dwdz*dwdz) +
                        (dudy + dvdx)*(dudy + dvdx) +
                        (dudz + dwdx)*(dudz + dwdx) +
                        (dvdz + dwdy)*(dvdz + dwdy)
                    );
                    
                    viscField.shearRate[index] = shearRate;
                    
                    // Calculate non-Newtonian viscosity
                    viscField.values[index] = this.calculateNonNewtonianViscosity(shearRate);
                }
            }
        }
    }
    
    /**
     * Calculate non-Newtonian viscosity based on shear rate
     */
    calculateNonNewtonianViscosity(shearRate) {
        const props = this.materialProperties[this.currentMaterial];
        const baseViscosity = this.currentViscosity || props.viscosity;
        
        if (this.config.viscosityModel === 'newtonian') {
            return baseViscosity;
        }
        
        // Power law model for shear thinning/thickening
        if (props.shearThinning > 0) {
            const consistencyIndex = baseViscosity;
            const flowBehaviorIndex = 1 - props.shearThinning;
            return consistencyIndex * Math.pow(shearRate + 1e-10, flowBehaviorIndex - 1);
        }
        
        // Bingham plastic model for yield stress materials
        if (props.yieldStress > 0) {
            if (shearRate < 1e-6) return 1e6; // Very high viscosity at low shear
            return baseViscosity + props.yieldStress / shearRate;
        }
        
        // Thixotropic behavior (simplified)
        if (this.config.viscosityModel === 'thixotropic') {
            const structureParameter = 1; // Would track structure breakdown over time
            return baseViscosity / (1 + shearRate * 0.1) * structureParameter;
        }
        
        return baseViscosity;
    }
    
    /**
     * Calculate surface tension forces using Young-Laplace equation
     */
    calculateSurfaceTensionForces(fluidSimulation) {
        const grid = this.surfaceTensionGrid;
        const resolution = grid.resolution;
        const sigma = this.currentSurfaceTension || this.materialProperties[this.currentMaterial].surfaceTension;
        
        if (this.config.surfaceTensionAccuracy === 'low') {
            this.calculateSurfaceTensionSimple(fluidSimulation, sigma);
            return;
        }
        
        // High-accuracy surface tension calculation
        for (let k = 1; k < resolution - 1; k++) {
            for (let j = 1; j < resolution - 1; j++) {
                for (let i = 1; i < resolution - 1; i++) {
                    const index = k * resolution * resolution + j * resolution + i;
                    
                    // Sample density from fluid simulation
                    const worldX = (i / resolution - 0.5) * 10;
                    const worldY = (j / resolution - 0.5) * 10;
                    const worldZ = (k / resolution - 0.5) * 10;
                    
                    const density = fluidSimulation.getDensityAt(worldX, worldY, worldZ);
                    
                    // Calculate density gradients for interface detection
                    const dx = 10 / resolution;
                    const densityX1 = fluidSimulation.getDensityAt(worldX + dx, worldY, worldZ);
                    const densityX2 = fluidSimulation.getDensityAt(worldX - dx, worldY, worldZ);
                    const densityY1 = fluidSimulation.getDensityAt(worldX, worldY + dx, worldZ);
                    const densityY2 = fluidSimulation.getDensityAt(worldX, worldY - dx, worldZ);
                    const densityZ1 = fluidSimulation.getDensityAt(worldX, worldY, worldZ + dx);
                    const densityZ2 = fluidSimulation.getDensityAt(worldX, worldY, worldZ - dx);
                    
                    // Density gradient
                    const gradX = (densityX1 - densityX2) / (2 * dx);
                    const gradY = (densityY1 - densityY2) / (2 * dx);
                    const gradZ = (densityZ1 - densityZ2) / (2 * dx);
                    
                    grid.gradient[index * 3] = gradX;
                    grid.gradient[index * 3 + 1] = gradY;
                    grid.gradient[index * 3 + 2] = gradZ;
                    
                    const gradMagnitude = Math.sqrt(gradX*gradX + gradY*gradY + gradZ*gradZ);
                    
                    if (gradMagnitude > 0.01) { // Interface detected
                        // Calculate curvature using divergence of unit normal
                        const curvature = this.calculateInterfaceCurvature(i, j, k, grid, resolution);
                        grid.curvature[index] = curvature;
                        
                        // Surface tension force: F = σ * κ * n
                        if (gradMagnitude > 1e-10) {
                            const normalX = gradX / gradMagnitude;
                            const normalY = gradY / gradMagnitude;
                            const normalZ = gradZ / gradMagnitude;
                            
                            grid.force[index * 3] = sigma * curvature * normalX;
                            grid.force[index * 3 + 1] = sigma * curvature * normalY;
                            grid.force[index * 3 + 2] = sigma * curvature * normalZ;
                        }
                    } else {
                        grid.curvature[index] = 0;
                        grid.force[index * 3] = 0;
                        grid.force[index * 3 + 1] = 0;
                        grid.force[index * 3 + 2] = 0;
                    }
                }
            }
        }
        
        // Apply surface tension forces to fluid simulation
        this.applySurfaceTensionToFluid(fluidSimulation, grid);
    }
    
    /**
     * Calculate interface curvature using finite differences
     */
    calculateInterfaceCurvature(i, j, k, grid, resolution) {
        const getGradient = (ii, jj, kk) => {
            const idx = kk * resolution * resolution + jj * resolution + ii;
            return {
                x: grid.gradient[idx * 3],
                y: grid.gradient[idx * 3 + 1],
                z: grid.gradient[idx * 3 + 2]
            };
        };
        
        // Calculate divergence of unit normal (mean curvature)
        const center = getGradient(i, j, k);
        const left = getGradient(Math.max(0, i-1), j, k);
        const right = getGradient(Math.min(resolution-1, i+1), j, k);
        const down = getGradient(i, Math.max(0, j-1), k);
        const up = getGradient(i, Math.min(resolution-1, j+1), k);
        const back = getGradient(i, j, Math.max(0, k-1));
        const front = getGradient(i, j, Math.min(resolution-1, k+1));
        
        // Normalize gradients to get unit normals
        const normalizeGrad = (grad) => {
            const mag = Math.sqrt(grad.x*grad.x + grad.y*grad.y + grad.z*grad.z);
            return mag > 1e-10 ? { x: grad.x/mag, y: grad.y/mag, z: grad.z/mag } : { x: 0, y: 0, z: 0 };
        };
        
        const nCenter = normalizeGrad(center);
        const nLeft = normalizeGrad(left);
        const nRight = normalizeGrad(right);
        const nDown = normalizeGrad(down);
        const nUp = normalizeGrad(up);
        const nBack = normalizeGrad(back);
        const nFront = normalizeGrad(front);
        
        // Calculate divergence of unit normal field
        const dx = 10 / resolution;
        const divX = (nRight.x - nLeft.x) / (2 * dx);
        const divY = (nUp.y - nDown.y) / (2 * dx);
        const divZ = (nFront.z - nBack.z) / (2 * dx);
        
        return -(divX + divY + divZ); // Mean curvature (negative for convention)
    }
    
    /**
     * Simplified surface tension calculation for performance
     */
    calculateSurfaceTensionSimple(fluidSimulation, sigma) {
        // Apply simplified surface tension as proportional to density gradient
        // This is less accurate but much faster
        
        const resolution = 32; // Lower resolution for simple calculation
        
        for (let k = 1; k < resolution - 1; k++) {
            for (let j = 1; j < resolution - 1; j++) {
                for (let i = 1; i < resolution - 1; i++) {
                    const worldX = (i / resolution - 0.5) * 10;
                    const worldY = (j / resolution - 0.5) * 10;
                    const worldZ = (k / resolution - 0.5) * 10;
                    
                    const density = fluidSimulation.getDensityAt(worldX, worldY, worldZ);
                    const dx = 10 / resolution;
                    
                    // Simple gradient calculation
                    const densityX1 = fluidSimulation.getDensityAt(worldX + dx, worldY, worldZ);
                    const densityY1 = fluidSimulation.getDensityAt(worldX, worldY + dx, worldZ);
                    const densityZ1 = fluidSimulation.getDensityAt(worldX, worldY, worldZ + dx);
                    
                    const gradX = (densityX1 - density) / dx;
                    const gradY = (densityY1 - density) / dx;
                    const gradZ = (densityZ1 - density) / dx;
                    
                    const gradMagnitude = Math.sqrt(gradX*gradX + gradY*gradY + gradZ*gradZ);
                    
                    if (gradMagnitude > 0.01) {
                        // Apply simplified surface tension force
                        const forceX = sigma * gradX * 0.1;
                        const forceY = sigma * gradY * 0.1;
                        const forceZ = sigma * gradZ * 0.1;
                        
                        fluidSimulation.addImpulse(
                            worldX, worldY, worldZ,
                            forceX, forceY, forceZ,
                            2 // Small radius
                        );
                    }
                }
            }
        }
    }
    
    /**
     * Apply calculated surface tension forces to fluid simulation
     */
    applySurfaceTensionToFluid(fluidSimulation, grid) {
        const resolution = grid.resolution;
        
        for (let k = 0; k < resolution; k++) {
            for (let j = 0; j < resolution; j++) {
                for (let i = 0; i < resolution; i++) {
                    const index = k * resolution * resolution + j * resolution + i;
                    
                    const forceX = grid.force[index * 3];
                    const forceY = grid.force[index * 3 + 1];
                    const forceZ = grid.force[index * 3 + 2];
                    
                    if (Math.abs(forceX) > 1e-6 || Math.abs(forceY) > 1e-6 || Math.abs(forceZ) > 1e-6) {
                        const worldX = (i / resolution - 0.5) * 10;
                        const worldY = (j / resolution - 0.5) * 10;
                        const worldZ = (k / resolution - 0.5) * 10;
                        
                        fluidSimulation.addContinuousForce(
                            worldX, worldY, worldZ,
                            forceX, forceY, forceZ,
                            3 // Force application radius
                        );
                    }
                }
            }
        }
    }
    
    /**
     * Calculate viscosity effects and apply to fluid simulation
     */
    calculateViscosityEffects(fluidSimulation) {
        if (this.config.viscosityModel === 'newtonian') {
            // For Newtonian fluids, viscosity is handled in the base fluid simulation
            return;
        }
        
        // Apply non-Newtonian viscosity corrections
        const viscField = this.viscosityField;
        const resolution = viscField.resolution;
        
        for (let k = 1; k < resolution - 1; k++) {
            for (let j = 1; j < resolution - 1; j++) {
                for (let i = 1; i < resolution - 1; i++) {
                    const index = k * resolution * resolution + j * resolution + i;
                    const viscosity = viscField.values[index];
                    const shearRate = viscField.shearRate[index];
                    
                    if (viscosity > 0 && shearRate > 1e-6) {
                        const worldX = (i / resolution - 0.5) * 10;
                        const worldY = (j / resolution - 0.5) * 10;
                        const worldZ = (k / resolution - 0.5) * 10;
                        
                        const velocity = fluidSimulation.getVelocityAt(worldX, worldY, worldZ);
                        
                        // Apply viscous damping proportional to non-Newtonian viscosity
                        const baseMu = this.materialProperties[this.currentMaterial].viscosity;
                        const viscosityRatio = viscosity / baseMu;
                        const dampingFactor = (viscosityRatio - 1) * 0.1;
                        
                        if (Math.abs(dampingFactor) > 1e-6) {
                            fluidSimulation.addContinuousForce(
                                worldX, worldY, worldZ,
                                -velocity.x * dampingFactor,
                                -velocity.y * dampingFactor,
                                -velocity.z * dampingFactor,
                                4
                            );
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Update phase transitions based on temperature and pressure
     */
    updatePhaseTransitions(deltaTime, fluidSimulation) {
        if (!this.config.phaseTransitions) return;
        
        const props = this.materialProperties[this.currentMaterial];
        const T = this.materialState.temperature;
        const P = this.materialState.pressure;
        
        // Determine target phase based on state diagram
        let targetPhase = this.determinePhase(T, P);
        
        if (targetPhase !== this.phaseState.currentPhase) {
            this.processPhaseTransition(deltaTime, targetPhase, fluidSimulation);
        }
        
        // Update nucleation sites for phase transitions
        this.updateNucleationSites(fluidSimulation);
    }
    
    /**
     * Determine phase based on temperature and pressure
     */
    determinePhase(temperature, pressure) {
        const props = this.materialProperties[this.currentMaterial];
        
        // Simplified phase diagram - real materials would have complex curves
        if (temperature < props.freezingPoint) {
            return 'solid';
        } else if (temperature < props.boilingPoint) {
            return 'liquid';
        } else if (temperature < props.boilingPoint * 5) { // Arbitrary plasma threshold
            return 'gas';
        } else {
            return 'plasma';
        }
    }
    
    /**
     * Process phase transition between states
     */
    processPhaseTransition(deltaTime, targetPhase, fluidSimulation) {
        const props = this.materialProperties[this.currentMaterial];
        const transitionRate = 0.1; // Phase transition speed
        
        // Calculate energy required for phase transition
        let energyRequired = props.phaseTransitionEnergy;
        
        // Different energy requirements for different transitions
        if (this.phaseState.currentPhase === 'solid' && targetPhase === 'liquid') {
            energyRequired = props.phaseTransitionEnergy; // Fusion
        } else if (this.phaseState.currentPhase === 'liquid' && targetPhase === 'gas') {
            energyRequired = props.phaseTransitionEnergy * 6; // Vaporization (typically ~6x fusion)
        } else if (targetPhase === 'plasma') {
            energyRequired = props.ionizationEnergy * 1000; // Simplified ionization energy
        }
        
        // Accumulate energy for phase transition
        this.phaseState.transitionEnergy += energyRequired * transitionRate * deltaTime;
        
        // Update transition progress
        this.phaseState.transitionProgress = Math.min(1.0, 
            this.phaseState.transitionEnergy / energyRequired
        );
        
        // Complete transition if enough energy accumulated
        if (this.phaseState.transitionProgress >= 1.0) {
            this.completePhaseTransition(targetPhase, fluidSimulation);
        }
        
        // Apply transition effects to fluid simulation
        this.applyPhaseTransitionEffects(fluidSimulation);
    }
    
    /**
     * Complete phase transition and update material properties
     */
    completePhaseTransition(newPhase, fluidSimulation) {
        const oldPhase = this.phaseState.currentPhase;
        this.phaseState.currentPhase = newPhase;
        this.phaseState.transitionProgress = 0.0;
        this.phaseState.transitionEnergy = 0.0;
        
        console.log(`Phase transition: ${oldPhase} → ${newPhase}`);
        
        // Update material properties based on new phase
        this.updateMaterialProperties();
        
        // Apply dramatic effects for certain transitions
        if (oldPhase === 'liquid' && newPhase === 'gas') {
            // Vaporization creates expansion forces
            this.createVaporizationEffect(fluidSimulation);
        } else if (newPhase === 'plasma') {
            // Plasma creation generates electromagnetic effects
            this.createPlasmaEffect(fluidSimulation);
        }
    }
    
    /**
     * Create vaporization expansion effect
     */
    createVaporizationEffect(fluidSimulation) {
        // Steam expansion creates outward forces
        const expansionForce = 5.0;
        const sites = this.phaseState.nucleationSites;
        
        for (const site of sites) {
            fluidSimulation.addImpulse(
                site.x, site.y, site.z,
                (Math.random() - 0.5) * expansionForce,
                Math.random() * expansionForce, // Upward bias
                (Math.random() - 0.5) * expansionForce,
                10
            );
        }
    }
    
    /**
     * Create plasma formation effect
     */
    createPlasmaEffect(fluidSimulation) {
        // Plasma creates electromagnetic forces and heating
        const plasmaForce = 3.0;
        const sites = this.phaseState.nucleationSites;
        
        for (const site of sites) {
            // Electromagnetic repulsion
            fluidSimulation.addImpulse(
                site.x, site.y, site.z,
                (Math.random() - 0.5) * plasmaForce,
                (Math.random() - 0.5) * plasmaForce,
                (Math.random() - 0.5) * plasmaForce,
                15
            );
            
            // Temperature increase
            fluidSimulation.addTemperatureSource(
                site.x, site.y, site.z,
                this.materialState.temperature + 1000,
                8
            );
        }
    }
    
    /**
     * Update nucleation sites for phase transitions
     */
    updateNucleationSites(fluidSimulation) {
        // Clear old sites
        this.phaseState.nucleationSites = [];
        
        // Find regions with appropriate conditions for nucleation
        const numSites = 10;
        for (let i = 0; i < numSites; i++) {
            const x = (Math.random() - 0.5) * 10;
            const y = (Math.random() - 0.5) * 10;
            const z = (Math.random() - 0.5) * 10;
            
            const density = fluidSimulation.getDensityAt(x, y, z);
            const temperature = fluidSimulation.getTemperatureAt(x, y, z);
            
            // Nucleation more likely in high-density, high-temperature regions
            const nucleationProbability = density * temperature * 1e-8;
            
            if (Math.random() < nucleationProbability) {
                this.phaseState.nucleationSites.push({ x, y, z });
            }
        }
    }
    
    /**
     * Apply phase transition effects during transition
     */
    applyPhaseTransitionEffects(fluidSimulation) {
        const progress = this.phaseState.transitionProgress;
        
        if (progress > 0 && progress < 1) {
            // Transition is in progress - apply intermediate effects
            const transitionForce = progress * 2.0;
            
            for (const site of this.phaseState.nucleationSites) {
                // Create turbulence during phase transition
                fluidSimulation.addContinuousForce(
                    site.x, site.y, site.z,
                    (Math.random() - 0.5) * transitionForce,
                    (Math.random() - 0.5) * transitionForce,
                    (Math.random() - 0.5) * transitionForce,
                    5
                );
            }
        }
    }
    
    /**
     * Calculate electromagnetic effects for conductive materials
     */
    calculateElectromagneticEffects(fluidSimulation) {
        if (!this.config.electricalConductivity) return;
        
        const props = this.materialProperties[this.currentMaterial];
        const conductivity = props.electricalConductivity;
        
        if (conductivity < 1e-6) return; // Skip for insulators
        
        // Calculate Lorentz forces for moving conductors in magnetic field
        if (this.materialState.magneticField > 1e-6) {
            this.calculateLorentzForces(fluidSimulation, conductivity);
        }
        
        // Calculate induced currents and magnetic fields
        if (conductivity > 1e3) { // For high conductivity materials
            this.calculateInducedCurrents(fluidSimulation, conductivity);
        }
        
        // Joule heating from current flow
        this.calculateJouleHeating(fluidSimulation, conductivity);
    }
    
    /**
     * Calculate Lorentz forces (F = J × B)
     */
    calculateLorentzForces(fluidSimulation, conductivity) {
        const B = this.materialState.magneticField;
        const resolution = 16; // Low resolution for electromagnetic calculations
        
        for (let k = 1; k < resolution - 1; k++) {
            for (let j = 1; j < resolution - 1; j++) {
                for (let i = 1; i < resolution - 1; i++) {
                    const worldX = (i / resolution - 0.5) * 10;
                    const worldY = (j / resolution - 0.5) * 10;
                    const worldZ = (k / resolution - 0.5) * 10;
                    
                    const velocity = fluidSimulation.getVelocityAt(worldX, worldY, worldZ);
                    const density = fluidSimulation.getDensityAt(worldX, worldY, worldZ);
                    
                    if (density > 100) { // Only in material regions
                        // Simplified Lorentz force: F = ρ * v × B
                        // Assuming magnetic field in Z direction
                        const forceX = density * velocity.y * B * conductivity * 1e-6;
                        const forceY = -density * velocity.x * B * conductivity * 1e-6;
                        const forceZ = 0;
                        
                        if (Math.abs(forceX) > 1e-6 || Math.abs(forceY) > 1e-6) {
                            fluidSimulation.addContinuousForce(
                                worldX, worldY, worldZ,
                                forceX, forceY, forceZ,
                                3
                            );
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Calculate induced currents from moving conductor
     */
    calculateInducedCurrents(fluidSimulation, conductivity) {
        // Simplified model - real implementation would solve Maxwell's equations
        const B = this.materialState.magneticField;
        
        if (B < 1e-6) return;
        
        const resolution = 16;
        
        for (let k = 1; k < resolution - 1; k++) {
            for (let j = 1; j < resolution - 1; j++) {
                for (let i = 1; i < resolution - 1; i++) {
                    const worldX = (i / resolution - 0.5) * 10;
                    const worldY = (j / resolution - 0.5) * 10;
                    const worldZ = (k / resolution - 0.5) * 10;
                    
                    const velocity = fluidSimulation.getVelocityAt(worldX, worldY, worldZ);
                    const density = fluidSimulation.getDensityAt(worldX, worldY, worldZ);
                    
                    if (density > 100) {
                        // Induced electric field: E = v × B
                        const Ex = velocity.y * B;
                        const Ey = -velocity.x * B;
                        
                        // Current density: J = σ * E
                        const Jx = conductivity * Ex;
                        const Jy = conductivity * Ey;
                        
                        // Store for Joule heating calculation
                        const currentMagnitude = Math.sqrt(Jx*Jx + Jy*Jy);
                        this.materialState.currentDensity = currentMagnitude;
                    }
                }
            }
        }
    }
    
    /**
     * Calculate Joule heating from current flow
     */
    calculateJouleHeating(fluidSimulation, conductivity) {
        const J = this.materialState.currentDensity || 0;
        
        if (J > 1e-3) { // Significant current flow
            // Joule heating: P = J²/σ
            const heatGeneration = (J * J) / conductivity;
            const temperatureIncrease = heatGeneration * 0.01; // Simplified conversion
            
            // Apply heating to regions with current flow
            const numHeatSources = 5;
            for (let i = 0; i < numHeatSources; i++) {
                const x = (Math.random() - 0.5) * 10;
                const y = (Math.random() - 0.5) * 10;
                const z = (Math.random() - 0.5) * 10;
                
                fluidSimulation.addTemperatureSource(
                    x, y, z,
                    this.materialState.temperature + temperatureIncrease,
                    6
                );
            }
        }
    }
    
    /**
     * Update material properties based on current state
     */
    updateMaterialProperties() {
        const props = this.materialProperties[this.currentMaterial];
        
        // Set baseline properties
        this.currentDensity = props.density;
        this.currentViscosity = props.viscosity;
        this.currentSurfaceTension = props.surfaceTension;
        
        // Apply temperature and pressure corrections
        this.updateTemperatureDependentProperties();
        
        // Phase-specific modifications
        if (this.phaseState.currentPhase === 'gas') {
            this.currentDensity *= 0.001; // Gas is much less dense
            this.currentViscosity *= 0.1; // Lower viscosity
            this.currentSurfaceTension = 0; // No surface tension in gas
        } else if (this.phaseState.currentPhase === 'plasma') {
            this.currentDensity *= 0.0001; // Even lower density
            this.currentViscosity *= 0.01; // Very low viscosity
            this.currentSurfaceTension = 0; // No surface tension
        } else if (this.phaseState.currentPhase === 'solid') {
            this.currentViscosity *= 1e6; // Very high viscosity (acts like solid)
        }
    }
    
    /**
     * Change current material
     */
    setMaterial(materialName) {
        if (this.materialProperties.hasOwnProperty(materialName)) {
            this.currentMaterial = materialName;
            this.phaseState.currentPhase = 'liquid'; // Reset to liquid
            this.phaseState.transitionProgress = 0;
            this.updateMaterialProperties();
            
            console.log(`Material changed to: ${materialName}`);
        } else {
            console.warn(`Unknown material: ${materialName}`);
        }
    }
    
    /**
     * Get current material properties for rendering
     */
    getMaterialProperties() {
        const props = this.materialProperties[this.currentMaterial];
        
        return {
            // Basic properties
            density: this.currentDensity,
            viscosity: this.currentViscosity,
            surfaceTension: this.currentSurfaceTension,
            
            // Optical properties
            refractionIndex: props.refractionIndex,
            absorption: props.absorption,
            scattering: props.scattering,
            
            // Electrical properties
            conductivity: props.electricalConductivity,
            dielectric: props.dielectricConstant,
            
            // State information
            phase: this.phaseState.currentPhase,
            transitionProgress: this.phaseState.transitionProgress,
            temperature: this.materialState.temperature,
            pressure: this.materialState.pressure,
            ionization: this.materialState.ionization,
            
            // Material type
            name: this.currentMaterial
        };
    }
    
    /**
     * Get surface tension forces for specific location
     */
    getSurfaceTensionAt(worldX, worldY, worldZ) {
        if (!this.surfaceTensionGrid) return { x: 0, y: 0, z: 0 };
        
        const grid = this.surfaceTensionGrid;
        const resolution = grid.resolution;
        
        // Convert world coordinates to grid coordinates
        const gridX = (worldX / 10 + 0.5) * resolution;
        const gridY = (worldY / 10 + 0.5) * resolution;
        const gridZ = (worldZ / 10 + 0.5) * resolution;
        
        if (gridX < 0 || gridX >= resolution ||
            gridY < 0 || gridY >= resolution ||
            gridZ < 0 || gridZ >= resolution) {
            return { x: 0, y: 0, z: 0 };
        }
        
        // Trilinear interpolation of force field
        const i = Math.floor(gridX);
        const j = Math.floor(gridY);
        const k = Math.floor(gridZ);
        
        const fx = gridX - i;
        const fy = gridY - j;
        const fz = gridZ - k;
        
        const getForce = (ii, jj, kk) => {
            const idx = Math.max(0, Math.min(resolution-1, kk)) * resolution * resolution +
                       Math.max(0, Math.min(resolution-1, jj)) * resolution +
                       Math.max(0, Math.min(resolution-1, ii));
            return {
                x: grid.force[idx * 3],
                y: grid.force[idx * 3 + 1],
                z: grid.force[idx * 3 + 2]
            };
        };
        
        // 8 corner values
        const c000 = getForce(i, j, k);
        const c001 = getForce(i, j, k+1);
        const c010 = getForce(i, j+1, k);
        const c011 = getForce(i, j+1, k+1);
        const c100 = getForce(i+1, j, k);
        const c101 = getForce(i+1, j, k+1);
        const c110 = getForce(i+1, j+1, k);
        const c111 = getForce(i+1, j+1, k+1);
        
        // Trilinear interpolation
        const interpolate = (c000, c001, c010, c011, c100, c101, c110, c111, fx, fy, fz) => {
            const c00 = c000 * (1-fx) + c100 * fx;
            const c01 = c001 * (1-fx) + c101 * fx;
            const c10 = c010 * (1-fx) + c110 * fx;
            const c11 = c011 * (1-fx) + c111 * fx;
            
            const c0 = c00 * (1-fy) + c10 * fy;
            const c1 = c01 * (1-fy) + c11 * fy;
            
            return c0 * (1-fz) + c1 * fz;
        };
        
        return {
            x: interpolate(c000.x, c001.x, c010.x, c011.x, c100.x, c101.x, c110.x, c111.x, fx, fy, fz),
            y: interpolate(c000.y, c001.y, c010.y, c011.y, c100.y, c101.y, c110.y, c111.y, fx, fy, fz),
            z: interpolate(c000.z, c001.z, c010.z, c011.z, c100.z, c101.z, c110.z, c111.z, fx, fy, fz)
        };
    }
    
    /**
     * Get viscosity at specific location
     */
    getViscosityAt(worldX, worldY, worldZ) {
        if (!this.viscosityField || this.config.viscosityModel === 'newtonian') {
            return this.currentViscosity;
        }
        
        const field = this.viscosityField;
        const resolution = field.resolution;
        
        // Convert world coordinates to grid coordinates
        const gridX = (worldX / 10 + 0.5) * resolution;
        const gridY = (worldY / 10 + 0.5) * resolution;
        const gridZ = (worldZ / 10 + 0.5) * resolution;
        
        if (gridX < 0 || gridX >= resolution ||
            gridY < 0 || gridY >= resolution ||
            gridZ < 0 || gridZ >= resolution) {
            return this.currentViscosity;
        }
        
        // Simple trilinear interpolation
        const i = Math.floor(gridX);
        const j = Math.floor(gridY);
        const k = Math.floor(gridZ);
        
        const index = k * resolution * resolution + j * resolution + i;
        return field.values[index] || this.currentViscosity;
    }
    
    /**
     * Get statistics for debugging and monitoring
     */
    getStatistics() {
        return {
            material: this.currentMaterial,
            phase: this.phaseState.currentPhase,
            transitionProgress: this.phaseState.transitionProgress,
            properties: {
                density: this.currentDensity,
                viscosity: this.currentViscosity,
                surfaceTension: this.currentSurfaceTension,
                temperature: this.materialState.temperature,
                pressure: this.materialState.pressure
            },
            nucleationSites: this.phaseState.nucleationSites.length,
            performance: this.performanceMetrics
        };
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        console.log('Disposing MaterialPhysics...');
        
        // Clear grids
        if (this.surfaceTensionGrid) {
            this.surfaceTensionGrid.curvature = null;
            this.surfaceTensionGrid.gradient = null;
            this.surfaceTensionGrid.force = null;
        }
        
        if (this.viscosityField) {
            this.viscosityField.values = null;
            this.viscosityField.gradient = null;
            this.viscosityField.shearRate = null;
        }
        
        // Clear caches
        this.surfaceTensionCache.clear();
        
        // Clear arrays
        this.phaseState.nucleationSites = [];
        
        console.log('MaterialPhysics disposed');
    }
}