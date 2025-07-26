/**
 * WebGL Utility Functions
 * Provides comprehensive WebGL context management, shader compilation,
 * and GPU resource handling for the advanced GLSL music visualizer
 */

export class WebGLUtils {
    static instance = null;
    
    constructor() {
        if (WebGLUtils.instance) {
            return WebGLUtils.instance;
        }
        
        this.extensions = new Map();
        this.capabilities = null;
        this.debugMode = process.env.NODE_ENV === 'development';
        this.shaderCache = new Map();
        this.programCache = new Map();
        
        WebGLUtils.instance = this;
    }
    
    /**
     * Create and initialize WebGL2 context with fallback to WebGL1
     * @param {HTMLCanvasElement} canvas - Target canvas element
     * @param {Object} options - WebGL context options
     * @returns {WebGL2RenderingContext|WebGLRenderingContext|null}
     */
    createContext(canvas, options = {}) {
        const defaultOptions = {
            alpha: false,
            depth: true,
            stencil: false,
            antialias: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
            desynchronized: true
        };
        
        const contextOptions = { ...defaultOptions, ...options };
        
        // Try WebGL2 first for advanced features
        let gl = canvas.getContext('webgl2', contextOptions);
        
        if (!gl) {
            console.warn('WebGL2 not available, falling back to WebGL1');
            gl = canvas.getContext('webgl', contextOptions) || 
                 canvas.getContext('experimental-webgl', contextOptions);
        }
        
        if (!gl) {
            throw new Error('WebGL is not supported by your browser');
        }
        
        // Initialize extensions and capabilities
        this.initializeExtensions(gl);
        this.detectCapabilities(gl);
        
        // Setup debug mode if enabled
        if (this.debugMode) {
            this.setupDebugMode(gl);
        }
        
        return gl;
    }
    
    /**
     * Initialize critical WebGL extensions
     * @param {WebGLRenderingContext} gl - WebGL context
     */
    initializeExtensions(gl) {
        const criticalExtensions = [
            'OES_texture_float',
            'OES_texture_half_float',
            'OES_element_index_uint',
            'WEBGL_color_buffer_float',
            'EXT_color_buffer_float',
            'WEBGL_depth_texture',
            'OES_texture_float_linear',
            'OES_texture_half_float_linear'
        ];
        
        const optionalExtensions = [
            'EXT_disjoint_timer_query',
            'EXT_disjoint_timer_query_webgl2',
            'WEBGL_debug_renderer_info',
            'WEBGL_debug_shaders',
            'EXT_texture_filter_anisotropic',
            'WEBKIT_EXT_texture_filter_anisotropic',
            'MOZ_EXT_texture_filter_anisotropic'
        ];
        
        // Load critical extensions
        criticalExtensions.forEach(name => {
            const ext = gl.getExtension(name);
            if (ext) {
                this.extensions.set(name, ext);
            } else {
                console.warn(`Critical extension ${name} not available`);
            }
        });
        
        // Load optional extensions
        optionalExtensions.forEach(name => {
            const ext = gl.getExtension(name);
            if (ext) {
                this.extensions.set(name, ext);
            }
        });
    }
    
    /**
     * Detect WebGL capabilities for performance optimization
     * @param {WebGLRenderingContext} gl - WebGL context
     */
    detectCapabilities(gl) {
        this.capabilities = {
            isWebGL2: gl instanceof WebGL2RenderingContext,
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
            maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
            maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
            maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
            maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
            maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
            maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
            maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
            
            // Advanced capabilities for WebGL2
            ...(gl instanceof WebGL2RenderingContext && {
                maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
                maxColorAttachments: gl.getParameter(gl.MAX_COLOR_ATTACHMENTS),
                maxSamples: gl.getParameter(gl.MAX_SAMPLES),
                maxUniformBufferBindings: gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS),
                maxUniformBlockSize: gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE),
                maxTransformFeedbackInterleavedComponents: gl.getParameter(gl.MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS)
            }),
            
            // Extension-based capabilities
            floatTextures: this.extensions.has('OES_texture_float'),
            halfFloatTextures: this.extensions.has('OES_texture_half_float'),
            colorBufferFloat: this.extensions.has('WEBGL_color_buffer_float') || this.extensions.has('EXT_color_buffer_float'),
            depthTexture: this.extensions.has('WEBGL_depth_texture'),
            anisotropicFiltering: this.extensions.has('EXT_texture_filter_anisotropic') || 
                                this.extensions.has('WEBKIT_EXT_texture_filter_anisotropic') || 
                                this.extensions.has('MOZ_EXT_texture_filter_anisotropic'),
            
            // GPU info
            renderer: gl.getParameter(gl.RENDERER),
            vendor: gl.getParameter(gl.VENDOR),
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
        };
        
        // Estimate GPU performance tier
        this.capabilities.performanceTier = this.estimatePerformanceTier();
        
        console.log('WebGL Capabilities:', this.capabilities);
    }
    
    /**
     * Estimate GPU performance tier for adaptive quality settings
     * @returns {string} Performance tier: 'low', 'medium', 'high'
     */
    estimatePerformanceTier() {
        const renderer = this.capabilities.renderer.toLowerCase();
        
        // High-end GPUs
        if (renderer.includes('rtx') || 
            renderer.includes('gtx 1080') || 
            renderer.includes('gtx 1070') ||
            renderer.includes('rx 6800') ||
            renderer.includes('rx 6900') ||
            renderer.includes('apple m1') ||
            renderer.includes('apple m2')) {
            return 'high';
        }
        
        // Mid-range GPUs
        if (renderer.includes('gtx') || 
            renderer.includes('radeon') ||
            renderer.includes('rx ') ||
            this.capabilities.maxTextureSize >= 8192) {
            return 'medium';
        }
        
        // Low-end or integrated GPUs
        return 'low';
    }
    
    /**
     * Compile GLSL shader with error handling and caching
     * @param {WebGLRenderingContext} gl - WebGL context
     * @param {string} source - Shader source code
     * @param {number} type - Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
     * @param {string} name - Shader name for debugging
     * @returns {WebGLShader} Compiled shader
     */
    compileShader(gl, source, type, name = 'unnamed') {
        const cacheKey = `${name}_${type}_${this.hashString(source)}`;
        
        if (this.shaderCache.has(cacheKey)) {
            return this.shaderCache.get(cacheKey);
        }
        
        const shader = gl.createShader(type);
        
        if (!shader) {
            throw new Error(`Failed to create shader: ${name}`);
        }
        
        // Preprocess shader source for compatibility
        const processedSource = this.preprocessShader(source, gl);
        
        gl.shaderSource(shader, processedSource);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            
            // Enhanced error reporting
            const error = this.formatShaderError(info, processedSource, name);
            throw new Error(`Shader compilation failed (${name}): ${error}`);
        }
        
        this.shaderCache.set(cacheKey, shader);
        return shader;
    }
    
    /**
     * Create and link shader program with error handling
     * @param {WebGLRenderingContext} gl - WebGL context
     * @param {WebGLShader} vertexShader - Compiled vertex shader
     * @param {WebGLShader} fragmentShader - Compiled fragment shader
     * @param {string} name - Program name for debugging
     * @returns {WebGLProgram} Linked shader program
     */
    createProgram(gl, vertexShader, fragmentShader, name = 'unnamed') {
        const cacheKey = `${name}_${vertexShader}_${fragmentShader}`;
        
        if (this.programCache.has(cacheKey)) {
            return this.programCache.get(cacheKey);
        }
        
        const program = gl.createProgram();
        
        if (!program) {
            throw new Error(`Failed to create program: ${name}`);
        }
        
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Program linking failed (${name}): ${info}`);
        }
        
        this.programCache.set(cacheKey, program);
        return program;
    }
    
    /**
     * Preprocess shader source for compatibility across WebGL versions
     * @param {string} source - Original shader source
     * @param {WebGLRenderingContext} gl - WebGL context
     * @returns {string} Processed shader source
     */
    preprocessShader(source, gl) {
        let processed = source;
        
        // Add version directive if missing
        if (!processed.includes('#version')) {
            const version = gl instanceof WebGL2RenderingContext ? '300 es' : '100';
            processed = `#version ${version}\n${processed}`;
        }
        
        // Add precision qualifiers for fragment shaders if missing
        if (!processed.includes('precision') && processed.includes('gl_FragColor')) {
            processed = processed.replace('#version', '#version\nprecision highp float;\n');
        }
        
        // WebGL1 compatibility fixes
        if (!(gl instanceof WebGL2RenderingContext)) {
            processed = processed
                .replace(/\btexture\(/g, 'texture2D(')
                .replace(/\bin\b/g, 'attribute')
                .replace(/\bout\b/g, 'varying');
        }
        
        return processed;
    }
    
    /**
     * Create texture with optimal settings
     * @param {WebGLRenderingContext} gl - WebGL context
     * @param {Object} options - Texture options
     * @returns {WebGLTexture} Created texture
     */
    createTexture(gl, options = {}) {
        const {
            width = 1,
            height = 1,
            data = null,
            format = gl.RGBA,
            internalFormat = gl.RGBA,
            type = gl.UNSIGNED_BYTE,
            wrapS = gl.CLAMP_TO_EDGE,
            wrapT = gl.CLAMP_TO_EDGE,
            minFilter = gl.LINEAR,
            magFilter = gl.LINEAR,
            generateMipmaps = false,
            flipY = false
        } = options;
        
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
        
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            internalFormat,
            width,
            height,
            0,
            format,
            type,
            data
        );
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
        
        if (generateMipmaps) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
        
        // Apply anisotropic filtering if available
        if (this.extensions.has('EXT_texture_filter_anisotropic')) {
            const ext = this.extensions.get('EXT_texture_filter_anisotropic');
            const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
            gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, max));
        }
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        return texture;
    }
    
    /**
     * Create framebuffer with render target
     * @param {WebGLRenderingContext} gl - WebGL context
     * @param {Object} options - Framebuffer options
     * @returns {Object} Framebuffer object with texture and buffer
     */
    createFramebuffer(gl, options = {}) {
        const {
            width,
            height,
            format = gl.RGBA,
            type = gl.UNSIGNED_BYTE,
            depth = true,
            stencil = false
        } = options;
        
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        
        // Create color texture
        const colorTexture = this.createTexture(gl, {
            width,
            height,
            format,
            type,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR
        });
        
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            colorTexture,
            0
        );
        
        let depthBuffer = null;
        
        // Add depth/stencil buffer if requested
        if (depth || stencil) {
            depthBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
            
            const attachment = stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
            const format = stencil ? gl.DEPTH_STENCIL : gl.DEPTH_COMPONENT16;
            
            gl.renderbufferStorage(gl.RENDERBUFFER, format, width, height);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, depthBuffer);
        }
        
        // Check framebuffer completeness
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer incomplete: ${status}`);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        
        return {
            framebuffer,
            colorTexture,
            depthBuffer,
            width,
            height
        };
    }
    
    /**
     * Setup debug mode with enhanced error reporting
     * @param {WebGLRenderingContext} gl - WebGL context
     */
    setupDebugMode(gl) {
        // Override WebGL functions to add error checking
        const originalFunctions = {};
        const functionsToWrap = [
            'drawArrays', 'drawElements', 'useProgram', 'bindTexture',
            'bindBuffer', 'bindFramebuffer', 'uniform1f', 'uniform2f'
        ];
        
        functionsToWrap.forEach(name => {
            if (gl[name]) {
                originalFunctions[name] = gl[name];
                gl[name] = (...args) => {
                    const result = originalFunctions[name].apply(gl, args);
                    this.checkGLError(gl, name);
                    return result;
                };
            }
        });
    }
    
    /**
     * Check for WebGL errors and throw descriptive error messages
     * @param {WebGLRenderingContext} gl - WebGL context
     * @param {string} operation - Operation that was performed
     */
    checkGLError(gl, operation = 'unknown') {
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
            const errorNames = {
                [gl.INVALID_ENUM]: 'INVALID_ENUM',
                [gl.INVALID_VALUE]: 'INVALID_VALUE',
                [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
                [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
                [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL'
            };
            
            const errorName = errorNames[error] || `UNKNOWN_ERROR(${error})`;
            throw new Error(`WebGL Error: ${errorName} during operation: ${operation}`);
        }
    }
    
    /**
     * Format shader compilation error with line numbers
     * @param {string} info - Shader info log
     * @param {string} source - Shader source code
     * @param {string} name - Shader name
     * @returns {string} Formatted error message
     */
    formatShaderError(info, source, name) {
        const lines = source.split('\n');
        const errorRegex = /ERROR: (\d+):(\d+):/g;
        let match;
        let formattedError = `\n${name}:\n${info}`;
        
        while ((match = errorRegex.exec(info)) !== null) {
            const lineNum = parseInt(match[2]) - 1;
            if (lineNum >= 0 && lineNum < lines.length) {
                formattedError += `\nLine ${lineNum + 1}: ${lines[lineNum]}`;
            }
        }
        
        return formattedError;
    }
    
    /**
     * Create a simple hash of a string for caching
     * @param {string} str - String to hash
     * @returns {string} Hash string
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
    
    /**
     * Clean up WebGL resources
     */
    dispose() {
        this.shaderCache.clear();
        this.programCache.clear();
        this.extensions.clear();
        this.capabilities = null;
    }
    
    /**
     * Get extension by name
     * @param {string} name - Extension name
     * @returns {Object|null} Extension object or null
     */
    getExtension(name) {
        return this.extensions.get(name) || null;
    }
    
    /**
     * Check if extension is available
     * @param {string} name - Extension name
     * @returns {boolean} True if extension is available
     */
    hasExtension(name) {
        return this.extensions.has(name);
    }
    
    /**
     * Get WebGL capabilities
     * @returns {Object} Capabilities object
     */
    getCapabilities() {
        return this.capabilities;
    }
}

// Create singleton instance
export const webglUtils = new WebGLUtils();