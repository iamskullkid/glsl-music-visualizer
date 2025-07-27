#!/usr/bin/env node

/**
 * GLSL Shader Compiler and Validation Tool
 * Advanced shader preprocessing, validation, and optimization for GLSL Music Visualizer
 * Location: tools/shader-compiler.js
 * 
 * Features:
 * - GLSL shader validation and syntax checking
 * - Cross-platform WebGL compatibility validation
 * - Shader preprocessing with includes and defines
 * - Performance analysis and optimization suggestions
 * - Hot-reload support for development
 * - Batch processing of shader directories
 * - Integration with build pipeline
 * - Error reporting with line numbers and context
 */

const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const chokidar = require('chokidar');
const { performance } = require('perf_hooks');

// Shader validation classes
class ShaderValidator {
    constructor(options = {}) {
        this.options = {
            strictMode: options.strictMode !== false,
            webgl1Compatible: options.webgl1Compatible !== false,
            webgl2Compatible: options.webgl2Compatible !== false,
            enableOptimizations: options.enableOptimizations !== false,
            maxLineLength: options.maxLineLength || 120,
            allowedExtensions: options.allowedExtensions || [
                'GL_OES_standard_derivatives',
                'GL_EXT_shader_texture_lod',
                'GL_EXT_frag_depth',
                'GL_WEBGL_depth_texture',
                'GL_OES_texture_float',
                'GL_OES_texture_half_float'
            ]
        };
        
        // Validation statistics
        this.stats = {
            filesProcessed: 0,
            validShaders: 0,
            invalidShaders: 0,
            warnings: 0,
            errors: 0,
            optimizationSuggestions: 0
        };
        
        // Shader includes cache
        this.includesCache = new Map();
        
        // Known GLSL built-ins and functions
        this.builtinFunctions = new Set([
            'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
            'pow', 'exp', 'log', 'exp2', 'log2', 'sqrt', 'inversesqrt',
            'abs', 'sign', 'floor', 'ceil', 'fract', 'mod', 'min', 'max', 'clamp',
            'mix', 'step', 'smoothstep', 'length', 'distance', 'dot', 'cross',
            'normalize', 'reflect', 'refract', 'texture2D', 'textureCube',
            'dFdx', 'dFdy', 'fwidth'
        ]);
        
        this.builtinVariables = new Set([
            'gl_Position', 'gl_FragColor', 'gl_FragData', 'gl_FragCoord',
            'gl_FrontFacing', 'gl_PointCoord', 'gl_PointSize'
        ]);
        
        this.builtinTypes = new Set([
            'float', 'int', 'bool', 'vec2', 'vec3', 'vec4',
            'ivec2', 'ivec3', 'ivec4', 'bvec2', 'bvec3', 'bvec4',
            'mat2', 'mat3', 'mat4', 'sampler2D', 'samplerCube'
        ]);
    }
    
    /**
     * Validate a single shader file
     */
    async validateShader(filePath, options = {}) {
        const startTime = performance.now();
        
        try {
            // Read shader source
            const source = await fs.readFile(filePath, 'utf-8');
            
            // Determine shader type
            const shaderType = this.determineShaderType(filePath, source);
            
            // Preprocess shader
            const preprocessed = await this.preprocessShader(source, filePath, options.defines);
            
            // Validate syntax
            const syntaxResult = this.validateSyntax(preprocessed, shaderType, filePath);
            
            // Check WebGL compatibility
            const compatibilityResult = this.checkWebGLCompatibility(preprocessed, shaderType);
            
            // Performance analysis
            const performanceResult = this.analyzePerformance(preprocessed, shaderType);
            
            // Generate optimization suggestions
            const optimizations = this.generateOptimizations(preprocessed, shaderType);
            
            // Compile results
            const result = {
                filePath,
                shaderType,
                valid: syntaxResult.valid && compatibilityResult.compatible,
                errors: [...syntaxResult.errors, ...compatibilityResult.errors],
                warnings: [...syntaxResult.warnings, ...compatibilityResult.warnings],
                performance: performanceResult,
                optimizations,
                compilationTime: performance.now() - startTime,
                sourceLines: source.split('\n').length,
                processedLines: preprocessed.split('\n').length
            };
            
            // Update statistics
            this.updateStats(result);
            
            return result;
            
        } catch (error) {
            this.stats.errors++;
            return {
                filePath,
                valid: false,
                errors: [{ type: 'file_error', message: error.message, line: 0 }],
                warnings: [],
                compilationTime: performance.now() - startTime
            };
        }
    }
    
    /**
     * Determine shader type from file extension and content
     */
    determineShaderType(filePath, source) {
        const ext = path.extname(filePath).toLowerCase();
        
        // Explicit type from extension
        if (ext === '.vert' || ext === '.vs') return 'vertex';
        if (ext === '.frag' || ext === '.fs') return 'fragment';
        
        // Try to determine from content
        if (source.includes('gl_Position')) return 'vertex';
        if (source.includes('gl_FragColor') || source.includes('gl_FragData')) return 'fragment';
        
        // Default to fragment shader for .glsl files
        return 'fragment';
    }
    
    /**
     * Preprocess shader source with includes and defines
     */
    async preprocessShader(source, filePath, defines = {}) {
        let processed = source;
        
        // Process #include directives
        processed = await this.processIncludes(processed, path.dirname(filePath));
        
        // Process #define directives
        processed = this.processDefines(processed, defines);
        
        // Add default precision qualifiers if missing
        processed = this.addDefaultPrecision(processed);
        
        return processed;
    }
    
    /**
     * Process #include directives
     */
    async processIncludes(source, baseDir) {
        const includeRegex = /#include\s+["<]([^">]+)[">]/g;
        let processed = source;
        let match;
        
        while ((match = includeRegex.exec(source)) !== null) {
            const includeFile = match[1];
            const includePath = path.resolve(baseDir, includeFile);
            
            try {
                // Check cache first
                if (!this.includesCache.has(includePath)) {
                    const includeContent = await fs.readFile(includePath, 'utf-8');
                    // Recursively process includes in the included file
                    const processedInclude = await this.processIncludes(includeContent, path.dirname(includePath));
                    this.includesCache.set(includePath, processedInclude);
                }
                
                const includeContent = this.includesCache.get(includePath);
                processed = processed.replace(match[0], includeContent);
                
            } catch (error) {
                // Include file not found - this will be reported as an error
                processed = processed.replace(match[0], `// ERROR: Include file not found: ${includeFile}`);
            }
        }
        
        return processed;
    }
    
    /**
     * Process #define directives
     */
    processDefines(source, defines) {
        let processed = source;
        
        // Add external defines
        const defineString = Object.entries(defines)
            .map(([key, value]) => `#define ${key} ${value}`)
            .join('\n');
        
        if (defineString) {
            // Insert after version directive or at the beginning
            const versionMatch = processed.match(/#version[^\n]*/);
            if (versionMatch) {
                const insertPos = versionMatch.index + versionMatch[0].length;
                processed = processed.slice(0, insertPos) + '\n' + defineString + '\n' + processed.slice(insertPos);
            } else {
                processed = defineString + '\n' + processed;
            }
        }
        
        return processed;
    }
    
    /**
     * Add default precision qualifiers
     */
    addDefaultPrecision(source) {
        let processed = source;
        
        // Add precision qualifiers if missing for WebGL 1.0 compatibility
        if (!processed.includes('precision') && !processed.includes('#version 300')) {
            const versionMatch = processed.match(/#version[^\n]*/);
            const insertPos = versionMatch ? versionMatch.index + versionMatch[0].length : 0;
            const precisionDirectives = '\nprecision highp float;\nprecision highp int;\n';
            
            processed = processed.slice(0, insertPos) + precisionDirectives + processed.slice(insertPos);
        }
        
        return processed;
    }
    
    /**
     * Validate GLSL syntax
     */
    validateSyntax(source, shaderType, filePath) {
        const errors = [];
        const warnings = [];
        const lines = source.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;
            
            // Skip empty lines and comments
            if (!line || line.startsWith('//') || line.startsWith('/*')) continue;
            
            // Check for common syntax errors
            this.checkSyntaxErrors(line, lineNum, errors, warnings);
            
            // Check for best practices
            this.checkBestPractices(line, lineNum, warnings);
            
            // Check line length
            if (line.length > this.options.maxLineLength) {
                warnings.push({
                    type: 'style',
                    message: `Line too long (${line.length} > ${this.options.maxLineLength})`,
                    line: lineNum,
                    column: this.options.maxLineLength
                });
            }
        }
        
        // Check shader-specific requirements
        this.checkShaderSpecificRequirements(source, shaderType, errors, warnings);
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Check for common syntax errors
     */
    checkSyntaxErrors(line, lineNum, errors, warnings) {
        // Missing semicolons
        if (line.match(/^\s*(uniform|attribute|varying|in|out|const)\s+/) && !line.endsWith(';') && !line.endsWith('{')) {
            errors.push({
                type: 'syntax',
                message: 'Missing semicolon',
                line: lineNum,
                column: line.length
            });
        }
        
        // Unmatched braces
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        if (openBraces !== closeBraces && !line.includes('//')) {
            warnings.push({
                type: 'syntax',
                message: 'Potentially unmatched braces',
                line: lineNum
            });
        }
        
        // Invalid variable names
        const varDeclaration = line.match(/(?:uniform|attribute|varying|in|out|const|float|int|bool|vec[234]|mat[234])\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (varDeclaration) {
            const varName = varDeclaration[1];
            if (this.builtinVariables.has(varName) || this.builtinFunctions.has(varName)) {
                errors.push({
                    type: 'naming',
                    message: `Cannot redefine built-in identifier: ${varName}`,
                    line: lineNum
                });
            }
        }
        
        // Check for unsupported functions or features
        const unsupportedWebGL1 = ['texture', 'texelFetch', 'textureSize'];
        unsupportedWebGL1.forEach(func => {
            if (line.includes(func + '(') && this.options.webgl1Compatible) {
                warnings.push({
                    type: 'compatibility',
                    message: `Function '${func}' not available in WebGL 1.0`,
                    line: lineNum
                });
            }
        });
    }
    
    /**
     * Check for best practices
     */
    checkBestPractices(line, lineNum, warnings) {
        // Avoid hardcoded magic numbers
        const magicNumbers = line.match(/\b(\d+\.\d+|\d+\.|\.\d+)\b/g);
        if (magicNumbers && magicNumbers.length > 2) {
            warnings.push({
                type: 'best_practice',
                message: 'Consider using named constants instead of magic numbers',
                line: lineNum
            });
        }
        
        // Avoid complex expressions in loops
        if (line.includes('for') && line.match(/[+\-*/]/g)?.length > 3) {
            warnings.push({
                type: 'performance',
                message: 'Complex expressions in loop conditions may impact performance',
                line: lineNum
            });
        }
        
        // Check for expensive operations in fragment shaders
        const expensiveOps = ['pow', 'log', 'exp', 'sin', 'cos', 'tan', 'atan', 'sqrt'];
        expensiveOps.forEach(op => {
            if (line.includes(op + '(')) {
                warnings.push({
                    type: 'performance',
                    message: `Expensive operation '${op}' - consider optimizing for mobile`,
                    line: lineNum
                });
            }
        });
    }
    
    /**
     * Check shader-specific requirements
     */
    checkShaderSpecificRequirements(source, shaderType, errors, warnings) {
        if (shaderType === 'vertex') {
            if (!source.includes('gl_Position')) {
                errors.push({
                    type: 'requirement',
                    message: 'Vertex shader must set gl_Position',
                    line: 0
                });
            }
        } else if (shaderType === 'fragment') {
            if (!source.includes('gl_FragColor') && !source.includes('gl_FragData') && !source.includes('out ')) {
                errors.push({
                    type: 'requirement',
                    message: 'Fragment shader must set output color',
                    line: 0
                });
            }
        }
        
        // Check for required precision qualifiers in WebGL 1.0
        if (this.options.webgl1Compatible && !source.includes('#version 300')) {
            if (!source.includes('precision') && shaderType === 'fragment') {
                warnings.push({
                    type: 'compatibility',
                    message: 'Fragment shader should specify precision for WebGL 1.0 compatibility',
                    line: 0
                });
            }
        }
    }
    
    /**
     * Check WebGL compatibility
     */
    checkWebGLCompatibility(source, shaderType) {
        const errors = [];
        const warnings = [];
        
        // Check WebGL 1.0 compatibility
        if (this.options.webgl1Compatible) {
            this.checkWebGL1Compatibility(source, errors, warnings);
        }
        
        // Check WebGL 2.0 compatibility
        if (this.options.webgl2Compatible) {
            this.checkWebGL2Compatibility(source, errors, warnings);
        }
        
        return {
            compatible: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Check WebGL 1.0 compatibility
     */
    checkWebGL1Compatibility(source, errors, warnings) {
        // Check for WebGL 2.0 specific features
        const webgl2Features = [
            'texture(', 'texelFetch(', 'textureSize(',
            'in ', 'out ', 'uniform buffer',
            'gl_VertexID', 'gl_InstanceID'
        ];
        
        const lines = source.split('\n');
        webgl2Features.forEach(feature => {
            lines.forEach((line, index) => {
                if (line.includes(feature)) {
                    warnings.push({
                        type: 'webgl1_compatibility',
                        message: `Feature '${feature.trim()}' not available in WebGL 1.0`,
                        line: index + 1
                    });
                }
            });
        });
        
        // Check version directive
        const versionMatch = source.match(/#version\s+(\d+)/);
        if (versionMatch && parseInt(versionMatch[1]) >= 300) {
            warnings.push({
                type: 'webgl1_compatibility',
                message: 'GLSL ES 3.0+ not supported in WebGL 1.0',
                line: 1
            });
        }
    }
    
    /**
     * Check WebGL 2.0 compatibility
     */
    checkWebGL2Compatibility(source, errors, warnings) {
        // Check for deprecated WebGL 1.0 features
        const deprecatedFeatures = [
            'attribute ', 'varying ', 'texture2D(', 'textureCube('
        ];
        
        const lines = source.split('\n');
        deprecatedFeatures.forEach(feature => {
            lines.forEach((line, index) => {
                if (line.includes(feature) && source.includes('#version 300')) {
                    warnings.push({
                        type: 'webgl2_compatibility',
                        message: `Deprecated feature '${feature.trim()}' in GLSL ES 3.0+`,
                        line: index + 1
                    });
                }
            });
        });
    }
    
    /**
     * Analyze shader performance
     */
    analyzePerformance(source, shaderType) {
        const analysis = {
            complexity: 'low',
            textureReads: 0,
            mathOperations: 0,
            branchingStatements: 0,
            loopCount: 0,
            suggestions: []
        };
        
        const lines = source.split('\n');
        
        lines.forEach(line => {
            // Count texture reads
            const textureReads = (line.match(/texture[^(]*\(/g) || []).length;
            analysis.textureReads += textureReads;
            
            // Count math operations
            const mathOps = (line.match(/[+\-*/]/g) || []).length;
            analysis.mathOperations += mathOps;
            
            // Count branching statements
            if (line.includes('if') || line.includes('switch')) {
                analysis.branchingStatements++;
            }
            
            // Count loops
            if (line.includes('for') || line.includes('while')) {
                analysis.loopCount++;
            }
        });
        
        // Determine complexity
        const complexityScore = 
            analysis.textureReads * 2 + 
            analysis.mathOperations * 0.1 + 
            analysis.branchingStatements * 3 + 
            analysis.loopCount * 5;
        
        if (complexityScore > 50) analysis.complexity = 'high';
        else if (complexityScore > 20) analysis.complexity = 'medium';
        
        // Generate performance suggestions
        if (analysis.textureReads > 8) {
            analysis.suggestions.push('Consider reducing texture reads for better mobile performance');
        }
        
        if (analysis.branchingStatements > 5) {
            analysis.suggestions.push('Excessive branching may cause performance issues on some GPUs');
        }
        
        if (analysis.loopCount > 2) {
            analysis.suggestions.push('Consider unrolling loops or using lookup textures for better performance');
        }
        
        return analysis;
    }
    
    /**
     * Generate optimization suggestions
     */
    generateOptimizations(source, shaderType) {
        const optimizations = [];
        
        // Check for common optimization opportunities
        const lines = source.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Suggest const for unchanging values
            if (line.match(/^\s*(float|int|vec[234]|mat[234])\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=/) && 
                !line.includes('const')) {
                optimizations.push({
                    type: 'const_optimization',
                    message: 'Consider using const for unchanging values',
                    line: lineNum,
                    suggestion: line.replace(/^\s*(float|int|vec[234]|mat[234])/, 'const $1')
                });
            }
            
            // Suggest precision qualifiers
            if (line.match(/^\s*(float|vec[234]|mat[234])\s+/) && 
                !line.includes('lowp') && !line.includes('mediump') && !line.includes('highp')) {
                optimizations.push({
                    type: 'precision_optimization',
                    message: 'Consider using appropriate precision qualifiers for mobile',
                    line: lineNum,
                    suggestion: line.replace(/^\s*(float|vec[234]|mat[234])/, 'mediump $1')
                });
            }
            
            // Suggest pow optimization
            if (line.includes('pow(') && line.includes(', 2.0)')) {
                optimizations.push({
                    type: 'math_optimization',
                    message: 'Use x*x instead of pow(x, 2.0) for better performance',
                    line: lineNum
                });
            }
        });
        
        return optimizations;
    }
    
    /**
     * Update validation statistics
     */
    updateStats(result) {
        this.stats.filesProcessed++;
        
        if (result.valid) {
            this.stats.validShaders++;
        } else {
            this.stats.invalidShaders++;
        }
        
        this.stats.errors += result.errors.length;
        this.stats.warnings += result.warnings.length;
        this.stats.optimizationSuggestions += result.optimizations?.length || 0;
    }
    
    /**
     * Get validation statistics
     */
    getStats() {
        return { ...this.stats };
    }
}

// Main shader compiler class
class ShaderCompiler {
    constructor(options = {}) {
        this.validator = new ShaderValidator(options);
        this.options = {
            outputDir: options.outputDir || 'dist/shaders',
            minify: options.minify !== false,
            generateSourceMaps: options.generateSourceMaps !== false,
            ...options
        };
    }
    
    /**
     * Process all shaders in a directory
     */
    async processDirectory(inputDir, options = {}) {
        const results = [];
        
        try {
            const files = await this.findShaderFiles(inputDir);
            
            console.log(chalk.blue(`Found ${files.length} shader files in ${inputDir}`));
            
            for (const file of files) {
                const result = await this.validator.validateShader(file, options);
                results.push(result);
                
                // Print result
                this.printValidationResult(result);
            }
            
            // Print summary
            this.printSummary(this.validator.getStats());
            
            return results;
            
        } catch (error) {
            console.error(chalk.red(`Error processing directory ${inputDir}:`, error.message));
            return [];
        }
    }
    
    /**
     * Find all shader files in directory
     */
    async findShaderFiles(dir) {
        const files = [];
        
        async function traverse(currentDir) {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (entry.isDirectory()) {
                    await traverse(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (['.glsl', '.frag', '.vert', '.vs', '.fs'].includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        }
        
        await traverse(dir);
        return files;
    }
    
    /**
     * Print validation result
     */
    printValidationResult(result) {
        const relativePath = path.relative(process.cwd(), result.filePath);
        
        if (result.valid) {
            console.log(chalk.green(`✓ ${relativePath}`));
        } else {
            console.log(chalk.red(`✗ ${relativePath}`));
        }
        
        // Print errors
        result.errors.forEach(error => {
            console.log(chalk.red(`  Error (line ${error.line}): ${error.message}`));
        });
        
        // Print warnings
        result.warnings.forEach(warning => {
            console.log(chalk.yellow(`  Warning (line ${warning.line}): ${warning.message}`));
        });
        
        // Print optimizations
        if (result.optimizations && result.optimizations.length > 0) {
            result.optimizations.forEach(opt => {
                console.log(chalk.cyan(`  Optimization (line ${opt.line}): ${opt.message}`));
            });
        }
        
        // Print performance info
        if (result.performance) {
            const complexity = result.performance.complexity;
            const complexityColor = complexity === 'high' ? 'red' : complexity === 'medium' ? 'yellow' : 'green';
            console.log(chalk[complexityColor](`  Complexity: ${complexity}`));
        }
    }
    
    /**
     * Print validation summary
     */
    printSummary(stats) {
        console.log('\n' + chalk.bold('Validation Summary:'));
        console.log(`  Files processed: ${stats.filesProcessed}`);
        console.log(chalk.green(`  Valid shaders: ${stats.validShaders}`));
        console.log(chalk.red(`  Invalid shaders: ${stats.invalidShaders}`));
        console.log(chalk.yellow(`  Warnings: ${stats.warnings}`));
        console.log(chalk.red(`  Errors: ${stats.errors}`));
        console.log(chalk.cyan(`  Optimization suggestions: ${stats.optimizationSuggestions}`));
        
        const successRate = stats.filesProcessed > 0 ? 
            (stats.validShaders / stats.filesProcessed * 100).toFixed(1) : 0;
        console.log(`  Success rate: ${successRate}%`);
    }
    
    /**
     * Watch directory for changes
     */
    watchDirectory(inputDir, options = {}) {
        console.log(chalk.blue(`Watching ${inputDir} for changes...`));
        
        const watcher = chokidar.watch(inputDir, {
            ignored: /node_modules/,
            persistent: true
        });
        
        watcher.on('change', async (filePath) => {
            if (['.glsl', '.frag', '.vert', '.vs', '.fs'].includes(path.extname(filePath))) {
                console.log(chalk.blue(`\nRecompiling ${filePath}...`));
                const result = await this.validator.validateShader(filePath, options);
                this.printValidationResult(result);
            }
        });
        
        return watcher;
    }
}

// CLI setup
program
    .name('shader-compiler')
    .description('GLSL Shader Compiler and Validation Tool for GLSL Music Visualizer')
    .version('1.0.0');

program
    .command('validate')
    .description('Validate all shaders in the project')
    .option('-d, --dir <directory>', 'Shader directory to validate', 'src/shaders')
    .option('--strict', 'Enable strict validation mode')
    .option('--webgl1', 'Check WebGL 1.0 compatibility')
    .option('--webgl2', 'Check WebGL 2.0 compatibility')
    .option('--no-optimize', 'Disable optimization suggestions')
    .action(async (options) => {
        const compiler = new ShaderCompiler({
            strictMode: options.strict,
            webgl1Compatible: options.webgl1,
            webgl2Compatible: options.webgl2,
            enableOptimizations: options.optimize
        });
        
        const results = await compiler.processDirectory(options.dir);
        process.exit(results.some(r => !r.valid) ? 1 : 0);
    });

program
    .command('watch')
    .description('Watch shader directory for changes and validate automatically')
    .option('-d, --dir <directory>', 'Shader directory to watch', 'src/shaders')
    .option('--strict', 'Enable strict validation mode')
    .action(async (options) => {
        const compiler = new ShaderCompiler({
            strictMode: options.strict
        });
        
        const watcher = compiler.watchDirectory(options.dir);
        
        // Initial validation
        await compiler.processDirectory(options.dir);
        
        // Keep process alive
        process.on('SIGINT', () => {
            console.log(chalk.blue('\nStopping shader watcher...'));
            watcher.close();
            process.exit(0);
        });
    });

program
    .command('optimize')
    .description('Optimize and minify shaders for production')
    .option('-d, --dir <directory>', 'Shader directory', 'src/shaders')
    .option('-o, --output <directory>', 'Output directory', 'dist/shaders')
    .option('--no-minify', 'Disable minification')
    .action(async (options) => {
        console.log(chalk.blue('Shader optimization not yet implemented'));
        console.log('This feature will be available in a future update');
        process.exit(0);
    });

program
    .command('analyze')
    .description('Analyze shader performance and complexity')
    .option('-f, --file <file>', 'Specific shader file to analyze')
    .option('-d, --dir <directory>', 'Shader directory to analyze', 'src/shaders')
    .option('--json', 'Output results in JSON format')
    .action(async (options) => {
        const compiler = new ShaderCompiler();
        
        if (options.file) {
            // Analyze single file
            const result = await compiler.validator.validateShader(options.file);
            
            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                compiler.printValidationResult(result);
                
                if (result.performance) {
                    console.log('\n' + chalk.bold('Performance Analysis:'));
                    console.log(`  Texture reads: ${result.performance.textureReads}`);
                    console.log(`  Math operations: ${result.performance.mathOperations}`);
                    console.log(`  Branching statements: ${result.performance.branchingStatements}`);
                    console.log(`  Loop count: ${result.performance.loopCount}`);
                    console.log(`  Complexity: ${result.performance.complexity}`);
                    
                    if (result.performance.suggestions.length > 0) {
                        console.log('\n' + chalk.bold('Performance Suggestions:'));
                        result.performance.suggestions.forEach(suggestion => {
                            console.log(chalk.cyan(`  • ${suggestion}`));
                        });
                    }
                }
            }
        } else {
            // Analyze directory
            const results = await compiler.processDirectory(options.dir);
            
            if (options.json) {
                console.log(JSON.stringify(results, null, 2));
            }
        }
    });

program
    .command('check-compatibility')
    .description('Check shader compatibility across different WebGL versions')
    .option('-d, --dir <directory>', 'Shader directory', 'src/shaders')
    .option('--target <version>', 'Target WebGL version (1.0 or 2.0)', '2.0')
    .action(async (options) => {
        const isWebGL2 = options.target === '2.0';
        
        const compiler = new ShaderCompiler({
            webgl1Compatible: !isWebGL2,
            webgl2Compatible: isWebGL2
        });
        
        console.log(chalk.blue(`Checking compatibility for WebGL ${options.target}...`));
        
        const results = await compiler.processDirectory(options.dir);
        const incompatible = results.filter(r => !r.valid || r.warnings.some(w => w.type.includes('compatibility')));
        
        if (incompatible.length > 0) {
            console.log(chalk.yellow(`\nFound ${incompatible.length} files with compatibility issues:`));
            incompatible.forEach(result => {
                console.log(chalk.yellow(`  • ${path.relative(process.cwd(), result.filePath)}`));
            });
        } else {
            console.log(chalk.green('\nAll shaders are compatible!'));
        }
    });

program
    .command('deps')
    .description('Analyze shader dependencies and includes')
    .option('-d, --dir <directory>', 'Shader directory', 'src/shaders')
    .option('--graph', 'Generate dependency graph')
    .action(async (options) => {
        console.log(chalk.blue('Analyzing shader dependencies...'));
        
        const dependencies = new Map();
        const files = await findShaderFiles(options.dir);
        
        for (const file of files) {
            const source = await fs.readFile(file, 'utf-8');
            const includes = extractIncludes(source);
            dependencies.set(file, includes);
        }
        
        // Print dependency information
        console.log('\n' + chalk.bold('Shader Dependencies:'));
        dependencies.forEach((includes, file) => {
            const relativePath = path.relative(process.cwd(), file);
            console.log(chalk.blue(`${relativePath}:`));
            
            if (includes.length === 0) {
                console.log(chalk.gray('  No dependencies'));
            } else {
                includes.forEach(include => {
                    console.log(`  → ${include}`);
                });
            }
        });
        
        if (options.graph) {
            console.log('\n' + chalk.yellow('Dependency graph generation not yet implemented'));
        }
    });

// Helper functions
async function findShaderFiles(dir) {
    const files = [];
    
    async function traverse(currentDir) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            
            if (entry.isDirectory()) {
                await traverse(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (['.glsl', '.frag', '.vert', '.vs', '.fs'].includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    await traverse(dir);
    return files;
}

function extractIncludes(source) {
    const includeRegex = /#include\s+["<]([^">]+)[">]/g;
    const includes = [];
    let match;
    
    while ((match = includeRegex.exec(source)) !== null) {
        includes.push(match[1]);
    }
    
    return includes;
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('Unhandled rejection:'), error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught exception:'), error);
    process.exit(1);
});

// Run CLI if this file is executed directly
if (require.main === module) {
    program.parse();
}

// Export for programmatic use
module.exports = {
    ShaderValidator,
    ShaderCompiler
};