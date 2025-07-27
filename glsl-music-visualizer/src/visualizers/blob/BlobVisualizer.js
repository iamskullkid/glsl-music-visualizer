/**
 * Blob Visualizer - Main Implementation
 * Primary blob visualizer combining physics, materials, and rendering
 * Extends BaseVisualizer for the physically-accurate amorphous blob
 * Location: src/visualizers/blob/BlobVisualizer.js
 */

import { BaseVisualizer } from '../base/BaseVisualizer.js';
import { BlobPhysics } from './BlobPhysics.js';
import { MaterialSystem } from './MaterialSystem.js';
import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { WebGLUtils } from '../../utils/WebGLUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';
import { vec3, vec4, mat4, quat } from 'gl-matrix';

export class BlobVisualizer extends BaseVisualizer {
    constructor(config = {}) {
        super('Blob Visualizer', {
            type: 'blob',
            version: '1.0.0',
            ...config
        });
        
        // Blob-specific configuration
        this.blobConfig = {
            // Geometry and mesh settings
            meshResolution: config.meshResolution || 64,
            meshSubdivisions: config.meshSubdivisions || 2,
            enableAdaptiveMesh: config.enableAdaptiveMesh !== false,
            enableLOD: config.enableLOD !== false,
            
            // Rendering settings
            enablePhysicallyBasedShading: config.enablePhysicallyBasedShading !== false,
            enableVolumetricEffects: config.enableVolumetricEffects !== false,
            enableCaustics: config.enableCaustics !== false,
            enableSubsurfaceScattering: config.enableSubsurfaceScattering !== false,
            
            // Material settings
            defaultMaterial: config.defaultMaterial || 'water_pure',
            enableMaterialTransitions: config.enableMaterialTransitions !== false,
            materialTransitionDuration: config.materialTransitionDuration || 2.0,
            
            // Audio reactivity
            audioReactivity: config.audioReactivity || 1.0,
            bassResponse: config.bassResponse || 1.0,
            midResponse: config.midResponse || 0.7,
            trebleResponse: config.trebleResponse || 0.5,
            beatResponse: config.beatResponse || 1.5,
            
            // Physics integration
            enablePhysics: config.enablePhysics !== false,
            enableMetaballs: config.enableMetaballs !== false,
            enableFluidSimulation: config.enableFluidSimulation !== false,
            enableParticleEffects: config.enableParticleEffects !== false,
            
            // Performance settings
            targetFPS: config.targetFPS || 60,
            adaptiveQuality: config.adaptiveQuality !== false,
            maxComplexity: config.maxComplexity || 1.0,
            enableOptimizations: config.enableOptimizations !== false
        };
        
        // Core systems
        this.physics = null;
        this.materialSystem = null;
        
        // Rendering components
        this.geometry = {
            baseGeometry: null,
            adaptiveGeometry: null,
            lodLevels: [],
            currentLOD: 0,
            needsUpdate: false
        };
        
        this.shaders = {
            vertexProgram: null,
            fragmentPrograms: new Map(),
            currentProgram: null,
            uniformLocations: new Map(),
            needsRecompile: false
        };
        
        this.uniforms = {
            // Transform matrices
            modelMatrix: mat4.create(),
            viewMatrix: mat4.create(),
            projectionMatrix: mat4.create(),
            mvpMatrix: mat4.create(),
            normalMatrix: mat4.create(),
            
            // Time and animation
            time: 0,
            deltaTime: 0,
            frameCount: 0,
            
            // Audio data
            audioEnergy: 0,
            bassLevel: 0,
            midLevel: 0,
            trebleLevel: 0,
            beatDetected: false,
            beatStrength: 0,
            
            // Material properties
            materialId: 0,
            materialType: 1,
            materialPhase: 2,
            
            // Quality and LOD
            qualityLevel: 1.0,
            lodDistance: 50.0,
            
            // Camera and lighting
            cameraPosition: vec3.create(),
            lightPosition: vec3.fromValues(10, 10, 10),
            lightColor: vec3.fromValues(1, 1, 1),
            lightIntensity: 1.0
        };
        
        // Render state
        this.renderState = {
            currentMaterial: null,
            currentLODLevel: 0,
            isTransitioning: false,
            renderTargets: new Map(),
            textures: new Map(),
            buffers: new Map()
        };
        
        // Performance tracking
        this.performanceState = {
            lastFrameTime: 0,
            frameTimeHistory: new Array(60).fill(16.67),
            frameTimeIndex: 0,
            averageFrameTime: 16.67,
            qualityLevel: 1.0,
            adaptiveQualityEnabled: true,
            lastQualityAdjustment: 0
        };
        
        console.log('BlobVisualizer initialized with config:', this.blobConfig);
    }
    
    /**
     * Initialize blob visualizer systems
     */
    async initialize(gl, canvas, integrations) {
        try {
            console.log('Initializing BlobVisualizer...');
            
            // Call base initialization first
            await this.initializeBase(gl, canvas, integrations);
            
            // Initialize core systems
            await this.initializePhysicsSystem();
            await this.initializeMaterialSystem();
            await this.initializeRenderingSystem();
            await this.initializeGeometry();
            await this.initializeShaders();
            
            // Setup cross-system integrations
            this.setupSystemIntegrations();
            
            // Initialize performance monitoring
            this.initializePerformanceMonitoring();
            
            // Set initial material
            await this.setMaterial(this.blobConfig.defaultMaterial);
            
            // Setup event handlers
            this.setupEventHandlers();
            
            this.state.isInitialized = true;
            console.log('BlobVisualizer initialization complete');
            
        } catch (error) {
            console.error('Failed to initialize BlobVisualizer:', error);
            throw error;
        }
    }
    
    /**
     * Initialize physics system
     */
    async initializePhysicsSystem() {
        if (!this.blobConfig.enablePhysics) return;
        
        this.physics = new BlobPhysics({
            enableMetaballs: this.blobConfig.enableMetaballs,
            enableFluidSim: this.blobConfig.enableFluidSimulation,
            enableParticles: this.blobConfig.enableParticleEffects,
            enableMaterialPhysics: true,
            
            // Audio reactivity
            audioReactivity: this.blobConfig.audioReactivity,
            bassResponse: this.blobConfig.bassResponse,
            midResponse: this.blobConfig.midResponse,
            trebleResponse: this.blobConfig.trebleResponse,
            beatResponse: this.blobConfig.beatResponse,
            
            // Quality settings
            qualityLevel: this.blobConfig.maxComplexity,
            adaptiveQuality: this.blobConfig.adaptiveQuality
        });
        
        await this.physics.initialize(this.gl, {
            materialManager: this.integrations.materialManager,
            renderEngine: this.integrations.renderEngine
        });
        
        console.log('✓ BlobPhysics system initialized');
    }
    
    /**
     * Initialize material system
     */
    async initializeMaterialSystem() {
        this.materialSystem = new MaterialSystem({
            enableMaterialPhysics: this.blobConfig.enablePhysics,
            enableAudioReactivity: this.blobConfig.audioReactivity > 0,
            enableTransitions: this.blobConfig.enableMaterialTransitions,
            enablePhaseChanges: true,
            
            transitionDuration: this.blobConfig.materialTransitionDuration,
            audioSensitivity: this.blobConfig.audioReactivity,
            bassInfluence: this.blobConfig.bassResponse,
            midInfluence: this.blobConfig.midResponse,
            trebleInfluence: this.blobConfig.trebleResponse,
            energyInfluence: 1.0,
            beatInfluence: this.blobConfig.beatResponse,
            
            qualityLevel: this.blobConfig.maxComplexity
        });
        
        await this.materialSystem.initialize({
            materialManager: this.integrations.materialManager,
            propertyInterpolator: this.integrations.materialManager?.interpolator,
            blobPhysics: this.physics,
            shaderManager: this.integrations.shaderManager,
            audioEngine: this.integrations.audioEngine
        });
        
        console.log('✓ MaterialSystem initialized');
    }
    
    /**
     * Initialize rendering system
     */
    async initializeRenderingSystem() {
        // Create render targets for multi-pass rendering
        await this.createRenderTargets();
        
        // Initialize textures
        await this.initializeTextures();
        
        // Setup render state
        this.setupRenderState();
        
        console.log('✓ Rendering system initialized');
    }
    
    /**
     * Initialize base geometry
     */
    async initializeGeometry() {
        const resolution = this.blobConfig.meshResolution;
        
        // Create base icosphere geometry
        this.geometry.baseGeometry = this.createIcosphereGeometry(resolution, this.blobConfig.meshSubdivisions);
        
        // Create LOD levels if enabled
        if (this.blobConfig.enableLOD) {
            this.createLODLevels();
        }
        
        // Create adaptive geometry buffers
        if (this.blobConfig.enableAdaptiveMesh) {
            this.setupAdaptiveGeometry();
        }
        
        console.log('✓ Geometry initialized');
    }
    
    /**
     * Initialize shader programs
     */
    async initializeShaders() {
        try {
            // Load vertex shader
            this.shaders.vertexProgram = await this.integrations.shaderManager.loadShader(
                'src/shaders/blob.vert',
                'vertex'
            );
            
            // Load material-specific fragment shaders
            const materialTypes = ['base', 'water', 'metal', 'fire', 'magma'];
            
            for (const materialType of materialTypes) {
                const fragmentProgram = await this.integrations.shaderManager.loadShader(
                    `src/shaders/materials/${materialType}.frag`,
                    'fragment'
                );
                this.shaders.fragmentPrograms.set(materialType, fragmentProgram);
            }
            
            // Create shader program
            await this.createShaderProgram();
            
            // Cache uniform locations
            this.cacheUniformLocations();
            
            console.log('✓ Shaders initialized');
            
        } catch (error) {
            console.error('Failed to initialize shaders:', error);
            throw error;
        }
    }
    
    /**
     * Update blob visualizer
     */
    update(deltaTime, audioData) {
        if (!this.state.isInitialized) return;
        
        // Update base
        this.updateBase(deltaTime, audioData);
        
        // Update performance tracking
        this.updatePerformanceTracking(deltaTime);
        
        // Update uniforms
        this.updateUniforms(deltaTime, audioData);
        
        // Update physics system
        if (this.physics) {
            this.physics.update(deltaTime, audioData);
        }
        
        // Update material system
        if (this.materialSystem) {
            this.materialSystem.update(deltaTime, audioData);
        }
        
        // Update geometry if needed
        if (this.geometry.needsUpdate) {
            this.updateGeometry();
        }
        
        // Update adaptive quality
        if (this.blobConfig.adaptiveQuality) {
            this.updateAdaptiveQuality();
        }
        
        // Update LOD level
        if (this.blobConfig.enableLOD) {
            this.updateLODLevel();
        }
    }
    
    /**
     * Render blob visualizer
     */
    render(deltaTime, renderState) {
        if (!this.state.isInitialized || !this.state.isActive) return;
        
        const gl = this.gl;
        
        try {
            // Setup render state
            this.setupFrameRenderState(renderState);
            
            // Use shader program
            const program = this.shaders.currentProgram;
            if (!program) return;
            
            gl.useProgram(program);
            
            // Update material system uniforms
            if (this.materialSystem) {
                this.materialSystem.updateShaderUniforms(program);
            }
            
            // Set all uniforms
            this.setAllUniforms();
            
            // Bind geometry
            this.bindGeometry();
            
            // Perform multi-pass rendering if enabled
            if (this.blobConfig.enableVolumetricEffects || this.blobConfig.enableSubsurfaceScattering) {
                this.renderMultiPass(deltaTime);
            } else {
                this.renderSinglePass();
            }
            
            // Render particle effects if enabled
            if (this.blobConfig.enableParticleEffects && this.physics?.particleSystem) {
                this.renderParticleEffects();
            }
            
            // Update render statistics
            this.updateRenderStatistics();
            
        } catch (error) {
            console.error('BlobVisualizer render error:', error);
        }
    }
    
    /**
     * Set material by ID
     */
    async setMaterial(materialId, options = {}) {
        try {
            if (this.materialSystem) {
                await this.materialSystem.setMaterial(materialId, options);
                
                // Update shader program if material type changed
                const materialProps = this.materialSystem.getMaterialProperties();
                if (materialProps && this.needsShaderUpdate(materialProps)) {
                    await this.updateShaderProgram(materialProps);
                }
                
                this.renderState.currentMaterial = materialId;
                console.log(`BlobVisualizer: Material set to ${materialId}`);
            }
        } catch (error) {
            console.error('Failed to set material:', error);
        }
    }
    
    /**
     * Resize visualizer
     */
    resize(width, height) {
        // Update viewport
        this.gl.viewport(0, 0, width, height);
        
        // Update projection matrix
        const aspect = width / height;
        mat4.perspective(this.uniforms.projectionMatrix, Math.PI / 4, aspect, 0.1, 1000.0);
        
        // Recreate render targets if needed
        if (this.blobConfig.enableVolumetricEffects) {
            this.recreateRenderTargets(width, height);
        }
        
        // Update LOD calculations
        if (this.blobConfig.enableLOD) {
            this.updateLODSettings(width, height);
        }
        
        console.log(`BlobVisualizer resized to ${width}x${height}`);
    }
    
    // ===== PRIVATE METHODS =====
    
    /**
     * Setup system integrations
     */
    setupSystemIntegrations() {
        // Connect physics to material system
        if (this.physics && this.materialSystem) {
            this.physics.setIntegrations({
                materialManager: this.integrations.materialManager,
                materialSystem: this.materialSystem
            });
            
            this.materialSystem.integrations.blobPhysics = this.physics;
        }
        
        console.log('✓ System integrations setup complete');
    }
    
    /**
     * Update uniforms
     */
    updateUniforms(deltaTime, audioData) {
        // Update time uniforms
        this.uniforms.time += deltaTime;
        this.uniforms.deltaTime = deltaTime;
        this.uniforms.frameCount++;
        
        // Update audio uniforms
        if (audioData && audioData.features) {
            this.uniforms.audioEnergy = audioData.features.energy || 0;
            this.uniforms.bassLevel = audioData.features.bass || 0;
            this.uniforms.midLevel = audioData.features.mid || 0;
            this.uniforms.trebleLevel = audioData.features.treble || 0;
            this.uniforms.beatDetected = audioData.features.beat || false;
            this.uniforms.beatStrength = audioData.features.beatStrength || 0;
        }
        
        // Update material uniforms
        if (this.materialSystem) {
            const materialProps = this.materialSystem.getMaterialProperties();
            if (materialProps) {
                this.uniforms.materialId = materialProps.id || 0;
                this.uniforms.materialType = materialProps.type || 1;
                this.uniforms.materialPhase = materialProps.phase || 2;
            }
        }
        
        // Update camera uniforms
        if (this.integrations.renderEngine) {
            const camera = this.integrations.renderEngine.getCamera();
            if (camera) {
                vec3.copy(this.uniforms.cameraPosition, camera.position);
                mat4.copy(this.uniforms.viewMatrix, camera.viewMatrix);
                mat4.copy(this.uniforms.projectionMatrix, camera.projectionMatrix);
            }
        }
        
        // Update MVP matrix
        mat4.multiply(this.uniforms.mvpMatrix, this.uniforms.projectionMatrix, this.uniforms.viewMatrix);
        mat4.multiply(this.uniforms.mvpMatrix, this.uniforms.mvpMatrix, this.uniforms.modelMatrix);
        
        // Update normal matrix
        mat4.invert(this.uniforms.normalMatrix, this.uniforms.modelMatrix);
        mat4.transpose(this.uniforms.normalMatrix, this.uniforms.normalMatrix);
        
        // Update quality level
        this.uniforms.qualityLevel = this.performanceState.qualityLevel;
    }
    
    /**
     * Create icosphere geometry
     */
    createIcosphereGeometry(resolution, subdivisions) {
        const geometry = WebGLUtils.createIcosphere(resolution, subdivisions);
        
        // Create WebGL buffers
        const gl = this.gl;
        
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
        
        const normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
        
        const uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geometry.uvs, gl.STATIC_DRAW);
        
        const tangentBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geometry.tangents, gl.STATIC_DRAW);
        
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
        
        return {
            vertexBuffer,
            normalBuffer,
            uvBuffer,
            tangentBuffer,
            indexBuffer,
            vertexCount: geometry.vertices.length / 3,
            indexCount: geometry.indices.length,
            bounds: geometry.bounds
        };
    }
    
    /**
     * Create LOD levels
     */
    createLODLevels() {
        const baseLOD = this.blobConfig.meshResolution;
        const lodLevels = [1.0, 0.75, 0.5, 0.25];
        
        this.geometry.lodLevels = lodLevels.map(factor => {
            const resolution = Math.max(8, Math.floor(baseLOD * factor));
            const subdivisions = Math.max(0, Math.floor(this.blobConfig.meshSubdivisions * factor));
            return this.createIcosphereGeometry(resolution, subdivisions);
        });
        
        console.log(`✓ Created ${this.geometry.lodLevels.length} LOD levels`);
    }
    
    /**
     * Create shader program
     */
    async createShaderProgram() {
        const vertexShader = this.shaders.vertexProgram;
        const fragmentShader = this.shaders.fragmentPrograms.get('base'); // Default to base material
        
        if (!vertexShader || !fragmentShader) {
            throw new Error('Missing vertex or fragment shader');
        }
        
        this.shaders.currentProgram = await this.integrations.shaderManager.createProgram(
            vertexShader,
            fragmentShader,
            'blob_visualizer'
        );
        
        return this.shaders.currentProgram;
    }
    
    /**
     * Cache uniform locations
     */
    cacheUniformLocations() {
        const gl = this.gl;
        const program = this.shaders.currentProgram;
        
        if (!program) return;
        
        // Transform uniforms
        this.cacheUniform('u_modelMatrix');
        this.cacheUniform('u_viewMatrix');
        this.cacheUniform('u_projectionMatrix');
        this.cacheUniform('u_mvpMatrix');
        this.cacheUniform('u_normalMatrix');
        
        // Time uniforms
        this.cacheUniform('u_time');
        this.cacheUniform('u_deltaTime');
        
        // Audio uniforms
        this.cacheUniform('u_audioEnergy');
        this.cacheUniform('u_bassLevel');
        this.cacheUniform('u_midLevel');
        this.cacheUniform('u_trebleLevel');
        this.cacheUniform('u_beatDetected');
        this.cacheUniform('u_beatStrength');
        this.cacheUniform('u_audioReactivity');
        
        // Material uniforms
        this.cacheUniform('u_materialId');
        this.cacheUniform('u_materialType');
        this.cacheUniform('u_materialPhase');
        
        // Quality uniforms
        this.cacheUniform('u_qualityLevel');
        this.cacheUniform('u_lodDistance');
        
        // Camera and lighting
        this.cacheUniform('u_cameraPosition');
        this.cacheUniform('u_lightPosition');
        this.cacheUniform('u_lightColor');
        this.cacheUniform('u_lightIntensity');
        
        console.log(`✓ Cached ${this.shaders.uniformLocations.size} uniform locations`);
    }
    
    /**
     * Cache single uniform location
     */
    cacheUniform(name) {
        const gl = this.gl;
        const program = this.shaders.currentProgram;
        const location = gl.getUniformLocation(program, name);
        if (location !== null) {
            this.shaders.uniformLocations.set(name, location);
        }
    }
    
    /**
     * Set all uniforms
     */
    setAllUniforms() {
        const gl = this.gl;
        
        // Transform matrices
        this.setUniform('u_modelMatrix', this.uniforms.modelMatrix);
        this.setUniform('u_viewMatrix', this.uniforms.viewMatrix);
        this.setUniform('u_projectionMatrix', this.uniforms.projectionMatrix);
        this.setUniform('u_mvpMatrix', this.uniforms.mvpMatrix);
        this.setUniform('u_normalMatrix', this.uniforms.normalMatrix);
        
        // Time
        this.setUniform('u_time', this.uniforms.time);
        this.setUniform('u_deltaTime', this.uniforms.deltaTime);
        
        // Audio
        this.setUniform('u_audioEnergy', this.uniforms.audioEnergy);
        this.setUniform('u_bassLevel', this.uniforms.bassLevel);
        this.setUniform('u_midLevel', this.uniforms.midLevel);
        this.setUniform('u_trebleLevel', this.uniforms.trebleLevel);
        this.setUniform('u_beatDetected', this.uniforms.beatDetected ? 1.0 : 0.0);
        this.setUniform('u_beatStrength', this.uniforms.beatStrength);
        this.setUniform('u_audioReactivity', this.blobConfig.audioReactivity);
        
        // Material
        this.setUniform('u_materialId', this.uniforms.materialId);
        this.setUniform('u_materialType', this.uniforms.materialType);
        this.setUniform('u_materialPhase', this.uniforms.materialPhase);
        
        // Quality
        this.setUniform('u_qualityLevel', this.uniforms.qualityLevel);
        this.setUniform('u_lodDistance', this.uniforms.lodDistance);
        
        // Camera and lighting
        this.setUniform('u_cameraPosition', this.uniforms.cameraPosition);
        this.setUniform('u_lightPosition', this.uniforms.lightPosition);
        this.setUniform('u_lightColor', this.uniforms.lightColor);
        this.setUniform('u_lightIntensity', this.uniforms.lightIntensity);
    }
    
    /**
     * Set individual uniform
     */
    setUniform(name, value) {
        const gl = this.gl;
        const location = this.shaders.uniformLocations.get(name);
        
        if (location === null || location === undefined) return;
        
        // Determine uniform type and set accordingly
        if (typeof value === 'number') {
            gl.uniform1f(location, value);
        } else if (value instanceof Float32Array) {
            if (value.length === 16) {
                gl.uniformMatrix4fv(location, false, value);
            } else if (value.length === 9) {
                gl.uniformMatrix3fv(location, false, value);
            } else if (value.length === 4) {
                gl.uniform4fv(location, value);
            } else if (value.length === 3) {
                gl.uniform3fv(location, value);
            } else if (value.length === 2) {
                gl.uniform2fv(location, value);
            }
        } else if (Array.isArray(value)) {
            if (value.length === 4) {
                gl.uniform4f(location, value[0], value[1], value[2], value[3]);
            } else if (value.length === 3) {
                gl.uniform3f(location, value[0], value[1], value[2]);
            } else if (value.length === 2) {
                gl.uniform2f(location, value[0], value[1]);
            }
        }
    }
    
    /**
     * Bind geometry buffers
     */
    bindGeometry() {
        const gl = this.gl;
        const geometry = this.getCurrentGeometry();
        
        if (!geometry) return;
        
        // Bind vertex positions
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry.vertexBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        
        // Bind normals
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry.normalBuffer);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        
        // Bind UVs
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry.uvBuffer);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        
        // Bind tangents
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry.tangentBuffer);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
        
        // Bind indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indexBuffer);
    }
    
    /**
     * Get current geometry based on LOD
     */
    getCurrentGeometry() {
        if (this.blobConfig.enableLOD && this.geometry.lodLevels.length > 0) {
            const lodIndex = Math.min(this.renderState.currentLODLevel, this.geometry.lodLevels.length - 1);
            return this.geometry.lodLevels[lodIndex];
        }
        return this.geometry.baseGeometry;
    }
    
    /**
     * Render single pass
     */
    renderSinglePass() {
        const gl = this.gl;
        const geometry = this.getCurrentGeometry();
        
        if (!geometry) return;
        
        // Set render state
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        
        if (this.blobConfig.enableBlending) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
        
        // Draw geometry
        gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_SHORT, 0);
        
        // Update statistics
        this.performanceMetrics.triangles += geometry.indexCount / 3;
        this.performanceMetrics.drawCalls++;
    }
    
    /**
     * Update performance tracking
     */
    updatePerformanceTracking(deltaTime) {
        const frameTime = deltaTime * 1000; // Convert to milliseconds
        
        // Update frame time history
        this.performanceState.frameTimeHistory[this.performanceState.frameTimeIndex] = frameTime;
        this.performanceState.frameTimeIndex = (this.performanceState.frameTimeIndex + 1) % 60;
        
        // Calculate average frame time
        this.performanceState.averageFrameTime = this.performanceState.frameTimeHistory.reduce((a, b) => a + b, 0) / 60;
        
        // Update last frame time for adaptive quality
        this.performanceState.lastFrameTime = frameTime;
        
        // Record performance metrics
        if (performanceMonitor) {
            performanceMonitor.recordCPUTime('blobVisualizer', frameTime);
        }
    }
    
    /**
     * Update adaptive quality based on performance
     */
    updateAdaptiveQuality() {
        if (!this.performanceState.adaptiveQualityEnabled) return;
        
        const targetFrameTime = 1000 / this.blobConfig.targetFPS;
        const currentFrameTime = this.performanceState.averageFrameTime;
        const now = performance.now();
        
        // Only adjust quality every 2 seconds to avoid oscillation
        if (now - this.performanceState.lastQualityAdjustment < 2000) return;
        
        let newQualityLevel = this.performanceState.qualityLevel;
        
        // If we're consistently above target frame time, decrease quality
        if (currentFrameTime > targetFrameTime * 1.2) {
            newQualityLevel = Math.max(0.25, this.performanceState.qualityLevel - 0.1);
        }
        // If we're consistently below target, increase quality
        else if (currentFrameTime < targetFrameTime * 0.8 && this.performanceState.qualityLevel < 1.0) {
            newQualityLevel = Math.min(1.0, this.performanceState.qualityLevel + 0.05);
        }
        
        if (newQualityLevel !== this.performanceState.qualityLevel) {
            this.performanceState.qualityLevel = newQualityLevel;
            this.performanceState.lastQualityAdjustment = now;
            this.applyQualitySettings(newQualityLevel);
            
            console.log(`BlobVisualizer: Quality adjusted to ${(newQualityLevel * 100).toFixed(0)}%`);
        }
    }
    
    /**
     * Apply quality settings
     */
    applyQualitySettings(qualityLevel) {
        // Update physics quality
        if (this.physics) {
            this.physics.updateConfig({
                qualityLevel: qualityLevel,
                adaptiveQuality: true
            });
        }
        
        // Update material system quality
        if (this.materialSystem) {
            this.materialSystem.config.qualityLevel = qualityLevel;
        }
        
        // Update render settings based on quality
        this.blobConfig.maxComplexity = qualityLevel;
        
        // Trigger geometry update if LOD is enabled
        if (this.blobConfig.enableLOD) {
            this.geometry.needsUpdate = true;
        }
    }
    
    /**
     * Update LOD level based on camera distance and performance
     */
    updateLODLevel() {
        if (!this.blobConfig.enableLOD || this.geometry.lodLevels.length === 0) return;
        
        // Calculate distance from camera
        const cameraPos = this.uniforms.cameraPosition;
        const blobPos = [0, 0, 0]; // Blob is at origin
        const distance = vec3.distance(cameraPos, blobPos);
        
        // Determine LOD level based on distance and performance
        let lodLevel = 0;
        const qualityFactor = this.performanceState.qualityLevel;
        
        if (distance > 50 * qualityFactor) {
            lodLevel = 3; // Lowest detail
        } else if (distance > 30 * qualityFactor) {
            lodLevel = 2;
        } else if (distance > 15 * qualityFactor) {
            lodLevel = 1;
        } else {
            lodLevel = 0; // Highest detail
        }
        
        // Clamp to available LOD levels
        lodLevel = Math.min(lodLevel, this.geometry.lodLevels.length - 1);
        
        if (lodLevel !== this.renderState.currentLODLevel) {
            this.renderState.currentLODLevel = lodLevel;
            console.log(`BlobVisualizer: LOD level changed to ${lodLevel}`);
        }
    }
    
    /**
     * Create render targets for multi-pass rendering
     */
    async createRenderTargets() {
        if (!this.blobConfig.enableVolumetricEffects && !this.blobConfig.enableSubsurfaceScattering) {
            return;
        }
        
        const gl = this.gl;
        const canvas = this.canvas;
        
        // Create depth pre-pass target
        this.renderState.renderTargets.set('depth', WebGLUtils.createRenderTarget(
            gl, canvas.width, canvas.height, { depth: true, color: false }
        ));
        
        // Create subsurface scattering targets
        if (this.blobConfig.enableSubsurfaceScattering) {
            this.renderState.renderTargets.set('sss_front', WebGLUtils.createRenderTarget(
                gl, canvas.width, canvas.height, { format: gl.RGBA16F }
            ));
            this.renderState.renderTargets.set('sss_back', WebGLUtils.createRenderTarget(
                gl, canvas.width, canvas.height, { format: gl.RGBA16F }
            ));
        }
        
        // Create volumetric lighting target
        if (this.blobConfig.enableVolumetricEffects) {
            this.renderState.renderTargets.set('volumetric', WebGLUtils.createRenderTarget(
                gl, canvas.width / 2, canvas.height / 2, { format: gl.RGBA8 }
            ));
        }
        
        console.log('✓ Render targets created');
    }
    
    /**
     * Initialize textures
     */
    async initializeTextures() {
        // Create noise textures for procedural effects
        this.renderState.textures.set('noise3D', WebGLUtils.createNoise3DTexture(this.gl, 64));
        this.renderState.textures.set('noise2D', WebGLUtils.createNoise2DTexture(this.gl, 256));
        
        // Create lookup tables for material properties
        this.renderState.textures.set('materialLUT', WebGLUtils.createMaterialLookupTexture(this.gl));
        
        console.log('✓ Textures initialized');
    }
    
    /**
     * Setup render state
     */
    setupRenderState() {
        const gl = this.gl;
        
        // Enable necessary extensions
        const extensions = [
            'OES_standard_derivatives',
            'EXT_shader_texture_lod',
            'WEBGL_depth_texture'
        ];
        
        extensions.forEach(ext => {
            const extension = gl.getExtension(ext);
            if (!extension) {
                console.warn(`Extension ${ext} not available`);
            }
        });
        
        // Set initial GL state
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        
        console.log('✓ Render state setup complete');
    }
    
    /**
     * Setup adaptive geometry for dynamic mesh resolution
     */
    setupAdaptiveGeometry() {
        // Create vertex buffers that can be dynamically updated
        const gl = this.gl;
        
        // Create adaptive geometry buffers
        this.geometry.adaptiveGeometry = {
            vertexBuffer: gl.createBuffer(),
            normalBuffer: gl.createBuffer(),
            uvBuffer: gl.createBuffer(),
            tangentBuffer: gl.createBuffer(),
            indexBuffer: gl.createBuffer(),
            needsUpdate: true
        };
        
        console.log('✓ Adaptive geometry setup complete');
    }
    
    /**
     * Update geometry based on audio and performance
     */
    updateGeometry() {
        if (!this.geometry.needsUpdate) return;
        
        // TODO: Implement dynamic geometry updates based on audio data
        // This would involve modifying vertex positions based on metaball influence
        // and audio reactivity
        
        this.geometry.needsUpdate = false;
    }
    
    /**
     * Setup frame render state
     */
    setupFrameRenderState(renderState) {
        const gl = this.gl;
        
        // Clear render targets if using multi-pass
        if (this.blobConfig.enableVolumetricEffects || this.blobConfig.enableSubsurfaceScattering) {
            this.clearRenderTargets();
        }
        
        // Setup viewport
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Set blend mode based on material
        if (this.materialSystem) {
            const materialProps = this.materialSystem.getMaterialProperties();
            if (materialProps && materialProps.properties.optical.transparency > 0.1) {
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            } else {
                gl.disable(gl.BLEND);
            }
        }
    }
    
    /**
     * Clear render targets
     */
    clearRenderTargets() {
        const gl = this.gl;
        
        for (const [name, target] of this.renderState.renderTargets) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }
        
        // Bind back to default framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    /**
     * Render multi-pass for advanced effects
     */
    renderMultiPass(deltaTime) {
        // 1. Depth pre-pass
        if (this.blobConfig.enableSubsurfaceScattering) {
            this.renderDepthPass();
        }
        
        // 2. Front face pass for subsurface scattering
        if (this.blobConfig.enableSubsurfaceScattering) {
            this.renderSubsurfaceFrontPass();
        }
        
        // 3. Back face pass for subsurface scattering
        if (this.blobConfig.enableSubsurfaceScattering) {
            this.renderSubsurfaceBackPass();
        }
        
        // 4. Volumetric pass
        if (this.blobConfig.enableVolumetricEffects) {
            this.renderVolumetricPass();
        }
        
        // 5. Final composite pass
        this.renderCompositePass();
    }
    
    /**
     * Render depth pass
     */
    renderDepthPass() {
        const gl = this.gl;
        const depthTarget = this.renderState.renderTargets.get('depth');
        
        if (!depthTarget) return;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, depthTarget.framebuffer);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        
        // Render geometry with depth-only shader
        // (Implementation would use a simpler shader for depth-only rendering)
        this.renderSinglePass();
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    /**
     * Render subsurface scattering front pass
     */
    renderSubsurfaceFrontPass() {
        const gl = this.gl;
        const frontTarget = this.renderState.renderTargets.get('sss_front');
        
        if (!frontTarget) return;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, frontTarget.framebuffer);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Render front faces
        gl.cullFace(gl.BACK);
        this.renderSinglePass();
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    /**
     * Render subsurface scattering back pass
     */
    renderSubsurfaceBackPass() {
        const gl = this.gl;
        const backTarget = this.renderState.renderTargets.get('sss_back');
        
        if (!backTarget) return;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, backTarget.framebuffer);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Render back faces
        gl.cullFace(gl.FRONT);
        this.renderSinglePass();
        
        // Restore normal culling
        gl.cullFace(gl.BACK);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    /**
     * Render volumetric effects pass
     */
    renderVolumetricPass() {
        const gl = this.gl;
        const volumetricTarget = this.renderState.renderTargets.get('volumetric');
        
        if (!volumetricTarget) return;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, volumetricTarget.framebuffer);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Render volumetric effects at lower resolution
        gl.viewport(0, 0, volumetricTarget.width, volumetricTarget.height);
        
        // Use volumetric shader variant
        // (Implementation would switch to volumetric fragment shader)
        this.renderSinglePass();
        
        // Restore full resolution
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    
    /**
     * Render final composite pass
     */
    renderCompositePass() {
        const gl = this.gl;
        
        // Bind all render target textures
        let textureUnit = 0;
        for (const [name, target] of this.renderState.renderTargets) {
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, target.colorTexture);
            textureUnit++;
        }
        
        // Render final composite
        this.renderSinglePass();
    }
    
    /**
     * Render particle effects
     */
    renderParticleEffects() {
        if (!this.physics || !this.physics.particleSystem) return;
        
        const gl = this.gl;
        
        // Setup particle rendering state
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.depthMask(false);
        
        // Render particles
        this.physics.particleSystem.render(this.uniforms.mvpMatrix);
        
        // Restore render state
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
    
    /**
     * Update render statistics
     */
    updateRenderStatistics() {
        const geometry = this.getCurrentGeometry();
        if (geometry) {
            this.performanceMetrics.triangles += geometry.indexCount / 3;
            this.performanceMetrics.vertices += geometry.vertexCount;
        }
        this.performanceMetrics.drawCalls++;
    }
    
    /**
     * Check if shader needs update based on material properties
     */
    needsShaderUpdate(materialProps) {
        const currentMaterialType = materialProps.type;
        const requiredShader = this.getRequiredShaderType(materialProps);
        
        return !this.shaders.fragmentPrograms.has(requiredShader) || 
               this.shaders.needsRecompile;
    }
    
    /**
     * Get required shader type based on material properties
     */
    getRequiredShaderType(materialProps) {
        if (!materialProps) return 'base';
        
        const materialId = materialProps.id;
        
        if (materialId.includes('water')) return 'water';
        if (materialId.includes('metal')) return 'metal';
        if (materialId.includes('fire')) return 'fire';
        if (materialId.includes('magma')) return 'magma';
        
        return 'base';
    }
    
    /**
     * Update shader program based on material
     */
    async updateShaderProgram(materialProps) {
        const requiredShaderType = this.getRequiredShaderType(materialProps);
        const fragmentShader = this.shaders.fragmentPrograms.get(requiredShaderType);
        
        if (!fragmentShader) {
            console.warn(`No fragment shader found for material type: ${requiredShaderType}`);
            return;
        }
        
        // Create new shader program
        this.shaders.currentProgram = await this.integrations.shaderManager.createProgram(
            this.shaders.vertexProgram,
            fragmentShader,
            `blob_visualizer_${requiredShaderType}`
        );
        
        // Update uniform locations
        this.cacheUniformLocations();
        
        console.log(`BlobVisualizer: Shader program updated for material type: ${requiredShaderType}`);
    }
    
    /**
     * Recreate render targets on resize
     */
    recreateRenderTargets(width, height) {
        // Dispose old render targets
        for (const [name, target] of this.renderState.renderTargets) {
            WebGLUtils.disposeRenderTarget(this.gl, target);
        }
        
        this.renderState.renderTargets.clear();
        
        // Create new render targets with new dimensions
        this.createRenderTargets();
    }
    
    /**
     * Update LOD settings based on viewport
     */
    updateLODSettings(width, height) {
        // Adjust LOD distance based on resolution
        const pixelDensity = Math.sqrt(width * height) / 1000;
        this.uniforms.lodDistance = 50.0 * pixelDensity;
    }
    
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Listen for material changes
        if (this.materialSystem) {
            // Material system events are handled in setupSystemIntegrations
        }
        
        // Listen for physics events
        if (this.physics) {
            this.physics.on?.('performanceChanged', (metrics) => {
                this.onPhysicsPerformanceChanged(metrics);
            });
            
            this.physics.on?.('materialChanged', (material) => {
                this.onMaterialChanged(material);
            });
        }
        
        // Listen for audio engine events
        if (this.integrations.audioEngine) {
            this.integrations.audioEngine.on?.('audioProcessed', (audioData) => {
                this.onAudioProcessed(audioData);
            });
        }
    }
    
    /**
     * Handle physics performance changes
     */
    onPhysicsPerformanceChanged(metrics) {
        // Adjust visualizer settings based on physics performance
        if (metrics.averageUpdateTime > 10) {
            // Physics is running slow, reduce quality
            this.applyQualitySettings(Math.max(0.5, this.performanceState.qualityLevel - 0.1));
        }
    }
    
    /**
     * Handle material changes
     */
    onMaterialChanged(material) {
        console.log(`BlobVisualizer: Material changed to ${material.id}`);
        
        // Update render state
        this.renderState.isTransitioning = true;
        
        // Set transition end callback
        setTimeout(() => {
            this.renderState.isTransitioning = false;
        }, this.blobConfig.materialTransitionDuration * 1000);
    }
    
    /**
     * Handle processed audio data
     */
    onAudioProcessed(audioData) {
        // Update audio-reactive uniforms
        this.updateUniforms(0, audioData);
    }
    
    /**
     * Get current performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            averageFrameTime: this.performanceState.averageFrameTime,
            qualityLevel: this.performanceState.qualityLevel,
            currentLODLevel: this.renderState.currentLODLevel,
            physics: this.physics?.getPerformanceMetrics?.() || null,
            materialSystem: this.materialSystem?.getPerformanceMetrics?.() || null
        };
    }
    
    /**
     * Get visualizer status
     */
    getStatus() {
        return {
            ...this.getInfo(),
            renderState: {
                currentMaterial: this.renderState.currentMaterial,
                currentLODLevel: this.renderState.currentLODLevel,
                isTransitioning: this.renderState.isTransitioning
            },
            performance: this.getPerformanceMetrics(),
            systems: {
                physics: this.physics?.getStatus?.() || null,
                materialSystem: this.materialSystem?.getMaterialProperties?.() || null
            }
        };
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        console.log('BlobVisualizer: Cleaning up resources...');
        
        // Destroy physics systems
        if (this.physics) {
            this.physics.destroy?.();
        }
        
        // Destroy material system
        if (this.materialSystem) {
            this.materialSystem.destroy?.();
        }
        
        // Dispose render targets
        for (const [name, target] of this.renderState.renderTargets) {
            WebGLUtils.disposeRenderTarget(this.gl, target);
        }
        
        // Dispose textures
        for (const [name, texture] of this.renderState.textures) {
            this.gl.deleteTexture(texture);
        }
        
        // Dispose geometry buffers
        if (this.geometry.baseGeometry) {
            const geo = this.geometry.baseGeometry;
            this.gl.deleteBuffer(geo.vertexBuffer);
            this.gl.deleteBuffer(geo.normalBuffer);
            this.gl.deleteBuffer(geo.uvBuffer);
            this.gl.deleteBuffer(geo.tangentBuffer);
            this.gl.deleteBuffer(geo.indexBuffer);
        }
        
        // Dispose LOD geometry
        this.geometry.lodLevels.forEach(geo => {
            this.gl.deleteBuffer(geo.vertexBuffer);
            this.gl.deleteBuffer(geo.normalBuffer);
            this.gl.deleteBuffer(geo.uvBuffer);
            this.gl.deleteBuffer(geo.tangentBuffer);
            this.gl.deleteBuffer(geo.indexBuffer);
        });
        
        console.log('BlobVisualizer: Cleanup complete');
    }
}