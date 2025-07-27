/**
 * Shader Manager
 * Advanced shader compilation, caching, and management system for the GLSL music visualizer
 * Handles dynamic shader compilation, hot-reload, preprocessing, and optimization
 */

import { webglUtils } from '../utils/WebGLUtils.js';
import { FileUtils } from '../utils/FileUtils.js';
import { performanceMonitor } from './PerformanceMonitor.js';

export class ShaderManager {
    constructor() {
        this.gl = null;
        this.shaders = new Map(); // Compiled shaders cache
        this.programs = new Map(); // Linked programs cache
        this.sources = new Map(); // Source code cache
        this.includes = new Map(); // Include files cache
        
        // Hot-reload support
        this.hotReloadEnabled = process.env.NODE_ENV === 'development';
        this.watchedFiles = new Map();
        this.reloadCallbacks = new Map();
        
        // Preprocessing
        this.globalDefines = new Map();
        this.includeResolver = this.defaultIncludeResolver.bind(this);
        
        // Compilation statistics
        this.stats = {
            compilationsSucceeded: 0,
            compilationsFailed: 0,
            programsLinked: 0,
            cacheHits: 0,
            hotReloads: 0
        };
        
        // Active programs tracking
        this.activeProgram = null;
        this.uniformLocations = new Map();
        this.attributeLocations = new Map();
        
        // Error handling
        this.errorCallback = null;
        this.warningCallback = null;
    }
    
    /**
     * Initialize shader manager with WebGL context
     * @param {WebGLRenderingContext} gl - WebGL context
     */
    initialize(gl) {
        this.gl = gl;
        
        // Set up default global defines based on WebGL capabilities
        this.setupGlobalDefines();
        
        // Load common include files
        this.loadCommonIncludes();
        
        console.log('ShaderManager initialized', {
            webglVersion: gl instanceof WebGL2RenderingContext ? '2.0' : '1.0',
            hotReload: this.hotReloadEnabled,
            globalDefines: this.globalDefines.size
        });
    }
    
    /**
     * Set up global shader defines based on WebGL capabilities
     */
    setupGlobalDefines() {
        const capabilities = webglUtils.getCapabilities();
        
        // WebGL version
        this.globalDefines.set('WEBGL_VERSION', capabilities.isWebGL2 ? '2' : '1');
        
        // Extension support
        this.globalDefines.set('HAS_FLOAT_TEXTURES', capabilities.floatTextures ? '1' : '0');
        this.globalDefines.set('HAS_HALF_FLOAT_TEXTURES', capabilities.halfFloatTextures ? '1' : '0');
        this.globalDefines.set('HAS_COLOR_BUFFER_FLOAT', capabilities.colorBufferFloat ? '1' : '0');
        this.globalDefines.set('HAS_DEPTH_TEXTURE', capabilities.depthTexture ? '1' : '0');
        this.globalDefines.set('HAS_ANISOTROPIC_FILTERING', capabilities.anisotropicFiltering ? '1' : '0');
        
        // Hardware capabilities
        this.globalDefines.set('MAX_TEXTURE_SIZE', capabilities.maxTextureSize.toString());
        this.globalDefines.set('MAX_TEXTURE_IMAGE_UNITS', capabilities.maxTextureImageUnits.toString());
        this.globalDefines.set('MAX_VERTEX_ATTRIBS', capabilities.maxVertexAttribs.toString());
        
        // Performance tier
        const tier = capabilities.performanceTier;
        this.globalDefines.set('PERFORMANCE_TIER_LOW', tier === 'low' ? '1' : '0');
        this.globalDefines.set('PERFORMANCE_TIER_MEDIUM', tier === 'medium' ? '1' : '0');
        this.globalDefines.set('PERFORMANCE_TIER_HIGH', tier === 'high' ? '1' : '0');
    }
    
    /**
     * Load common shader include files
     */
    async loadCommonIncludes() {
        const commonIncludes = [
            'src/shaders/common/utils.glsl',
            'src/shaders/common/noise.glsl',
            'src/shaders/common/sdf.glsl',
            'src/shaders/common/lighting.glsl'
        ];
        
        const loadPromises = commonIncludes.map(async (path) => {
            try {
                const source = await FileUtils.loadTextFile(path);
                const filename = path.split('/').pop();
                this.includes.set(filename, source);
                
                if (this.hotReloadEnabled) {
                    this.watchFile(path, () => this.reloadInclude(filename, path));
                }
            } catch (error) {
                console.warn(`Failed to load include file ${path}:`, error);
            }
        });
        
        await Promise.allSettled(loadPromises);
        console.log(`Loaded ${this.includes.size} common include files`);
    }
    
    /**
     * Load and compile shader from file
     * @param {string} vertexPath - Path to vertex shader
     * @param {string} fragmentPath - Path to fragment shader
     * @param {Object} defines - Additional shader defines
     * @param {string} programName - Name for the shader program
     * @returns {Promise<WebGLProgram>} Compiled shader program
     */
    async loadShaderProgram(vertexPath, fragmentPath, defines = {}, programName = null) {
        const name = programName || `${vertexPath}_${fragmentPath}`;
        
        try {
            // Check cache first
            if (this.programs.has(name)) {
                this.stats.cacheHits++;
                return this.programs.get(name);
            }
            
            // Load shader sources
            const [vertexSource, fragmentSource] = await Promise.all([
                FileUtils.loadTextFile(vertexPath),
                FileUtils.loadTextFile(fragmentPath)
            ]);
            
            // Store sources for hot-reload
            this.sources.set(`${name}_vertex`, { source: vertexSource, path: vertexPath });
            this.sources.set(`${name}_fragment`, { source: fragmentSource, path: fragmentPath });
            
            // Compile program
            const program = this.compileProgram(vertexSource, fragmentSource, defines, name);
            
            // Setup hot-reload if enabled
            if (this.hotReloadEnabled) {
                this.setupHotReload(name, vertexPath, fragmentPath, defines);
            }
            
            return program;
            
        } catch (error) {
            this.stats.compilationsFailed++;
            console.error(`Failed to load shader program ${name}:`, error);
            
            if (this.errorCallback) {
                this.errorCallback(error, name);
            }
            
            throw error;
        }
    }
    
    /**
     * Compile shader program from source code
     * @param {string} vertexSource - Vertex shader source
     * @param {string} fragmentSource - Fragment shader source
     * @param {Object} defines - Shader defines
     * @param {string} name - Program name
     * @returns {WebGLProgram} Compiled program
     */
    compileProgram(vertexSource, fragmentSource, defines = {}, name = 'unnamed') {
        const startTime = performance.now();
        
        try {
            // Preprocess sources
            const processedVertexSource = this.preprocessShader(vertexSource, defines, 'vertex');
            const processedFragmentSource = this.preprocessShader(fragmentSource, defines, 'fragment');
            
            // Compile individual shaders
            const vertexShader = this.compileShader(processedVertexSource, this.gl.VERTEX_SHADER, `${name}_vertex`);
            const fragmentShader = this.compileShader(processedFragmentSource, this.gl.FRAGMENT_SHADER, `${name}_fragment`);
            
            // Link program
            const program = this.linkProgram(vertexShader, fragmentShader, name);
            
            // Cache the program
            this.programs.set(name, program);
            
            // Extract and cache uniform/attribute locations
            this.cacheLocations(program, name);
            
            // Record statistics
            this.stats.compilationsSucceeded++;
            this.stats.programsLinked++;
            
            const compileTime = performance.now() - startTime;
            performanceMonitor.recordCPUTime('rendering', compileTime);
            
            console.log(`Compiled shader program "${name}" in ${compileTime.toFixed(2)}ms`);
            
            return program;
            
        } catch (error) {
            this.stats.compilationsFailed++;
            throw new Error(`Shader compilation failed for "${name}": ${error.message}`);
        }
    }
    
    /**
     * Compile individual shader
     * @param {string} source - Shader source code
     * @param {number} type - Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
     * @param {string} name - Shader name for debugging
     * @returns {WebGLShader} Compiled shader
     */
    compileShader(source, type, name) {
        const shaderKey = `${name}_${this.hashSource(source)}`;
        
        // Check cache
        if (this.shaders.has(shaderKey)) {
            this.stats.cacheHits++;
            return this.shaders.get(shaderKey);
        }
        
        // Use WebGLUtils for compilation
        const shader = webglUtils.compileShader(this.gl, source, type, name);
        
        // Cache the compiled shader
        this.shaders.set(shaderKey, shader);
        
        return shader;
    }
    
    /**
     * Link shader program
     * @param {WebGLShader} vertexShader - Compiled vertex shader
     * @param {WebGLShader} fragmentShader - Compiled fragment shader
     * @param {string} name - Program name
     * @returns {WebGLProgram} Linked program
     */
    linkProgram(vertexShader, fragmentShader, name) {
        return webglUtils.createProgram(this.gl, vertexShader, fragmentShader, name);
    }
    
    /**
     * Preprocess shader source code
     * @param {string} source - Original shader source
     * @param {Object} defines - Shader defines
     * @param {string} shaderType - 'vertex' or 'fragment'
     * @returns {string} Processed source
     */
    preprocessShader(source, defines = {}, shaderType = 'fragment') {
        let processed = source;
        
        // Add version directive if missing
        if (!processed.includes('#version')) {
            const version = webglUtils.getCapabilities().isWebGL2 ? '300 es' : '100';
            processed = `#version ${version}\n${processed}`;
        }
        
        // Add precision qualifier for fragment shaders
        if (shaderType === 'fragment' && !processed.includes('precision')) {
            const versionMatch = processed.match(/#version[^\n]+/);
            const insertPos = versionMatch ? versionMatch.index + versionMatch[0].length : 0;
            processed = processed.slice(0, insertPos) + 
                       '\nprecision highp float;\nprecision highp int;\n' + 
                       processed.slice(insertPos);
        }
        
        // Process includes first
        processed = this.processIncludes(processed);
        
        // Add global defines
        const allDefines = new Map([...this.globalDefines, ...Object.entries(defines)]);
        const defineString = Array.from(allDefines.entries())
            .map(([key, value]) => `#define ${key} ${value}`)
            .join('\n');
        
        if (defineString) {
            const versionMatch = processed.match(/#version[^\n]+(\nprecision[^\n]+)*/);
            const insertPos = versionMatch ? versionMatch.index + versionMatch[0].length : 0;
            processed = processed.slice(0, insertPos) + 
                       '\n' + defineString + '\n' + 
                       processed.slice(insertPos);
        }
        
        // WebGL1 compatibility
        if (!webglUtils.getCapabilities().isWebGL2) {
            processed = this.convertToWebGL1(processed, shaderType);
        }
        
        return processed;
    }
    
    /**
     * Process #include directives
     * @param {string} source - Shader source with includes
     * @returns {string} Source with includes resolved
     */
    processIncludes(source) {
        const includeRegex = /#include\s*["<]([^">]+)[">]/g;
        let processed = source;
        let match;
        
        // Track included files to prevent circular includes
        const includedFiles = new Set();
        
        while ((match = includeRegex.exec(processed)) !== null) {
            const includePath = match[1];
            const fullMatch = match[0];
            
            if (includedFiles.has(includePath)) {
                console.warn(`Circular include detected: ${includePath}`);
                continue;
            }
            
            const includeSource = this.includeResolver(includePath);
            if (includeSource) {
                includedFiles.add(includePath);
                
                // Recursively process includes in the included file
                const processedInclude = this.processIncludes(includeSource);
                processed = processed.replace(fullMatch, processedInclude);
                
                // Reset regex to start from beginning due to string modification
                includeRegex.lastIndex = 0;
            } else {
                console.warn(`Include file not found: ${includePath}`);
            }
        }
        
        return processed;
    }
    
    /**
     * Default include resolver
     * @param {string} path - Include path
     * @returns {string|null} Include source or null if not found
     */
    defaultIncludeResolver(path) {
        // Try different path variations
        const pathVariations = [
            path,
            path.split('/').pop(), // Just filename
            `common/${path}`, // Common directory
            `src/shaders/common/${path}` // Full path
        ];
        
        for (const variation of pathVariations) {
            if (this.includes.has(variation)) {
                return this.includes.get(variation);
            }
        }
        
        return null;
    }
    
    /**
     * Convert WebGL2 shader to WebGL1 compatibility
     * @param {string} source - WebGL2 shader source
     * @param {string} shaderType - 'vertex' or 'fragment'
     * @returns {string} WebGL1 compatible source
     */
    convertToWebGL1(source, shaderType) {
        let converted = source;
        
        // Convert version directive
        converted = converted.replace(/#version 300 es/, '#version 100');
        
        if (shaderType === 'vertex') {
            // Convert input/output qualifiers
            converted = converted.replace(/\bin\s+/g, 'attribute ');
            converted = converted.replace(/\bout\s+/g, 'varying ');
        } else {
            // Fragment shader conversions
            converted = converted.replace(/\bin\s+/g, 'varying ');
            converted = converted.replace(/\bout\s+vec4\s+(\w+);/g, ''); // Remove out declarations
            converted = converted.replace(/(\w+)\s*=/g, 'gl_FragColor ='); // Replace output assignments
        }
        
        // Convert texture functions
        converted = converted.replace(/\btexture\s*\(/g, 'texture2D(');
        
        return converted;
    }
    
    /**
     * Cache uniform and attribute locations for a program
     * @param {WebGLProgram} program - Shader program
     * @param {string} name - Program name
     */
    cacheLocations(program, name) {
        const uniformCount = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);
        const attributeCount = this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES);
        
        const uniforms = new Map();
        const attributes = new Map();
        
        // Cache uniform locations
        for (let i = 0; i < uniformCount; i++) {
            const uniformInfo = this.gl.getActiveUniform(program, i);
            if (uniformInfo) {
                const location = this.gl.getUniformLocation(program, uniformInfo.name);
                uniforms.set(uniformInfo.name, location);
            }
        }
        
        // Cache attribute locations
        for (let i = 0; i < attributeCount; i++) {
            const attributeInfo = this.gl.getActiveAttrib(program, i);
            if (attributeInfo) {
                const location = this.gl.getAttribLocation(program, attributeInfo.name);
                attributes.set(attributeInfo.name, location);
            }
        }
        
        this.uniformLocations.set(name, uniforms);
        this.attributeLocations.set(name, attributes);
    }
    
    /**
     * Use shader program
     * @param {string|WebGLProgram} program - Program name or WebGL program
     * @returns {WebGLProgram} Active program
     */
    useProgram(program) {
        let glProgram;
        
        if (typeof program === 'string') {
            glProgram = this.programs.get(program);
            if (!glProgram) {
                throw new Error(`Shader program not found: ${program}`);
            }
        } else {
            glProgram = program;
        }
        
        if (this.activeProgram !== glProgram) {
            this.gl.useProgram(glProgram);
            this.activeProgram = glProgram;
            
            // Track shader switches for performance monitoring
            performanceMonitor.recordGPUStats({ shaderSwitches: 1 });
        }
        
        return glProgram;
    }
    
    /**
     * Get uniform location
     * @param {string} programName - Program name
     * @param {string} uniformName - Uniform name
     * @returns {WebGLUniformLocation|null} Uniform location
     */
    getUniformLocation(programName, uniformName) {
        const uniforms = this.uniformLocations.get(programName);
        return uniforms ? uniforms.get(uniformName) : null;
    }
    
    /**
     * Get attribute location
     * @param {string} programName - Program name
     * @param {string} attributeName - Attribute name
     * @returns {number} Attribute location
     */
    getAttributeLocation(programName, attributeName) {
        const attributes = this.attributeLocations.get(programName);
        return attributes ? attributes.get(attributeName) : -1;
    }
    
    /**
     * Set up hot-reload for a shader program
     * @param {string} name - Program name
     * @param {string} vertexPath - Vertex shader path
     * @param {string} fragmentPath - Fragment shader path
     * @param {Object} defines - Shader defines
     */
    setupHotReload(name, vertexPath, fragmentPath, defines) {
        const reloadFunction = async () => {
            try {
                console.log(`Hot-reloading shader program: ${name}`);
                
                // Remove old program from cache
                const oldProgram = this.programs.get(name);
                if (oldProgram) {
                    this.gl.deleteProgram(oldProgram);
                    this.programs.delete(name);
                }
                
                // Reload and recompile
                const newProgram = await this.loadShaderProgram(vertexPath, fragmentPath, defines, name);
                
                // Notify callbacks
                const callbacks = this.reloadCallbacks.get(name);
                if (callbacks) {
                    callbacks.forEach(callback => callback(newProgram, name));
                }
                
                this.stats.hotReloads++;
                console.log(`Successfully hot-reloaded shader program: ${name}`);
                
            } catch (error) {
                console.error(`Hot-reload failed for ${name}:`, error);
                if (this.errorCallback) {
                    this.errorCallback(error, name);
                }
            }
        };
        
        this.watchFile(vertexPath, reloadFunction);
        this.watchFile(fragmentPath, reloadFunction);
    }
    
    /**
     * Watch file for changes (stub implementation for development)
     * @param {string} path - File path to watch
     * @param {Function} callback - Callback function
     */
    watchFile(path, callback) {
        if (!this.hotReloadEnabled) return;
        
        // In a real implementation, this would use file system watchers
        // For now, we'll just store the callback for manual triggering
        if (!this.watchedFiles.has(path)) {
            this.watchedFiles.set(path, []);
        }
        this.watchedFiles.get(path).push(callback);
    }
    
    /**
     * Manually trigger hot-reload for development
     * @param {string} path - File path that changed
     */
    triggerHotReload(path) {
        const callbacks = this.watchedFiles.get(path);
        if (callbacks) {
            callbacks.forEach(callback => callback());
        }
    }
    
    /**
     * Add hot-reload callback for a program
     * @param {string} programName - Program name
     * @param {Function} callback - Callback function
     */
    onProgramReload(programName, callback) {
        if (!this.reloadCallbacks.has(programName)) {
            this.reloadCallbacks.set(programName, []);
        }
        this.reloadCallbacks.get(programName).push(callback);
    }
    
    /**
     * Reload include file
     * @param {string} filename - Include filename
     * @param {string} path - Include file path
     */
    async reloadInclude(filename, path) {
        try {
            const source = await FileUtils.loadTextFile(path);
            this.includes.set(filename, source);
            console.log(`Reloaded include file: ${filename}`);
        } catch (error) {
            console.error(`Failed to reload include file ${filename}:`, error);
        }
    }
    
    /**
     * Add global define
     * @param {string} name - Define name
     * @param {string} value - Define value
     */
    addGlobalDefine(name, value) {
        this.globalDefines.set(name, value);
    }
    
    /**
     * Remove global define
     * @param {string} name - Define name
     */
    removeGlobalDefine(name) {
        this.globalDefines.delete(name);
    }
    
    /**
     * Set custom include resolver
     * @param {Function} resolver - Include resolver function
     */
    setIncludeResolver(resolver) {
        this.includeResolver = resolver;
    }
    
    /**
     * Generate hash from source code for caching
     * @param {string} source - Source code
     * @returns {string} Hash string
     */
    hashSource(source) {
        let hash = 0;
        for (let i = 0; i < source.length; i++) {
            const char = source.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    
    /**
     * Get compilation statistics
     * @returns {Object} Compilation stats
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Get all loaded programs
     * @returns {Array} Array of program names
     */
    getLoadedPrograms() {
        return Array.from(this.programs.keys());
    }
    
    /**
     * Set error callback
     * @param {Function} callback - Error callback function
     */
    setErrorCallback(callback) {
        this.errorCallback = callback;
    }
    
    /**
     * Set warning callback
     * @param {Function} callback - Warning callback function
     */
    setWarningCallback(callback) {
        this.warningCallback = callback;
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        // Delete all programs
        this.programs.forEach((program, name) => {
            this.gl.deleteProgram(program);
        });
        
        // Delete all shaders
        this.shaders.forEach((shader, key) => {
            this.gl.deleteShader(shader);
        });
        
        // Clear all caches
        this.programs.clear();
        this.shaders.clear();
        this.sources.clear();
        this.includes.clear();
        this.uniformLocations.clear();
        this.attributeLocations.clear();
        this.watchedFiles.clear();
        this.reloadCallbacks.clear();
        
        this.activeProgram = null;
        this.gl = null;
        
        console.log('ShaderManager disposed');
    }
}

// Export singleton instance
export const shaderManager = new ShaderManager();