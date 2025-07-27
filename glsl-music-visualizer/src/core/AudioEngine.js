/**
 * Audio Engine
 * Advanced audio processing coordinator for the GLSL music visualizer
 * Manages Web Audio API, coordinates analysis modules, and provides real-time audio data
 */

import { performanceMonitor } from './PerformanceMonitor.js';
import { FileUtils } from '../utils/FileUtils.js';
import { MathUtils } from '../utils/MathUtils.js';

export class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.isInitialized = false;
        this.isPlaying = false;
        this.isPaused = false;
        
        // Audio sources
        this.currentSource = null;
        this.audioBuffer = null;
        this.mediaElement = null;
        this.microphoneStream = null;
        
        // Audio nodes
        this.nodes = {
            source: null,
            analyzer: null,
            gainNode: null,
            compressor: null,
            destination: null
        };
        
        // Analysis modules (will be imported dynamically)
        this.analysisModules = {
            fft: null,
            spectral: null,
            beat: null,
            features: null
        };
        
        // Real-time audio data
        this.audioData = {
            // Time domain
            timeData: new Float32Array(2048),
            
            // Frequency domain
            frequencyData: new Float32Array(1024),
            frequencyDataDb: new Float32Array(1024),
            
            // Processed frequency bands
            bassLevel: 0,
            midLevel: 0,
            trebleLevel: 0,
            
            // Advanced features
            energy: 0,
            rms: 0,
            zcr: 0, // Zero crossing rate
            spectralCentroid: 0,
            spectralRolloff: 0,
            spectralFlux: 0,
            
            // Beat detection
            bpm: 0,
            beat: false,
            beatStrength: 0,
            onset: false,
            
            // Harmonic analysis
            pitch: 0,
            harmonics: new Float32Array(8),
            chroma: new Float32Array(12),
            
            // Mel-frequency features
            mfcc: new Float32Array(13),
            melSpectrogram: new Float32Array(128)
        };
        
        // Analysis configuration
        this.config = {
            fftSize: 4096,
            hopSize: 1024,
            sampleRate: 44100,
            smoothingTimeConstant: 0.8,
            
            // Frequency band ranges (Hz)
            bassRange: [20, 250],
            midRange: [250, 4000],
            trebleRange: [4000, 20000],
            
            // Beat detection settings
            beatSensitivity: 0.5,
            beatThreshold: 0.15,
            bpmRange: [60, 180],
            
            // Advanced analysis
            windowFunction: 'hann',
            overlapRatio: 0.75,
            melFilterBanks: 128,
            mfccCoefficients: 13
        };
        
        // Performance monitoring
        this.analysisTime = 0;
        this.updateCallbacks = new Set();
        this.errorCallbacks = new Set();
        
        // Animation frame for real-time updates
        this.animationFrame = null;
        this.lastUpdateTime = 0;
        this.updateRate = 60; // Target updates per second
        
        // Audio file management
        this.loadedFiles = new Map();
        this.currentFile = null;
        
        // Microphone settings
        this.microphoneSettings = {
            enabled: false,
            autoGainControl: true,
            noiseSuppression: true,
            echoCancellation: true
        };
        
        // Volume and gain control
        this.volume = 1.0;
        this.muted = false;
        this.previousVolume = 1.0;
    }
    
    /**
     * Initialize the audio engine
     * @param {Object} options - Initialization options
     */
    async initialize(options = {}) {
        try {
            // Merge configuration
            Object.assign(this.config, options);
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.config.sampleRate,
                latencyHint: 'interactive'
            });
            
            // Resume context if suspended (browser autoplay policy)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create audio nodes
            this.createAudioNodes();
            
            // Load analysis modules
            await this.loadAnalysisModules();
            
            // Start real-time analysis loop
            this.startAnalysisLoop();
            
            this.isInitialized = true;
            
            console.log('AudioEngine initialized', {
                sampleRate: this.audioContext.sampleRate,
                fftSize: this.config.fftSize,
                analysisModules: Object.keys(this.analysisModules).filter(key => this.analysisModules[key])
            });
            
        } catch (error) {
            console.error('Failed to initialize AudioEngine:', error);
            this.notifyError('initialization', error);
            throw error;
        }
    }
    
    /**
     * Create and connect audio nodes
     */
    createAudioNodes() {
        const ctx = this.audioContext;
        
        // Create analyzer node
        this.nodes.analyzer = ctx.createAnalyser();
        this.nodes.analyzer.fftSize = this.config.fftSize;
        this.nodes.analyzer.smoothingTimeConstant = this.config.smoothingTimeConstant;
        this.nodes.analyzer.maxDecibels = -10;
        this.nodes.analyzer.minDecibels = -90;
        
        // Create gain node for volume control
        this.nodes.gainNode = ctx.createGain();
        this.nodes.gainNode.gain.value = this.volume;
        
        // Create compressor for dynamic range control
        this.nodes.compressor = ctx.createDynamicsCompressor();
        this.nodes.compressor.threshold.value = -24;
        this.nodes.compressor.knee.value = 30;
        this.nodes.compressor.ratio.value = 12;
        this.nodes.compressor.attack.value = 0.003;
        this.nodes.compressor.release.value = 0.25;
        
        // Connect nodes: source -> analyzer -> gain -> compressor -> destination
        this.nodes.analyzer.connect(this.nodes.gainNode);
        this.nodes.gainNode.connect(this.nodes.compressor);
        this.nodes.compressor.connect(ctx.destination);
        
        console.log('Audio nodes created and connected');
    }
    
    /**
     * Load analysis modules dynamically
     */
    async loadAnalysisModules() {
        try {
            // Import analysis modules
            const modules = await Promise.all([
                import('../audio/FFTProcessor.js'),
                import('../audio/SpectralAnalyzer.js'),
                import('../audio/BeatDetector.js'),
                import('../audio/FeatureExtractor.js')
            ]);
            
            // Initialize modules
            this.analysisModules.fft = new modules[0].FFTProcessor(this.config);
            this.analysisModules.spectral = new modules[1].SpectralAnalyzer(this.config);
            this.analysisModules.beat = new modules[2].BeatDetector(this.config);
            this.analysisModules.features = new modules[3].FeatureExtractor(this.config);
            
            // Initialize each module
            await Promise.all([
                this.analysisModules.fft.initialize(this.audioContext),
                this.analysisModules.spectral.initialize(this.audioContext),
                this.analysisModules.beat.initialize(this.audioContext),
                this.analysisModules.features.initialize(this.audioContext)
            ]);
            
            console.log('Analysis modules loaded and initialized');
            
        } catch (error) {
            console.warn('Some analysis modules failed to load:', error);
            // Continue without failed modules
        }
    }
    
    /**
     * Load audio file
     * @param {File|string} source - Audio file or URL
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<AudioBuffer>} Loaded audio buffer
     */
    async loadAudioFile(source, onProgress = null) {
        try {
            const startTime = performance.now();
            
            // Load and decode audio file
            const audioBuffer = await FileUtils.loadAudioFile(source, this.audioContext, {
                onProgress
            });
            
            // Store the loaded buffer
            const fileName = source instanceof File ? source.name : source.split('/').pop();
            this.loadedFiles.set(fileName, audioBuffer);
            this.audioBuffer = audioBuffer;
            this.currentFile = fileName;
            
            const loadTime = performance.now() - startTime;
            console.log(`Audio file loaded: ${fileName} (${loadTime.toFixed(2)}ms)`);
            
            // Analyze file properties
            const duration = audioBuffer.duration;
            const channels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            
            console.log(`Audio properties: ${duration.toFixed(2)}s, ${channels} channels, ${sampleRate}Hz`);
            
            return audioBuffer;
            
        } catch (error) {
            console.error('Failed to load audio file:', error);
            this.notifyError('file_load', error);
            throw error;
        }
    }
    
    /**
     * Play loaded audio file
     * @param {AudioBuffer} audioBuffer - Audio buffer to play (optional)
     */
    async playAudioFile(audioBuffer = null) {
        try {
            // Use provided buffer or current buffer
            const buffer = audioBuffer || this.audioBuffer;
            if (!buffer) {
                throw new Error('No audio buffer to play');
            }
            
            // Stop current playback
            this.stop();
            
            // Create buffer source
            this.nodes.source = this.audioContext.createBufferSource();
            this.nodes.source.buffer = buffer;
            
            // Connect source to analysis chain
            this.nodes.source.connect(this.nodes.analyzer);
            
            // Start playback
            this.nodes.source.start(0);
            this.isPlaying = true;
            this.isPaused = false;
            
            // Handle playback end
            this.nodes.source.onended = () => {
                this.isPlaying = false;
                this.isPaused = false;
                this.nodes.source = null;
            };
            
            console.log('Audio playback started');
            
        } catch (error) {
            console.error('Failed to play audio file:', error);
            this.notifyError('playback', error);
            throw error;
        }
    }
    
    /**
     * Enable microphone input
     * @param {Object} constraints - MediaStream constraints
     */
    async enableMicrophone(constraints = {}) {
        try {
            const defaultConstraints = {
                audio: {
                    autoGainControl: this.microphoneSettings.autoGainControl,
                    noiseSuppression: this.microphoneSettings.noiseSuppression,
                    echoCancellation: this.microphoneSettings.echoCancellation,
                    sampleRate: this.config.sampleRate
                }
            };
            
            const finalConstraints = { ...defaultConstraints, ...constraints };
            
            // Get microphone stream
            this.microphoneStream = await navigator.mediaDevices.getUserMedia(finalConstraints);
            
            // Stop current playback
            this.stop();
            
            // Create media stream source
            this.nodes.source = this.audioContext.createMediaStreamSource(this.microphoneStream);
            this.nodes.source.connect(this.nodes.analyzer);
            
            this.isPlaying = true;
            this.microphoneSettings.enabled = true;
            
            console.log('Microphone input enabled');
            
        } catch (error) {
            console.error('Failed to enable microphone:', error);
            this.notifyError('microphone', error);
            throw error;
        }
    }
    
    /**
     * Disable microphone input
     */
    disableMicrophone() {
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
            this.microphoneStream = null;
        }
        
        if (this.nodes.source && this.microphoneSettings.enabled) {
            this.nodes.source.disconnect();
            this.nodes.source = null;
            this.isPlaying = false;
        }
        
        this.microphoneSettings.enabled = false;
        console.log('Microphone input disabled');
    }
    
    /**
     * Start real-time audio analysis loop
     */
    startAnalysisLoop() {
        const analyze = () => {
            if (!this.isInitialized) return;
            
            const now = performance.now();
            const deltaTime = now - this.lastUpdateTime;
            
            // Limit update rate for performance
            if (deltaTime >= 1000 / this.updateRate) {
                this.performAnalysis();
                this.lastUpdateTime = now;
            }
            
            this.animationFrame = requestAnimationFrame(analyze);
        };
        
        analyze();
    }
    
    /**
     * Perform audio analysis
     */
    performAnalysis() {
        const startTime = performance.now();
        
        try {
            // Get raw audio data from analyzer
            this.nodes.analyzer.getFloatTimeDomainData(this.audioData.timeData);
            this.nodes.analyzer.getFloatFrequencyData(this.audioData.frequencyDataDb);
            
            // Convert dB to linear for some calculations
            for (let i = 0; i < this.audioData.frequencyDataDb.length; i++) {
                this.audioData.frequencyData[i] = MathUtils.dbToAmplitude(this.audioData.frequencyDataDb[i]);
            }
            
            // Basic frequency band analysis
            this.analyzeFrequencyBands();
            
            // Calculate basic audio features
            this.calculateBasicFeatures();
            
            // Run advanced analysis modules
            this.runAdvancedAnalysis();
            
            // Record analysis time
            this.analysisTime = performance.now() - startTime;
            performanceMonitor.recordCPUTime('audioProcessing', this.analysisTime);
            
            // Notify listeners
            this.notifyUpdate();
            
        } catch (error) {
            console.error('Audio analysis error:', error);
            this.notifyError('analysis', error);
        }
    }
    
    /**
     * Analyze frequency bands (bass, mid, treble)
     */
    analyzeFrequencyBands() {
        const nyquist = this.audioContext.sampleRate / 2;
        const binCount = this.audioData.frequencyData.length;
        
        // Calculate frequency per bin
        const freqPerBin = nyquist / binCount;
        
        // Find bin ranges for each frequency band
        const bassStart = Math.floor(this.config.bassRange[0] / freqPerBin);
        const bassEnd = Math.floor(this.config.bassRange[1] / freqPerBin);
        const midStart = bassEnd;
        const midEnd = Math.floor(this.config.midRange[1] / freqPerBin);
        const trebleStart = midEnd;
        const trebleEnd = Math.floor(this.config.trebleRange[1] / freqPerBin);
        
        // Calculate average amplitude for each band
        this.audioData.bassLevel = this.calculateBandAverage(bassStart, bassEnd);
        this.audioData.midLevel = this.calculateBandAverage(midStart, midEnd);
        this.audioData.trebleLevel = this.calculateBandAverage(trebleStart, trebleEnd);
    }
    
    /**
     * Calculate average amplitude for a frequency band
     * @param {number} startBin - Start bin index
     * @param {number} endBin - End bin index
     * @returns {number} Average amplitude
     */
    calculateBandAverage(startBin, endBin) {
        let sum = 0;
        let count = 0;
        
        for (let i = startBin; i < Math.min(endBin, this.audioData.frequencyData.length); i++) {
            sum += this.audioData.frequencyData[i];
            count++;
        }
        
        return count > 0 ? sum / count : 0;
    }
    
    /**
     * Calculate basic audio features
     */
    calculateBasicFeatures() {
        // RMS (Root Mean Square) - overall energy
        this.audioData.rms = MathUtils.rms(this.audioData.timeData);
        this.audioData.energy = this.audioData.rms * this.audioData.rms;
        
        // Zero Crossing Rate
        this.audioData.zcr = this.calculateZeroCrossingRate(this.audioData.timeData);
        
        // Spectral Centroid (brightness)
        this.audioData.spectralCentroid = this.calculateSpectralCentroid();
        
        // Spectral Rolloff
        this.audioData.spectralRolloff = this.calculateSpectralRolloff();
    }
    
    /**
     * Calculate zero crossing rate
     * @param {Float32Array} timeData - Time domain data
     * @returns {number} Zero crossing rate
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
     * Calculate spectral centroid
     * @returns {number} Spectral centroid (normalized)
     */
    calculateSpectralCentroid() {
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < this.audioData.frequencyData.length; i++) {
            const magnitude = this.audioData.frequencyData[i];
            weightedSum += i * magnitude;
            magnitudeSum += magnitude;
        }
        
        return magnitudeSum > 0 ? (weightedSum / magnitudeSum) / this.audioData.frequencyData.length : 0;
    }
    
    /**
     * Calculate spectral rolloff
     * @returns {number} Spectral rolloff (normalized)
     */
    calculateSpectralRolloff() {
        const totalEnergy = this.audioData.frequencyData.reduce((sum, val) => sum + val, 0);
        const threshold = totalEnergy * 0.85; // 85% of total energy
        
        let cumulativeEnergy = 0;
        
        for (let i = 0; i < this.audioData.frequencyData.length; i++) {
            cumulativeEnergy += this.audioData.frequencyData[i];
            
            if (cumulativeEnergy >= threshold) {
                return i / this.audioData.frequencyData.length;
            }
        }
        
        return 1.0;
    }
    
    /**
     * Run advanced analysis modules
     */
    runAdvancedAnalysis() {
        // Beat detection
        if (this.analysisModules.beat) {
            const beatData = this.analysisModules.beat.analyze(this.audioData);
            this.audioData.beat = beatData.beat;
            this.audioData.beatStrength = beatData.strength;
            this.audioData.bpm = beatData.bpm;
            this.audioData.onset = beatData.onset;
        }
        
        // Advanced spectral analysis
        if (this.analysisModules.spectral) {
            const spectralData = this.analysisModules.spectral.analyze(this.audioData);
            this.audioData.spectralFlux = spectralData.flux;
            this.audioData.harmonics = spectralData.harmonics;
            this.audioData.pitch = spectralData.pitch;
        }
        
        // Feature extraction (MFCC, chroma, etc.)
        if (this.analysisModules.features) {
            const featureData = this.analysisModules.features.analyze(this.audioData);
            this.audioData.mfcc = featureData.mfcc;
            this.audioData.chroma = featureData.chroma;
            this.audioData.melSpectrogram = featureData.melSpectrogram;
        }
    }
    
    /**
     * Stop audio playback
     */
    stop() {
        if (this.nodes.source) {
            try {
                this.nodes.source.stop();
                this.nodes.source.disconnect();
            } catch (error) {
                // Source might already be stopped
            }
            this.nodes.source = null;
        }
        
        this.isPlaying = false;
        this.isPaused = false;
    }
    
    /**
     * Pause audio playback
     */
    pause() {
        if (this.isPlaying && !this.isPaused) {
            // Web Audio API doesn't support pause/resume for BufferSource
            // This would need to be implemented with currentTime tracking
            this.isPaused = true;
            console.log('Audio paused (basic implementation)');
        }
    }
    
    /**
     * Resume audio playback
     */
    resume() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        if (this.isPaused) {
            this.isPaused = false;
            console.log('Audio resumed');
        }
    }
    
    /**
     * Set volume
     * @param {number} volume - Volume level (0-1)
     */
    setVolume(volume) {
        this.volume = MathUtils.clamp(volume, 0, 1);
        if (this.nodes.gainNode) {
            this.nodes.gainNode.gain.linearRampToValueAtTime(
                this.volume,
                this.audioContext.currentTime + 0.1
            );
        }
    }
    
    /**
     * Mute/unmute audio
     * @param {boolean} muted - Mute state
     */
    setMuted(muted) {
        if (muted && !this.muted) {
            this.previousVolume = this.volume;
            this.setVolume(0);
        } else if (!muted && this.muted) {
            this.setVolume(this.previousVolume);
        }
        
        this.muted = muted;
    }
    
    /**
     * Get current audio data
     * @returns {Object} Current audio analysis data
     */
    getAudioData() {
        return { ...this.audioData };
    }
    
    /**
     * Get audio configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        
        // Update analyzer node if FFT size changed
        if (newConfig.fftSize && this.nodes.analyzer) {
            this.nodes.analyzer.fftSize = newConfig.fftSize;
            
            // Recreate data arrays with new size
            this.audioData.timeData = new Float32Array(newConfig.fftSize);
            this.audioData.frequencyData = new Float32Array(newConfig.fftSize / 2);
            this.audioData.frequencyDataDb = new Float32Array(newConfig.fftSize / 2);
        }
        
        // Update smoothing
        if (newConfig.smoothingTimeConstant && this.nodes.analyzer) {
            this.nodes.analyzer.smoothingTimeConstant = newConfig.smoothingTimeConstant;
        }
        
        console.log('Audio configuration updated');
    }
    
    /**
     * Add update callback
     * @param {Function} callback - Callback function
     */
    onUpdate(callback) {
        this.updateCallbacks.add(callback);
    }
    
    /**
     * Remove update callback
     * @param {Function} callback - Callback function
     */
    offUpdate(callback) {
        this.updateCallbacks.delete(callback);
    }
    
    /**
     * Add error callback
     * @param {Function} callback - Error callback function
     */
    onError(callback) {
        this.errorCallbacks.add(callback);
    }
    
    /**
     * Remove error callback
     * @param {Function} callback - Error callback function
     */
    offError(callback) {
        this.errorCallbacks.delete(callback);
    }
    
    /**
     * Notify update listeners
     */
    notifyUpdate() {
        this.updateCallbacks.forEach(callback => {
            try {
                callback(this.audioData);
            } catch (error) {
                console.error('Update callback error:', error);
            }
        });
    }
    
    /**
     * Notify error listeners
     * @param {string} type - Error type
     * @param {Error} error - Error object
     */
    notifyError(type, error) {
        this.errorCallbacks.forEach(callback => {
            try {
                callback(type, error);
            } catch (callbackError) {
                console.error('Error callback error:', callbackError);
            }
        });
    }
    
    /**
     * Get playback state
     * @returns {Object} Playback state
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            volume: this.volume,
            muted: this.muted,
            microphoneEnabled: this.microphoneSettings.enabled,
            currentFile: this.currentFile,
            analysisTime: this.analysisTime
        };
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        // Stop analysis loop
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Stop playback
        this.stop();
        
        // Disable microphone
        this.disableMicrophone();
        
        // Dispose analysis modules
        Object.values(this.analysisModules).forEach(module => {
            if (module && module.dispose) {
                module.dispose();
            }
        });
        
        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Clear callbacks
        this.updateCallbacks.clear();
        this.errorCallbacks.clear();
        
        // Clear data
        this.loadedFiles.clear();
        this.audioBuffer = null;
        this.currentFile = null;
        
        this.isInitialized = false;
        
        console.log('AudioEngine disposed');
    }
}

// Export singleton instance
export const audioEngine = new AudioEngine();