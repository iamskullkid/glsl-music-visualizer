/**
 * Advanced Audio Interface
 * Professional-grade Web Audio API wrapper with sophisticated audio preprocessing
 * Location: src/audio/AudioInterface.js
 * 
 * Integrates with AudioEngine.js to provide high-quality audio routing,
 * multi-source support, and professional audio processing features
 */

import { MathUtils } from '../utils/MathUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class AudioInterface {
    constructor() {
        this.audioContext = null;
        this.isInitialized = false;
        
        // Audio routing graph - professional signal chain
        this.audioGraph = {
            // Input sources
            source: null,
            microphoneInput: null,
            lineInput: null,
            
            // Signal processing chain
            inputGain: null,
            highpassFilter: null,     // Remove subsonic frequencies
            lowpassFilter: null,      // Anti-aliasing filter
            compressor: null,         // Dynamic range control
            limiter: null,            // Peak limiting
            
            // Analysis chain
            preAnalysisGain: null,    // Gain staging for analysis
            analyzerNode: null,       // Main analyzer
            
            // Output routing
            outputGain: null,
            destination: null
        };
        
        // High-resolution audio buffers for advanced analysis
        this.buffers = {
            // Time domain buffers
            timeDataFloat: null,
            timeDataHighRes: null,    // Higher resolution for micro-timing
            
            // Frequency domain buffers
            frequencyDataFloat: null,
            frequencyDataDb: null,
            
            // Overlapping window buffers for smooth analysis
            windowBuffer: null,
            overlapBuffer: null,
            
            // Spectral history for temporal analysis
            spectralHistory: null,
            spectralHistorySize: 256  // Number of frames to keep
        };
        
        // Advanced audio settings
        this.settings = {
            // Input settings
            inputGain: 1.0,
            inputAutoGain: true,
            inputNoiseGate: -60,      // dB threshold
            
            // Processing settings
            highpassFreq: 20,         // Hz - remove subsonic
            lowpassFreq: 20000,       // Hz - anti-aliasing
            
            // Compressor settings
            compressorThreshold: -24, // dB
            compressorRatio: 4,
            compressorAttack: 0.003,  // seconds
            compressorRelease: 0.25,
            compressorKnee: 30,
            
            // Limiter settings
            limiterThreshold: -3,     // dB
            limiterLookahead: 0.005,  // seconds
            
            // Analysis settings
            analysisGain: 1.0,
            windowFunction: 'hann',   // 'hann', 'hamming', 'blackman'
            overlapRatio: 0.75,       // 75% overlap for smooth analysis
            
            // Quality settings
            processingQuality: 'high', // 'low', 'medium', 'high', 'ultra'
            latencyMode: 'interactive' // 'interactive', 'balanced', 'playback'
        };
        
        // Audio source management
        this.sources = {
            current: null,
            type: null,              // 'file', 'microphone', 'line'
            sampleRate: 44100,
            channels: 2,
            bitDepth: 32
        };
        
        // Real-time audio metrics
        this.metrics = {
            inputLevel: 0,
            outputLevel: 0,
            peakLevel: 0,
            rmsLevel: 0,
            dynamicRange: 0,
            signalToNoise: 0,
            thd: 0,                  // Total harmonic distortion
            latency: 0,
            processingLoad: 0
        };
        
        // Advanced windowing functions
        this.windowFunctions = new Map();
        
        // Performance tracking
        this.performanceMetrics = {
            processingTime: 0,
            bufferUnderruns: 0,
            peakCPUUsage: 0,
            memoryUsage: 0
        };
        
        // Event system
        this.eventListeners = new Map();
        
        // Error recovery system
        this.errorRecovery = {
            enabled: true,
            maxRetries: 3,
            retryCount: 0,
            lastError: null
        };
    }
    
    /**
     * Initialize the audio interface with advanced configuration
     * @param {AudioContext} audioContext - Shared audio context from AudioEngine
     * @param {Object} config - Configuration options
     */
    async initialize(audioContext, config = {}) {
        try {
            this.audioContext = audioContext;
            
            // Apply configuration
            Object.assign(this.settings, config);
            
            // Create audio routing graph
            await this.createAudioGraph();
            
            // Initialize buffers
            this.initializeBuffers();
            
            // Setup windowing functions
            this.initializeWindowFunctions();
            
            // Start real-time monitoring
            this.startMetricsMonitoring();
            
            this.isInitialized = true;
            
            console.log('AudioInterface initialized with advanced features', {
                sampleRate: this.audioContext.sampleRate,
                processingQuality: this.settings.processingQuality,
                latencyMode: this.settings.latencyMode
            });
            
        } catch (error) {
            console.error('Failed to initialize AudioInterface:', error);
            this.handleError('initialization', error);
            throw error;
        }
    }
    
    /**
     * Create sophisticated audio processing graph
     */
    async createAudioGraph() {
        const ctx = this.audioContext;
        
        // Input gain with auto-gain control
        this.audioGraph.inputGain = ctx.createGain();
        this.audioGraph.inputGain.gain.value = this.settings.inputGain;
        
        // High-pass filter to remove subsonic frequencies
        this.audioGraph.highpassFilter = ctx.createBiquadFilter();
        this.audioGraph.highpassFilter.type = 'highpass';
        this.audioGraph.highpassFilter.frequency.value = this.settings.highpassFreq;
        this.audioGraph.highpassFilter.Q.value = 0.7;
        
        // Low-pass filter for anti-aliasing
        this.audioGraph.lowpassFilter = ctx.createBiquadFilter();
        this.audioGraph.lowpassFilter.type = 'lowpass';
        this.audioGraph.lowpassFilter.frequency.value = this.settings.lowpassFreq;
        this.audioGraph.lowpassFilter.Q.value = 0.7;
        
        // Professional dynamics processor
        this.audioGraph.compressor = ctx.createDynamicsCompressor();
        this.audioGraph.compressor.threshold.value = this.settings.compressorThreshold;
        this.audioGraph.compressor.ratio.value = this.settings.compressorRatio;
        this.audioGraph.compressor.attack.value = this.settings.compressorAttack;
        this.audioGraph.compressor.release.value = this.settings.compressorRelease;
        this.audioGraph.compressor.knee.value = this.settings.compressorKnee;
        
        // Limiter for peak control (using second compressor with extreme settings)
        this.audioGraph.limiter = ctx.createDynamicsCompressor();
        this.audioGraph.limiter.threshold.value = this.settings.limiterThreshold;
        this.audioGraph.limiter.ratio.value = 20; // Hard limiting
        this.audioGraph.limiter.attack.value = 0.001;
        this.audioGraph.limiter.release.value = 0.01;
        this.audioGraph.limiter.knee.value = 0;
        
        // Pre-analysis gain control
        this.audioGraph.preAnalysisGain = ctx.createGain();
        this.audioGraph.preAnalysisGain.gain.value = this.settings.analysisGain;
        
        // High-resolution analyzer
        this.audioGraph.analyzerNode = ctx.createAnalyser();
        this.setupAnalyzerNode();
        
        // Output gain
        this.audioGraph.outputGain = ctx.createGain();
        this.audioGraph.outputGain.gain.value = 1.0;
        
        // Connect the processing chain
        this.connectProcessingChain();
        
        console.log('Advanced audio processing graph created');
    }
    
    /**
     * Setup analyzer node with optimal parameters
     */
    setupAnalyzerNode() {
        const analyzer = this.audioGraph.analyzerNode;
        
        // Configure based on quality settings
        const qualitySettings = {
            low: { fftSize: 2048, smoothing: 0.9 },
            medium: { fftSize: 4096, smoothing: 0.8 },
            high: { fftSize: 8192, smoothing: 0.7 },
            ultra: { fftSize: 16384, smoothing: 0.6 }
        };
        
        const settings = qualitySettings[this.settings.processingQuality] || qualitySettings.high;
        
        analyzer.fftSize = settings.fftSize;
        analyzer.smoothingTimeConstant = settings.smoothing;
        analyzer.maxDecibels = -10;
        analyzer.minDecibels = -100;
        
        console.log(`Analyzer configured: FFT=${settings.fftSize}, Smoothing=${settings.smoothing}`);
    }
    
    /**
     * Connect all audio nodes in the processing chain
     */
    connectProcessingChain() {
        // Main processing chain
        this.audioGraph.inputGain
            .connect(this.audioGraph.highpassFilter)
            .connect(this.audioGraph.lowpassFilter)
            .connect(this.audioGraph.compressor)
            .connect(this.audioGraph.limiter)
            .connect(this.audioGraph.outputGain)
            .connect(this.audioContext.destination);
        
        // Analysis chain (tapped after compressor for consistent levels)
        this.audioGraph.compressor
            .connect(this.audioGraph.preAnalysisGain)
            .connect(this.audioGraph.analyzerNode);
    }
    
    /**
     * Initialize high-performance audio buffers
     */
    initializeBuffers() {
        const fftSize = this.audioGraph.analyzerNode.fftSize;
        const frequencyBinCount = this.audioGraph.analyzerNode.frequencyBinCount;
        
        // Time domain buffers
        this.buffers.timeDataFloat = new Float32Array(fftSize);
        this.buffers.timeDataHighRes = new Float32Array(fftSize * 2); // Higher resolution
        
        // Frequency domain buffers
        this.buffers.frequencyDataFloat = new Float32Array(frequencyBinCount);
        this.buffers.frequencyDataDb = new Float32Array(frequencyBinCount);
        
        // Windowing buffers
        this.buffers.windowBuffer = new Float32Array(fftSize);
        this.buffers.overlapBuffer = new Float32Array(fftSize);
        
        // Spectral history for temporal analysis
        this.buffers.spectralHistory = new Array(this.buffers.spectralHistorySize);
        for (let i = 0; i < this.buffers.spectralHistorySize; i++) {
            this.buffers.spectralHistory[i] = new Float32Array(frequencyBinCount);
        }
        
        console.log(`Audio buffers initialized: FFT=${fftSize}, Bins=${frequencyBinCount}`);
    }
    
    /**
     * Initialize advanced windowing functions for spectral analysis
     */
    initializeWindowFunctions() {
        const fftSize = this.audioGraph.analyzerNode.fftSize;
        
        // Hann window (default)
        const hannWindow = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
        }
        this.windowFunctions.set('hann', hannWindow);
        
        // Hamming window
        const hammingWindow = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            hammingWindow[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (fftSize - 1));
        }
        this.windowFunctions.set('hamming', hammingWindow);
        
        // Blackman window
        const blackmanWindow = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            const a0 = 0.42, a1 = 0.5, a2 = 0.08;
            blackmanWindow[i] = a0 - a1 * Math.cos(2 * Math.PI * i / (fftSize - 1)) + 
                               a2 * Math.cos(4 * Math.PI * i / (fftSize - 1));
        }
        this.windowFunctions.set('blackman', blackmanWindow);
        
        // Kaiser window (high quality)
        const kaiserWindow = new Float32Array(fftSize);
        const beta = 8.6; // Kaiser parameter
        const I0_beta = this.besselI0(beta);
        for (let i = 0; i < fftSize; i++) {
            const n = i - (fftSize - 1) / 2;
            const arg = beta * Math.sqrt(1 - Math.pow(2 * n / (fftSize - 1), 2));
            kaiserWindow[i] = this.besselI0(arg) / I0_beta;
        }
        this.windowFunctions.set('kaiser', kaiserWindow);
        
        console.log(`Windowing functions initialized: ${Array.from(this.windowFunctions.keys()).join(', ')}`);
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
     * Connect audio source to the processing chain
     * @param {AudioNode} sourceNode - Audio source to connect
     * @param {string} sourceType - Type of source ('file', 'microphone', 'line')
     */
    connectAudioSource(sourceNode, sourceType = 'unknown') {
        // Disconnect previous source
        if (this.audioGraph.source) {
            this.audioGraph.source.disconnect();
        }
        
        // Connect new source
        this.audioGraph.source = sourceNode;
        this.sources.type = sourceType;
        
        sourceNode.connect(this.audioGraph.inputGain);
        
        // Update metrics based on source type
        this.updateSourceMetrics(sourceNode);
        
        console.log(`Audio source connected: ${sourceType}`);
        this.emit('sourceConnected', { type: sourceType, node: sourceNode });
    }
    
    /**
     * Update audio source metrics
     */
    updateSourceMetrics(sourceNode) {
        if (sourceNode.buffer) {
            this.sources.sampleRate = sourceNode.buffer.sampleRate;
            this.sources.channels = sourceNode.buffer.numberOfChannels;
        } else if (sourceNode.mediaStream) {
            const audioTracks = sourceNode.mediaStream.getAudioTracks();
            if (audioTracks.length > 0) {
                const settings = audioTracks[0].getSettings();
                this.sources.sampleRate = settings.sampleRate || 44100;
                this.sources.channels = settings.channelCount || 2;
            }
        }
    }
    
    /**
     * Get high-quality audio data with advanced windowing
     * @param {Object} options - Analysis options
     * @returns {Object} Processed audio data
     */
    getAudioData(options = {}) {
        const startTime = performance.now();
        
        try {
            const analyzer = this.audioGraph.analyzerNode;
            
            // Get raw audio data
            analyzer.getFloatTimeDomainData(this.buffers.timeDataFloat);
            analyzer.getFloatFrequencyData(this.buffers.frequencyDataDb);
            
            // Apply windowing function
            const windowFunction = this.windowFunctions.get(this.settings.windowFunction);
            const windowedData = this.applyWindow(this.buffers.timeDataFloat, windowFunction);
            
            // Convert dB to linear for calculations
            for (let i = 0; i < this.buffers.frequencyDataDb.length; i++) {
                this.buffers.frequencyDataFloat[i] = MathUtils.dbToAmplitude(this.buffers.frequencyDataDb[i]);
            }
            
            // Update spectral history
            this.updateSpectralHistory();
            
            // Calculate advanced metrics
            const metrics = this.calculateAdvancedMetrics(windowedData);
            
            // Record processing time
            const processingTime = performance.now() - startTime;
            this.performanceMetrics.processingTime = processingTime;
            performanceMonitor.recordCPUTime('audioProcessing', processingTime);
            
            return {
                timeData: windowedData,
                frequencyData: this.buffers.frequencyDataFloat,
                frequencyDataDb: this.buffers.frequencyDataDb,
                metrics: metrics,
                spectralHistory: this.buffers.spectralHistory,
                processingTime: processingTime
            };
            
        } catch (error) {
            console.error('Error getting audio data:', error);
            this.handleError('audioData', error);
            return null;
        }
    }
    
    /**
     * Apply windowing function to time domain data
     */
    applyWindow(timeData, windowFunction) {
        if (!windowFunction) return timeData;
        
        const windowedData = new Float32Array(timeData.length);
        for (let i = 0; i < timeData.length; i++) {
            windowedData[i] = timeData[i] * windowFunction[i];
        }
        
        return windowedData;
    }
    
    /**
     * Update spectral history buffer for temporal analysis
     */
    updateSpectralHistory() {
        // Shift history
        for (let i = this.buffers.spectralHistory.length - 1; i > 0; i--) {
            this.buffers.spectralHistory[i].set(this.buffers.spectralHistory[i - 1]);
        }
        
        // Add current frame
        this.buffers.spectralHistory[0].set(this.buffers.frequencyDataFloat);
    }
    
    /**
     * Calculate advanced audio metrics
     */
    calculateAdvancedMetrics(timeData) {
        const metrics = {};
        
        // RMS and peak levels
        metrics.rmsLevel = MathUtils.rms(timeData);
        metrics.peakLevel = Math.max(...timeData.map(Math.abs));
        
        // Dynamic range
        const sortedAmplitudes = [...timeData].map(Math.abs).sort((a, b) => b - a);
        const percentile95 = sortedAmplitudes[Math.floor(sortedAmplitudes.length * 0.05)];
        const percentile5 = sortedAmplitudes[Math.floor(sortedAmplitudes.length * 0.95)];
        metrics.dynamicRange = 20 * Math.log10(percentile95 / (percentile5 + 1e-10));
        
        // Zero crossing rate
        metrics.zeroCrossingRate = this.calculateZeroCrossingRate(timeData);
        
        // Spectral centroid
        metrics.spectralCentroid = this.calculateSpectralCentroid();
        
        // Spectral rolloff
        metrics.spectralRolloff = this.calculateSpectralRolloff();
        
        // Spectral flux (temporal change)
        metrics.spectralFlux = this.calculateSpectralFlux();
        
        // THD estimation
        metrics.thd = this.calculateTHD();
        
        return metrics;
    }
    
    /**
     * Calculate zero crossing rate
     */
    calculateZeroCrossingRate(timeData) {
        let crossings = 0;
        for (let i = 1; i < timeData.length; i++) {
            if ((timeData[i] >= 0) !== (timeData[i - 1] >= 0)) {
                crossings++;
            }
        }
        return crossings / (timeData.length - 1);
    }
    
    /**
     * Calculate spectral centroid (brightness)
     */
    calculateSpectralCentroid() {
        const spectrum = this.buffers.frequencyDataFloat;
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < spectrum.length; i++) {
            weightedSum += i * spectrum[i];
            magnitudeSum += spectrum[i];
        }
        
        return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }
    
    /**
     * Calculate spectral rolloff
     */
    calculateSpectralRolloff(threshold = 0.85) {
        const spectrum = this.buffers.frequencyDataFloat;
        const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
        const rolloffThreshold = totalEnergy * threshold;
        
        let cumulativeEnergy = 0;
        for (let i = 0; i < spectrum.length; i++) {
            cumulativeEnergy += spectrum[i];
            if (cumulativeEnergy >= rolloffThreshold) {
                return i / spectrum.length;
            }
        }
        
        return 1.0;
    }
    
    /**
     * Calculate spectral flux (temporal change in spectrum)
     */
    calculateSpectralFlux() {
        if (this.buffers.spectralHistory.length < 2) return 0;
        
        const current = this.buffers.spectralHistory[0];
        const previous = this.buffers.spectralHistory[1];
        
        let flux = 0;
        for (let i = 0; i < current.length; i++) {
            const diff = current[i] - previous[i];
            flux += Math.max(0, diff); // Only positive changes
        }
        
        return flux / current.length;
    }
    
    /**
     * Estimate Total Harmonic Distortion
     */
    calculateTHD() {
        const spectrum = this.buffers.frequencyDataFloat;
        
        // Find fundamental frequency (simplified)
        let maxBin = 0;
        let maxValue = 0;
        for (let i = 1; i < spectrum.length / 4; i++) {
            if (spectrum[i] > maxValue) {
                maxValue = spectrum[i];
                maxBin = i;
            }
        }
        
        if (maxValue < 1e-6) return 0;
        
        // Calculate harmonic content
        let harmonicEnergy = 0;
        for (let h = 2; h <= 8; h++) {
            const harmonicBin = maxBin * h;
            if (harmonicBin < spectrum.length) {
                harmonicEnergy += spectrum[harmonicBin] * spectrum[harmonicBin];
            }
        }
        
        const fundamentalEnergy = maxValue * maxValue;
        return Math.sqrt(harmonicEnergy / fundamentalEnergy);
    }
    
    /**
     * Start real-time metrics monitoring
     */
    startMetricsMonitoring() {
        const updateMetrics = () => {
            if (!this.isInitialized) return;
            
            // Update input/output levels
            const audioData = this.getAudioData();
            if (audioData) {
                this.metrics.inputLevel = audioData.metrics.rmsLevel;
                this.metrics.peakLevel = audioData.metrics.peakLevel;
                this.metrics.dynamicRange = audioData.metrics.dynamicRange;
                this.metrics.thd = audioData.metrics.thd;
            }
            
            // Calculate processing load
            this.metrics.processingLoad = this.performanceMetrics.processingTime / 16.67; // Percentage of 60fps frame time
            
            // Emit metrics update
            this.emit('metricsUpdate', this.metrics);
            
            // Schedule next update
            setTimeout(updateMetrics, 100); // 10Hz update rate
        };
        
        updateMetrics();
    }
    
    /**
     * Set audio processing parameter
     * @param {string} parameter - Parameter name
     * @param {*} value - Parameter value
     */
    setParameter(parameter, value) {
        const graph = this.audioGraph;
        
        switch (parameter) {
            case 'inputGain':
                this.settings.inputGain = value;
                graph.inputGain.gain.setValueAtTime(value, this.audioContext.currentTime);
                break;
                
            case 'highpassFreq':
                this.settings.highpassFreq = value;
                graph.highpassFilter.frequency.setValueAtTime(value, this.audioContext.currentTime);
                break;
                
            case 'lowpassFreq':
                this.settings.lowpassFreq = value;
                graph.lowpassFilter.frequency.setValueAtTime(value, this.audioContext.currentTime);
                break;
                
            case 'compressorThreshold':
                this.settings.compressorThreshold = value;
                graph.compressor.threshold.setValueAtTime(value, this.audioContext.currentTime);
                break;
                
            case 'compressorRatio':
                this.settings.compressorRatio = value;
                graph.compressor.ratio.setValueAtTime(value, this.audioContext.currentTime);
                break;
                
            case 'compressorAttack':
                this.settings.compressorAttack = value;
                graph.compressor.attack.setValueAtTime(value, this.audioContext.currentTime);
                break;
                
            case 'compressorRelease':
                this.settings.compressorRelease = value;
                graph.compressor.release.setValueAtTime(value, this.audioContext.currentTime);
                break;
                
            case 'analysisGain':
                this.settings.analysisGain = value;
                graph.preAnalysisGain.gain.setValueAtTime(value, this.audioContext.currentTime);
                break;
                
            case 'windowFunction':
                if (this.windowFunctions.has(value)) {
                    this.settings.windowFunction = value;
                }
                break;
                
            default:
                console.warn(`Unknown parameter: ${parameter}`);
        }
        
        this.emit('parameterChanged', { parameter, value });
    }
    
    /**
     * Get current audio processing parameter
     * @param {string} parameter - Parameter name
     * @returns {*} Parameter value
     */
    getParameter(parameter) {
        return this.settings[parameter];
    }
    
    /**
     * Enable/disable auto-gain control
     * @param {boolean} enabled - Auto-gain state
     */
    setAutoGain(enabled) {
        this.settings.inputAutoGain = enabled;
        
        if (enabled) {
            this.startAutoGainControl();
        } else {
            this.stopAutoGainControl();
        }
    }
    
    /**
     * Start automatic gain control
     */
    startAutoGainControl() {
        if (this.autoGainInterval) return;
        
        this.autoGainInterval = setInterval(() => {
            const targetLevel = 0.7; // Target RMS level
            const currentLevel = this.metrics.rmsLevel;
            
            if (currentLevel > 0.001) { // Avoid division by zero
                const gainAdjustment = targetLevel / currentLevel;
                const newGain = MathUtils.clamp(
                    this.settings.inputGain * gainAdjustment,
                    0.1, 10.0
                );
                
                // Smooth gain changes
                const smoothedGain = MathUtils.lerp(this.settings.inputGain, newGain, 0.1);
                this.setParameter('inputGain', smoothedGain);
            }
        }, 100);
    }
    
    /**
     * Stop automatic gain control
     */
    stopAutoGainControl() {
        if (this.autoGainInterval) {
            clearInterval(this.autoGainInterval);
            this.autoGainInterval = null;
        }
    }
    
    /**
     * Get frequency response of the processing chain
     * @param {Array} frequencies - Frequencies to test
     * @returns {Promise<Array>} Frequency response data
     */
    async getFrequencyResponse(frequencies) {
        const responses = [];
        
        // Test each filter in the chain
        const filters = [
            this.audioGraph.highpassFilter,
            this.audioGraph.lowpassFilter
        ];
        
        for (const filter of filters) {
            const magResponse = new Float32Array(frequencies.length);
            const phaseResponse = new Float32Array(frequencies.length);
            
            filter.getFrequencyResponse(
                new Float32Array(frequencies),
                magResponse,
                phaseResponse
            );
            
            responses.push({
                filter: filter.type,
                magnitude: Array.from(magResponse),
                phase: Array.from(phaseResponse)
            });
        }
        
        return responses;
    }
    
    /**
     * Analyze noise floor and signal-to-noise ratio
     * @param {number} duration - Analysis duration in seconds
     * @returns {Promise<Object>} Noise analysis results
     */
    async analyzeNoiseFloor(duration = 5.0) {
        return new Promise((resolve) => {
            const samples = [];
            const sampleRate = 10; // 10 samples per second
            const totalSamples = duration * sampleRate;
            
            const collectSample = () => {
                const audioData = this.getAudioData();
                if (audioData) {
                    samples.push(audioData.metrics.rmsLevel);
                }
                
                if (samples.length >= totalSamples) {
                    // Calculate noise floor statistics
                    const sortedSamples = samples.sort((a, b) => a - b);
                    const noiseFloor = sortedSamples[Math.floor(sortedSamples.length * 0.1)]; // 10th percentile
                    const signalLevel = sortedSamples[Math.floor(sortedSamples.length * 0.9)]; // 90th percentile
                    
                    const snr = 20 * Math.log10(signalLevel / (noiseFloor + 1e-10));
                    
                    resolve({
                        noiseFloor: 20 * Math.log10(noiseFloor + 1e-10),
                        signalLevel: 20 * Math.log10(signalLevel + 1e-10),
                        snr: snr,
                        samples: samples.length,
                        duration: duration
                    });
                } else {
                    setTimeout(collectSample, 1000 / sampleRate);
                }
            };
            
            collectSample();
        });
    }
    
    /**
     * Calibrate the audio interface for optimal performance
     * @param {Object} options - Calibration options
     * @returns {Promise<Object>} Calibration results
     */
    async calibrate(options = {}) {
        console.log('Starting audio interface calibration...');
        
        const {
            testDuration = 10,
            targetLevel = -20, // dB
            autoAdjust = true
        } = options;
        
        try {
            // Step 1: Analyze noise floor
            const noiseAnalysis = await this.analyzeNoiseFloor(testDuration / 2);
            
            // Step 2: Measure frequency response
            const testFrequencies = [];
            for (let i = 20; i <= 20000; i *= 1.1) {
                testFrequencies.push(i);
            }
            const frequencyResponse = await this.getFrequencyResponse(testFrequencies);
            
            // Step 3: Optimize settings
            if (autoAdjust) {
                // Adjust highpass filter to remove noise
                if (noiseAnalysis.noiseFloor > -60) {
                    this.setParameter('highpassFreq', 40);
                }
                
                // Adjust compressor based on dynamic range
                if (noiseAnalysis.snr < 40) {
                    this.setParameter('compressorRatio', 6);
                    this.setParameter('compressorThreshold', -30);
                }
            }
            
            const results = {
                timestamp: Date.now(),
                noiseAnalysis,
                frequencyResponse,
                settings: { ...this.settings },
                recommendations: this.generateCalibrationRecommendations(noiseAnalysis)
            };
            
            console.log('Audio interface calibration completed', results);
            this.emit('calibrationComplete', results);
            
            return results;
            
        } catch (error) {
            console.error('Calibration failed:', error);
            this.handleError('calibration', error);
            throw error;
        }
    }
    
    /**
     * Generate calibration recommendations
     */
    generateCalibrationRecommendations(noiseAnalysis) {
        const recommendations = [];
        
        if (noiseAnalysis.snr < 30) {
            recommendations.push({
                type: 'warning',
                message: 'Low signal-to-noise ratio detected',
                suggestion: 'Increase input gain or reduce background noise'
            });
        }
        
        if (noiseAnalysis.noiseFloor > -50) {
            recommendations.push({
                type: 'suggestion',
                message: 'High noise floor detected',
                suggestion: 'Enable noise gate or increase highpass filter frequency'
            });
        }
        
        if (this.metrics.thd > 0.1) {
            recommendations.push({
                type: 'warning',
                message: 'High distortion detected',
                suggestion: 'Reduce input gain or limiter threshold'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Event system implementation
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }
    
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }
    
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Error handling and recovery
     */
    handleError(context, error) {
        this.errorRecovery.lastError = { context, error, timestamp: Date.now() };
        
        console.error(`AudioInterface error in ${context}:`, error);
        
        if (this.errorRecovery.enabled && this.errorRecovery.retryCount < this.errorRecovery.maxRetries) {
            this.errorRecovery.retryCount++;
            console.log(`Attempting error recovery (${this.errorRecovery.retryCount}/${this.errorRecovery.maxRetries})`);
            
            // Attempt recovery based on error context
            switch (context) {
                case 'audioData':
                    // Reset analyzer node
                    this.setupAnalyzerNode();
                    break;
                    
                case 'processing':
                    // Reset processing chain
                    this.connectProcessingChain();
                    break;
                    
                default:
                    console.warn(`No recovery strategy for context: ${context}`);
            }
        }
        
        this.emit('error', { context, error, recovery: this.errorRecovery });
    }
    
    /**
     * Get comprehensive interface status
     * @returns {Object} Complete interface status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            settings: { ...this.settings },
            sources: { ...this.sources },
            metrics: { ...this.metrics },
            performance: { ...this.performanceMetrics },
            bufferInfo: {
                fftSize: this.audioGraph.analyzerNode?.fftSize || 0,
                frequencyBinCount: this.audioGraph.analyzerNode?.frequencyBinCount || 0,
                spectralHistorySize: this.buffers.spectralHistorySize
            },
            audioContext: {
                state: this.audioContext?.state,
                sampleRate: this.audioContext?.sampleRate,
                currentTime: this.audioContext?.currentTime
            }
        };
    }
    
    /**
     * Export configuration for saving/loading
     * @returns {Object} Exportable configuration
     */
    exportConfig() {
        return {
            version: '1.0.0',
            timestamp: Date.now(),
            settings: { ...this.settings },
            windowFunction: this.settings.windowFunction,
            calibration: this.errorRecovery.lastError ? null : 'valid'
        };
    }
    
    /**
     * Import configuration
     * @param {Object} config - Configuration to import
     */
    importConfig(config) {
        if (config.version && config.settings) {
            Object.assign(this.settings, config.settings);
            
            // Apply settings to audio graph
            Object.keys(config.settings).forEach(key => {
                try {
                    this.setParameter(key, config.settings[key]);
                } catch (error) {
                    console.warn(`Failed to apply setting ${key}:`, error);
                }
            });
            
            console.log('Configuration imported successfully');
            this.emit('configImported', config);
        } else {
            throw new Error('Invalid configuration format');
        }
    }
    
    /**
     * Clean up resources and disconnect audio graph
     */
    dispose() {
        console.log('Disposing AudioInterface...');
        
        // Stop auto-gain control
        this.stopAutoGainControl();
        
        // Clear event listeners
        this.eventListeners.clear();
        
        // Disconnect audio graph
        if (this.audioGraph.source) {
            this.audioGraph.source.disconnect();
        }
        
        Object.values(this.audioGraph).forEach(node => {
            if (node && node.disconnect) {
                try {
                    node.disconnect();
                } catch (error) {
                    // Node might already be disconnected
                }
            }
        });
        
        // Clear buffers
        this.buffers = {
            timeDataFloat: null,
            timeDataHighRes: null,
            frequencyDataFloat: null,
            frequencyDataDb: null,
            windowBuffer: null,
            overlapBuffer: null,
            spectralHistory: null
        };
        
        // Clear window functions
        this.windowFunctions.clear();
        
        // Reset state
        this.isInitialized = false;
        this.audioContext = null;
        
        console.log('AudioInterface disposed');
    }
}

// Export the AudioInterface class
export { AudioInterface };