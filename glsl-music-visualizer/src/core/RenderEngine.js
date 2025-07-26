/**
 * Render Engine
 * Advanced WebGL rendering pipeline for the GLSL music visualizer
 * Handles framebuffers, post-processing, scene management, and optimization
 */

import { mat4, vec3 } from 'gl-matrix';
import { webglUtils } from '../utils/WebGLUtils.js';
import { MathUtils } from '../utils/MathUtils.js';
import { shaderManager } from './ShaderManager.js';
import { performanceMonitor } from './PerformanceMonitor.js';

export class RenderEngine {
    constructor() {
        this.gl = null;
        this.canvas = null;
        
        // Rendering state
        this.viewport = { x: 0, y: 0, width: 0, height: 0 };
        this.aspectRatio = 1.0;
        this.pixelRatio = 1.0;
        this.renderScale = 1.0; // For adaptive quality
        
        // Framebuffers
        this.framebuffers = new Map();
        this.currentFramebuffer = null;
        this.defaultFramebuffer = null;
        
        // Render targets
        this.renderTargets = {
            main: null,
            depth: null,
            postProcess: null,
            bloom: null,
            temp: null
        };
        
        // Camera system
        this.camera = {
            position: vec3.fromValues(0, 0, 5),
            target: vec3.fromValues(0, 0, 0),
            up: vec3.fromValues(0, 1, 0),
            fov: Math.PI / 4,
            near: 0.1,
            far: 1000.0,
            viewMatrix: mat4.create(),
            projectionMatrix: mat4.create(),
            viewProjectionMatrix: mat4.create()
        };
        
        // Lighting system
        this.lights = [];
        this.ambientLight = vec3.fromValues(0.1, 0.1, 0.1);
        this.lightingUniforms = new Map();
        
        // Post-processing pipeline
        this.postProcessing = {
            enabled: true,
            effects: new Map(),
            passes: [],
            quadGeometry: null
        };
        
        // Render statistics
        this.stats = {
            drawCalls: 0,
            triangles: 0,
            vertices: 0,
            textureBinds: 0,
            framebufferSwitches: 0,
            renderTargetSwitches: 0
        };
        
        // Quality settings
        this.quality = {
            resolution: 1.0,
            msaa: false,
            shadows: true,
            reflections: true,
            postProcessing: true,
            maxLights: 8
        };
        
        // Render queues
        this.renderQueues = {
            opaque: [],
            transparent: [],
            ui: []
        };
        
        // State management
        this.renderState = {
            depthTest: true,
            depthWrite: true,
            blending: false,
            cullFace: true,
            cullMode: 'back'
        };
        
        // Debug options
        this.debug = {
            wireframe: false,
            showFramebuffers: false,
            showStats: process.env.NODE_ENV === 'development'
        };
        
        this.isInitialized = false;
    }
    
    /**
     * Initialize the render engine
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {Object} options - Initialization options
     */
    initialize(canvas, options = {}) {
        this.canvas = canvas;
        
        // Create WebGL context
        this.gl = webglUtils.createContext(canvas, {
            antialias: options.antialias !== false,
            alpha: options.alpha !== false,
            depth: true,
            stencil: false,
            preserveDrawingBuffer: options.preserveDrawingBuffer || false,
            powerPreference: 'high-performance'
        });
        
        // Initialize shader manager
        shaderManager.initialize(this.gl);
        
        // Setup viewport
        this.updateViewport();
        
        // Initialize render targets
        this.initializeRenderTargets();
        
        // Setup post-processing
        this.initializePostProcessing();
        
        // Initialize camera
        this.updateCamera();
        
        // Setup WebGL state
        this.setupWebGLState();
        
        // Load default shaders
        this.loadDefaultShaders();
        
        this.isInitialized = true;
        
        console.log('RenderEngine initialized', {
            webglVersion: this.gl instanceof WebGL2RenderingContext ? '2.0' : '1.0',
            viewport: this.viewport,
            pixelRatio: this.pixelRatio
        });
        
        return this.gl;
    }
    
    /**
     * Update viewport and canvas size
     */
    updateViewport() {
        if (!this.canvas) return;
        
        // Get device pixel ratio for high DPI displays
        this.pixelRatio = window.devicePixelRatio || 1;
        
        // Calculate canvas size
        const rect = this.canvas.getBoundingClientRect();
        const width = Math.floor(rect.width * this.pixelRatio * this.renderScale);
        const height = Math.floor(rect.height * this.pixelRatio * this.renderScale);
        
        // Update canvas size if needed
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            
            // Update viewport
            this.viewport = { x: 0, y: 0, width, height };
            this.aspectRatio = width / height;
            
            if (this.gl) {
                this.gl.viewport(0, 0, width, height);
                
                // Recreate render targets with new size
                this.recreateRenderTargets();
                
                // Update camera projection
                this.updateCamera();
            }
        }
    }
    
    /**
     * Initialize render targets
     */
    initializeRenderTargets() {
        const { width, height } = this.viewport;
        
        // Main render target (HDR)
        this.renderTargets.main = this.createRenderTarget(width, height, {
            format: this.gl.RGBA,
            type: webglUtils.hasExtension('EXT_color_buffer_float') ? this.gl.FLOAT : this.gl.UNSIGNED_BYTE,
            filter: this.gl.LINEAR,
            depth: true
        });
        
        // Depth-only target for shadow mapping
        this.renderTargets.depth = this.createRenderTarget(1024, 1024, {
            format: this.gl.DEPTH_COMPONENT,
            type: this.gl.UNSIGNED_SHORT,
            filter: this.gl.NEAREST,
            depth: false,
            depthOnly: true
        });
        
        // Post-processing targets
        this.renderTargets.postProcess = this.createRenderTarget(width, height, {
            format: this.gl.RGBA,
            type: this.gl.UNSIGNED_BYTE,
            filter: this.gl.LINEAR
        });
        
        this.renderTargets.temp = this.createRenderTarget(width, height, {
            format: this.gl.RGBA,
            type: this.gl.UNSIGNED_BYTE,
            filter: this.gl.LINEAR
        });
        
        // Bloom targets (quarter resolution)
        this.renderTargets.bloom = this.createRenderTarget(width / 4, height / 4, {
            format: this.gl.RGBA,
            type: this.gl.UNSIGNED_BYTE,
            filter: this.gl.LINEAR
        });
    }
    
    /**
     * Create render target
     * @param {number} width - Target width
     * @param {number} height - Target height
     * @param {Object} options - Render target options
     * @returns {Object} Render target object
     */
    createRenderTarget(width, height, options = {}) {
        const {
            format = this.gl.RGBA,
            type = this.gl.UNSIGNED_BYTE,
            filter = this.gl.LINEAR,
            wrap = this.gl.CLAMP_TO_EDGE,
            depth = false,
            depthOnly = false
        } = options;
        
        return webglUtils.createFramebuffer(this.gl, {
            width,
            height,
            format: depthOnly ? this.gl.DEPTH_COMPONENT : format,
            type: depthOnly ? this.gl.UNSIGNED_SHORT : type,
            depth: depth && !depthOnly,
            minFilter: filter,
            magFilter: filter,
            wrapS: wrap,
            wrapT: wrap
        });
    }
    
    /**
     * Recreate render targets when viewport changes
     */
    recreateRenderTargets() {
        // Dispose old render targets
        Object.values(this.renderTargets).forEach(target => {
            if (target && target.framebuffer) {
                this.gl.deleteFramebuffer(target.framebuffer);
                this.gl.deleteTexture(target.colorTexture);
                if (target.depthBuffer) {
                    this.gl.deleteRenderbuffer(target.depthBuffer);
                }
            }
        });
        
        // Create new render targets
        this.initializeRenderTargets();
    }
    
    /**
     * Initialize post-processing pipeline
     */
    async initializePostProcessing() {
        // Create fullscreen quad geometry
        this.postProcessing.quadGeometry = this.createQuadGeometry();
        
        // Load post-processing shaders
        try {
            const postProcessProgram = await shaderManager.loadShaderProgram(
                'src/shaders/fullscreen.vert',
                'src/shaders/postprocess.frag',
                {},
                'postprocess'
            );
            
            this.postProcessing.effects.set('default', postProcessProgram);
            
        } catch (error) {
            console.warn('Failed to load post-processing shaders:', error);
            this.postProcessing.enabled = false;
        }
    }
    
    /**
     * Create fullscreen quad geometry
     * @returns {Object} Quad geometry buffers
     */
    createQuadGeometry() {
        const vertices = new Float32Array([
            -1, -1, 0, 0,
             1, -1, 1, 0,
            -1,  1, 0, 1,
             1,  1, 1, 1
        ]);
        
        const indices = new Uint16Array([0, 1, 2, 1, 3, 2]);
        
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
        
        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
        
        return {
            vertexBuffer,
            indexBuffer,
            vertexCount: indices.length
        };
    }
    
    /**
     * Setup initial WebGL state
     */
    setupWebGLState() {
        const gl = this.gl;
        
        // Enable depth testing
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        
        // Enable culling
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);
        
        // Set clear color
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        
        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Disable scissor test initially
        gl.disable(gl.SCISSOR_TEST);
    }
    
    /**
     * Load default shaders
     */
    async loadDefaultShaders() {
        // This would load basic shaders for rendering
        // Implementation depends on available shader files
    }
    
    /**
     * Update camera matrices
     */
    updateCamera() {
        const camera = this.camera;
        
        // Update view matrix
        mat4.lookAt(camera.viewMatrix, camera.position, camera.target, camera.up);
        
        // Update projection matrix
        mat4.perspective(
            camera.projectionMatrix,
            camera.fov,
            this.aspectRatio,
            camera.near,
            camera.far
        );
        
        // Update combined view-projection matrix
        mat4.multiply(
            camera.viewProjectionMatrix,
            camera.projectionMatrix,
            camera.viewMatrix
        );
    }
    
    /**
     * Begin frame rendering
     */
    beginFrame() {
        // Reset statistics
        this.stats.drawCalls = 0;
        this.stats.triangles = 0;
        this.stats.vertices = 0;
        this.stats.textureBinds = 0;
        this.stats.framebufferSwitches = 0;
        this.stats.renderTargetSwitches = 0;
        
        // Update viewport if canvas size changed
        this.updateViewport();
        
        // Clear render queues
        this.clearRenderQueues();
        
        // Begin performance monitoring
        performanceMonitor.beginFrame();
    }
    
    /**
     * End frame rendering
     */
    endFrame() {
        // Report statistics to performance monitor
        performanceMonitor.recordGPUStats(this.stats);
        
        // End performance monitoring
        performanceMonitor.endFrame();
    }
    
    /**
     * Clear render queues
     */
    clearRenderQueues() {
        this.renderQueues.opaque.length = 0;
        this.renderQueues.transparent.length = 0;
        this.renderQueues.ui.length = 0;
    }
    
    /**
     * Set render target
     * @param {Object|null} target - Render target or null for default framebuffer
     */
    setRenderTarget(target) {
        if (target === this.currentFramebuffer) return;
        
        const gl = this.gl;
        
        if (target) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
            gl.viewport(0, 0, target.width, target.height);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.viewport.width, this.viewport.height);
        }
        
        this.currentFramebuffer = target;
        this.stats.framebufferSwitches++;
    }
    
    /**
     * Clear current render target
     * @param {boolean} color - Clear color buffer
     * @param {boolean} depth - Clear depth buffer
     * @param {Array} clearColor - Clear color [r, g, b, a]
     */
    clear(color = true, depth = true, clearColor = [0, 0, 0, 1]) {
        const gl = this.gl;
        let mask = 0;
        
        if (color) {
            gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
            mask |= gl.COLOR_BUFFER_BIT;
        }
        
        if (depth) {
            gl.clearDepth(1.0);
            mask |= gl.DEPTH_BUFFER_BIT;
        }
        
        if (mask) {
            gl.clear(mask);
        }
    }
    
    /**
     * Draw geometry
     * @param {Object} geometry - Geometry data
     * @param {Object} material - Material properties
     * @param {Float32Array} modelMatrix - Model transformation matrix
     */
    draw(geometry, material, modelMatrix = null) {
        const gl = this.gl;
        
        // Use shader program
        const program = shaderManager.useProgram(material.program);
        
        // Set up vertex attributes
        this.setupVertexAttributes(geometry, material.program);
        
        // Set uniforms
        this.setUniforms(material, modelMatrix);
        
        // Bind textures
        this.bindTextures(material);
        
        // Set render state
        this.setRenderState(material);
        
        // Draw
        if (geometry.indexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indexBuffer);
            gl.drawElements(
                material.primitive || gl.TRIANGLES,
                geometry.indexCount,
                gl.UNSIGNED_SHORT,
                0
            );
            this.stats.triangles += geometry.indexCount / 3;
        } else {
            gl.drawArrays(
                material.primitive || gl.TRIANGLES,
                0,
                geometry.vertexCount
            );
            this.stats.triangles += geometry.vertexCount / 3;
        }
        
        this.stats.drawCalls++;
        this.stats.vertices += geometry.vertexCount;
    }
    
    /**
     * Setup vertex attributes for geometry
     * @param {Object} geometry - Geometry data
     * @param {string} programName - Shader program name
     */
    setupVertexAttributes(geometry, programName) {
        const gl = this.gl;
        
        // Bind vertex buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry.vertexBuffer);
        
        // Setup position attribute
        const positionLocation = shaderManager.getAttributeLocation(programName, 'a_position');
        if (positionLocation !== -1) {
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, geometry.stride, 0);
        }
        
        // Setup normal attribute
        const normalLocation = shaderManager.getAttributeLocation(programName, 'a_normal');
        if (normalLocation !== -1 && geometry.hasNormals) {
            gl.enableVertexAttribArray(normalLocation);
            gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, geometry.stride, 12);
        }
        
        // Setup UV attribute
        const uvLocation = shaderManager.getAttributeLocation(programName, 'a_uv');
        if (uvLocation !== -1 && geometry.hasUVs) {
            gl.enableVertexAttribArray(uvLocation);
            gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, geometry.stride, 24);
        }
    }
    
    /**
     * Set shader uniforms
     * @param {Object} material - Material properties
     * @param {Float32Array} modelMatrix - Model matrix
     */
    setUniforms(material, modelMatrix) {
        const gl = this.gl;
        const programName = material.program;
        
        // Model-View-Projection matrices
        if (modelMatrix) {
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, this.camera.viewProjectionMatrix, modelMatrix);
            
            const uMVP = shaderManager.getUniformLocation(programName, 'u_mvpMatrix');
            if (uMVP) gl.uniformMatrix4fv(uMVP, false, mvpMatrix);
            
            const uModel = shaderManager.getUniformLocation(programName, 'u_modelMatrix');
            if (uModel) gl.uniformMatrix4fv(uModel, false, modelMatrix);
        }
        
        // View matrix
        const uView = shaderManager.getUniformLocation(programName, 'u_viewMatrix');
        if (uView) gl.uniformMatrix4fv(uView, false, this.camera.viewMatrix);
        
        // Projection matrix
        const uProj = shaderManager.getUniformLocation(programName, 'u_projectionMatrix');
        if (uProj) gl.uniformMatrix4fv(uProj, false, this.camera.projectionMatrix);
        
        // Time uniform
        const uTime = shaderManager.getUniformLocation(programName, 'u_time');
        if (uTime) gl.uniform1f(uTime, performance.now() * 0.001);
        
        // Resolution uniform
        const uResolution = shaderManager.getUniformLocation(programName, 'u_resolution');
        if (uResolution) gl.uniform2f(uResolution, this.viewport.width, this.viewport.height);
        
        // Material-specific uniforms
        if (material.uniforms) {
            Object.entries(material.uniforms).forEach(([name, value]) => {
                const location = shaderManager.getUniformLocation(programName, name);
                if (location) {
                    this.setUniform(location, value);
                }
            });
        }
    }
    
    /**
     * Set individual uniform value
     * @param {WebGLUniformLocation} location - Uniform location
     * @param {*} value - Uniform value
     */
    setUniform(location, value) {
        const gl = this.gl;
        
        if (Array.isArray(value)) {
            switch (value.length) {
                case 1: gl.uniform1f(location, value[0]); break;
                case 2: gl.uniform2fv(location, value); break;
                case 3: gl.uniform3fv(location, value); break;
                case 4: gl.uniform4fv(location, value); break;
                case 16: gl.uniformMatrix4fv(location, false, value); break;
            }
        } else if (typeof value === 'number') {
            gl.uniform1f(location, value);
        } else if (typeof value === 'boolean') {
            gl.uniform1i(location, value ? 1 : 0);
        }
    }
    
    /**
     * Bind material textures
     * @param {Object} material - Material properties
     */
    bindTextures(material) {
        if (!material.textures) return;
        
        const gl = this.gl;
        let textureUnit = 0;
        
        Object.entries(material.textures).forEach(([name, texture]) => {
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            
            const location = shaderManager.getUniformLocation(material.program, name);
            if (location) {
                gl.uniform1i(location, textureUnit);
            }
            
            textureUnit++;
            this.stats.textureBinds++;
        });
    }
    
    /**
     * Set render state
     * @param {Object} material - Material properties
     */
    setRenderState(material) {
        const gl = this.gl;
        
        // Depth testing
        if (material.depthTest !== undefined) {
            if (material.depthTest) {
                gl.enable(gl.DEPTH_TEST);
            } else {
                gl.disable(gl.DEPTH_TEST);
            }
        }
        
        // Depth writing
        if (material.depthWrite !== undefined) {
            gl.depthMask(material.depthWrite);
        }
        
        // Blending
        if (material.blending !== undefined) {
            if (material.blending) {
                gl.enable(gl.BLEND);
                gl.blendFunc(
                    material.blendSrc || gl.SRC_ALPHA,
                    material.blendDst || gl.ONE_MINUS_SRC_ALPHA
                );
            } else {
                gl.disable(gl.BLEND);
            }
        }
        
        // Face culling
        if (material.cullFace !== undefined) {
            if (material.cullFace) {
                gl.enable(gl.CULL_FACE);
                gl.cullFace(material.cullMode === 'front' ? gl.FRONT : gl.BACK);
            } else {
                gl.disable(gl.CULL_FACE);
            }
        }
    }
    
    /**
     * Render post-processing effects
     */
    renderPostProcessing() {
        if (!this.postProcessing.enabled || !this.postProcessing.quadGeometry) {
            return;
        }
        
        const gl = this.gl;
        
        // Use post-processing shader
        const program = this.postProcessing.effects.get('default');
        if (!program) return;
        
        shaderManager.useProgram(program);
        
        // Setup fullscreen quad
        const quad = this.postProcessing.quadGeometry;
        gl.bindBuffer(gl.ARRAY_BUFFER, quad.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quad.indexBuffer);
        
        const positionLocation = shaderManager.getAttributeLocation('postprocess', 'a_position');
        const uvLocation = shaderManager.getAttributeLocation('postprocess', 'a_uv');
        
        if (positionLocation !== -1) {
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
        }
        
        if (uvLocation !== -1) {
            gl.enableVertexAttribArray(uvLocation);
            gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);
        }
        
        // Bind main render target as texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.renderTargets.main.colorTexture);
        
        const uTexture = shaderManager.getUniformLocation('postprocess', 'u_texture');
        if (uTexture) gl.uniform1i(uTexture, 0);
        
        // Render fullscreen quad
        gl.drawElements(gl.TRIANGLES, quad.vertexCount, gl.UNSIGNED_SHORT, 0);
        
        this.stats.drawCalls++;
    }
    
    /**
     * Set camera position
     * @param {Array} position - Camera position [x, y, z]
     */
    setCameraPosition(position) {
        vec3.set(this.camera.position, position[0], position[1], position[2]);
        this.updateCamera();
    }
    
    /**
     * Set camera target
     * @param {Array} target - Camera target [x, y, z]
     */
    setCameraTarget(target) {
        vec3.set(this.camera.target, target[0], target[1], target[2]);
        this.updateCamera();
    }
    
    /**
     * Set camera field of view
     * @param {number} fov - Field of view in radians
     */
    setCameraFOV(fov) {
        this.camera.fov = fov;
        this.updateCamera();
    }
    
    /**
     * Set render scale for adaptive quality
     * @param {number} scale - Render scale (0.5 - 1.0)
     */
    setRenderScale(scale) {
        this.renderScale = MathUtils.clamp(scale, 0.25, 1.0);
        this.updateViewport();
    }
    
    /**
     * Set quality settings
     * @param {Object} settings - Quality settings
     */
    setQuality(settings) {
        Object.assign(this.quality, settings);
        
        // Update render scale
        this.setRenderScale(settings.resolution || 1.0);
        
        // Update post-processing
        this.postProcessing.enabled = settings.postProcessing !== false;
    }
    
    /**
     * Get render statistics
     * @returns {Object} Render statistics
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Get camera information
     * @returns {Object} Camera data
     */
    getCamera() {
        return {
            position: Array.from(this.camera.position),
            target: Array.from(this.camera.target),
            fov: this.camera.fov,
            aspect: this.aspectRatio
        };
    }
    
    /**
     * Resize canvas and update render targets
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        if (this.canvas) {
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';
            this.updateViewport();
        }
    }
    
    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Debug mode enabled
     */
    setDebugMode(enabled) {
        this.debug.showStats = enabled;
        this.debug.wireframe = enabled;
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        // Delete render targets
        Object.values(this.renderTargets).forEach(target => {
            if (target && target.framebuffer) {
                this.gl.deleteFramebuffer(target.framebuffer);
                this.gl.deleteTexture(target.colorTexture);
                if (target.depthBuffer) {
                    this.gl.deleteRenderbuffer(target.depthBuffer);
                }
            }
        });
        
        // Delete post-processing geometry
        if (this.postProcessing.quadGeometry) {
            this.gl.deleteBuffer(this.postProcessing.quadGeometry.vertexBuffer);
            this.gl.deleteBuffer(this.postProcessing.quadGeometry.indexBuffer);
        }
        
        // Clear all data
        this.framebuffers.clear();
        this.renderTargets = {};
        this.lights = [];
        this.renderQueues = { opaque: [], transparent: [], ui: [] };
        
        this.gl = null;
        this.canvas = null;
        this.isInitialized = false;
        
        console.log('RenderEngine disposed');
    }
}

// Export singleton instance
export const renderEngine = new RenderEngine();