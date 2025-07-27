/**
 * Material Presets
 * Comprehensive preset management system for material configurations
 * Provides predefined materials, user presets, and dynamic preset generation
 * Location: src/materials/MaterialPresets.js
 */

import { ColorUtils } from '../utils/ColorUtils.js';
import { MathUtils } from '../utils/MathUtils.js';
import { FileUtils } from '../utils/FileUtils.js';

export class MaterialPresets {
    constructor(options = {}) {
        // Configuration
        this.config = {
            presetDirectories: {
                builtin: 'assets/presets/materials/',
                user: 'user_presets/',
                community: 'community_presets/'
            },
            enableFileWatching: options.enableFileWatching !== false,
            enableCloudSync: options.enableCloudSync === true,
            maxUserPresets: options.maxUserPresets || 100,
            cacheSize: options.cacheSize || 50
        };
        
        // Preset collections
        this.presets = {
            builtin: new Map(),
            user: new Map(),
            community: new Map(),
            runtime: new Map() // Generated at runtime
        };
        
        // Preset categories for organization
        this.categories = {
            basic: {
                name: 'Basic Materials',
                description: 'Fundamental material types',
                color: '#4A90E2',
                presets: []
            },
            liquids: {
                name: 'Liquids',
                description: 'Fluid materials with flow properties',
                color: '#357ABD',
                presets: []
            },
            metals: {
                name: 'Metals',
                description: 'Metallic materials with conductivity',
                color: '#8E8E93',
                presets: []
            },
            energy: {
                name: 'Energy States',
                description: 'Plasma, fire, and electromagnetic materials',
                color: '#FF3B30',
                presets: []
            },
            exotic: {
                name: 'Exotic Materials',
                description: 'Special and experimental materials',
                color: '#AF52DE',
                presets: []
            },
            musical: {
                name: 'Musical Themes',
                description: 'Genre-specific material configurations',
                color: '#32D74B',
                presets: []
            }
        };
        
        // Audio-reactive preset modifiers
        this.audioModifiers = {
            genres: {
                electronic: {
                    bassEmphasis: 1.5,
                    trebleResponse: 1.2,
                    energyMultiplier: 1.3,
                    colorShift: 30, // degrees
                    viscosityRange: [0.0001, 0.01]
                },
                rock: {
                    bassEmphasis: 2.0,
                    trebleResponse: 0.8,
                    energyMultiplier: 1.6,
                    colorShift: -45,
                    viscosityRange: [0.001, 0.1]
                },
                classical: {
                    bassEmphasis: 0.8,
                    trebleResponse: 1.5,
                    energyMultiplier: 0.9,
                    colorShift: 60,
                    viscosityRange: [0.0005, 0.005]
                },
                ambient: {
                    bassEmphasis: 0.6,
                    trebleResponse: 1.0,
                    energyMultiplier: 0.7,
                    colorShift: 120,
                    viscosityRange: [0.0001, 0.001]
                },
                jazz: {
                    bassEmphasis: 1.2,
                    trebleResponse: 1.3,
                    energyMultiplier: 1.1,
                    colorShift: 180,
                    viscosityRange: [0.0008, 0.008]
                }
            }
        };
        
        // Preset cache for performance
        this.presetCache = new Map();
        this.cacheStats = { hits: 0, misses: 0 };
        
        // Preset templates for generation
        this.templates = new Map();
        
        // Initialize built-in presets
        this.initializeBuiltinPresets();
        
        console.log('MaterialPresets initialized', {
            builtinCount: this.presets.builtin.size,
            categories: Object.keys(this.categories).length,
            cacheSize: this.config.cacheSize
        });
    }
    
    /**
     * Initialize built-in material presets
     */
    initializeBuiltinPresets() {
        // Basic Materials
        this.addBuiltinPreset('water_pure', {
            name: 'Pure Water',
            category: 'basic',
            description: 'Clean, transparent water with realistic physics',
            tags: ['water', 'transparent', 'basic'],
            physical: {
                density: 1000.0,
                viscosity: 0.001002,
                surfaceTension: 0.0728,
                bulkModulus: 2.15e9,
                thermalConductivity: 0.598,
                thermalExpansion: 2.14e-4
            },
            optical: {
                refractionIndex: 1.333,
                absorption: [0.45, 0.74, 4.62],
                scattering: 0.001,
                emission: [0.0, 0.0, 0.0],
                transparency: 0.95,
                baseColor: [0.8, 0.9, 1.0, 0.3]
            },
            electrical: {
                conductivity: 5.5e-6,
                dielectricConstant: 81,
                magneticPermeability: 1.0
            },
            thermal: {
                temperature: 293.15,
                specificHeat: 4186,
                freezingPoint: 273.15,
                boilingPoint: 373.15
            },
            audioReactivity: {
                temperatureResponse: 0.5,
                viscosityResponse: 0.3,
                surfaceTensionResponse: 0.2,
                colorResponse: 0.4
            }
        });
        
        this.addBuiltinPreset('mercury_liquid', {
            name: 'Liquid Mercury',
            category: 'metals',
            description: 'Highly reflective liquid metal with conductivity',
            tags: ['mercury', 'metal', 'conductive', 'reflective'],
            physical: {
                density: 13534.0,
                viscosity: 0.001526,
                surfaceTension: 0.4865,
                bulkModulus: 25.3e9,
                thermalConductivity: 8.30,
                thermalExpansion: 1.82e-4
            },
            optical: {
                refractionIndex: 1.0,
                absorption: [0.0, 0.0, 0.0],
                scattering: 0.0,
                emission: [0.1, 0.1, 0.1],
                transparency: 0.0,
                baseColor: [0.7, 0.7, 0.8, 1.0],
                metallic: 1.0,
                roughness: 0.1
            },
            electrical: {
                conductivity: 1.04e6,
                dielectricConstant: 1.0,
                magneticPermeability: 1.0
            },
            thermal: {
                temperature: 293.15,
                specificHeat: 139.5,
                freezingPoint: 234.32,
                boilingPoint: 629.88
            },
            audioReactivity: {
                temperatureResponse: 0.3,
                viscosityResponse: 0.1,
                surfaceTensionResponse: 0.4,
                colorResponse: 0.6,
                magneticResponse: 0.8
            }
        });
        
        this.addBuiltinPreset('plasma_ionized', {
            name: 'Ionized Plasma',
            category: 'energy',
            description: 'High-energy plasma state with electromagnetic effects',
            tags: ['plasma', 'energy', 'electromagnetic', 'glowing'],
            physical: {
                density: 1.225,
                viscosity: 1.8e-5,
                surfaceTension: 0.0,
                bulkModulus: 1.42e5,
                thermalConductivity: 0.024,
                thermalExpansion: 3.43e-3
            },
            optical: {
                refractionIndex: 0.999,
                absorption: [0.1, 0.1, 0.1],
                scattering: 0.1,
                emission: [2.0, 1.5, 3.0],
                transparency: 0.7,
                baseColor: [0.8, 0.4, 1.0, 0.8],
                selfIllumination: 1.5
            },
            electrical: {
                conductivity: 1e4,
                dielectricConstant: 1.0,
                magneticPermeability: 1.0,
                ionizationLevel: 0.8,
                plasmaDensity: 1e12
            },
            thermal: {
                temperature: 5000.0,
                specificHeat: 1005,
                freezingPoint: 0,
                boilingPoint: 10000
            },
            audioReactivity: {
                temperatureResponse: 1.2,
                viscosityResponse: 0.8,
                surfaceTensionResponse: 0.0,
                colorResponse: 1.5,
                ionizationResponse: 1.0
            }
        });
        
        this.addBuiltinPreset('oil_viscous', {
            name: 'Viscous Oil',
            category: 'liquids',
            description: 'Thick, dark oil with non-Newtonian properties',
            tags: ['oil', 'viscous', 'non-newtonian', 'dark'],
            physical: {
                density: 920.0,
                viscosity: 0.084,
                surfaceTension: 0.035,
                bulkModulus: 1.5e9,
                thermalConductivity: 0.145,
                thermalExpansion: 7e-4,
                shearThinning: 0.3
            },
            optical: {
                refractionIndex: 1.47,
                absorption: [0.2, 0.5, 0.8],
                scattering: 0.01,
                emission: [0.0, 0.0, 0.0],
                transparency: 0.1,
                baseColor: [0.1, 0.05, 0.02, 0.9]
            },
            electrical: {
                conductivity: 1e-12,
                dielectricConstant: 2.3,
                magneticPermeability: 1.0
            },
            thermal: {
                temperature: 293.15,
                specificHeat: 1900,
                freezingPoint: 233,
                boilingPoint: 573
            },
            audioReactivity: {
                temperatureResponse: 0.4,
                viscosityResponse: 0.8,
                surfaceTensionResponse: 0.3,
                colorResponse: 0.2
            }
        });
        
        this.addBuiltinPreset('lava_molten', {
            name: 'Molten Lava',
            category: 'energy',
            description: 'Glowing molten rock with extreme temperature',
            tags: ['lava', 'molten', 'hot', 'glowing', 'viscous'],
            physical: {
                density: 2800.0,
                viscosity: 1000.0,
                surfaceTension: 0.4,
                bulkModulus: 50e9,
                thermalConductivity: 2.0,
                thermalExpansion: 3e-5,
                yieldStress: 100
            },
            optical: {
                refractionIndex: 1.6,
                absorption: [0.0, 0.1, 0.9],
                scattering: 0.05,
                emission: [3.0, 1.5, 0.2],
                transparency: 0.0,
                baseColor: [1.0, 0.3, 0.0, 1.0],
                selfIllumination: 2.0
            },
            electrical: {
                conductivity: 0.1,
                dielectricConstant: 12,
                magneticPermeability: 1.0
            },
            thermal: {
                temperature: 1373.15,
                specificHeat: 1150,
                freezingPoint: 1373,
                boilingPoint: 3000
            },
            audioReactivity: {
                temperatureResponse: 0.8,
                viscosityResponse: 0.6,
                surfaceTensionResponse: 0.4,
                colorResponse: 1.0
            }
        });
        
        // Musical theme presets
        this.addBuiltinPreset('electronic_pulse', {
            name: 'Electronic Pulse',
            category: 'musical',
            description: 'Neon-like material perfect for electronic music',
            tags: ['electronic', 'neon', 'pulse', 'synthetic'],
            physical: {
                density: 800.0,
                viscosity: 0.005,
                surfaceTension: 0.045,
                bulkModulus: 5e8
            },
            optical: {
                refractionIndex: 1.2,
                absorption: [0.1, 0.0, 0.1],
                emission: [0.0, 2.0, 2.0],
                baseColor: [0.0, 1.0, 1.0, 0.8],
                selfIllumination: 1.2
            },
            electrical: {
                conductivity: 1e3,
                dielectricConstant: 5
            },
            thermal: {
                temperature: 273.15
            },
            audioReactivity: {
                temperatureResponse: 1.5,
                colorResponse: 2.0,
                pulseSync: true
            }
        });
        
        this.addBuiltinPreset('classical_gold', {
            name: 'Classical Gold',
            category: 'musical',
            description: 'Elegant golden material for classical music',
            tags: ['classical', 'gold', 'elegant', 'warm'],
            physical: {
                density: 19300.0,
                viscosity: 0.002,
                surfaceTension: 1.128
            },
            optical: {
                refractionIndex: 0.47,
                absorption: [0.0, 0.1, 0.8],
                emission: [0.8, 0.6, 0.0],
                baseColor: [1.0, 0.84, 0.0, 1.0],
                metallic: 1.0,
                roughness: 0.05
            },
            electrical: {
                conductivity: 4.1e7
            },
            thermal: {
                temperature: 293.15
            },
            audioReactivity: {
                temperatureResponse: 0.3,
                colorResponse: 0.8,
                smooth: true
            }
        });
        
        // Initialize categories
        this.categorizePresets();
    }
    
    /**
     * Add a built-in preset to the collection
     */
    addBuiltinPreset(id, preset) {
        preset.id = id;
        preset.type = 'builtin';
        preset.version = '1.0.0';
        preset.created = Date.now();
        preset.lastModified = Date.now();
        
        this.presets.builtin.set(id, preset);
    }
    
    /**
     * Categorize presets into their respective categories
     */
    categorizePresets() {
        // Clear existing categorization
        Object.values(this.categories).forEach(category => {
            category.presets = [];
        });
        
        // Categorize all presets
        for (const [presetType, presetMap] of Object.entries(this.presets)) {
            for (const [id, preset] of presetMap) {
                const category = this.categories[preset.category];
                if (category) {
                    category.presets.push({ id, type: presetType, preset });
                }
            }
        }
    }
    
    /**
     * Get preset by ID and type
     */
    getPreset(id, type = 'builtin') {
        const cacheKey = `${type}:${id}`;
        
        // Check cache first
        if (this.presetCache.has(cacheKey)) {
            this.cacheStats.hits++;
            return this.presetCache.get(cacheKey);
        }
        
        this.cacheStats.misses++;
        
        // Get preset from collection
        const presetMap = this.presets[type];
        if (!presetMap || !presetMap.has(id)) {
            return null;
        }
        
        const preset = presetMap.get(id);
        
        // Cache the result
        if (this.presetCache.size < this.config.cacheSize) {
            this.presetCache.set(cacheKey, preset);
        }
        
        return preset;
    }
    
    /**
     * Create a new user preset
     */
    createUserPreset(name, materialProperties, options = {}) {
        if (this.presets.user.size >= this.config.maxUserPresets) {
            throw new Error('Maximum number of user presets reached');
        }
        
        const id = this.generatePresetId(name);
        const preset = {
            id,
            name,
            type: 'user',
            category: options.category || 'basic',
            description: options.description || '',
            tags: options.tags || [],
            version: '1.0.0',
            created: Date.now(),
            lastModified: Date.now(),
            author: options.author || 'User',
            ...materialProperties
        };
        
        this.presets.user.set(id, preset);
        this.categorizePresets();
        
        // Save to local storage
        this.saveUserPreset(preset);
        
        console.log(`Created user preset: ${name} (${id})`);
        return preset;
    }
    
    /**
     * Generate audio-reactive preset based on genre
     */
    generateAudioPreset(basePresetId, genre, audioData = null) {
        const basePreset = this.getPreset(basePresetId);
        if (!basePreset) {
            throw new Error(`Base preset not found: ${basePresetId}`);
        }
        
        const genreModifier = this.audioModifiers.genres[genre];
        if (!genreModifier) {
            throw new Error(`Unknown genre: ${genre}`);
        }
        
        const audioPreset = JSON.parse(JSON.stringify(basePreset));
        audioPreset.id = `${basePresetId}_${genre}_audio`;
        audioPreset.name = `${basePreset.name} (${genre.toUpperCase()})`;
        audioPreset.category = 'musical';
        audioPreset.type = 'runtime';
        audioPreset.basePreset = basePresetId;
        audioPreset.genre = genre;
        
        // Apply genre-specific modifications
        if (audioPreset.audioReactivity) {
            audioPreset.audioReactivity.bassEmphasis = genreModifier.bassEmphasis;
            audioPreset.audioReactivity.trebleResponse = genreModifier.trebleResponse;
            audioPreset.audioReactivity.energyMultiplier = genreModifier.energyMultiplier;
        }
        
        // Modify physical properties
        if (audioPreset.physical && genreModifier.viscosityRange) {
            const [minVisc, maxVisc] = genreModifier.viscosityRange;
            audioPreset.physical.viscosityRange = [minVisc, maxVisc];
        }
        
        // Modify color based on genre
        if (audioPreset.optical && audioPreset.optical.baseColor) {
            const baseHSV = ColorUtils.rgbToHsv(audioPreset.optical.baseColor);
            baseHSV[0] = (baseHSV[0] + genreModifier.colorShift) % 360;
            audioPreset.optical.baseColor = ColorUtils.hsvToRgb(baseHSV[0], baseHSV[1], baseHSV[2], baseHSV[3]);
        }
        
        // Apply real-time audio data if available
        if (audioData) {
            this.applyAudioDataToPreset(audioPreset, audioData, genreModifier);
        }
        
        this.presets.runtime.set(audioPreset.id, audioPreset);
        return audioPreset;
    }
    
    /**
     * Apply real-time audio data to preset
     */
    applyAudioDataToPreset(preset, audioData, genreModifier) {
        const { bassLevel, midLevel, trebleLevel, energy, beat, beatStrength } = audioData;
        
        // Temperature modulation
        if (preset.thermal && preset.audioReactivity.temperatureResponse) {
            const baseTemp = preset.thermal.temperature;
            const tempVariation = energy * 200 * preset.audioReactivity.temperatureResponse * genreModifier.energyMultiplier;
            preset.thermal.temperature = baseTemp + tempVariation;
        }
        
        // Viscosity modulation
        if (preset.physical && preset.audioReactivity.viscosityResponse) {
            const baseViscosity = preset.physical.viscosity;
            const viscosityMod = 1 + (bassLevel * genreModifier.bassEmphasis - 0.5) * preset.audioReactivity.viscosityResponse;
            preset.physical.viscosity = baseViscosity * viscosityMod;
        }
        
        // Color modulation
        if (preset.optical && preset.audioReactivity.colorResponse) {
            const baseColor = preset.optical.baseColor;
            const hsv = ColorUtils.rgbToHsv(baseColor);
            
            // Hue shift based on spectral centroid
            if (audioData.spectralCentroid) {
                const hueShift = MathUtils.map(audioData.spectralCentroid, 0, 8000, -30, 30);
                hsv[0] = (hsv[0] + hueShift) % 360;
            }
            
            // Saturation based on treble
            hsv[1] = MathUtils.clamp(hsv[1] * (1 + trebleLevel * genreModifier.trebleResponse * 0.3), 0, 1);
            
            // Brightness based on energy
            hsv[2] = MathUtils.clamp(hsv[2] * (1 + energy * genreModifier.energyMultiplier * 0.2), 0, 1);
            
            preset.optical.baseColor = ColorUtils.hsvToRgb(hsv[0], hsv[1], hsv[2], baseColor[3]);
        }
        
        // Emission modulation for self-illuminating materials
        if (preset.optical && preset.optical.emission && preset.optical.selfIllumination) {
            const emissionMod = 1 + beatStrength * preset.audioReactivity.colorResponse;
            preset.optical.emission = preset.optical.emission.map(e => e * emissionMod);
        }
    }
    
    /**
     * Create a preset based on a template
     */
    createFromTemplate(templateName, parameters = {}) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template not found: ${templateName}`);
        }
        
        return template.generate(parameters);
    }
    
    /**
     * Interpolate between two presets
     */
    interpolatePresets(presetA, presetB, t, options = {}) {
        const interpolated = {
            id: `${presetA.id}_${presetB.id}_lerp_${Math.floor(t * 100)}`,
            name: `${presetA.name} → ${presetB.name} (${Math.floor(t * 100)}%)`,
            type: 'runtime',
            category: presetA.category,
            description: `Interpolated between ${presetA.name} and ${presetB.name}`,
            basePresets: [presetA.id, presetB.id],
            interpolationFactor: t,
            created: Date.now()
        };
        
        // Interpolate physical properties
        if (presetA.physical && presetB.physical) {
            interpolated.physical = this.interpolatePropertyGroup(presetA.physical, presetB.physical, t);
        }
        
        // Interpolate optical properties
        if (presetA.optical && presetB.optical) {
            interpolated.optical = this.interpolatePropertyGroup(presetA.optical, presetB.optical, t);
            
            // Special handling for colors
            if (presetA.optical.baseColor && presetB.optical.baseColor) {
                interpolated.optical.baseColor = options.useHSVInterpolation 
                    ? ColorUtils.lerpHsv(presetA.optical.baseColor, presetB.optical.baseColor, t)
                    : ColorUtils.lerp(presetA.optical.baseColor, presetB.optical.baseColor, t);
            }
        }
        
        // Interpolate electrical properties
        if (presetA.electrical && presetB.electrical) {
            interpolated.electrical = this.interpolatePropertyGroup(presetA.electrical, presetB.electrical, t);
        }
        
        // Interpolate thermal properties
        if (presetA.thermal && presetB.thermal) {
            interpolated.thermal = this.interpolatePropertyGroup(presetA.thermal, presetB.thermal, t);
        }
        
        // Interpolate audio reactivity
        if (presetA.audioReactivity && presetB.audioReactivity) {
            interpolated.audioReactivity = this.interpolatePropertyGroup(presetA.audioReactivity, presetB.audioReactivity, t);
        }
        
        this.presets.runtime.set(interpolated.id, interpolated);
        return interpolated;
    }
    
    /**
     * Interpolate a group of properties
     */
    interpolatePropertyGroup(groupA, groupB, t) {
        const interpolated = {};
        
        // Get all unique property keys
        const keys = new Set([...Object.keys(groupA), ...Object.keys(groupB)]);
        
        for (const key of keys) {
            const valueA = groupA[key];
            const valueB = groupB[key];
            
            if (valueA !== undefined && valueB !== undefined) {
                if (Array.isArray(valueA) && Array.isArray(valueB)) {
                    // Interpolate arrays (colors, vectors)
                    interpolated[key] = valueA.map((a, i) => 
                        MathUtils.lerp(a, valueB[i] || 0, t)
                    );
                } else if (typeof valueA === 'number' && typeof valueB === 'number') {
                    // Interpolate numbers
                    interpolated[key] = MathUtils.lerp(valueA, valueB, t);
                } else if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
                    // Boolean interpolation (switch at midpoint)
                    interpolated[key] = t < 0.5 ? valueA : valueB;
                } else {
                    // Default to A or B based on t
                    interpolated[key] = t < 0.5 ? valueA : valueB;
                }
            } else {
                // Use whichever value exists
                interpolated[key] = valueA !== undefined ? valueA : valueB;
            }
        }
        
        return interpolated;
    }
    
    /**
     * Create a random preset variation
     */
    createRandomVariation(basePresetId, variationAmount = 0.2, options = {}) {
        const basePreset = this.getPreset(basePresetId);
        if (!basePreset) {
            throw new Error(`Base preset not found: ${basePresetId}`);
        }
        
        const variation = JSON.parse(JSON.stringify(basePreset));
        variation.id = `${basePresetId}_variation_${Date.now()}`;
        variation.name = `${basePreset.name} (Variation)`;
        variation.type = 'runtime';
        variation.basePreset = basePresetId;
        variation.variationAmount = variationAmount;
        
        // Apply random variations to physical properties
        if (variation.physical) {
            this.applyRandomVariations(variation.physical, variationAmount, {
                density: { min: 0.5, max: 2.0, logScale: false },
                viscosity: { min: 0.1, max: 10.0, logScale: true },
                surfaceTension: { min: 0.5, max: 1.5, logScale: false }
            });
        }
        
        // Apply random variations to optical properties
        if (variation.optical) {
            this.applyRandomVariations(variation.optical, variationAmount, {
                refractionIndex: { min: 0.8, max: 1.2, logScale: false },
                transparency: { min: 0.8, max: 1.2, logScale: false }
            });
            
            // Special variation for colors
            if (variation.optical.baseColor) {
                const hsv = ColorUtils.rgbToHsv(variation.optical.baseColor);
                hsv[0] = (hsv[0] + (Math.random() - 0.5) * 60 * variationAmount) % 360;
                hsv[1] = MathUtils.clamp(hsv[1] * (1 + (Math.random() - 0.5) * variationAmount), 0, 1);
                hsv[2] = MathUtils.clamp(hsv[2] * (1 + (Math.random() - 0.5) * variationAmount), 0, 1);
                variation.optical.baseColor = ColorUtils.hsvToRgb(hsv[0], hsv[1], hsv[2], variation.optical.baseColor[3]);
            }
        }
        
        // Apply random variations to thermal properties
        if (variation.thermal) {
            this.applyRandomVariations(variation.thermal, variationAmount, {
                temperature: { min: 0.8, max: 1.2, logScale: false },
                specificHeat: { min: 0.9, max: 1.1, logScale: false }
            });
        }
        
        this.presets.runtime.set(variation.id, variation);
        return variation;
    }
    
    /**
     * Apply random variations to a property group
     */
    applyRandomVariations(properties, variationAmount, constraints = {}) {
        for (const [key, value] of Object.entries(properties)) {
            if (typeof value === 'number') {
                const constraint = constraints[key];
                if (constraint) {
                    const variation = (Math.random() - 0.5) * 2 * variationAmount;
                    let newValue;
                    
                    if (constraint.logScale) {
                        const logValue = Math.log(value);
                        const logVariation = variation * Math.log(constraint.max / constraint.min);
                        newValue = Math.exp(logValue + logVariation);
                    } else {
                        newValue = value * (1 + variation * (constraint.max - constraint.min));
                    }
                    
                    properties[key] = MathUtils.clamp(newValue, 
                        value * constraint.min, 
                        value * constraint.max);
                } else {
                    // Default variation for unconstrained properties
                    properties[key] = value * (1 + (Math.random() - 0.5) * variationAmount);
                }
            }
        }
    }
    
    /**
     * Search presets by criteria
     */
    searchPresets(query, options = {}) {
        const {
            types = ['builtin', 'user', 'community'],
            categories = null,
            tags = null,
            sortBy = 'name',
            sortOrder = 'asc',
            limit = 50
        } = options;
        
        const results = [];
        
        // Search through specified preset types
        for (const type of types) {
            const presetMap = this.presets[type];
            if (!presetMap) continue;
            
            for (const [id, preset] of presetMap) {
                let matches = true;
                
                // Category filter
                if (categories && !categories.includes(preset.category)) {
                    matches = false;
                }
                
                // Tag filter
                if (tags && preset.tags && !tags.some(tag => preset.tags.includes(tag))) {
                    matches = false;
                }
                
                // Text search
                if (query) {
                    const searchText = `${preset.name} ${preset.description} ${preset.tags?.join(' ')}`.toLowerCase();
                    if (!searchText.includes(query.toLowerCase())) {
                        matches = false;
                    }
                }
                
                if (matches) {
                    results.push({ id, type, preset, score: this.calculateRelevanceScore(preset, query) });
                }
            }
        }
        
        // Sort results
        results.sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'name':
                    comparison = a.preset.name.localeCompare(b.preset.name);
                    break;
                case 'created':
                    comparison = a.preset.created - b.preset.created;
                    break;
                case 'modified':
                    comparison = (a.preset.lastModified || a.preset.created) - (b.preset.lastModified || b.preset.created);
                    break;
                case 'relevance':
                    comparison = b.score - a.score;
                    break;
                default:
                    comparison = 0;
            }
            
            return sortOrder === 'desc' ? -comparison : comparison;
        });
        
        return results.slice(0, limit);
    }
    
    /**
     * Calculate relevance score for search
     */
    calculateRelevanceScore(preset, query) {
        if (!query) return 0;
        
        const queryLower = query.toLowerCase();
        let score = 0;
        
        // Name match (highest weight)
        if (preset.name.toLowerCase().includes(queryLower)) {
            score += 10;
            if (preset.name.toLowerCase().startsWith(queryLower)) {
                score += 5;
            }
        }
        
        // Description match
        if (preset.description?.toLowerCase().includes(queryLower)) {
            score += 3;
        }
        
        // Tag match
        if (preset.tags) {
            for (const tag of preset.tags) {
                if (tag.toLowerCase().includes(queryLower)) {
                    score += 2;
                }
            }
        }
        
        // Category match
        if (preset.category?.toLowerCase().includes(queryLower)) {
            score += 1;
        }
        
        return score;
    }
    
    /**
     * Get presets by category
     */
    getPresetsByCategory(categoryName) {
        const category = this.categories[categoryName];
        if (!category) {
            return [];
        }
        
        return category.presets.map(item => ({
            ...item,
            preset: this.getPreset(item.id, item.type)
        }));
    }
    
    /**
     * Get all categories with preset counts
     */
    getCategories() {
        const categoriesWithCounts = {};
        
        for (const [name, category] of Object.entries(this.categories)) {
            categoriesWithCounts[name] = {
                ...category,
                count: category.presets.length
            };
        }
        
        return categoriesWithCounts;
    }
    
    /**
     * Export preset to JSON
     */
    exportPreset(presetId, type = 'builtin') {
        const preset = this.getPreset(presetId, type);
        if (!preset) {
            throw new Error(`Preset not found: ${presetId}`);
        }
        
        const exportData = {
            ...preset,
            exportedAt: Date.now(),
            exportedBy: 'MaterialPresets',
            version: '1.0.0'
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    /**
     * Import preset from JSON
     */
    importPreset(jsonData, options = {}) {
        let presetData;
        
        try {
            presetData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        } catch (error) {
            throw new Error('Invalid JSON data');
        }
        
        // Validate preset structure
        this.validatePresetStructure(presetData);
        
        // Generate new ID if needed
        const id = options.newId || presetData.id || this.generatePresetId(presetData.name);
        const type = options.type || 'user';
        
        const preset = {
            ...presetData,
            id,
            type,
            imported: true,
            importedAt: Date.now(),
            lastModified: Date.now()
        };
        
        this.presets[type].set(id, preset);
        this.categorizePresets();
        
        if (type === 'user') {
            this.saveUserPreset(preset);
        }
        
        console.log(`Imported preset: ${preset.name} (${id})`);
        return preset;
    }
    
    /**
     * Validate preset structure
     */
    validatePresetStructure(preset) {
        const required = ['name'];
        const optional = ['physical', 'optical', 'electrical', 'thermal', 'audioReactivity'];
        
        for (const field of required) {
            if (!preset[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Validate property groups
        for (const group of optional) {
            if (preset[group] && typeof preset[group] !== 'object') {
                throw new Error(`Invalid ${group} properties: must be an object`);
            }
        }
        
        return true;
    }
    
    /**
     * Generate unique preset ID
     */
    generatePresetId(name) {
        const base = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${base}_${timestamp}_${random}`;
    }
    
    /**
     * Save user preset to local storage
     */
    saveUserPreset(preset) {
        try {
            const userPresets = this.loadUserPresetsFromStorage();
            userPresets[preset.id] = preset;
            localStorage.setItem('material_presets_user', JSON.stringify(userPresets));
        } catch (error) {
            console.warn('Failed to save user preset to local storage:', error);
        }
    }
    
    /**
     * Load user presets from local storage
     */
    loadUserPresetsFromStorage() {
        try {
            const stored = localStorage.getItem('material_presets_user');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to load user presets from local storage:', error);
            return {};
        }
    }
    
    /**
     * Load user presets at startup
     */
    async loadUserPresets() {
        const storedPresets = this.loadUserPresetsFromStorage();
        
        for (const [id, preset] of Object.entries(storedPresets)) {
            try {
                this.validatePresetStructure(preset);
                this.presets.user.set(id, preset);
            } catch (error) {
                console.warn(`Invalid user preset ${id}:`, error);
            }
        }
        
        this.categorizePresets();
        console.log(`Loaded ${this.presets.user.size} user presets`);
    }
    
    /**
     * Delete preset
     */
    deletePreset(presetId, type = 'user') {
        if (type === 'builtin') {
            throw new Error('Cannot delete built-in presets');
        }
        
        const presetMap = this.presets[type];
        if (!presetMap || !presetMap.has(presetId)) {
            throw new Error(`Preset not found: ${presetId}`);
        }
        
        presetMap.delete(presetId);
        this.categorizePresets();
        
        // Remove from cache
        const cacheKey = `${type}:${presetId}`;
        this.presetCache.delete(cacheKey);
        
        // Remove from local storage for user presets
        if (type === 'user') {
            const userPresets = this.loadUserPresetsFromStorage();
            delete userPresets[presetId];
            localStorage.setItem('material_presets_user', JSON.stringify(userPresets));
        }
        
        console.log(`Deleted preset: ${presetId}`);
        return true;
    }
    
    /**
     * Update existing preset
     */
    updatePreset(presetId, updates, type = 'user') {
        if (type === 'builtin') {
            throw new Error('Cannot modify built-in presets');
        }
        
        const preset = this.getPreset(presetId, type);
        if (!preset) {
            throw new Error(`Preset not found: ${presetId}`);
        }
        
        // Apply updates
        Object.assign(preset, updates, {
            lastModified: Date.now()
        });
        
        // Validate updated preset
        this.validatePresetStructure(preset);
        
        // Update cache
        const cacheKey = `${type}:${presetId}`;
        this.presetCache.set(cacheKey, preset);
        
        // Save to storage for user presets
        if (type === 'user') {
            this.saveUserPreset(preset);
        }
        
        console.log(`Updated preset: ${presetId}`);
        return preset;
    }
    
    /**
     * Create preset collection/pack
     */
    createPresetPack(name, presetIds, options = {}) {
        const pack = {
            id: this.generatePresetId(name),
            name,
            description: options.description || '',
            author: options.author || 'User',
            version: options.version || '1.0.0',
            presets: [],
            created: Date.now(),
            type: 'pack'
        };
        
        // Gather presets
        for (const presetRef of presetIds) {
            const { id, type = 'builtin' } = typeof presetRef === 'string' 
                ? { id: presetRef, type: 'builtin' } 
                : presetRef;
            
            const preset = this.getPreset(id, type);
            if (preset) {
                pack.presets.push({
                    id,
                    type,
                    name: preset.name,
                    category: preset.category
                });
            }
        }
        
        return pack;
    }
    
    /**
     * Get preset statistics
     */
    getStatistics() {
        const stats = {
            total: 0,
            byType: {},
            byCategory: {},
            cacheHitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses),
            cacheSize: this.presetCache.size
        };
        
        // Count by type
        for (const [type, presetMap] of Object.entries(this.presets)) {
            const count = presetMap.size;
            stats.byType[type] = count;
            stats.total += count;
        }
        
        // Count by category
        for (const [categoryName, category] of Object.entries(this.categories)) {
            stats.byCategory[categoryName] = category.presets.length;
        }
        
        return stats;
    }
    
    /**
     * Clear preset cache
     */
    clearCache() {
        this.presetCache.clear();
        this.cacheStats = { hits: 0, misses: 0 };
    }
    
    /**
     * Load presets from external files
     */
    async loadPresetsFromFile(filePath, type = 'community') {
        try {
            const presetData = await FileUtils.loadFile(filePath, { responseType: 'json' });
            
            if (Array.isArray(presetData)) {
                // Multiple presets
                const loaded = [];
                for (const preset of presetData) {
                    try {
                        const imported = this.importPreset(preset, { type });
                        loaded.push(imported);
                    } catch (error) {
                        console.warn(`Failed to import preset from ${filePath}:`, error);
                    }
                }
                return loaded;
            } else {
                // Single preset
                return [this.importPreset(presetData, { type })];
            }
        } catch (error) {
            console.error(`Failed to load presets from ${filePath}:`, error);
            throw error;
        }
    }
    
    /**
     * Export multiple presets as a collection
     */
    exportPresetCollection(presetRefs, options = {}) {
        const collection = {
            name: options.name || 'Preset Collection',
            description: options.description || '',
            version: '1.0.0',
            exportedAt: Date.now(),
            presets: []
        };
        
        for (const ref of presetRefs) {
            const { id, type = 'builtin' } = typeof ref === 'string' 
                ? { id: ref, type: 'builtin' } 
                : ref;
            
            const preset = this.getPreset(id, type);
            if (preset) {
                collection.presets.push(preset);
            }
        }
        
        return JSON.stringify(collection, null, 2);
    }
    
    /**
     * Get recommended presets based on current audio characteristics
     */
    getRecommendedPresets(audioData, limit = 5) {
        const recommendations = [];
        
        if (!audioData) {
            // Return popular presets if no audio data
            return this.searchPresets('', { 
                types: ['builtin', 'user'], 
                sortBy: 'name', 
                limit 
            });
        }
        
        const { bassLevel, midLevel, trebleLevel, energy, tempo } = audioData;
        
        // Determine music characteristics
        const isBassHeavy = bassLevel > 0.7;
        const isTrebleHeavy = trebleLevel > 0.7;
        const isHighEnergy = energy > 0.8;
        const isFast = tempo > 120;
        
        // Score presets based on audio characteristics
        for (const [type, presetMap] of Object.entries(this.presets)) {
            for (const [id, preset] of presetMap) {
                let score = 0;
                
                // Genre-based scoring
                if (preset.category === 'musical') {
                    score += 3;
                }
                
                // Energy-based scoring
                if (isHighEnergy && preset.category === 'energy') {
                    score += 4;
                }
                
                // Bass-heavy music preferences
                if (isBassHeavy) {
                    if (preset.tags?.includes('heavy') || preset.tags?.includes('dense')) {
                        score += 2;
                    }
                    if (preset.physical?.density > 5000) {
                        score += 1;
                    }
                }
                
                // Treble-heavy music preferences
                if (isTrebleHeavy) {
                    if (preset.tags?.includes('bright') || preset.tags?.includes('glowing')) {
                        score += 2;
                    }
                    if (preset.optical?.emission) {
                        score += 1;
                    }
                }
                
                // Fast tempo preferences
                if (isFast && preset.audioReactivity?.pulseSync) {
                    score += 2;
                }
                
                if (score > 0) {
                    recommendations.push({ id, type, preset, score });
                }
            }
        }
        
        // Sort by score and return top recommendations
        recommendations.sort((a, b) => b.score - a.score);
        return recommendations.slice(0, limit);
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        console.log('Disposing MaterialPresets...');
        
        // Clear all preset collections
        Object.values(this.presets).forEach(presetMap => presetMap.clear());
        
        // Clear cache
        this.clearCache();
        
        // Clear templates
        this.templates.clear();
        
        console.log('MaterialPresets disposed');
    }
}