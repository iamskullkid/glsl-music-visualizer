/**
 * Advanced FFT Processor
 * High-resolution Fast Fourier Transform analysis with multiple algorithms
 * Location: src/audio/FFTProcessor.js
 * 
 * Provides sophisticated spectral analysis building upon AudioInterface
 * Integrates with AudioEngine analysis module system
 */

import { MathUtils } from '../utils/MathUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class FFTProcessor {
    constructor(config = {}) {
        this.isInitialized = false;
        this.audioContext = null;
        
        // Configuration
        this.config = {
            fftSize: 4096,
            hopSize: 1024,
            sampleRate: 44100,
            windowFunction: 'hann',
            overlapRatio: 0.75,
            
            // Advanced FFT settings
            algorithm: 'hybrid',        // 'native', 'custom', 'hybrid'
            zeroPadding: 2,            // Zero padding factor
            spectralInterpolation: true, // Interpolate between bins
            phaseAnalysis: true,       // Include phase information
            
            // Performance settings
            useWebAssembly: false,     // Use WASM for heavy calculations
            maxConcurrency: 2,         // Parallel processing threads
            cacheSize: 64,             // Number of cached FFT results
            
            // Output settings
            outputFormat: 'both',      // 'linear', 'db', 'both'
            frequencyRange: [20, 20000], // Analysis frequency range
            binResolution: 'adaptive', // 'fixed', 'adaptive', 'logarithmic'
            
            ...config
        };
        
        // FFT computation engines
        this.engines = {
            native: null,      // Web Audio AnalyserNode
            custom: null,      // Custom JavaScript FFT
            wasm: null         // WebAssembly FFT (future)
        };
        
        // Analysis buffers
        this.buffers = {
            // Input buffers
            inputBuffer: null,
            windowedBuffer: null,
            zeroPaddedBuffer: null,
            
            // Working buffers
            realBuffer: null,
            imagBuffer: null,
            magnitudeBuffer: null,
            phaseBuffer: null,
            
            // Output buffers
            frequencyData: null,
            frequencyDataDb: null,
            powerSpectrum: null,
            
            // Overlap-add buffers
            overlapBuffer: null,
            hopBuffer: null,
            
            // History buffers for temporal analysis
            spectrumHistory: null,
            phaseHistory: null
        };
        
        // Window functions cache
        this.windowFunctions = new Map();
        
        // FFT computation cache
        this.fftCache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        // Performance metrics
        this.performanceMetrics = {
            fftComputeTime: 0,
            windowingTime: 0,
            cacheHitRate: 0,
            averageLatency: 0,
            peakMemoryUsage: 0
        };
        
        // Frequency mapping tables
        this.frequencyMaps = {
            linear: null,
            mel: null,
            bark: null,
            erb: null,          // Equivalent Rectangular Bandwidth
            log: null
        };
        
        // Twiddle factors for custom FFT
        this.twiddleFactors = new Map();
        
        // Bit-reversal lookup table
        this.bitReversalTable = null;
        
        // WebWorker for heavy computations
        this.worker = null;
        this.workerQueue = [];
        
        // State management
        this.frameCounter = 0;
        this.lastFrameTime = 0;
        this.isProcessing = false;
    }
    
    /**
     * Initialize FFT processor with audio context
     * @param {AudioContext} audioContext - Web Audio context
     */
    async initialize(audioContext) {
        try {
            this.audioContext = audioContext;
            this.config.sampleRate = audioContext.sampleRate;
            
            // Initialize FFT engines
            await this.initializeEngines();
            
            // Setup analysis buffers
            this.initializeBuffers();
            
            // Precompute window functions
            this.precomputeWindowFunctions();
            
            // Generate frequency mapping tables
            this.generateFrequencyMaps();
            
            // Precompute FFT coefficients
            this.precomputeFFTCoefficients();
            
            // Initialize WebWorker if needed
            if (this.config.maxConcurrency > 1) {
                await this.initializeWorker();
            }
            
            this.isInitialized = true;
            
            console.log('FFTProcessor initialized', {
                fftSize: this.config.fftSize,
                algorithm: this.config.algorithm,
                sampleRate: this.config.sampleRate,
                hopSize: this.config.hopSize
            });
            
        } catch (error) {
            console.error('Failed to initialize FFTProcessor:', error);
            throw error;
        }
    }
    
    /**
     * Initialize different FFT computation engines
     */
    async initializeEngines() {
        // Native Web Audio engine (always available)
        this.engines.native = this.audioContext.createAnalyser();
        this.engines.native.fftSize = this.config.fftSize;
        this.engines.native.smoothingTimeConstant = 0; // No smoothing for raw data
        
        // Custom JavaScript FFT engine
        this.engines.custom = new CustomFFT(this.config.fftSize);
        
        // WebAssembly engine (future implementation)
        if (this.config.useWebAssembly) {
            try {
                // this.engines.wasm = await this.loadWasmFFT();
                console.log('WebAssembly FFT not yet implemented');
            } catch (error) {
                console.warn('Failed to load WebAssembly FFT:', error);
            }
        }
    }
    
    /**
     * Initialize all analysis buffers
     */
    initializeBuffers() {
        const fftSize = this.config.fftSize;
        const hopSize = this.config.hopSize;
        const paddedSize = fftSize * this.config.zeroPadding;
        
        // Input and working buffers
        this.buffers.inputBuffer = new Float32Array(fftSize);
        this.buffers.windowedBuffer = new Float32Array(fftSize);
        this.buffers.zeroPaddedBuffer = new Float32Array(paddedSize);
        
        // Complex FFT buffers
        this.buffers.realBuffer = new Float32Array(paddedSize);
        this.buffers.imagBuffer = new Float32Array(paddedSize);
        
        // Output buffers
        const outputSize = paddedSize / 2; // Nyquist limit
        this.buffers.magnitudeBuffer = new Float32Array(outputSize);
        this.buffers.phaseBuffer = new Float32Array(outputSize);
        this.buffers.powerSpectrum = new Float32Array(outputSize);
        
        // Standard output format (matching AudioEngine expectations)
        this.buffers.frequencyData = new Float32Array(1024);
        this.buffers.frequencyDataDb = new Float32Array(1024);
        
        // Overlap-add buffers
        this.buffers.overlapBuffer = new Float32Array(fftSize);
        this.buffers.hopBuffer = new Float32Array(hopSize);
        
        // History buffers for temporal analysis
        const historyLength = 128;
        this.buffers.spectrumHistory = new Array(historyLength);
        this.buffers.phaseHistory = new Array(historyLength);
        
        for (let i = 0; i < historyLength; i++) {
            this.buffers.spectrumHistory[i] = new Float32Array(outputSize);
            this.buffers.phaseHistory[i] = new Float32Array(outputSize);
        }
        
        console.log(`FFT buffers initialized: ${fftSize} → ${outputSize} bins`);
    }
    
    /**
     * Precompute window functions for different types
     */
    precomputeWindowFunctions() {
        const fftSize = this.config.fftSize;
        
        // Hann window
        const hann = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
        }
        this.windowFunctions.set('hann', hann);
        
        // Hamming window
        const hamming = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            hamming[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (fftSize - 1));
        }
        this.windowFunctions.set('hamming', hamming);
        
        // Blackman window
        const blackman = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            blackman[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (fftSize - 1)) + 
                         0.08 * Math.cos(4 * Math.PI * i / (fftSize - 1));
        }
        this.windowFunctions.set('blackman', blackman);
        
        // Kaiser window (β = 8.6 for good sidelobe suppression)
        const kaiser = new Float32Array(fftSize);
        const beta = 8.6;
        const I0_beta = this.besselI0(beta);
        for (let i = 0; i < fftSize; i++) {
            const n = i - (fftSize - 1) / 2;
            const arg = beta * Math.sqrt(1 - Math.pow(2 * n / (fftSize - 1), 2));
            kaiser[i] = this.besselI0(arg) / I0_beta;
        }
        this.windowFunctions.set('kaiser', kaiser);
        
        // Flat-top window (for amplitude accuracy)
        const flattop = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            const x = 2 * Math.PI * i / (fftSize - 1);
            flattop[i] = 0.21557895 - 0.41663158 * Math.cos(x) + 
                        0.277263158 * Math.cos(2 * x) - 0.083578947 * Math.cos(3 * x) + 
                        0.006947368 * Math.cos(4 * x);
        }
        this.windowFunctions.set('flattop', flattop);
        
        console.log(`Window functions precomputed: ${Array.from(this.windowFunctions.keys()).join(', ')}`);
    }
    
    /**
     * Generate frequency mapping tables for different scales
     */
    generateFrequencyMaps() {
        const fftSize = this.config.fftSize;
        const sampleRate = this.config.sampleRate;
        const nyquist = sampleRate / 2;
        const binCount = fftSize / 2;
        
        // Linear frequency mapping
        this.frequencyMaps.linear = new Float32Array(binCount);
        for (let i = 0; i < binCount; i++) {
            this.frequencyMaps.linear[i] = (i * nyquist) / binCount;
        }
        
        // Mel scale mapping
        this.frequencyMaps.mel = new Float32Array(binCount);
        for (let i = 0; i < binCount; i++) {
            const freq = this.frequencyMaps.linear[i];
            this.frequencyMaps.mel[i] = MathUtils.frequencyToMel(freq);
        }
        
        // Bark scale mapping
        this.frequencyMaps.bark = new Float32Array(binCount);
        for (let i = 0; i < binCount; i++) {
            const freq = this.frequencyMaps.linear[i];
            this.frequencyMaps.bark[i] = this.frequencyToBark(freq);
        }
        
        // ERB scale mapping
        this.frequencyMaps.erb = new Float32Array(binCount);
        for (let i = 0; i < binCount; i++) {
            const freq = this.frequencyMaps.linear[i];
            this.frequencyMaps.erb[i] = this.frequencyToERB(freq);
        }
        
        // Logarithmic mapping
        this.frequencyMaps.log = new Float32Array(binCount);
        const minFreq = Math.max(1, this.config.frequencyRange[0]);
        const maxFreq = Math.min(nyquist, this.config.frequencyRange[1]);
        for (let i = 0; i < binCount; i++) {
            const t = i / (binCount - 1);
            this.frequencyMaps.log[i] = minFreq * Math.pow(maxFreq / minFreq, t);
        }
    }
    
    /**
     * Precompute FFT twiddle factors for efficient computation
     */
    precomputeFFTCoefficients() {
        const maxSize = this.config.fftSize * this.config.zeroPadding;
        
        // Generate bit-reversal table
        this.bitReversalTable = new Uint32Array(maxSize);
        for (let i = 0; i < maxSize; i++) {
            this.bitReversalTable[i] = this.reverseBits(i, Math.log2(maxSize));
        }
        
        // Precompute twiddle factors for different sizes
        for (let size = 2; size <= maxSize; size *= 2) {
            const twiddles = new Array(size / 2);
            for (let i = 0; i < size / 2; i++) {
                const angle = -2 * Math.PI * i / size;
                twiddles[i] = {
                    real: Math.cos(angle),
                    imag: Math.sin(angle)
                };
            }
            this.twiddleFactors.set(size, twiddles);
        }
        
        console.log(`FFT coefficients precomputed for sizes up to ${maxSize}`);
    }
    
    /**
     * Main analysis function - processes audio data and returns FFT results
     * @param {Object} audioData - Input audio data from AudioInterface
     * @returns {Object} Enhanced spectral analysis results
     */
    analyze(audioData) {
        if (!this.isInitialized) {
            console.warn('FFTProcessor not initialized');
            return audioData;
        }
        
        const startTime = performance.now();
        this.isProcessing = true;
        
        try {
            // Extract time domain data
            const timeData = audioData.timeData || audioData.timeDataFloat;
            if (!timeData || timeData.length === 0) {
                return audioData;
            }
            
            // Perform FFT analysis based on configured algorithm
            let fftResult;
            switch (this.config.algorithm) {
                case 'native':
                    fftResult = this.performNativeFFT(timeData);
                    break;
                case 'custom':
                    fftResult = this.performCustomFFT(timeData);
                    break;
                case 'hybrid':
                default:
                    fftResult = this.performHybridFFT(timeData);
                    break;
            }
            
            // Post-process results
            const processedResult = this.postProcessFFT(fftResult);
            
            // Update history buffers
            this.updateSpectralHistory(processedResult);
            
            // Calculate additional spectral features
            const spectralFeatures = this.calculateSpectralFeatures(processedResult);
            
            // Update performance metrics
            const processingTime = performance.now() - startTime;
            this.updatePerformanceMetrics(processingTime);
            
            // Create enhanced output matching AudioEngine expectations
            const enhancedOutput = {
                ...audioData,
                
                // Standard output (for compatibility)
                frequencyData: this.buffers.frequencyData,
                frequencyDataDb: this.buffers.frequencyDataDb,
                
                // Enhanced FFT data
                fft: {
                    magnitude: processedResult.magnitude,
                    phase: processedResult.phase,
                    powerSpectrum: processedResult.powerSpectrum,
                    
                    // Frequency mappings
                    frequencies: this.frequencyMaps.linear,
                    melFrequencies: this.frequencyMaps.mel,
                    barkFrequencies: this.frequencyMaps.bark,
                    
                    // Analysis metadata
                    fftSize: this.config.fftSize,
                    hopSize: this.config.hopSize,
                    windowFunction: this.config.windowFunction,
                    sampleRate: this.config.sampleRate,
                    binResolution: this.config.sampleRate / this.config.fftSize
                },
                
                // Spectral features
                spectral: spectralFeatures,
                
                // Processing metadata
                processing: {
                    algorithm: this.config.algorithm,
                    processingTime: processingTime,
                    frameNumber: this.frameCounter,
                    cacheHitRate: this.performanceMetrics.cacheHitRate
                }
            };
            
            this.frameCounter++;
            this.lastFrameTime = performance.now();
            this.isProcessing = false;
            
            return enhancedOutput;
            
        } catch (error) {
            console.error('FFT analysis error:', error);
            this.isProcessing = false;
            return audioData; // Return original data on error
        }
    }
    
    /**
     * Perform FFT using native Web Audio AnalyserNode
     */
    performNativeFFT(timeData) {
        const startTime = performance.now();
        
        // This would typically be connected to the audio graph
        // For now, we'll use it as a reference implementation
        const analyzer = this.engines.native;
        
        // Get frequency data (simulated - in real use, this would be connected)
        const frequencyData = new Float32Array(analyzer.frequencyBinCount);
        const frequencyDataDb = new Float32Array(analyzer.frequencyBinCount);
        
        // For simulation, we'll use our custom FFT
        const customResult = this.performCustomFFT(timeData);
        
        this.performanceMetrics.windowingTime = performance.now() - startTime;
        
        return customResult;
    }
    
    /**
     * Perform FFT using custom JavaScript implementation
     */
    performCustomFFT(timeData) {
        const startTime = performance.now();
        
        // Prepare input buffer
        this.prepareInputBuffer(timeData);
        
        // Apply windowing
        this.applyWindow();
        const windowingTime = performance.now();
        
        // Zero padding if configured
        this.applyZeroPadding();
        
        // Perform FFT computation
        const fftResult = this.engines.custom.compute(
            this.buffers.zeroPaddedBuffer,
            this.config.fftSize * this.config.zeroPadding
        );
        
        // Calculate magnitude and phase
        this.calculateMagnitudePhase(fftResult);
        
        // Update performance metrics
        this.performanceMetrics.windowingTime = windowingTime - startTime;
        this.performanceMetrics.fftComputeTime = performance.now() - windowingTime;
        
        return {
            magnitude: this.buffers.magnitudeBuffer,
            phase: this.buffers.phaseBuffer,
            powerSpectrum: this.buffers.powerSpectrum,
            real: fftResult.real,
            imag: fftResult.imag
        };
    }
    
    /**
     * Perform hybrid FFT (combines multiple approaches)
     */
    performHybridFFT(timeData) {
        // Use custom FFT for detailed analysis
        const customResult = this.performCustomFFT(timeData);
        
        // Could add native FFT for validation or different purposes
        // For now, return the custom result with additional processing
        
        return customResult;
    }
    
    /**
     * Prepare input buffer with proper alignment and overlap
     */
    prepareInputBuffer(timeData) {
        const fftSize = this.config.fftSize;
        const hopSize = this.config.hopSize;
        
        // Handle overlap-add if configured
        if (this.config.overlapRatio > 0) {
            const overlapSamples = Math.floor(fftSize * this.config.overlapRatio);
            
            // Shift existing data
            for (let i = 0; i < overlapSamples; i++) {
                this.buffers.inputBuffer[i] = this.buffers.overlapBuffer[i];
            }
            
            // Add new data
            const newSamples = Math.min(timeData.length, fftSize - overlapSamples);
            for (let i = 0; i < newSamples; i++) {
                this.buffers.inputBuffer[overlapSamples + i] = timeData[i];
            }
            
            // Save overlap for next frame
            for (let i = 0; i < overlapSamples; i++) {
                this.buffers.overlapBuffer[i] = this.buffers.inputBuffer[hopSize + i];
            }
        } else {
            // Simple copy without overlap
            const copyLength = Math.min(timeData.length, fftSize);
            for (let i = 0; i < copyLength; i++) {
                this.buffers.inputBuffer[i] = timeData[i];
            }
            
            // Zero-pad if necessary
            for (let i = copyLength; i < fftSize; i++) {
                this.buffers.inputBuffer[i] = 0;
            }
        }
    }
    
    /**
     * Apply window function to input buffer
     */
    applyWindow() {
        const windowFunc = this.windowFunctions.get(this.config.windowFunction);
        if (!windowFunc) {
            // Copy without windowing
            this.buffers.windowedBuffer.set(this.buffers.inputBuffer);
            return;
        }
        
        const fftSize = this.config.fftSize;
        for (let i = 0; i < fftSize; i++) {
            this.buffers.windowedBuffer[i] = this.buffers.inputBuffer[i] * windowFunc[i];
        }
    }
    
    /**
     * Apply zero padding to increase frequency resolution
     */
    applyZeroPadding() {
        const fftSize = this.config.fftSize;
        const paddedSize = fftSize * this.config.zeroPadding;
        
        // Copy windowed data to zero-padded buffer
        for (let i = 0; i < fftSize; i++) {
            this.buffers.zeroPaddedBuffer[i] = this.buffers.windowedBuffer[i];
        }
        
        // Zero-pad the rest
        for (let i = fftSize; i < paddedSize; i++) {
            this.buffers.zeroPaddedBuffer[i] = 0;
        }
    }
    
    /**
     * Calculate magnitude and phase from complex FFT result
     */
    calculateMagnitudePhase(fftResult) {
        const { real, imag } = fftResult;
        const length = real.length / 2; // Nyquist limit
        
        for (let i = 0; i < length; i++) {
            const realPart = real[i];
            const imagPart = imag[i];
            
            // Magnitude
            this.buffers.magnitudeBuffer[i] = Math.sqrt(realPart * realPart + imagPart * imagPart);
            
            // Phase (if enabled)
            if (this.config.phaseAnalysis) {
                this.buffers.phaseBuffer[i] = Math.atan2(imagPart, realPart);
            }
            
            // Power spectrum
            this.buffers.powerSpectrum[i] = this.buffers.magnitudeBuffer[i] * this.buffers.magnitudeBuffer[i];
        }
    }
    
    /**
     * Post-process FFT results for output formatting
     */
    postProcessFFT(fftResult) {
        // Resample to standard output size (1024 bins)
        const outputSize = 1024;
        const inputSize = fftResult.magnitude.length;
        
        for (let i = 0; i < outputSize; i++) {
            const sourceIndex = Math.floor((i * inputSize) / outputSize);
            
            // Linear magnitude
            this.buffers.frequencyData[i] = fftResult.magnitude[sourceIndex];
            
            // dB magnitude
            this.buffers.frequencyDataDb[i] = MathUtils.amplitudeToDb(
                fftResult.magnitude[sourceIndex]
            );
        }
        
        return fftResult;
    }
    
    /**
     * Update spectral history buffers for temporal analysis
     */
    updateSpectralHistory(fftResult) {
        // Shift history arrays
        for (let i = this.buffers.spectrumHistory.length - 1; i > 0; i--) {
            this.buffers.spectrumHistory[i].set(this.buffers.spectrumHistory[i - 1]);
            if (this.config.phaseAnalysis) {
                this.buffers.phaseHistory[i].set(this.buffers.phaseHistory[i - 1]);
            }
        }
        
        // Add current frame
        this.buffers.spectrumHistory[0].set(fftResult.magnitude);
        if (this.config.phaseAnalysis) {
            this.buffers.phaseHistory[0].set(fftResult.phase);
        }
    }
    
    /**
     * Calculate additional spectral features
     */
    calculateSpectralFeatures(fftResult) {
        const magnitude = fftResult.magnitude;
        const powerSpectrum = fftResult.powerSpectrum;
        const frequencies = this.frequencyMaps.linear;
        
        const features = {};
        
        // Spectral centroid (brightness)
        let weightedSum = 0;
        let magnitudeSum = 0;
        for (let i = 0; i < magnitude.length; i++) {
            weightedSum += frequencies[i] * magnitude[i];
            magnitudeSum += magnitude[i];
        }
        features.centroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
        
        // Spectral spread (bandwidth)
        let spreadSum = 0;
        for (let i = 0; i < magnitude.length; i++) {
            const diff = frequencies[i] - features.centroid;
            spreadSum += diff * diff * magnitude[i];
        }
        features.spread = magnitudeSum > 0 ? Math.sqrt(spreadSum / magnitudeSum) : 0;
        
        // Spectral rolloff (85% energy point)
        const totalEnergy = powerSpectrum.reduce((sum, val) => sum + val, 0);
        const rolloffThreshold = totalEnergy * 0.85;
        let cumulativeEnergy = 0;
        features.rolloff = frequencies[frequencies.length - 1]; // Default to max
        for (let i = 0; i < powerSpectrum.length; i++) {
            cumulativeEnergy += powerSpectrum[i];
            if (cumulativeEnergy >= rolloffThreshold) {
                features.rolloff = frequencies[i];
                break;
            }
        }
        
        // Spectral flatness (Wiener entropy)
        let geometricMean = 1;
        let arithmeticMean = 0;
        let validBins = 0;
        for (let i = 1; i < magnitude.length; i++) { // Skip DC
            if (magnitude[i] > 1e-10) {
                geometricMean *= magnitude[i];
                arithmeticMean += magnitude[i];
                validBins++;
            }
        }
        if (validBins > 0) {
            geometricMean = Math.pow(geometricMean, 1 / validBins);
            arithmeticMean /= validBins;
            features.flatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
        } else {
            features.flatness = 0;
        }
        
        // Spectral flux (temporal change)
        if (this.buffers.spectrumHistory.length > 1) {
            const previous = this.buffers.spectrumHistory[1];
            let flux = 0;
            for (let i = 0; i < magnitude.length; i++) {
                const diff = magnitude[i] - previous[i];
                flux += Math.max(0, diff); // Only positive changes
            }
            features.flux = flux / magnitude.length;
        } else {
            features.flux = 0;
        }
        
        // Spectral decrease
        let decrease = 0;
        const k1_magnitude = magnitude[0];
        for (let i = 1; i < magnitude.length; i++) {
            decrease += (magnitude[i] - k1_magnitude) / i;
        }
        features.decrease = k1_magnitude > 0 ? decrease / k1_magnitude : 0;
        
        // Spectral slope
        let numerator = 0;
        let denominator = 0;
        const meanFreq = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
        const meanMag = magnitude.reduce((sum, m) => sum + m, 0) / magnitude.length;
        
        for (let i = 0; i < magnitude.length; i++) {
            const freqDiff = frequencies[i] - meanFreq;
            const magDiff = magnitude[i] - meanMag;
            numerator += freqDiff * magDiff;
            denominator += freqDiff * freqDiff;
        }
        features.slope = denominator > 0 ? numerator / denominator : 0;
        
        // High frequency content
        let hfcSum = 0;
        for (let i = 0; i < magnitude.length; i++) {
            hfcSum += (i + 1) * magnitude[i];
        }
        features.hfc = hfcSum;
        
        // Zero crossing rate in frequency domain (spectral irregularity)
        let crossings = 0;
        for (let i = 1; i < magnitude.length; i++) {
            if ((magnitude[i] > magnitude[i-1]) !== (magnitude[i] > magnitude[i+1 < magnitude.length ? i+1 : i])) {
                crossings++;
            }
        }
        features.irregularity = crossings / (magnitude.length - 1);
        
        return features;
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(processingTime) {
        this.performanceMetrics.fftComputeTime = 
            MathUtils.exponentialSmoothing(this.performanceMetrics.fftComputeTime, processingTime, 0.1);
        
        this.performanceMetrics.cacheHitRate = 
            this.cacheHits / Math.max(1, this.cacheHits + this.cacheMisses);
        
        this.performanceMetrics.averageLatency = 
            MathUtils.exponentialSmoothing(this.performanceMetrics.averageLatency, processingTime, 0.1);
        
        // Report to global performance monitor
        performanceMonitor.recordCPUTime('audioProcessing', processingTime);
    }
    
    /**
     * Helper functions for frequency scale conversions
     */
    frequencyToBark(frequency) {
        return 13 * Math.atan(0.00076 * frequency) + 3.5 * Math.atan(Math.pow(frequency / 7500, 2));
    }
    
    frequencyToERB(frequency) {
        return 21.4 * Math.log10(1 + 0.00437 * frequency);
    }
    
    /**
     * Bessel function I0 for Kaiser window
     */
    besselI0(x) {
        let sum = 1;
        let term = 1;
        const halfX = x / 2;
        
        for (let i = 1; i <= 50; i++) {
            term *= (halfX / i) * (halfX / i);
            sum += term;
            if (term < 1e-12) break;
        }
        
        return sum;
    }
    
    /**
     * Reverse bits for FFT bit-reversal
     */
    reverseBits(num, bits) {
        let result = 0;
        for (let i = 0; i < bits; i++) {
            result = (result << 1) | (num & 1);
            num >>= 1;
        }
        return result;
    }
    
    /**
     * Initialize WebWorker for parallel processing
     */
    async initializeWorker() {
        // WebWorker implementation for heavy FFT computations
        // This would be a separate worker file in a real implementation
        const workerCode = `
            // FFT Worker implementation would go here
            self.onmessage = function(e) {
                const { type, data } = e.data;
                if (type === 'fft') {
                    // Perform FFT computation
                    const result = performFFT(data);
                    self.postMessage({ type: 'fft_result', result });
                }
            };
        `;
        
        try {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));
            
            this.worker.onmessage = (e) => {
                const { type, result } = e.data;
                if (type === 'fft_result') {
                    this.handleWorkerResult(result);
                }
            };
            
            console.log('FFT WebWorker initialized');
        } catch (error) {
            console.warn('Failed to initialize WebWorker:', error);
        }
    }
    
    /**
     * Handle worker computation results
     */
    handleWorkerResult(result) {
        // Process worker results and update buffers
        if (this.workerQueue.length > 0) {
            const callback = this.workerQueue.shift();
            callback(result);
        }
    }
    
    /**
     * Get FFT processor status and performance metrics
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isProcessing: this.isProcessing,
            frameCounter: this.frameCounter,
            config: { ...this.config },
            performance: { ...this.performanceMetrics },
            memoryUsage: {
                bufferCount: Object.keys(this.buffers).length,
                windowFunctions: this.windowFunctions.size,
                cacheSize: this.fftCache.size
            },
            algorithms: {
                available: Object.keys(this.engines).filter(key => this.engines[key] !== null),
                current: this.config.algorithm
            }
        };
    }
    
    /**
     * Update configuration at runtime
     */
    updateConfig(newConfig) {
        const needsReinit = 
            newConfig.fftSize !== this.config.fftSize ||
            newConfig.zeroPadding !== this.config.zeroPadding;
        
        Object.assign(this.config, newConfig);
        
        if (needsReinit && this.isInitialized) {
            console.log('Reinitializing FFTProcessor due to config changes');
            this.initializeBuffers();
            this.precomputeFFTCoefficients();
        }
        
        // Update engine settings
        if (this.engines.native) {
            this.engines.native.fftSize = this.config.fftSize;
        }
    }
    
    /**
     * Export current configuration and calibration data
     */
    exportCalibration() {
        return {
            version: '1.0.0',
            timestamp: Date.now(),
            config: { ...this.config },
            performance: { ...this.performanceMetrics },
            frequencyMaps: {
                linear: Array.from(this.frequencyMaps.linear),
                mel: Array.from(this.frequencyMaps.mel),
                bark: Array.from(this.frequencyMaps.bark)
            }
        };
    }
    
    /**
     * Import calibration data
     */
    importCalibration(calibrationData) {
        if (calibrationData.config) {
            this.updateConfig(calibrationData.config);
        }
        
        // Restore frequency maps if provided
        if (calibrationData.frequencyMaps) {
            Object.keys(calibrationData.frequencyMaps).forEach(scale => {
                if (this.frequencyMaps[scale]) {
                    this.frequencyMaps[scale].set(calibrationData.frequencyMaps[scale]);
                }
            });
        }
        
        console.log('FFT calibration imported');
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        console.log('Disposing FFTProcessor...');
        
        // Clean up WebWorker
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        // Clear caches
        this.fftCache.clear();
        this.windowFunctions.clear();
        this.twiddleFactors.clear();
        
        // Clear buffers
        Object.keys(this.buffers).forEach(key => {
            this.buffers[key] = null;
        });
        
        // Clear frequency maps
        Object.keys(this.frequencyMaps).forEach(key => {
            this.frequencyMaps[key] = null;
        });
        
        // Disconnect engines
        if (this.engines.native) {
            this.engines.native.disconnect();
        }
        
        this.isInitialized = false;
        this.audioContext = null;
        
        console.log('FFTProcessor disposed');
    }
}

/**
 * Custom FFT implementation for educational purposes and full control
 */
class CustomFFT {
    constructor(maxSize = 8192) {
        this.maxSize = maxSize;
        this.initializeTables();
    }
    
    initializeTables() {
        // Precompute sine/cosine tables for efficiency
        this.sinTable = new Float32Array(this.maxSize / 2);
        this.cosTable = new Float32Array(this.maxSize / 2);
        
        for (let i = 0; i < this.maxSize / 2; i++) {
            const angle = -2 * Math.PI * i / this.maxSize;
            this.sinTable[i] = Math.sin(angle);
            this.cosTable[i] = Math.cos(angle);
        }
    }
    
    /**
     * Compute FFT using Cooley-Tukey algorithm
     */
    compute(inputBuffer, size) {
        if (size & (size - 1)) {
            throw new Error('FFT size must be a power of 2');
        }
        
        const real = new Float32Array(size);
        const imag = new Float32Array(size);
        
        // Copy input and initialize imaginary part
        for (let i = 0; i < Math.min(inputBuffer.length, size); i++) {
            real[i] = inputBuffer[i];
            imag[i] = 0;
        }
        
        // Bit-reversal permutation
        this.bitReversePermute(real, imag, size);
        
        // Cooley-Tukey FFT
        for (let len = 2; len <= size; len *= 2) {
            const halfLen = len / 2;
            const angleStep = this.maxSize / len;
            
            for (let i = 0; i < size; i += len) {
                for (let j = 0; j < halfLen; j++) {
                    const k = i + j;
                    const l = k + halfLen;
                    
                    const twiddle_real = this.cosTable[j * angleStep];
                    const twiddle_imag = this.sinTable[j * angleStep];
                    
                    const temp_real = real[l] * twiddle_real - imag[l] * twiddle_imag;
                    const temp_imag = real[l] * twiddle_imag + imag[l] * twiddle_real;
                    
                    real[l] = real[k] - temp_real;
                    imag[l] = imag[k] - temp_imag;
                    real[k] = real[k] + temp_real;
                    imag[k] = imag[k] + temp_imag;
                }
            }
        }
        
        return { real, imag };
    }
    
    /**
     * Bit-reversal permutation for FFT
     */
    bitReversePermute(real, imag, size) {
        const log2Size = Math.log2(size);
        
        for (let i = 0; i < size; i++) {
            const j = this.reverseBits(i, log2Size);
            if (i < j) {
                // Swap real parts
                [real[i], real[j]] = [real[j], real[i]];
                // Swap imaginary parts
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
        }
    }
    
    reverseBits(num, bits) {
        let result = 0;
        for (let i = 0; i < bits; i++) {
            result = (result << 1) | (num & 1);
            num >>= 1;
        }
        return result;
    }
}