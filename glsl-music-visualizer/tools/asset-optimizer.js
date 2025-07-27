#!/usr/bin/env node

/**
 * Advanced Asset Optimizer for GLSL Music Visualizer
 * Location: tools/asset-optimizer.js
 * 
 * Comprehensive asset optimization and preprocessing tool
 * Optimizes shaders, textures, audio files, and other assets for maximum performance
 * Integrates with webpack configuration and existing build pipeline
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');
const process = require('process');

class AdvancedAssetOptimizer {
    constructor() {
        this.config = {
            // Input/Output directories
            inputDir: './assets',
            outputDir: './assets-optimized',
            tempDir: './temp-optimization',
            
            // Asset types to process
            assetTypes: {
                shaders: { extensions: ['.glsl', '.vert', '.frag'], enabled: true },
                textures: { extensions: ['.png', '.jpg', '.jpeg', '.webp', '.hdr'], enabled: true },
                audio: { extensions: ['.mp3', '.wav', '.ogg', '.m4a'], enabled: true },
                fonts: { extensions: ['.woff', '.woff2', '.ttf', '.otf'], enabled: true },
                data: { extensions: ['.json', '.csv', '.txt'], enabled: true },
                presets: { extensions: ['.json'], enabled: true }
            },
            
            // Optimization settings
            optimization: {
                aggressive: false,
                preserveOriginals: true,
                generateManifest: true,
                enableCompression: true,
                enableVersioning: true,
                parallelProcessing: true
            },
            
            // Quality settings
            quality: {
                textures: {
                    jpeg: 85,
                    webp: 80,
                    png: 'high' // lossless
                },
                audio: {
                    mp3: 256, // kbps
                    ogg: 'q6', // quality level
                    compression: 'balanced'
                }
            },
            
            // Performance targets
            targets: {
                maxTextureSize: 2048,
                maxAudioBitrate: 320,
                maxFileSize: 5 * 1024 * 1024, // 5MB
                minCompressionRatio: 0.8
            }
        };
        
        // Optimization statistics
        this.stats = {
            processed: 0,
            skipped: 0,
            errors: 0,
            totalSizeBefor: 0,
            totalSizeAfter: 0,
            optimizationRatio: 0,
            processingTime: 0
        };
        
        // Asset manifest for tracking
        this.manifest = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            assets: {},
            optimizations: {},
            checksums: {}
        };
        
        // Available optimizers
        this.optimizers = new Map();
        
        // Processing queue
        this.processingQueue = [];
        this.concurrentLimit = require('os').cpus().length;
    }

    /**
     * Main entry point for asset optimization
     */
    async run() {
        console.log('🚀 Starting Advanced Asset Optimizer for GLSL Music Visualizer\n');
        
        try {
            // Parse command line arguments
            this.parseArguments();
            
            // Initialize optimizer
            await this.initialize();
            
            // Discover assets
            await this.discoverAssets();
            
            // Initialize optimizers
            await this.initializeOptimizers();
            
            // Process assets
            await this.processAssets();
            
            // Generate manifest and reports
            await this.generateManifest();
            await this.generateOptimizationReport();
            
            // Cleanup
            await this.cleanup();
            
            console.log('\n✅ Asset optimization completed successfully!');
            console.log(`📊 Processed ${this.stats.processed} assets`);
            console.log(`💾 Size reduction: ${((1 - this.stats.optimizationRatio) * 100).toFixed(1)}%`);
            
        } catch (error) {
            console.error('\n❌ Asset optimization failed:', error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const args = process.argv.slice(2);
        
        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--input':
                case '-i':
                    this.config.inputDir = args[++i];
                    break;
                    
                case '--output':
                case '-o':
                    this.config.outputDir = args[++i];
                    break;
                    
                case '--aggressive':
                case '-a':
                    this.config.optimization.aggressive = true;
                    break;
                    
                case '--preserve-originals':
                case '-p':
                    this.config.optimization.preserveOriginals = true;
                    break;
                    
                case '--no-compression':
                    this.config.optimization.enableCompression = false;
                    break;
                    
                case '--quality':
                case '-q':
                    const quality = args[++i];
                    this.setQualityPreset(quality);
                    break;
                    
                case '--type':
                case '-t':
                    const assetType = args[++i];
                    this.enableOnlyAssetType(assetType);
                    break;
                    
                case '--parallel':
                    this.config.concurrentLimit = parseInt(args[++i]) || this.config.concurrentLimit;
                    break;
                    
                case '--help':
                case '-h':
                    this.showHelp();
                    process.exit(0);
                    break;
                    
                default:
                    if (args[i].startsWith('-')) {
                        console.warn(`Unknown option: ${args[i]}`);
                    }
                    break;
            }
        }
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log(`
Advanced Asset Optimizer for GLSL Music Visualizer

Usage: node tools/asset-optimizer.js [options]

Options:
  -i, --input <directory>      Input assets directory (default: ./assets)
  -o, --output <directory>     Output directory (default: ./assets-optimized)
  -a, --aggressive             Enable aggressive optimization (may reduce quality)
  -p, --preserve-originals     Keep original files alongside optimized versions
  --no-compression             Disable compression optimization
  -q, --quality <preset>       Quality preset: low, medium, high, lossless (default: high)
  -t, --type <type>            Optimize only specific asset type: shaders, textures, audio, fonts, data
  --parallel <count>           Number of parallel processes (default: CPU count)
  -h, --help                   Show this help message

Quality Presets:
  low                          Aggressive compression, smaller files, lower quality
  medium                       Balanced compression and quality
  high                         High quality with moderate compression
  lossless                     Maximum quality, lossless compression where possible

Asset Types:
  shaders                      GLSL shader files (.glsl, .vert, .frag)
  textures                     Image files (.png, .jpg, .webp, .hdr)
  audio                        Audio files (.mp3, .wav, .ogg, .m4a)
  fonts                        Font files (.woff, .woff2, .ttf, .otf)
  data                         Data files (.json, .csv, .txt)
  presets                      Visualizer preset files

Examples:
  node tools/asset-optimizer.js                           # Optimize all assets with default settings
  node tools/asset-optimizer.js -a -q low                # Aggressive optimization, low quality
  node tools/asset-optimizer.js -t textures -q lossless  # Optimize only textures, lossless quality
  node tools/asset-optimizer.js --parallel 8 -p          # Use 8 parallel processes, preserve originals
        `);
    }

    /**
     * Set quality preset
     */
    setQualityPreset(preset) {
        switch (preset.toLowerCase()) {
            case 'low':
                this.config.quality.textures.jpeg = 65;
                this.config.quality.textures.webp = 60;
                this.config.quality.audio.mp3 = 128;
                this.config.quality.audio.ogg = 'q3';
                this.config.optimization.aggressive = true;
                break;
                
            case 'medium':
                this.config.quality.textures.jpeg = 75;
                this.config.quality.textures.webp = 70;
                this.config.quality.audio.mp3 = 192;
                this.config.quality.audio.ogg = 'q5';
                break;
                
            case 'high':
                this.config.quality.textures.jpeg = 85;
                this.config.quality.textures.webp = 80;
                this.config.quality.audio.mp3 = 256;
                this.config.quality.audio.ogg = 'q6';
                break;
                
            case 'lossless':
                this.config.quality.textures.jpeg = 95;
                this.config.quality.textures.webp = 95;
                this.config.quality.textures.png = 'lossless';
                this.config.quality.audio.mp3 = 320;
                this.config.quality.audio.ogg = 'q8';
                this.config.optimization.aggressive = false;
                break;
        }
    }

    /**
     * Enable only specific asset type
     */
    enableOnlyAssetType(type) {
        // Disable all asset types
        Object.values(this.config.assetTypes).forEach(assetType => {
            assetType.enabled = false;
        });
        
        // Enable specified type
        if (this.config.assetTypes[type]) {
            this.config.assetTypes[type].enabled = true;
        } else {
            console.warn(`Unknown asset type: ${type}`);
        }
    }

    /**
     * Initialize optimizer environment
     */
    async initialize() {
        console.log('🔧 Initializing asset optimizer...');
        
        // Create output directories
        await fs.mkdir(this.config.outputDir, { recursive: true });
        await fs.mkdir(this.config.tempDir, { recursive: true });
        
        // Validate input directory
        try {
            await fs.access(this.config.inputDir);
        } catch (error) {
            throw new Error(`Input directory not found: ${this.config.inputDir}`);
        }
        
        // Check for required tools
        await this.checkDependencies();
        
        console.log('✅ Optimizer initialized');
    }

    /**
     * Check for required optimization tools
     */
    async checkDependencies() {
        const requiredTools = [];
        
        // Check for image optimization tools
        if (this.config.assetTypes.textures.enabled) {
            try {
                execSync('which convert', { stdio: 'ignore' });
            } catch (error) {
                console.warn('ImageMagick not found. Some image optimizations may be limited.');
            }
        }
        
        // Check for audio optimization tools
        if (this.config.assetTypes.audio.enabled) {
            try {
                execSync('which ffmpeg', { stdio: 'ignore' });
            } catch (error) {
                console.warn('FFmpeg not found. Audio optimization will be limited.');
            }
        }
        
        // Install required Node.js packages
        const requiredPackages = ['imagemin', 'imagemin-mozjpeg', 'imagemin-pngquant', 'imagemin-webp', 'glsl-minifier'];
        
        for (const pkg of requiredPackages) {
            try {
                require.resolve(pkg);
            } catch (error) {
                requiredTools.push(pkg);
            }
        }
        
        if (requiredTools.length > 0) {
            console.log(`📦 Installing required packages: ${requiredTools.join(', ')}`);
            execSync(`npm install ${requiredTools.join(' ')}`, { stdio: 'inherit' });
        }
    }

    /**
     * Discover all assets in input directory
     */
    async discoverAssets() {
        console.log('🔍 Discovering assets...');
        
        const assets = [];
        
        for (const [typeName, typeConfig] of Object.entries(this.config.assetTypes)) {
            if (!typeConfig.enabled) continue;
            
            const typeAssets = await this.findAssetsByType(typeName, typeConfig.extensions);
            assets.push(...typeAssets);
        }
        
        this.processingQueue = assets;
        console.log(`Found ${assets.length} assets to optimize`);
        
        // Display breakdown by type
        const breakdown = {};
        assets.forEach(asset => {
            breakdown[asset.type] = (breakdown[asset.type] || 0) + 1;
        });
        
        Object.entries(breakdown).forEach(([type, count]) => {
            console.log(`  ${type}: ${count} files`);
        });
    }

    /**
     * Find assets by type and extensions
     */
    async findAssetsByType(typeName, extensions) {
        const assets = [];
        
        const searchPaths = [
            this.config.inputDir,
            './src/shaders', // Include shader files from source
            './assets/presets',
            './assets/textures',
            './assets/audio',
            './assets/fonts'
        ];
        
        for (const searchPath of searchPaths) {
            try {
                await fs.access(searchPath);
                const foundAssets = await this.scanDirectory(searchPath, extensions, typeName);
                assets.push(...foundAssets);
            } catch (error) {
                // Directory doesn't exist, skip silently
            }
        }
        
        return assets;
    }

    /**
     * Recursively scan directory for assets
     */
    async scanDirectory(dirPath, extensions, typeName) {
        const assets = [];
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Recursively scan subdirectories
                    const subAssets = await this.scanDirectory(fullPath, extensions, typeName);
                    assets.push(...subAssets);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    
                    if (extensions.includes(ext)) {
                        const stats = await fs.stat(fullPath);
                        
                        assets.push({
                            type: typeName,
                            path: fullPath,
                            name: entry.name,
                            extension: ext,
                            size: stats.size,
                            lastModified: stats.mtime
                        });
                    }
                }
            }
        } catch (error) {
            console.warn(`Error scanning directory ${dirPath}:`, error.message);
        }
        
        return assets;
    }

    /**
     * Initialize asset optimizers
     */
    async initializeOptimizers() {
        console.log('⚙️ Initializing optimizers...');
        
        // Shader optimizer
        this.optimizers.set('shaders', new ShaderOptimizer(this.config));
        
        // Texture optimizer
        this.optimizers.set('textures', new TextureOptimizer(this.config));
        
        // Audio optimizer
        this.optimizers.set('audio', new AudioOptimizer(this.config));
        
        // Font optimizer
        this.optimizers.set('fonts', new FontOptimizer(this.config));
        
        // Data optimizer
        this.optimizers.set('data', new DataOptimizer(this.config));
        
        // Preset optimizer
        this.optimizers.set('presets', new PresetOptimizer(this.config));
        
        console.log(`✅ Initialized ${this.optimizers.size} optimizers`);
    }

    /**
     * Process all assets in parallel
     */
    async processAssets() {
        console.log('\n🔄 Processing assets...');
        
        const startTime = performance.now();
        
        // Group assets by type for better progress reporting
        const assetGroups = {};
        this.processingQueue.forEach(asset => {
            if (!assetGroups[asset.type]) {
                assetGroups[asset.type] = [];
            }
            assetGroups[asset.type].push(asset);
        });
        
        // Process each group
        for (const [typeName, assets] of Object.entries(assetGroups)) {
            console.log(`\nProcessing ${assets.length} ${typeName} assets...`);
            
            if (this.config.optimization.parallelProcessing) {
                await this.processAssetsParallel(assets, typeName);
            } else {
                await this.processAssetsSequential(assets, typeName);
            }
        }
        
        this.stats.processingTime = performance.now() - startTime;
        this.stats.optimizationRatio = this.stats.totalSizeAfter / this.stats.totalSizeBefor;
    }

    /**
     * Process assets in parallel
     */
    async processAssetsParallel(assets, typeName) {
        const optimizer = this.optimizers.get(typeName);
        if (!optimizer) {
            console.warn(`No optimizer found for type: ${typeName}`);
            return;
        }
        
        const chunks = this.chunkArray(assets, this.config.concurrentLimit);
        
        for (const chunk of chunks) {
            const promises = chunk.map(asset => this.processAsset(asset, optimizer));
            await Promise.allSettled(promises);
        }
    }

    /**
     * Process assets sequentially
     */
    async processAssetsSequential(assets, typeName) {
        const optimizer = this.optimizers.get(typeName);
        if (!optimizer) {
            console.warn(`No optimizer found for type: ${typeName}`);
            return;
        }
        
        for (const asset of assets) {
            await this.processAsset(asset, optimizer);
        }
    }

    /**
     * Process a single asset
     */
    async processAsset(asset, optimizer) {
        try {
            const originalSize = asset.size;
            this.stats.totalSizeBefor += originalSize;
            
            // Calculate output path
            const relativePath = path.relative(this.config.inputDir, asset.path);
            const outputPath = path.join(this.config.outputDir, relativePath);
            
            // Ensure output directory exists
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            
            // Optimize asset
            const result = await optimizer.optimize(asset, outputPath);
            
            if (result.success) {
                const optimizedSize = result.size || originalSize;
                this.stats.totalSizeAfter += optimizedSize;
                this.stats.processed++;
                
                // Update manifest
                this.manifest.assets[asset.path] = {
                    originalSize: originalSize,
                    optimizedSize: optimizedSize,
                    compressionRatio: optimizedSize / originalSize,
                    outputPath: outputPath,
                    optimizations: result.optimizations || []
                };
                
                // Generate checksum
                if (result.outputPath && await this.fileExists(result.outputPath)) {
                    const checksum = await this.generateChecksum(result.outputPath);
                    this.manifest.checksums[asset.path] = checksum;
                }
                
                const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
                console.log(`  ✅ ${asset.name} (${savings}% smaller)`);
            } else {
                this.stats.skipped++;
                console.log(`  ⚠️ ${asset.name} (skipped: ${result.reason})`);
            }
            
        } catch (error) {
            this.stats.errors++;
            console.error(`  ❌ ${asset.name} (error: ${error.message})`);
        }
    }

    /**
     * Generate optimization manifest
     */
    async generateManifest() {
        console.log('\n📄 Generating optimization manifest...');
        
        this.manifest.statistics = {
            processedAssets: this.stats.processed,
            skippedAssets: this.stats.skipped,
            errorAssets: this.stats.errors,
            totalSizeBefor: this.stats.totalSizeBefor,
            totalSizeAfter: this.stats.totalSizeAfter,
            optimizationRatio: this.stats.optimizationRatio,
            processingTimeMs: this.stats.processingTime
        };
        
        const manifestPath = path.join(this.config.outputDir, 'optimization-manifest.json');
        await fs.writeFile(manifestPath, JSON.stringify(this.manifest, null, 2));
        
        console.log(`✅ Manifest saved to: ${manifestPath}`);
    }

    /**
     * Generate optimization report
     */
    async generateOptimizationReport() {
        console.log('📊 Generating optimization report...');
        
        const reportPath = path.join(this.config.outputDir, 'optimization-report.md');
        
        const report = `# Asset Optimization Report

**Generated:** ${new Date().toLocaleString()}
**Processing Time:** ${(this.stats.processingTime / 1000).toFixed(2)}s

## Summary

- **Total Assets Processed:** ${this.stats.processed}
- **Assets Skipped:** ${this.stats.skipped}
- **Errors:** ${this.stats.errors}
- **Original Total Size:** ${this.formatBytes(this.stats.totalSizeBefor)}
- **Optimized Total Size:** ${this.formatBytes(this.stats.totalSizeAfter)}
- **Size Reduction:** ${((1 - this.stats.optimizationRatio) * 100).toFixed(1)}%

## Asset Breakdown

${Object.entries(this.groupAssetsByType()).map(([type, assets]) => {
    const totalOriginal = assets.reduce((sum, asset) => sum + asset.originalSize, 0);
    const totalOptimized = assets.reduce((sum, asset) => sum + asset.optimizedSize, 0);
    const reduction = ((1 - totalOptimized / totalOriginal) * 100).toFixed(1);
    
    return `### ${type} (${assets.length} files)
- **Original Size:** ${this.formatBytes(totalOriginal)}
- **Optimized Size:** ${this.formatBytes(totalOptimized)}
- **Reduction:** ${reduction}%`;
}).join('\n\n')}

## Configuration Used

\`\`\`json
${JSON.stringify(this.config, null, 2)}
\`\`\`

---
*Generated by GLSL Music Visualizer Asset Optimizer*`;

        await fs.writeFile(reportPath, report);
        console.log(`✅ Report saved to: ${reportPath}`);
    }

    /**
     * Group assets by type for reporting
     */
    groupAssetsByType() {
        const groups = {};
        
        Object.values(this.manifest.assets).forEach(asset => {
            const type = this.getAssetType(asset.outputPath);
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(asset);
        });
        
        return groups;
    }

    /**
     * Get asset type from file path
     */
    getAssetType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (['.glsl', '.vert', '.frag'].includes(ext)) return 'Shaders';
        if (['.png', '.jpg', '.jpeg', '.webp', '.hdr'].includes(ext)) return 'Textures';
        if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'Audio';
        if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) return 'Fonts';
        if (['.json'].includes(ext)) return 'Data/Presets';
        
        return 'Other';
    }

    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Chunk array into smaller arrays
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Generate file checksum
     */
    async generateChecksum(filePath) {
        const hash = crypto.createHash('sha256');
        const data = await fs.readFile(filePath);
        hash.update(data);
        return hash.digest('hex');
    }

    /**
     * Cleanup temporary files
     */
    async cleanup() {
        console.log('🧹 Cleaning up...');
        
        try {
            await fs.rmdir(this.config.tempDir, { recursive: true });
        } catch (error) {
            // Ignore cleanup errors
        }
        
        console.log('✅ Cleanup completed');
    }
}

// Shader Optimizer Class
class ShaderOptimizer {
    constructor(config) {
        this.config = config;
    }

    async optimize(asset, outputPath) {
        try {
            const glslMinifier = require('glsl-minifier');
            
            // Read shader source
            const source = await fs.readFile(asset.path, 'utf8');
            
            // Minify shader
            const minified = glslMinifier(source, {
                preserveDefines: true,
                preserveUniforms: true,
                preserveVaryings: true
            });
            
            // Write optimized shader
            await fs.writeFile(outputPath, minified);
            
            const stats = await fs.stat(outputPath);
            
            return {
                success: true,
                size: stats.size,
                outputPath: outputPath,
                optimizations: ['minification', 'whitespace-removal']
            };
            
        } catch (error) {
            // Fallback: copy original file
            await fs.copyFile(asset.path, outputPath);
            
            return {
                success: true,
                size: asset.size,
                outputPath: outputPath,
                optimizations: ['copy-original'],
                reason: `Minification failed: ${error.message}`
            };
        }
    }
}

// Texture Optimizer Class
class TextureOptimizer {
    constructor(config) {
        this.config = config;
    }

    async optimize(asset, outputPath) {
        try {
            const imagemin = require('imagemin');
            const imageminMozjpeg = require('imagemin-mozjpeg');
            const imageminPngquant = require('imagemin-pngquant');
            const imageminWebp = require('imagemin-webp');
            
            const plugins = [];
            const optimizations = [];
            
            // Configure plugins based on file type
            if (asset.extension === '.jpg' || asset.extension === '.jpeg') {
                plugins.push(imageminMozjpeg({
                    quality: this.config.quality.textures.jpeg,
                    progressive: true
                }));
                optimizations.push('jpeg-optimization');
            }
            
            if (asset.extension === '.png') {
                if (this.config.quality.textures.png === 'lossless') {
                    // Use lossless PNG optimization
                    plugins.push(imageminPngquant({
                        quality: [0.95, 1.0],
                        speed: 1
                    }));
                } else {
                    plugins.push(imageminPngquant({
                        quality: [0.6, 0.8],
                        speed: 4
                    }));
                }
                optimizations.push('png-optimization');
            }
            
            // Additional WebP conversion for modern browsers
            if (this.config.optimization.aggressive && 
                (asset.extension === '.jpg' || asset.extension === '.jpeg' || asset.extension === '.png')) {
                
                const webpPath = outputPath.replace(path.extname(outputPath), '.webp');
                
                await imagemin([asset.path], {
                    destination: path.dirname(webpPath),
                    plugins: [
                        imageminWebp({
                            quality: this.config.quality.textures.webp
                        })
                    ]
                });
                
                optimizations.push('webp-conversion');
            }
            
            if (plugins.length > 0) {
                const result = await imagemin([asset.path], {
                    destination: path.dirname(outputPath),
                    plugins: plugins
                });
                
                if (result && result.length > 0) {
                    const stats = await fs.stat(outputPath);
                    
                    return {
                        success: true,
                        size: stats.size,
                        outputPath: outputPath,
                        optimizations: optimizations
                    };
                }
            }
            
            // Fallback: copy original
            await fs.copyFile(asset.path, outputPath);
            const stats = await fs.stat(outputPath);
            
            return {
                success: true,
                size: stats.size,
                outputPath: outputPath,
                optimizations: ['copy-original']
            };
            
        } catch (error) {
            return {
                success: false,
                reason: error.message
            };
        }
    }
}

// Audio Optimizer Class
class AudioOptimizer {
    constructor(config) {
        this.config = config;
    }

    async optimize(asset, outputPath) {
        try {
            // Check if FFmpeg is available
            try {
                execSync('which ffmpeg', { stdio: 'ignore' });
            } catch {
                // FFmpeg not available, just copy
                await fs.copyFile(asset.path, outputPath);
                const stats = await fs.stat(outputPath);
                
                return {
                    success: true,
                    size: stats.size,
                    outputPath: outputPath,
                    optimizations: ['copy-original'],
                    reason: 'FFmpeg not available'
                };
            }
            
            const optimizations = [];
            let ffmpegCmd = '';
            
            // Build FFmpeg command based on file type and quality settings
            if (asset.extension === '.mp3') {
                ffmpegCmd = `ffmpeg -i "${asset.path}" -codec:a libmp3lame -b:a ${this.config.quality.audio.mp3}k -y "${outputPath}"`;
                optimizations.push('mp3-reencoding');
            } else if (asset.extension === '.wav') {
                // Convert WAV to more efficient format
                const mp3Path = outputPath.replace('.wav', '.mp3');
                ffmpegCmd = `ffmpeg -i "${asset.path}" -codec:a libmp3lame -b:a ${this.config.quality.audio.mp3}k -y "${mp3Path}"`;
                optimizations.push('wav-to-mp3-conversion');
            } else if (asset.extension === '.ogg') {
                ffmpegCmd = `ffmpeg -i "${asset.path}" -codec:a libvorbis -q:a ${this.config.quality.audio.ogg.replace('q', '')} -y "${outputPath}"`;
                optimizations.push('ogg-optimization');
            } else {
                // Copy unsupported formats
                await fs.copyFile(asset.path, outputPath);
                const stats = await fs.stat(outputPath);
                
                return {
                    success: true,
                    size: stats.size,
                    outputPath: outputPath,
                    optimizations: ['copy-original']
                };
            }
            
            // Execute FFmpeg command
            execSync(ffmpegCmd, { stdio: 'ignore' });
            
            const stats = await fs.stat(outputPath);
            
            return {
                success: true,
                size: stats.size,
                outputPath: outputPath,
                optimizations: optimizations
            };
            
        } catch (error) {
            return {
                success: false,
                reason: error.message
            };
        }
    }
}

// Font Optimizer Class
class FontOptimizer {
    constructor(config) {
        this.config = config;
    }

    async optimize(asset, outputPath) {
        try {
            // For font files, we primarily focus on format conversion and subsetting
            // WOFF2 is the most efficient format for web use
            
            if (asset.extension === '.ttf' || asset.extension === '.otf') {
                // Try to convert to WOFF2 if possible
                try {
                    const woff2Path = outputPath.replace(path.extname(outputPath), '.woff2');
                    
                    // Note: This would require a WOFF2 converter tool
                    // For now, we'll copy the original and suggest manual conversion
                    await fs.copyFile(asset.path, outputPath);
                    
                    const stats = await fs.stat(outputPath);
                    
                    return {
                        success: true,
                        size: stats.size,
                        outputPath: outputPath,
                        optimizations: ['copy-original'],
                        suggestion: 'Consider converting to WOFF2 format for better compression'
                    };
                    
                } catch (conversionError) {
                    // Fallback to copy
                    await fs.copyFile(asset.path, outputPath);
                    const stats = await fs.stat(outputPath);
                    
                    return {
                        success: true,
                        size: stats.size,
                        outputPath: outputPath,
                        optimizations: ['copy-original']
                    };
                }
            } else {
                // WOFF/WOFF2 files are already optimized
                await fs.copyFile(asset.path, outputPath);
                const stats = await fs.stat(outputPath);
                
                return {
                    success: true,
                    size: stats.size,
                    outputPath: outputPath,
                    optimizations: ['copy-original']
                };
            }
            
        } catch (error) {
            return {
                success: false,
                reason: error.message
            };
        }
    }
}

// Data Optimizer Class
class DataOptimizer {
    constructor(config) {
        this.config = config;
    }

    async optimize(asset, outputPath) {
        try {
            if (asset.extension === '.json') {
                // Minify JSON files
                const jsonContent = await fs.readFile(asset.path, 'utf8');
                const parsed = JSON.parse(jsonContent);
                const minified = JSON.stringify(parsed);
                
                await fs.writeFile(outputPath, minified);
                
                const stats = await fs.stat(outputPath);
                
                return {
                    success: true,
                    size: stats.size,
                    outputPath: outputPath,
                    optimizations: ['json-minification']
                };
                
            } else if (asset.extension === '.csv') {
                // Basic CSV optimization (remove extra whitespace)
                const csvContent = await fs.readFile(asset.path, 'utf8');
                const optimized = csvContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .join('\n');
                
                await fs.writeFile(outputPath, optimized);
                
                const stats = await fs.stat(outputPath);
                
                return {
                    success: true,
                    size: stats.size,
                    outputPath: outputPath,
                    optimizations: ['csv-cleanup']
                };
                
            } else {
                // Copy other data files as-is
                await fs.copyFile(asset.path, outputPath);
                const stats = await fs.stat(outputPath);
                
                return {
                    success: true,
                    size: stats.size,
                    outputPath: outputPath,
                    optimizations: ['copy-original']
                };
            }
            
        } catch (error) {
            return {
                success: false,
                reason: error.message
            };
        }
    }
}

// Preset Optimizer Class
class PresetOptimizer {
    constructor(config) {
        this.config = config;
    }

    async optimize(asset, outputPath) {
        try {
            // Optimize visualizer preset files
            const presetContent = await fs.readFile(asset.path, 'utf8');
            const preset = JSON.parse(presetContent);
            
            // Remove unnecessary metadata and comments
            const optimized = this.optimizePresetData(preset);
            
            // Minify JSON
            const minified = JSON.stringify(optimized);
            
            await fs.writeFile(outputPath, minified);
            
            const stats = await fs.stat(outputPath);
            
            return {
                success: true,
                size: stats.size,
                outputPath: outputPath,
                optimizations: ['preset-optimization', 'json-minification']
            };
            
        } catch (error) {
            return {
                success: false,
                reason: error.message
            };
        }
    }

    optimizePresetData(preset) {
        // Remove development-only fields
        const optimized = { ...preset };
        
        // Remove comments and descriptions in production builds
        if (this.config.optimization.aggressive) {
            delete optimized.description;
            delete optimized.author;
            delete optimized.comments;
            delete optimized.development;
        }
        
        // Round numerical values to reduce precision where appropriate
        if (optimized.parameters) {
            Object.keys(optimized.parameters).forEach(key => {
                const param = optimized.parameters[key];
                if (typeof param === 'number') {
                    optimized.parameters[key] = Math.round(param * 1000) / 1000;
                }
            });
        }
        
        return optimized;
    }
}

// Compression Utility Class
class CompressionUtility {
    static async compressFile(inputPath, outputPath, format = 'gzip') {
        const zlib = require('zlib');
        const { createReadStream, createWriteStream } = require('fs');
        
        return new Promise((resolve, reject) => {
            const input = createReadStream(inputPath);
            const output = createWriteStream(outputPath);
            
            let compressor;
            switch (format) {
                case 'gzip':
                    compressor = zlib.createGzip({ level: 9 });
                    break;
                case 'brotli':
                    compressor = zlib.createBrotliCompress({
                        params: {
                            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 0
                        }
                    });
                    break;
                default:
                    reject(new Error(`Unsupported compression format: ${format}`));
                    return;
            }
            
            input.pipe(compressor).pipe(output);
            
            output.on('finish', resolve);
            output.on('error', reject);
            input.on('error', reject);
            compressor.on('error', reject);
        });
    }
}

// Performance Analysis Integration
class AssetPerformanceAnalyzer {
    constructor() {
        this.metrics = {
            loadTimes: new Map(),
            renderImpact: new Map(),
            memoryUsage: new Map()
        };
    }

    analyzeAssetPerformance(asset, optimizationResult) {
        // Estimate performance impact of optimization
        const sizeReduction = 1 - (optimizationResult.size / asset.size);
        
        // Estimate load time improvement (simplified calculation)
        const estimatedLoadTimeImprovement = sizeReduction * 0.7; // 70% of size reduction
        
        // Estimate memory impact based on asset type
        let memoryImpact = 0;
        switch (asset.type) {
            case 'textures':
                // Textures have direct memory impact
                memoryImpact = sizeReduction;
                break;
            case 'shaders':
                // Shaders have minimal memory impact but compilation impact
                memoryImpact = sizeReduction * 0.3;
                break;
            case 'audio':
                // Audio files impact memory during playback
                memoryImpact = sizeReduction * 0.8;
                break;
            default:
                memoryImpact = sizeReduction * 0.5;
        }
        
        return {
            sizeReduction,
            estimatedLoadTimeImprovement,
            memoryImpact,
            performanceScore: (sizeReduction + estimatedLoadTimeImprovement + memoryImpact) / 3
        };
    }
}

// Webpack Integration Helper
class WebpackIntegration {
    static generateWebpackAssetConfig(manifest) {
        // Generate webpack configuration for optimized assets
        const assetConfig = {
            resolve: {
                alias: {}
            },
            module: {
                rules: []
            }
        };
        
        // Add aliases for optimized assets
        Object.entries(manifest.assets).forEach(([originalPath, assetInfo]) => {
            const aliasName = '@optimized/' + path.basename(originalPath, path.extname(originalPath));
            assetConfig.resolve.alias[aliasName] = assetInfo.outputPath;
        });
        
        return assetConfig;
    }
    
    static generateAssetManifestPlugin(manifest) {
        // Generate a webpack plugin configuration for the asset manifest
        return {
            apply: (compiler) => {
                compiler.hooks.emit.tapAsync('AssetManifestPlugin', (compilation, callback) => {
                    const manifestJson = JSON.stringify(manifest, null, 2);
                    compilation.assets['asset-manifest.json'] = {
                        source: () => manifestJson,
                        size: () => manifestJson.length
                    };
                    callback();
                });
            }
        };
    }
}

// Main execution
if (require.main === module) {
    const optimizer = new AdvancedAssetOptimizer();
    optimizer.run().catch(error => {
        console.error('Asset optimization failed:', error);
        process.exit(1);
    });
}

module.exports = {
    AdvancedAssetOptimizer,
    ShaderOptimizer,
    TextureOptimizer,
    AudioOptimizer,
    FontOptimizer,
    DataOptimizer,
    PresetOptimizer,
    CompressionUtility,
    AssetPerformanceAnalyzer,
    WebpackIntegration
};