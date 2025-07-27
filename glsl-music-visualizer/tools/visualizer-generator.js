#!/usr/bin/env node

/**
 * Advanced Visualizer Generator for GLSL Music Visualizer
 * Location: tools/visualizer-generator.js
 * 
 * Automated code generation tool for creating new visualizer implementations
 * Generates complete visualizer packages with shaders, physics, materials, and integration code
 * Follows the established BaseVisualizer architecture and coding patterns
 */

const fs = require('fs').promises;
const path = require('path');
const process = require('process');

class AdvancedVisualizerGenerator {
    constructor() {
        this.config = {
            outputDir: './src/visualizers',
            templatesDir: './tools/templates',
            generateShaders: true,
            generatePhysics: true,
            generateMaterials: true,
            generateTests: true,
            generateDocs: true,
            defaultAuthor: 'Advanced Graphics Team',
            defaultLicense: 'MIT',
            defaultVersion: '1.0.0'
        };
        
        this.templates = new Map();
        this.templateVariables = new Map();
        
        this.visualizerTypes = {
            geometric: {
                description: 'Geometric pattern visualizer with mathematical precision',
                features: ['parametric_equations', 'fractal_geometry', 'symmetry_patterns'],
                shaderComplexity: 'medium',
                physicsRequired: false,
                materialTypes: ['crystalline', 'metallic', 'glass']
            },
            particle: {
                description: 'Particle system visualizer with dynamic behaviors',
                features: ['particle_physics', 'force_fields', 'collision_detection'],
                shaderComplexity: 'high',
                physicsRequired: true,
                materialTypes: ['plasma', 'energy', 'dust', 'sparks']
            },
            fluid: {
                description: 'Fluid simulation visualizer with realistic dynamics',
                features: ['navier_stokes', 'surface_tension', 'turbulence'],
                shaderComplexity: 'very_high',
                physicsRequired: true,
                materialTypes: ['water', 'oil', 'mercury', 'lava']
            },
            fractal: {
                description: 'Fractal pattern visualizer with infinite complexity',
                features: ['mandelbrot_sets', 'julia_sets', 'recursive_patterns'],
                shaderComplexity: 'high',
                physicsRequired: false,
                materialTypes: ['abstract', 'crystalline', 'organic']
            }
        };
        
        this.stats = {
            filesGenerated: 0,
            linesOfCode: 0,
            templatesUsed: 0,
            errorsEncountered: 0
        };
    }

    async run() {
        console.log('🚀 Starting Advanced Visualizer Generator for GLSL Music Visualizer\n');
        
        try {
            const options = await this.parseArguments();
            await this.initialize();
            await this.loadTemplates();
            await this.generateVisualizer(options);
            await this.generateDocumentation(options);
            await this.updateProjectFiles(options);
            
            if (this.config.generateTests) {
                await this.generateTests(options);
            }
            
            console.log('\n✅ Visualizer generation completed successfully!');
            console.log(`📁 Generated ${this.stats.filesGenerated} files`);
            console.log(`📝 Created ${this.stats.linesOfCode} lines of code`);
            console.log(`📋 Location: ${path.join(this.config.outputDir, this.toKebabCase(options.name))}`);
            
        } catch (error) {
            console.error('\n❌ Visualizer generation failed:', error.message);
            process.exit(1);
        }
    }

    async parseArguments() {
        const args = process.argv.slice(2);
        const options = {
            name: null,
            type: 'geometric',
            className: null,
            description: '',
            author: this.config.defaultAuthor,
            features: [],
            materials: [],
            interactive: false
        };
        
        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--name':
                case '-n':
                    options.name = args[++i];
                    options.className = this.toPascalCase(options.name);
                    break;
                    
                case '--type':
                case '-t':
                    options.type = args[++i];
                    break;
                    
                case '--description':
                case '-d':
                    options.description = args[++i];
                    break;
                    
                case '--interactive':
                case '-i':
                    options.interactive = true;
                    break;
                    
                case '--help':
                case '-h':
                    this.showHelp();
                    process.exit(0);
                    break;
            }
        }
        
        if (options.interactive || !options.name) {
            return await this.runInteractiveMode(options);
        }
        
        if (!options.name) {
            throw new Error('Visualizer name is required. Use --name or -n flag.');
        }
        
        // Apply type defaults
        if (this.visualizerTypes[options.type]) {
            const typeSpec = this.visualizerTypes[options.type];
            if (!options.description) {
                options.description = typeSpec.description;
            }
            if (options.features.length === 0) {
                options.features = typeSpec.features;
            }
            if (options.materials.length === 0) {
                options.materials = typeSpec.materialTypes;
            }
        }
        
        return options;
    }

    async runInteractiveMode(baseOptions) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
        
        console.log('🎨 Interactive Visualizer Generator\n');
        
        if (!baseOptions.name) {
            baseOptions.name = await question('Visualizer name: ');
            baseOptions.className = this.toPascalCase(baseOptions.name);
        }
        
        console.log('\nAvailable types:');
        Object.entries(this.visualizerTypes).forEach(([key, spec]) => {
            console.log(`  ${key}: ${spec.description}`);
        });
        
        const typeInput = await question(`\nVisualizer type (${baseOptions.type}): `);
        if (typeInput.trim()) {
            baseOptions.type = typeInput.trim();
        }
        
        const defaultDesc = this.visualizerTypes[baseOptions.type]?.description || '';
        const descInput = await question(`\nDescription (${defaultDesc}): `);
        if (descInput.trim()) {
            baseOptions.description = descInput.trim();
        } else if (this.visualizerTypes[baseOptions.type]) {
            baseOptions.description = this.visualizerTypes[baseOptions.type].description;
        }
        
        rl.close();
        return baseOptions;
    }

    showHelp() {
        console.log(`
Advanced Visualizer Generator for GLSL Music Visualizer

Usage: node tools/visualizer-generator.js [options]

Options:
  -n, --name <name>          Visualizer name (required)
  -t, --type <type>          Visualizer type (default: geometric)
  -d, --description <desc>   Visualizer description
  -i, --interactive          Run in interactive mode
  -h, --help                 Show this help message

Visualizer Types:
  geometric                  Geometric pattern visualizer
  particle                   Particle system visualizer
  fluid                      Fluid simulation visualizer
  fractal                    Fractal pattern visualizer

Examples:
  node tools/visualizer-generator.js -n "Crystal Garden" -t geometric
  node tools/visualizer-generator.js -i
        `);
    }

    async initialize() {
        console.log('🔧 Initializing visualizer generator...');
        
        await fs.mkdir(this.config.outputDir, { recursive: true });
        await fs.mkdir(this.config.templatesDir, { recursive: true });
        await this.validateProjectStructure();
        
        console.log('✅ Generator initialized');
    }

    async validateProjectStructure() {
        const requiredPaths = [
            'src/visualizers/base/BaseVisualizer.js',
            'src/core/VisualizerManager.js',
            'package.json'
        ];
        
        for (const requiredPath of requiredPaths) {
            try {
                await fs.access(requiredPath);
            } catch (error) {
                throw new Error(`Required project file not found: ${requiredPath}`);
            }
        }
    }

    async loadTemplates() {
        console.log('📋 Loading templates...');
        
        this.templates.set('visualizer_main', this.getMainTemplate());
        this.templates.set('vertex_shader', this.getVertexShaderTemplate());
        this.templates.set('fragment_shader', this.getFragmentShaderTemplate());
        
        console.log(`✅ Loaded ${this.templates.size} templates`);
    }

    getMainTemplate() {
        return `/**
 * {{VISUALIZER_NAME}} - {{DESCRIPTION}}
 * Location: src/visualizers/{{FOLDER_NAME}}/{{CLASS_NAME}}Visualizer.js
 * 
 * Generated by Advanced Visualizer Generator
 * Author: {{AUTHOR}}
 * Version: {{VERSION}}
 * Created: {{TIMESTAMP}}
 */

import { BaseVisualizer } from '../base/BaseVisualizer.js';
import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { WebGLUtils } from '../../utils/WebGLUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';
import { vec3, vec4, mat4 } from 'gl-matrix';

export class {{CLASS_NAME}}Visualizer extends BaseVisualizer {
    constructor(config = {}) {
        super('{{VISUALIZER_NAME}}', {
            type: '{{TYPE}}',
            version: '{{VERSION}}',
            ...config
        });
        
        this.visualizerConfig = {
            audioReactivity: config.audioReactivity || 1.0,
            bassResponse: config.bassResponse || 1.0,
            midResponse: config.midResponse || 0.7,
            trebleResponse: config.trebleResponse || 0.5,
            beatResponse: config.beatResponse || 1.5,
            enableLOD: config.enableLOD !== false,
            adaptiveQuality: config.adaptiveQuality !== false,
            maxComplexity: config.maxComplexity || 1.0
        };
        
        this.renderState = {
            time: 0,
            deltaTime: 0,
            frame: 0,
            audioInfluence: {
                bass: 0,
                mid: 0,
                treble: 0,
                beat: 0,
                volume: 0
            }
        };
        
        this.resources = {
            buffers: new Map(),
            textures: new Map(),
            uniforms: new Map()
        };
        
        console.log('{{CLASS_NAME}}Visualizer initialized');
    }
    
    async initialize(gl, canvas, integrations) {
        await this.initializeBase(gl, canvas, integrations);
        
        try {
            await this.initializeGeometry();
            await this.initializeShaders();
            this.setupWebGLState();
            this.cacheUniformLocations();
            
            console.log('✅ {{CLASS_NAME}}Visualizer initialization complete');
        } catch (error) {
            console.error('Failed to initialize {{CLASS_NAME}}Visualizer:', error);
            throw error;
        }
    }
    
    update(deltaTime, audioData) {
        if (!this.state.isInitialized) return;
        
        this.updateBase(deltaTime, audioData);
        this.updateRenderState(deltaTime, audioData);
        this.updateUniforms(deltaTime, audioData);
    }
    
    render(deltaTime, renderState) {
        if (!this.state.isInitialized || !this.shaders.currentProgram) return;
        
        const gl = this.gl;
        
        gl.useProgram(this.shaders.currentProgram);
        this.setupRenderState(gl);
        
        // Basic rendering
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        this.updatePerformanceMetrics();
    }
    
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        console.log(\`{{CLASS_NAME}}Visualizer resized to \${width}x\${height}\`);
    }
    
    async initializeGeometry() {
        // Create a simple quad for basic rendering
        const vertices = new Float32Array([
            -1, -1, 0,
             1, -1, 0,
            -1,  1, 0,
             1, -1, 0,
             1,  1, 0,
            -1,  1, 0
        ]);
        
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
        
        this.resources.buffers.set('vertices', buffer);
    }
    
    async initializeShaders() {
        try {
            this.shaders.vertexProgram = await this.integrations.shaderManager.loadShader(
                'src/shaders/{{FOLDER_NAME}}.vert',
                'vertex'
            );
            
            this.shaders.fragmentProgram = await this.integrations.shaderManager.loadShader(
                'src/shaders/{{FOLDER_NAME}}.frag',
                'fragment'
            );
            
            this.shaders.currentProgram = await this.integrations.shaderManager.createProgram(
                this.shaders.vertexProgram,
                this.shaders.fragmentProgram,
                '{{FOLDER_NAME}}_visualizer'
            );
            
            console.log('✅ {{CLASS_NAME}} shaders initialized');
        } catch (error) {
            console.error('Failed to initialize {{CLASS_NAME}} shaders:', error);
            throw error;
        }
    }
    
    updateRenderState(deltaTime, audioData) {
        this.renderState.time += deltaTime;
        this.renderState.deltaTime = deltaTime;
        this.renderState.frame++;
        
        if (audioData) {
            this.renderState.audioInfluence = {
                bass: audioData.bass * this.visualizerConfig.bassResponse,
                mid: audioData.mid * this.visualizerConfig.midResponse,
                treble: audioData.treble * this.visualizerConfig.trebleResponse,
                beat: audioData.beat * this.visualizerConfig.beatResponse,
                volume: audioData.volume
            };
        }
    }
    
    cacheUniformLocations() {
        const gl = this.gl;
        const program = this.shaders.currentProgram;
        
        if (!program) return;
        
        this.cacheUniform('u_time');
        this.cacheUniform('u_resolution');
        this.cacheUniform('u_bassLevel');
        this.cacheUniform('u_midLevel');
        this.cacheUniform('u_trebleLevel');
        this.cacheUniform('u_beatLevel');
    }
    
    updateUniforms(deltaTime, audioData) {
        this.setUniform('u_time', this.renderState.time);
        this.setUniform('u_resolution', [this.canvas.width, this.canvas.height]);
        
        if (audioData) {
            this.setUniform('u_bassLevel', this.renderState.audioInfluence.bass);
            this.setUniform('u_midLevel', this.renderState.audioInfluence.mid);
            this.setUniform('u_trebleLevel', this.renderState.audioInfluence.treble);
            this.setUniform('u_beatLevel', this.renderState.audioInfluence.beat);
        }
    }
    
    setupRenderState(gl) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    
    dispose() {
        if (this.gl) {
            this.resources.buffers.forEach(buffer => this.gl.deleteBuffer(buffer));
            this.resources.textures.forEach(texture => this.gl.deleteTexture(texture));
        }
        
        this.resources.buffers.clear();
        this.resources.textures.clear();
        
        console.log('{{CLASS_NAME}}Visualizer disposed');
    }
}
`;
    }

    getVertexShaderTemplate() {
        return `/**
 * {{VISUALIZER_NAME}} Vertex Shader
 * Location: src/shaders/{{FOLDER_NAME}}.vert
 * 
 * Generated by Advanced Visualizer Generator
 * Author: {{AUTHOR}}
 */

#version 300 es

precision highp float;

in vec3 a_position;

uniform float u_time;
uniform vec2 u_resolution;

out vec2 v_uv;

void main() {
    v_uv = a_position.xy * 0.5 + 0.5;
    gl_Position = vec4(a_position, 1.0);
}
`;
    }

    getFragmentShaderTemplate() {
        return `/**
 * {{VISUALIZER_NAME}} Fragment Shader
 * Location: src/shaders/{{FOLDER_NAME}}.frag
 * 
 * Generated by Advanced Visualizer Generator
 * Author: {{AUTHOR}}
 */

#version 300 es

precision highp float;

in vec2 v_uv;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bassLevel;
uniform float u_midLevel;
uniform float u_trebleLevel;
uniform float u_beatLevel;

out vec4 fragColor;

void main() {
    vec2 uv = v_uv;
    vec3 color = vec3(0.0);
    
    // Basic {{TYPE}} visualization
    float pattern = sin(uv.x * 10.0 + u_time) * sin(uv.y * 10.0 + u_time);
    color = vec3(pattern * 0.5 + 0.5);
    
    // Audio reactivity
    color *= 1.0 + u_beatLevel * 0.5;
    color.r *= 1.0 + u_bassLevel * 0.3;
    color.g *= 1.0 + u_midLevel * 0.3;
    color.b *= 1.0 + u_trebleLevel * 0.3;
    
    fragColor = vec4(color, 1.0);
}
`;
    }

    async generateVisualizer(options) {
        console.log(`🎨 Generating ${options.name} visualizer...`);
        
        const folderName = this.toKebabCase(options.name);
        const visualizerDir = path.join(this.config.outputDir, folderName);
        
        await fs.mkdir(visualizerDir, { recursive: true });
        
        this.setupTemplateVariables(options);
        
        await this.generateMainClass(options, visualizerDir);
        
        if (this.config.generateShaders) {
            await this.generateShaders(options);
        }
        
        console.log(`✅ ${options.name} visualizer generated`);
    }

    setupTemplateVariables(options) {
        this.templateVariables = new Map([
            ['VISUALIZER_NAME', options.name],
            ['CLASS_NAME', options.className],
            ['FOLDER_NAME', this.toKebabCase(options.name)],
            ['TYPE', options.type],
            ['DESCRIPTION', options.description],
            ['AUTHOR', options.author],
            ['VERSION', this.config.defaultVersion],
            ['TIMESTAMP', new Date().toISOString()]
        ]);
    }

    async generateMainClass(options, outputDir) {
        const template = this.templates.get('visualizer_main');
        const content = this.processTemplate(template);
        
        const filePath = path.join(outputDir, `${options.className}Visualizer.js`);
        await fs.writeFile(filePath, content);
        
        this.stats.filesGenerated++;
        this.stats.linesOfCode += content.split('\n').length;
        
        console.log(`  📄 Generated ${options.className}Visualizer.js`);
    }

    async generateShaders(options) {
        const shaderDir = path.join('./src/shaders');
        await fs.mkdir(shaderDir, { recursive: true });
        
        const folderName = this.toKebabCase(options.name);
        
        const vertexTemplate = this.templates.get('vertex_shader');
        const vertexContent = this.processTemplate(vertexTemplate);
        const vertexPath = path.join(shaderDir, `${folderName}.vert`);
        await fs.writeFile(vertexPath, vertexContent);
        
        const fragmentTemplate = this.templates.get('fragment_shader');
        const fragmentContent = this.processTemplate(fragmentTemplate);
        const fragmentPath = path.join(shaderDir, `${folderName}.frag`);
        await fs.writeFile(fragmentPath, fragmentContent);
        
        this.stats.filesGenerated += 2;
        this.stats.linesOfCode += vertexContent.split('\n').length + fragmentContent.split('\n').length;
        
        console.log(`  🎨 Generated shader files`);
    }

    async generateDocumentation(options) {
        console.log('📚 Generating documentation...');
        
        const docsDir = path.join('./docs/visualizers');
        await fs.mkdir(docsDir, { recursive: true });
        
        const docContent = `# ${options.name} Visualizer

## Overview
${options.description}

**Type:** ${options.type}  
**Author:** ${options.author}  
**Version:** ${this.config.defaultVersion}  
**Generated:** ${new Date().toLocaleString()}

## Usage

\`\`\`javascript
import { ${options.className}Visualizer } from './src/visualizers/${this.toKebabCase(options.name)}/${options.className}Visualizer.js';

const visualizer = new ${options.className}Visualizer({
    audioReactivity: 1.0,
    bassResponse: 1.0,
    midResponse: 0.7,
    trebleResponse: 0.5,
    beatResponse: 1.5
});

await visualizer.initialize(gl, canvas, integrations);

function renderFrame(deltaTime, audioData) {
    visualizer.update(deltaTime, audioData);
    visualizer.render(deltaTime, renderState);
}
\`\`\`

## Configuration Options

- \`audioReactivity\`: Overall audio responsiveness (default: 1.0)
- \`bassResponse\`: Bass frequency response (default: 1.0)
- \`midResponse\`: Mid frequency response (default: 0.7)
- \`trebleResponse\`: Treble frequency response (default: 0.5)
- \`beatResponse\`: Beat detection response (default: 1.5)

## Methods

### \`initialize(gl, canvas, integrations)\`
Initialize the visualizer with WebGL context and integrations.

### \`update(deltaTime, audioData)\`
Update the visualizer state with new audio data.

### \`render(deltaTime, renderState)\`
Render the visualizer to the WebGL context.

### \`resize(width, height)\`
Handle canvas resize events.

### \`dispose()\`
Clean up all resources and event listeners.

---
*Generated by Advanced Visualizer Generator*
`;
        
        const docPath = path.join(docsDir, `${this.toKebabCase(options.name)}.md`);
        await fs.writeFile(docPath, docContent);
        
        this.stats.filesGenerated++;
        this.stats.linesOfCode += docContent.split('\n').length;
        
        console.log(`  📖 Generated documentation`);
    }

    async updateProjectFiles(options) {
        console.log('📝 Updating project files...');
        
        try {
            const managerPath = './src/core/VisualizerManager.js';
            let content = await fs.readFile(managerPath, 'utf8');
            
            const importStatement = `import { ${options.className}Visualizer } from '../visualizers/${this.toKebabCase(options.name)}/${options.className}Visualizer.js';`;
            
            const importSection = content.match(/import.*from.*\.js';/g);
            if (importSection) {
                const lastImport = importSection[importSection.length - 1];
                const importIndex = content.indexOf(lastImport) + lastImport.length;
                content = content.slice(0, importIndex) + '\n' + importStatement + content.slice(importIndex);
            }
            
            await fs.writeFile(managerPath, content);
            console.log(`  ✅ Updated VisualizerManager.js`);
            
        } catch (error) {
            console.warn('Could not automatically update VisualizerManager:', error.message);
            console.log(`Please manually add: import { ${options.className}Visualizer } from '../visualizers/${this.toKebabCase(options.name)}/${options.className}Visualizer.js';`);
        }
    }

    async generateTests(options) {
        console.log('🧪 Generating test files...');
        
        const testsDir = path.join('./tests/visualizers');
        await fs.mkdir(testsDir, { recursive: true });
        
        const testContent = `/**
 * ${options.name} Visualizer Tests
 * Generated by Advanced Visualizer Generator
 */

import { ${options.className}Visualizer } from '../../src/visualizers/${this.toKebabCase(options.name)}/${options.className}Visualizer.js';

describe('${options.className}Visualizer', () => {
    let visualizer;
    
    beforeEach(() => {
        visualizer = new ${options.className}Visualizer();
    });
    
    afterEach(() => {
        if (visualizer) {
            visualizer.dispose();
        }
    });
    
    test('should initialize with default configuration', () => {
        expect(visualizer.name).toBe('${options.name}');
        expect(visualizer.type).toBe('${options.type}');
        expect(visualizer.version).toBe('${this.config.defaultVersion}');
    });
    
    test('should handle audio data updates', () => {
        const audioData = {
            bass: 0.5,
            mid: 0.3,
            treble: 0.2,
            beat: 0.8,
            volume: 0.6
        };
        
        expect(() => visualizer.update(16.67, audioData)).not.toThrow();
    });
    
    test('should handle resize events', () => {
        expect(() => visualizer.resize(1920, 1080)).not.toThrow();
    });
});
`;
        
        const testPath = path.join(testsDir, `${options.className}Visualizer.test.js`);
        await fs.writeFile(testPath, testContent);
        
        this.stats.filesGenerated++;
        this.stats.linesOfCode += testContent.split('\n').length;
        
        console.log(`  🧪 Generated test file`);
    }

    processTemplate(template) {
        let processed = template;
        
        for (const [key, value] of this.templateVariables) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            processed = processed.replace(regex, value);
        }
        
        return processed;
    }

    toPascalCase(str) {
        return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return word.toUpperCase();
        }).replace(/\s+/g, '');
    }

    toCamelCase(str) {
        const pascal = this.toPascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }

    toKebabCase(str) {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2')
                  .replace(/\s+/g, '-')
                  .toLowerCase();
    }
}

// Main execution
if (require.main === module) {
    const generator = new AdvancedVisualizerGenerator();
    generator.run().catch(error => {
        console.error('Visualizer generation failed:', error);
        process.exit(1);
    });
}

module.exports = {
    AdvancedVisualizerGenerator
};