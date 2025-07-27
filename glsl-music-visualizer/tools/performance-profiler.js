#!/usr/bin/env node

/**
 * Advanced Performance Profiler for GLSL Music Visualizer
 * Location: tools/performance-profiler.js
 * 
 * Command-line tool for comprehensive performance analysis and optimization
 * Integrates with the existing PerformanceMonitor to provide detailed insights
 * into rendering performance, memory usage, and system bottlenecks
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const process = require('process');

class AdvancedPerformanceProfiler {
    constructor() {
        this.config = {
            outputDir: './performance-reports',
            testDuration: 30, // seconds
            testCases: [
                { name: 'water_material', settings: { material: 'water_pure', fftSize: 2048 } },
                { name: 'metal_material', settings: { material: 'liquid_metal', fftSize: 2048 } },
                { name: 'fire_material', settings: { material: 'fire_plasma', fftSize: 2048 } },
                { name: 'high_fft', settings: { material: 'water_pure', fftSize: 8192 } },
                { name: 'particles_enabled', settings: { material: 'water_pure', particles: true } },
                { name: 'post_processing', settings: { material: 'water_pure', postProcessing: 'full' } }
            ],
            systemInfo: {},
            targetFPS: 60,
            warmupTime: 5 // seconds
        };
        
        this.results = {
            system: {},
            tests: [],
            summary: {},
            recommendations: []
        };
        
        this.browserProcess = null;
        this.serverProcess = null;
        this.isRunning = false;
    }

    /**
     * Main entry point for performance profiling
     */
    async run() {
        console.log('🚀 Starting Advanced Performance Profiler for GLSL Music Visualizer\n');
        
        try {
            // Parse command line arguments
            this.parseArguments();
            
            // Initialize profiler
            await this.initialize();
            
            // Collect system information
            await this.collectSystemInfo();
            
            // Build the project if needed
            await this.buildProject();
            
            // Start development server
            await this.startDevServer();
            
            // Run performance tests
            await this.runPerformanceTests();
            
            // Analyze results
            await this.analyzeResults();
            
            // Generate reports
            await this.generateReports();
            
            // Cleanup
            await this.cleanup();
            
            console.log('\n✅ Performance profiling completed successfully!');
            console.log(`📊 Reports generated in: ${this.config.outputDir}`);
            
        } catch (error) {
            console.error('\n❌ Performance profiling failed:', error.message);
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
                case '--duration':
                case '-d':
                    this.config.testDuration = parseInt(args[++i]) || 30;
                    break;
                    
                case '--output':
                case '-o':
                    this.config.outputDir = args[++i];
                    break;
                    
                case '--target-fps':
                    this.config.targetFPS = parseInt(args[++i]) || 60;
                    break;
                    
                case '--test-case':
                case '-t':
                    const testName = args[++i];
                    this.config.testCases = this.config.testCases.filter(tc => tc.name === testName);
                    break;
                    
                case '--quick':
                case '-q':
                    this.config.testDuration = 10;
                    this.config.warmupTime = 2;
                    break;
                    
                case '--comprehensive':
                case '-c':
                    this.config.testDuration = 60;
                    this.config.warmupTime = 10;
                    this.addComprehensiveTests();
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
Advanced Performance Profiler for GLSL Music Visualizer

Usage: node tools/performance-profiler.js [options]

Options:
  -d, --duration <seconds>     Test duration per case (default: 30)
  -o, --output <directory>     Output directory for reports (default: ./performance-reports)
  --target-fps <fps>          Target FPS for performance evaluation (default: 60)
  -t, --test-case <name>      Run specific test case only
  -q, --quick                 Quick test mode (10s duration, 2s warmup)
  -c, --comprehensive         Comprehensive test mode (60s duration, more test cases)
  -h, --help                  Show this help message

Test Cases:
  water_material              Test water material performance
  metal_material              Test liquid metal material performance
  fire_material               Test fire/plasma material performance
  high_fft                    Test high FFT resolution (8192 samples)
  particles_enabled           Test with particle effects enabled
  post_processing             Test with full post-processing pipeline

Examples:
  node tools/performance-profiler.js                    # Run all tests with default settings
  node tools/performance-profiler.js -q                 # Quick performance test
  node tools/performance-profiler.js -t water_material  # Test only water material
  node tools/performance-profiler.js -d 60 -c          # Comprehensive 60-second tests
        `);
    }

    /**
     * Add comprehensive test cases
     */
    addComprehensiveTests() {
        const additionalTests = [
            { name: 'stress_test', settings: { material: 'fire_plasma', fftSize: 8192, particles: true, postProcessing: 'full' } },
            { name: 'memory_stress', settings: { material: 'water_pure', textureSize: 2048, particleCount: 50000 } },
            { name: 'shader_complexity', settings: { material: 'liquid_metal', reflections: true, refractions: true } },
            { name: 'audio_latency', settings: { material: 'water_pure', audioLatency: 'interactive' } },
            { name: 'multi_material', settings: { materialBlending: true, primaryMaterial: 'water_pure', secondaryMaterial: 'fire_plasma' } }
        ];
        
        this.config.testCases.push(...additionalTests);
    }

    /**
     * Initialize profiler environment
     */
    async initialize() {
        console.log('🔧 Initializing profiler environment...');
        
        // Create output directory
        await fs.mkdir(this.config.outputDir, { recursive: true });
        
        // Validate project structure
        await this.validateProjectStructure();
        
        // Install dependencies if needed
        await this.checkDependencies();
        
        console.log('✅ Environment initialized');
    }

    /**
     * Validate project structure
     */
    async validateProjectStructure() {
        const requiredFiles = [
            'package.json',
            'webpack.config.js',
            'src/main.js',
            'src/core/PerformanceMonitor.js'
        ];
        
        for (const file of requiredFiles) {
            try {
                await fs.access(file);
            } catch (error) {
                throw new Error(`Required file not found: ${file}`);
            }
        }
    }

    /**
     * Check and install dependencies if needed
     */
    async checkDependencies() {
        try {
            await fs.access('node_modules');
        } catch (error) {
            console.log('📦 Installing dependencies...');
            execSync('npm install', { stdio: 'inherit' });
        }
    }

    /**
     * Collect comprehensive system information
     */
    async collectSystemInfo() {
        console.log('💻 Collecting system information...');
        
        const os = require('os');
        
        this.results.system = {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            nodeVersion: process.version,
            timestamp: new Date().toISOString(),
            
            // Browser information (will be populated during tests)
            browser: {
                userAgent: '',
                webglVersion: '',
                gpuInfo: '',
                maxTextureSize: 0,
                extensions: []
            },
            
            // Network information
            network: {
                localhost: '127.0.0.1:8080',
                interfaceDetails: os.networkInterfaces()
            }
        };
        
        // Get additional system details
        await this.getGPUInfo();
        await this.getNodeModulesInfo();
        
        console.log('✅ System information collected');
    }

    /**
     * Get GPU information (platform-specific)
     */
    async getGPUInfo() {
        try {
            if (process.platform === 'win32') {
                const wmic = execSync('wmic path win32_VideoController get name,adapterram /format:csv', { encoding: 'utf8' });
                this.results.system.gpuInfo = wmic.trim();
            } else if (process.platform === 'darwin') {
                const system_profiler = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf8' });
                this.results.system.gpuInfo = system_profiler.trim();
            } else if (process.platform === 'linux') {
                const lspci = execSync('lspci | grep -i vga', { encoding: 'utf8' });
                this.results.system.gpuInfo = lspci.trim();
            }
        } catch (error) {
            this.results.system.gpuInfo = 'GPU information not available';
        }
    }

    /**
     * Get Node modules information
     */
    async getNodeModulesInfo() {
        try {
            const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
            this.results.system.dependencies = {
                main: packageJson.dependencies,
                dev: packageJson.devDependencies
            };
        } catch (error) {
            console.warn('Could not read package.json:', error.message);
        }
    }

    /**
     * Build the project for performance testing
     */
    async buildProject() {
        console.log('🔨 Building project for performance testing...');
        
        try {
            // Build in development mode to preserve debugging capabilities
            execSync('npm run build', { stdio: 'inherit' });
            console.log('✅ Project built successfully');
        } catch (error) {
            throw new Error(`Build failed: ${error.message}`);
        }
    }

    /**
     * Start development server
     */
    async startDevServer() {
        console.log('🌐 Starting development server...');
        
        return new Promise((resolve, reject) => {
            // Start webpack dev server
            this.serverProcess = spawn('npm', ['run', 'dev'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let serverOutput = '';
            
            this.serverProcess.stdout.on('data', (data) => {
                serverOutput += data.toString();
                
                // Check if server is ready
                if (serverOutput.includes('webpack compiled') || serverOutput.includes('Local:')) {
                    console.log('✅ Development server started');
                    
                    // Wait a bit for server to fully initialize
                    setTimeout(resolve, 2000);
                }
            });
            
            this.serverProcess.stderr.on('data', (data) => {
                console.error('Server stderr:', data.toString());
            });
            
            this.serverProcess.on('error', (error) => {
                reject(new Error(`Failed to start server: ${error.message}`));
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                reject(new Error('Server startup timeout'));
            }, 30000);
        });
    }

    /**
     * Run comprehensive performance tests
     */
    async runPerformanceTests() {
        console.log('🧪 Running performance tests...\n');
        
        for (let i = 0; i < this.config.testCases.length; i++) {
            const testCase = this.config.testCases[i];
            console.log(`Running test ${i + 1}/${this.config.testCases.length}: ${testCase.name}`);
            
            const result = await this.runSingleTest(testCase);
            this.results.tests.push(result);
            
            console.log(`  └─ Average FPS: ${result.metrics.fps.average.toFixed(1)}`);
            console.log(`  └─ Frame Time: ${result.metrics.frameTime.average.toFixed(2)}ms\n`);
            
            // Brief pause between tests
            await this.sleep(2000);
        }
    }

    /**
     * Run a single performance test case
     */
    async runSingleTest(testCase) {
        const puppeteer = require('puppeteer');
        
        const browser = await puppeteer.launch({
            headless: false, // Show browser for visual feedback
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--enable-webgl',
                '--use-gl=desktop',
                '--enable-accelerated-2d-canvas',
                '--enable-gpu'
            ]
        });
        
        try {
            const page = await browser.newPage();
            
            // Set viewport to standard test size
            await page.setViewport({ width: 1920, height: 1080 });
            
            // Navigate to the application
            await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
            
            // Wait for application to initialize
            await this.sleep(3000);
            
            // Apply test case settings
            await this.applyTestSettings(page, testCase.settings);
            
            // Warmup period
            console.log(`  Warming up for ${this.config.warmupTime}s...`);
            await this.sleep(this.config.warmupTime * 1000);
            
            // Start performance monitoring
            console.log(`  Measuring performance for ${this.config.testDuration}s...`);
            const metrics = await this.collectPerformanceMetrics(page, this.config.testDuration);
            
            // Collect final system state
            const systemMetrics = await this.collectSystemMetrics(page);
            
            return {
                testCase: testCase.name,
                settings: testCase.settings,
                metrics: metrics,
                systemMetrics: systemMetrics,
                timestamp: new Date().toISOString()
            };
            
        } finally {
            await browser.close();
        }
    }

    /**
     * Apply test case settings to the application
     */
    async applyTestSettings(page, settings) {
        // Inject settings into the application
        await page.evaluate((settings) => {
            // Access the global application instance
            if (window.app && window.app.applyTestSettings) {
                window.app.applyTestSettings(settings);
            } else {
                console.warn('Test settings API not available');
            }
        }, settings);
        
        // Wait for settings to apply
        await this.sleep(1000);
    }

    /**
     * Collect performance metrics over time
     */
    async collectPerformanceMetrics(page, duration) {
        const startTime = Date.now();
        const endTime = startTime + (duration * 1000);
        const samples = [];
        
        while (Date.now() < endTime) {
            const metrics = await page.evaluate(() => {
                // Access performance monitor
                if (window.app && window.app.engines && window.app.engines.render) {
                    const perfMon = window.app.engines.render.performanceMonitor;
                    if (perfMon) {
                        return perfMon.getMetrics();
                    }
                }
                
                // Fallback to basic performance API
                return {
                    fps: { current: 0, average: 0 },
                    frameTime: { current: 16.67, average: 16.67 },
                    memory: { used: performance.memory ? performance.memory.usedJSHeapSize : 0 }
                };
            });
            
            samples.push({
                timestamp: Date.now() - startTime,
                ...metrics
            });
            
            // Sample every 100ms
            await this.sleep(100);
        }
        
        // Calculate aggregate metrics
        return this.calculateAggregateMetrics(samples);
    }

    /**
     * Calculate aggregate metrics from samples
     */
    calculateAggregateMetrics(samples) {
        if (samples.length === 0) {
            return {
                fps: { min: 0, max: 0, average: 0, percentile95: 0 },
                frameTime: { min: 0, max: 0, average: 0, percentile95: 0 },
                memory: { min: 0, max: 0, average: 0, final: 0 },
                stability: { frameTimeVariance: 0, fpsDrops: 0 }
            };
        }
        
        const fps = samples.map(s => s.fps?.current || 0).filter(v => v > 0);
        const frameTime = samples.map(s => s.frameTime?.current || 16.67);
        const memory = samples.map(s => s.memory?.used || 0);
        
        return {
            fps: {
                min: Math.min(...fps),
                max: Math.max(...fps),
                average: fps.reduce((a, b) => a + b, 0) / fps.length,
                percentile95: this.percentile(fps, 0.95)
            },
            frameTime: {
                min: Math.min(...frameTime),
                max: Math.max(...frameTime),
                average: frameTime.reduce((a, b) => a + b, 0) / frameTime.length,
                percentile95: this.percentile(frameTime, 0.95)
            },
            memory: {
                min: Math.min(...memory),
                max: Math.max(...memory),
                average: memory.reduce((a, b) => a + b, 0) / memory.length,
                final: memory[memory.length - 1]
            },
            stability: {
                frameTimeVariance: this.variance(frameTime),
                fpsDrops: fps.filter(f => f < this.config.targetFPS * 0.9).length
            },
            sampleCount: samples.length
        };
    }

    /**
     * Collect system-level metrics
     */
    async collectSystemMetrics(page) {
        return await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            const gl = canvas ? canvas.getContext('webgl2') || canvas.getContext('webgl') : null;
            
            return {
                webgl: {
                    version: gl ? (gl instanceof WebGL2RenderingContext ? '2.0' : '1.0') : 'none',
                    vendor: gl ? gl.getParameter(gl.VENDOR) : '',
                    renderer: gl ? gl.getParameter(gl.RENDERER) : '',
                    maxTextureSize: gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 0,
                    extensions: gl ? gl.getSupportedExtensions() : []
                },
                screen: {
                    width: screen.width,
                    height: screen.height,
                    pixelRatio: window.devicePixelRatio
                },
                browser: {
                    userAgent: navigator.userAgent,
                    hardwareConcurrency: navigator.hardwareConcurrency
                }
            };
        });
    }

    /**
     * Analyze test results and generate insights
     */
    async analyzeResults() {
        console.log('📊 Analyzing performance results...');
        
        // Calculate overall performance summary
        this.results.summary = this.calculateOverallSummary();
        
        // Generate performance recommendations
        this.results.recommendations = this.generateRecommendations();
        
        // Identify performance bottlenecks
        this.results.bottlenecks = this.identifyBottlenecks();
        
        console.log('✅ Analysis completed');
    }

    /**
     * Calculate overall performance summary
     */
    calculateOverallSummary() {
        const tests = this.results.tests;
        if (tests.length === 0) return {};
        
        const allFPS = tests.map(t => t.metrics.fps.average);
        const allFrameTime = tests.map(t => t.metrics.frameTime.average);
        const allMemory = tests.map(t => t.metrics.memory.final);
        
        return {
            overallFPS: {
                min: Math.min(...allFPS),
                max: Math.max(...allFPS),
                average: allFPS.reduce((a, b) => a + b, 0) / allFPS.length
            },
            overallFrameTime: {
                min: Math.min(...allFrameTime),
                max: Math.max(...allFrameTime),
                average: allFrameTime.reduce((a, b) => a + b, 0) / allFrameTime.length
            },
            memoryUsage: {
                min: Math.min(...allMemory),
                max: Math.max(...allMemory),
                average: allMemory.reduce((a, b) => a + b, 0) / allMemory.length
            },
            performanceGrade: this.calculatePerformanceGrade(allFPS),
            testsPassed: tests.filter(t => t.metrics.fps.average >= this.config.targetFPS * 0.8).length,
            totalTests: tests.length
        };
    }

    /**
     * Calculate performance grade
     */
    calculatePerformanceGrade(fpsValues) {
        const avgFPS = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
        const target = this.config.targetFPS;
        
        if (avgFPS >= target * 0.95) return 'A';
        if (avgFPS >= target * 0.85) return 'B';
        if (avgFPS >= target * 0.70) return 'C';
        if (avgFPS >= target * 0.50) return 'D';
        return 'F';
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        const summary = this.results.summary;
        
        if (summary.overallFPS.average < this.config.targetFPS * 0.8) {
            recommendations.push({
                type: 'performance',
                severity: 'high',
                message: 'Average FPS is below target. Consider reducing quality settings or optimizing shaders.',
                details: `Average FPS: ${summary.overallFPS.average.toFixed(1)}, Target: ${this.config.targetFPS}`
            });
        }
        
        if (summary.memoryUsage.max > 500 * 1024 * 1024) { // 500MB
            recommendations.push({
                type: 'memory',
                severity: 'medium',
                message: 'High memory usage detected. Consider implementing texture streaming or reducing particle counts.',
                details: `Peak memory: ${(summary.memoryUsage.max / 1024 / 1024).toFixed(1)} MB`
            });
        }
        
        // Analyze individual test results
        this.results.tests.forEach(test => {
            if (test.metrics.stability.fpsDrops > test.metrics.sampleCount * 0.1) {
                recommendations.push({
                    type: 'stability',
                    severity: 'medium',
                    message: `Frequent FPS drops in ${test.testCase} test. Consider optimizing this configuration.`,
                    details: `FPS drops: ${test.metrics.stability.fpsDrops}/${test.metrics.sampleCount} samples`
                });
            }
        });
        
        return recommendations;
    }

    /**
     * Identify performance bottlenecks
     */
    identifyBottlenecks() {
        const bottlenecks = [];
        
        // Find worst performing test case
        const worstTest = this.results.tests.reduce((worst, current) => 
            current.metrics.fps.average < worst.metrics.fps.average ? current : worst
        );
        
        if (worstTest) {
            bottlenecks.push({
                type: 'worst_case',
                testCase: worstTest.testCase,
                fps: worstTest.metrics.fps.average,
                settings: worstTest.settings
            });
        }
        
        // Identify memory-intensive operations
        const memoryIntensive = this.results.tests.filter(t => 
            t.metrics.memory.final > this.results.summary.memoryUsage.average * 1.5
        );
        
        memoryIntensive.forEach(test => {
            bottlenecks.push({
                type: 'memory_intensive',
                testCase: test.testCase,
                memoryUsage: test.metrics.memory.final,
                settings: test.settings
            });
        });
        
        return bottlenecks;
    }

    /**
     * Generate comprehensive reports
     */
    async generateReports() {
        console.log('📋 Generating performance reports...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Generate JSON report
        await this.generateJSONReport(timestamp);
        
        // Generate HTML report
        await this.generateHTMLReport(timestamp);
        
        // Generate CSV data
        await this.generateCSVReport(timestamp);
        
        // Generate markdown summary
        await this.generateMarkdownSummary(timestamp);
        
        console.log('✅ All reports generated');
    }

    /**
     * Generate JSON report with raw data
     */
    async generateJSONReport(timestamp) {
        const reportPath = path.join(this.config.outputDir, `performance-report-${timestamp}.json`);
        await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`  Generated JSON report: ${reportPath}`);
    }

    /**
     * Generate HTML report with visualizations
     */
    async generateHTMLReport(timestamp) {
        const reportPath = path.join(this.config.outputDir, `performance-report-${timestamp}.html`);
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GLSL Music Visualizer - Performance Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #ecf0f1; padding: 20px; border-radius: 6px; border-left: 4px solid #3498db; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #7f8c8d; font-size: 0.9em; }
        .chart-container { width: 100%; height: 400px; margin: 20px 0; }
        .grade { padding: 10px 20px; border-radius: 20px; font-weight: bold; }
        .grade-A { background: #2ecc71; color: white; }
        .grade-B { background: #f39c12; color: white; }
        .grade-C { background: #e67e22; color: white; }
        .grade-D { background: #e74c3c; color: white; }
        .grade-F { background: #c0392b; color: white; }
        .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .recommendation.high { background: #f8d7da; border-color: #f5c6cb; }
        .recommendation.medium { background: #d1ecf1; border-color: #bee5eb; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 GLSL Music Visualizer Performance Report</h1>
        
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${this.results.summary.overallFPS?.average.toFixed(1) || 'N/A'}</div>
                <div class="metric-label">Average FPS</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${this.results.summary.overallFrameTime?.average.toFixed(2) || 'N/A'}ms</div>
                <div class="metric-label">Average Frame Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${((this.results.summary.memoryUsage?.average || 0) / 1024 / 1024).toFixed(1)}MB</div>
                <div class="metric-label">Average Memory Usage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value grade grade-${this.results.summary.performanceGrade || 'F'}">${this.results.summary.performanceGrade || 'F'}</div>
                <div class="metric-label">Performance Grade</div>
            </div>
        </div>

        <h2>📊 Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Case</th>
                    <th>Average FPS</th>
                    <th>Frame Time (ms)</th>
                    <th>Memory (MB)</th>
                    <th>Stability</th>
                </tr>
            </thead>
            <tbody>
                ${this.results.tests.map(test => `
                    <tr>
                        <td><strong>${test.testCase}</strong></td>
                        <td>${test.metrics.fps.average.toFixed(1)}</td>
                        <td>${test.metrics.frameTime.average.toFixed(2)}</td>
                        <td>${(test.metrics.memory.final / 1024 / 1024).toFixed(1)}</td>
                        <td>${test.metrics.stability.fpsDrops}/${test.metrics.sampleCount} drops</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>⚡ Performance Recommendations</h2>
        ${this.results.recommendations.map(rec => `
            <div class="recommendation ${rec.severity}">
                <strong>${rec.type.toUpperCase()}:</strong> ${rec.message}
                <br><small>${rec.details}</small>
            </div>
        `).join('')}

        <div class="chart-container">
            <canvas id="fpsChart"></canvas>
        </div>

        <div class="chart-container">
            <canvas id="memoryChart"></canvas>
        </div>

        <h2>🖥️ System Information</h2>
        <table>
            <tr><td><strong>Platform</strong></td><td>${this.results.system.platform} (${this.results.system.arch})</td></tr>
            <tr><td><strong>CPU</strong></td><td>${this.results.system.cpus?.[0]?.model || 'Unknown'}</td></tr>
            <tr><td><strong>Total Memory</strong></td><td>${((this.results.system.totalMemory || 0) / 1024 / 1024 / 1024).toFixed(1)} GB</td></tr>
            <tr><td><strong>Node.js Version</strong></td><td>${this.results.system.nodeVersion}</td></tr>
            <tr><td><strong>Test Duration</strong></td><td>${this.config.testDuration}s per test</td></tr>
            <tr><td><strong>Report Generated</strong></td><td>${new Date().toLocaleString()}</td></tr>
        </table>
    </div>

    <script>
        // FPS Chart
        const fpsCtx = document.getElementById('fpsChart').getContext('2d');
        new Chart(fpsCtx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(this.results.tests.map(t => t.testCase))},
                datasets: [{
                    label: 'Average FPS',
                    data: ${JSON.stringify(this.results.tests.map(t => t.metrics.fps.average))},
                    backgroundColor: 'rgba(52, 152, 219, 0.8)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'FPS' }
                    }
                },
                plugins: {
                    title: { display: true, text: 'FPS Performance by Test Case' }
                }
            }
        });

        // Memory Chart
        const memoryCtx = document.getElementById('memoryChart').getContext('2d');
        new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(this.results.tests.map(t => t.testCase))},
                datasets: [{
                    label: 'Memory Usage (MB)',
                    data: ${JSON.stringify(this.results.tests.map(t => t.metrics.memory.final / 1024 / 1024))},
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Memory (MB)' }
                    }
                },
                plugins: {
                    title: { display: true, text: 'Memory Usage by Test Case' }
                }
            }
        });
    </script>
</body>
</html>`;
        
        await fs.writeFile(reportPath, html);
        console.log(`  Generated HTML report: ${reportPath}`);
    }

    /**
     * Generate CSV report for data analysis
     */
    async generateCSVReport(timestamp) {
        const reportPath = path.join(this.config.outputDir, `performance-data-${timestamp}.csv`);
        
        const headers = [
            'TestCase',
            'AvgFPS',
            'MinFPS',
            'MaxFPS',
            'FPS95thPercentile',
            'AvgFrameTime',
            'MinFrameTime',
            'MaxFrameTime',
            'FrameTimeVariance',
            'MemoryUsage',
            'FPSDrops',
            'SampleCount'
        ];
        
        const rows = this.results.tests.map(test => [
            test.testCase,
            test.metrics.fps.average.toFixed(2),
            test.metrics.fps.min.toFixed(2),
            test.metrics.fps.max.toFixed(2),
            test.metrics.fps.percentile95.toFixed(2),
            test.metrics.frameTime.average.toFixed(2),
            test.metrics.frameTime.min.toFixed(2),
            test.metrics.frameTime.max.toFixed(2),
            test.metrics.stability.frameTimeVariance.toFixed(2),
            Math.round(test.metrics.memory.final / 1024 / 1024),
            test.metrics.stability.fpsDrops,
            test.metrics.sampleCount
        ]);
        
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        await fs.writeFile(reportPath, csv);
        console.log(`  Generated CSV report: ${reportPath}`);
    }

    /**
     * Generate markdown summary report
     */
    async generateMarkdownSummary(timestamp) {
        const reportPath = path.join(this.config.outputDir, `performance-summary-${timestamp}.md`);
        
        const markdown = `# GLSL Music Visualizer Performance Report

**Generated:** ${new Date().toLocaleString()}  
**Test Duration:** ${this.config.testDuration}s per test case  
**Target FPS:** ${this.config.targetFPS}

## 📊 Overall Performance

- **Average FPS:** ${this.results.summary.overallFPS?.average.toFixed(1) || 'N/A'}
- **Performance Grade:** ${this.results.summary.performanceGrade || 'F'}
- **Tests Passed:** ${this.results.summary.testsPassed || 0}/${this.results.summary.totalTests || 0}
- **Average Memory Usage:** ${((this.results.summary.memoryUsage?.average || 0) / 1024 / 1024).toFixed(1)}MB

## 🧪 Test Results

| Test Case | Avg FPS | Frame Time | Memory (MB) | Stability |
|-----------|---------|------------|-------------|-----------|
${this.results.tests.map(test => 
    `| ${test.testCase} | ${test.metrics.fps.average.toFixed(1)} | ${test.metrics.frameTime.average.toFixed(2)}ms | ${(test.metrics.memory.final / 1024 / 1024).toFixed(1)} | ${test.metrics.stability.fpsDrops}/${test.metrics.sampleCount} drops |`
).join('\n')}

## ⚡ Performance Recommendations

${this.results.recommendations.map(rec => 
    `### ${rec.type.toUpperCase()} (${rec.severity})\n${rec.message}\n*${rec.details}*\n`
).join('\n')}

## 🔍 Identified Bottlenecks

${this.results.bottlenecks.map(bottleneck => {
    switch (bottleneck.type) {
        case 'worst_case':
            return `- **Worst Performance:** ${bottleneck.testCase} (${bottleneck.fps.toFixed(1)} FPS)`;
        case 'memory_intensive':
            return `- **High Memory Usage:** ${bottleneck.testCase} (${(bottleneck.memoryUsage / 1024 / 1024).toFixed(1)}MB)`;
        default:
            return `- **${bottleneck.type}:** ${bottleneck.testCase}`;
    }
}).join('\n')}

## 🖥️ System Information

- **Platform:** ${this.results.system.platform} (${this.results.system.arch})
- **CPU:** ${this.results.system.cpus?.[0]?.model || 'Unknown'}
- **Total Memory:** ${((this.results.system.totalMemory || 0) / 1024 / 1024 / 1024).toFixed(1)} GB
- **Node.js Version:** ${this.results.system.nodeVersion}

## 📈 Optimization Suggestions

Based on the performance analysis, consider the following optimizations:

1. **Shader Optimization**: Review fragment shaders for expensive operations
2. **Texture Management**: Implement texture streaming for large assets
3. **Particle Systems**: Use instanced rendering for particle effects
4. **Memory Management**: Implement proper cleanup for audio buffers
5. **Quality Settings**: Add adaptive quality scaling based on performance

---
*Report generated by GLSL Music Visualizer Performance Profiler v1.0*`;

        await fs.writeFile(reportPath, markdown);
        console.log(`  Generated Markdown summary: ${reportPath}`);
    }

    /**
     * Cleanup resources and processes
     */
    async cleanup() {
        console.log('🧹 Cleaning up...');
        
        // Kill server process
        if (this.serverProcess) {
            this.serverProcess.kill('SIGTERM');
            this.serverProcess = null;
        }
        
        // Kill browser process
        if (this.browserProcess) {
            this.browserProcess.kill('SIGTERM');
            this.browserProcess = null;
        }
        
        // Wait for processes to terminate
        await this.sleep(2000);
        
        console.log('✅ Cleanup completed');
    }

    /**
     * Utility function to calculate percentile
     */
    percentile(arr, p) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * Utility function to calculate variance
     */
    variance(arr) {
        if (arr.length === 0) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const squareDiffs = arr.map(value => Math.pow(value - mean, 2));
        return squareDiffs.reduce((a, b) => a + b, 0) / arr.length;
    }

    /**
     * Utility function for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Performance Profiler Integration with PerformanceMonitor
class PerformanceDataCollector {
    constructor() {
        this.isCollecting = false;
        this.samples = [];
        this.startTime = 0;
    }

    /**
     * Start collecting performance data
     */
    startCollection() {
        this.isCollecting = true;
        this.samples = [];
        this.startTime = performance.now();
        
        // Inject data collection into window for browser access
        if (typeof window !== 'undefined') {
            window.performanceCollector = this;
        }
    }

    /**
     * Add performance sample
     */
    addSample(metrics) {
        if (!this.isCollecting) return;
        
        this.samples.push({
            timestamp: performance.now() - this.startTime,
            ...metrics
        });
    }

    /**
     * Stop collecting and return data
     */
    stopCollection() {
        this.isCollecting = false;
        return this.samples;
    }
}

// GPU Memory Profiler for WebGL-specific metrics
class GPUMemoryProfiler {
    constructor(gl) {
        this.gl = gl;
        this.memoryInfo = {
            textures: new Map(),
            buffers: new Map(),
            programs: new Map(),
            totalEstimated: 0
        };
    }

    /**
     * Track texture memory usage
     */
    trackTexture(texture, width, height, format, type) {
        const bytesPerPixel = this.calculateBytesPerPixel(format, type);
        const size = width * height * bytesPerPixel;
        
        this.memoryInfo.textures.set(texture, {
            width,
            height,
            format,
            type,
            size
        });
        
        this.updateTotalMemory();
    }

    /**
     * Track buffer memory usage
     */
    trackBuffer(buffer, size, usage) {
        this.memoryInfo.buffers.set(buffer, {
            size,
            usage
        });
        
        this.updateTotalMemory();
    }

    /**
     * Calculate bytes per pixel for texture formats
     */
    calculateBytesPerPixel(format, type) {
        const gl = this.gl;
        
        let components = 1;
        switch (format) {
            case gl.RGB: components = 3; break;
            case gl.RGBA: components = 4; break;
            case gl.LUMINANCE_ALPHA: components = 2; break;
            default: components = 1;
        }
        
        let bytesPerComponent = 1;
        switch (type) {
            case gl.UNSIGNED_SHORT:
            case gl.SHORT:
                bytesPerComponent = 2;
                break;
            case gl.UNSIGNED_INT:
            case gl.INT:
            case gl.FLOAT:
                bytesPerComponent = 4;
                break;
        }
        
        return components * bytesPerComponent;
    }

    /**
     * Update total estimated memory usage
     */
    updateTotalMemory() {
        let total = 0;
        
        for (const texture of this.memoryInfo.textures.values()) {
            total += texture.size;
        }
        
        for (const buffer of this.memoryInfo.buffers.values()) {
            total += buffer.size;
        }
        
        this.memoryInfo.totalEstimated = total;
    }

    /**
     * Get memory usage report
     */
    getMemoryReport() {
        return {
            textures: {
                count: this.memoryInfo.textures.size,
                totalSize: Array.from(this.memoryInfo.textures.values())
                    .reduce((sum, tex) => sum + tex.size, 0)
            },
            buffers: {
                count: this.memoryInfo.buffers.size,
                totalSize: Array.from(this.memoryInfo.buffers.values())
                    .reduce((sum, buf) => sum + buf.size, 0)
            },
            totalEstimated: this.memoryInfo.totalEstimated
        };
    }
}

// Main execution
if (require.main === module) {
    // Add puppeteer to dependencies check
    const requiredPackages = ['puppeteer'];
    
    for (const pkg of requiredPackages) {
        try {
            require.resolve(pkg);
        } catch (error) {
            console.log(`📦 Installing missing dependency: ${pkg}`);
            const { execSync } = require('child_process');
            execSync(`npm install ${pkg}`, { stdio: 'inherit' });
        }
    }
    
    const profiler = new AdvancedPerformanceProfiler();
    profiler.run().catch(error => {
        console.error('Performance profiler failed:', error);
        process.exit(1);
    });
}

module.exports = {
    AdvancedPerformanceProfiler,
    PerformanceDataCollector,
    GPUMemoryProfiler
};