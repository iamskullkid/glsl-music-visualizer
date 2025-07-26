/**
 * Advanced Beat Detector
 * Sophisticated beat tracking, onset detection, and tempo analysis
 * Location: src/audio/BeatDetector.js
 * 
 * Provides real-time beat detection using multiple algorithms including
 * spectral flux analysis, complex domain onset detection, and adaptive tempo tracking
 */

import { MathUtils } from '../utils/MathUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class BeatDetector {
    constructor(config = {}) {
        this.isInitialized = false;
        this.audioContext = null;
        
        // Configuration with advanced settings
        this.config = {
            sampleRate: 44100,
            fftSize: 4096,
            hopSize: 1024,
            
            // Beat detection parameters
            beatSensitivity: 0.5,        // Overall sensitivity (0-1)
            beatThreshold: 0.15,         // Minimum threshold for beat detection
            adaptiveThreshold: true,     // Use adaptive threshold
            thresholdDecay: 0.95,        // Adaptive threshold decay rate
            
            // Tempo tracking
            bpmRange: [60, 180],         // Valid BPM range
            tempoSmoothing: 0.8,         // Temporal BPM smoothing
            tempoConfidenceThreshold: 0.3, // Minimum confidence for tempo lock
            
            // Onset detection
            onsetSensitivity: 0.3,       // Onset detection sensitivity
            onsetMinInterval: 50,        // Minimum ms between onsets
            spectralFluxThreshold: 0.01, // Spectral flux minimum
            
            // Advanced features
            enableComplexDomain: true,   // Complex domain onset detection
            enableRhythmTracking: true,  // Track rhythmic patterns
            enableAccentDetection: true, // Detect strong/weak beats
            enableSubdivisions: true,    // Track beat subdivisions
            
            // Frequency band analysis
            frequencyBands: [
                { name: 'sub-bass', min: 20, max: 60 },
                { name: 'bass', min: 60, max: 250 },
                { name: 'low-mid', min: 250, max: 500 },
                { name: 'mid', min: 500, max: 2000 },
                { name: 'high-mid', min: 2000, max: 4000 },
                { name: 'presence', min: 4000, max: 8000 },
                { name: 'brilliance', min: 8000, max: 20000 }
            ],
            
            // Algorithm weights
            algorithmWeights: {
                spectralFlux: 0.4,
                complexDomain: 0.3,
                energyBased: 0.2,
                phaseVocoder: 0.1
            },
            
            ...config
        };
        
        // Beat detection state
        this.beatState = {
            currentBPM: 120,
            confidence: 0,
            lastBeatTime: 0,
            beatPeriod: 0.5,            // Seconds between beats
            phase: 0,                   // Current phase in beat cycle (0-1)
            strength: 0,                // Current beat strength
            isOnBeat: false,
            timeToNextBeat: 0
        };
        
        // Onset detection state
        this.onsetState = {
            strength: 0,
            isOnset: false,
            lastOnsetTime: 0,
            onsetHistory: [],
            spectralFlux: 0,
            phaseDeviation: 0
        };
        
        // Advanced rhythm tracking
        this.rhythmTracker = {
            pattern: new Array(16).fill(0), // 16-step pattern
            currentStep: 0,
            patternConfidence: 0,
            accentPattern: new Array(4).fill(0), // Strong beat pattern
            subdivision: 4,             // Current subdivision (4/4, 3/4, etc.)
            meter: { numerator: 4, denominator: 4 }
        };
        
        // Analysis buffers
        this.buffers = {
            // Spectral analysis
            magnitudeHistory: null,
            phaseHistory: null,
            spectralFluxHistory: null,
            
            // Energy analysis
            energyHistory: null,
            instantaneousEnergy: null,
            localEnergyAverage: null,
            
            // Complex domain analysis
            complexSpectrum: null,
            unwrappedPhase: null,
            instantaneousFreq: null,
            
            // Band-specific analysis
            bandEnergies: null,
            bandFlux: null,
            bandOnsets: null,
            
            // Tempo tracking
            beatIntervalHistory: null,
            tempoHypotheses: null,
            autocorrelation: null
        };
        
        // Algorithm implementations
        this.algorithms = {
            spectralFlux: new SpectralFluxDetector(this.config),
            complexDomain: new ComplexDomainDetector(this.config),
            energyBased: new EnergyBasedDetector(this.config),
            phaseVocoder: new PhaseVocoderDetector(this.config)
        };
        
        // Tempo estimation
        this.tempoEstimator = new TempoEstimator(this.config);
        
        // Performance metrics
        this.performanceMetrics = {
            analysisTime: 0,
            beatAccuracy: 0,
            onsetPrecision: 0,
            tempoStability: 0,
            cacheHitRate: 0
        };
        
        // Calibration data
        this.calibration = {
            adaptiveThreshold: 0.15,
            energyThreshold: 0.1,
            spectralThreshold: 0.01,
            learningRate: 0.01
        };
        
        // Event system
        this.eventCallbacks = new Map();
        
        // Debug and visualization data
        this.debugData = {
            enabled: process.env.NODE_ENV === 'development',
            spectralFluxCurve: new Array(512).fill(0),
            energyCurve: new Array(512).fill(0),
            onsetFunction: new Array(512).fill(0),
            tempoFunction: new Array(120).fill(0) // BPM range visualization
        };
    }
    
    /**
     * Initialize beat detector with audio context
     * @param {AudioContext} audioContext - Web Audio context
     */
    async initialize(audioContext) {
        try {
            this.audioContext = audioContext;
            this.config.sampleRate = audioContext.sampleRate;
            
            // Initialize analysis buffers
            this.initializeBuffers();
            
            // Initialize detection algorithms
            await this.initializeAlgorithms();
            
            // Setup tempo estimator
            this.tempoEstimator.initialize();
            
            // Calculate frequency band bin mappings
            this.calculateBandMappings();
            
            this.isInitialized = true;
            
            console.log('BeatDetector initialized', {
                sampleRate: this.config.sampleRate,
                fftSize: this.config.fftSize,
                algorithms: Object.keys(this.algorithms).length,
                frequencyBands: this.config.frequencyBands.length
            });
            
        } catch (error) {
            console.error('Failed to initialize BeatDetector:', error);
            throw error;
        }
    }
    
    /**
     * Initialize analysis buffers for beat detection
     */
    initializeBuffers() {
        const historyLength = 256;
        const fftBins = this.config.fftSize / 2;
        const bandCount = this.config.frequencyBands.length;
        
        // Spectral analysis buffers
        this.buffers.magnitudeHistory = new Array(historyLength);
        this.buffers.phaseHistory = new Array(historyLength);
        this.buffers.spectralFluxHistory = new Float32Array(historyLength);
        
        for (let i = 0; i < historyLength; i++) {
            this.buffers.magnitudeHistory[i] = new Float32Array(fftBins);
            this.buffers.phaseHistory[i] = new Float32Array(fftBins);
        }
        
        // Energy analysis buffers
        this.buffers.energyHistory = new Float32Array(historyLength);
        this.buffers.instantaneousEnergy = 0;
        this.buffers.localEnergyAverage = 0;
        
        // Complex domain buffers
        this.buffers.complexSpectrum = new Array(fftBins);
        this.buffers.unwrappedPhase = new Float32Array(fftBins);
        this.buffers.instantaneousFreq = new Float32Array(fftBins);
        
        for (let i = 0; i < fftBins; i++) {
            this.buffers.complexSpectrum[i] = { real: 0, imag: 0, magnitude: 0, phase: 0 };
        }
        
        // Band-specific analysis
        this.buffers.bandEnergies = new Float32Array(bandCount);
        this.buffers.bandFlux = new Float32Array(bandCount);
        this.buffers.bandOnsets = new Array(bandCount).fill(false);
        
        // Tempo tracking buffers
        this.buffers.beatIntervalHistory = new Float32Array(64);
        this.buffers.tempoHypotheses = new Array(121); // 60-180 BPM
        this.buffers.autocorrelation = new Float32Array(512);
        
        for (let i = 0; i < this.buffers.tempoHypotheses.length; i++) {
            this.buffers.tempoHypotheses[i] = { bpm: 60 + i, confidence: 0, strength: 0 };
        }
        
        console.log('Beat detection buffers initialized');
    }
    
    /**
     * Initialize detection algorithms
     */
    async initializeAlgorithms() {
        await Promise.all([
            this.algorithms.spectralFlux.initialize(),
            this.algorithms.complexDomain.initialize(),
            this.algorithms.energyBased.initialize(),
            this.algorithms.phaseVocoder.initialize()
        ]);
        
        console.log('Beat detection algorithms initialized');
    }
    
    /**
     * Calculate frequency band to FFT bin mappings
     */
    calculateBandMappings() {
        const nyquist = this.config.sampleRate / 2;
        const fftBins = this.config.fftSize / 2;
        
        this.bandMappings = this.config.frequencyBands.map(band => {
            const startBin = Math.floor((band.min * fftBins) / nyquist);
            const endBin = Math.floor((band.max * fftBins) / nyquist);
            
            return {
                name: band.name,
                startBin: Math.max(0, startBin),
                endBin: Math.min(fftBins - 1, endBin),
                binCount: endBin - startBin + 1
            };
        });
        
        console.log('Frequency band mappings calculated:', this.bandMappings);
    }
    
    /**
     * Main beat detection analysis function
     * @param {Object} audioData - Enhanced audio data from FFTProcessor
     * @returns {Object} Beat detection results
     */
    analyze(audioData) {
        if (!this.isInitialized) {
            console.warn('BeatDetector not initialized');
            return audioData;
        }
        
        const startTime = performance.now();
        
        try {
            // Extract spectral data
            const spectralData = this.extractSpectralData(audioData);
            
            // Update analysis buffers
            this.updateBuffers(spectralData);
            
            // Run multiple detection algorithms
            const algorithmResults = this.runDetectionAlgorithms(spectralData);
            
            // Combine algorithm results
            const combinedResults = this.combineAlgorithmResults(algorithmResults);
            
            // Update beat tracking state
            this.updateBeatState(combinedResults);
            
            // Update tempo estimation
            this.updateTempoEstimation();
            
            // Detect onsets
            this.detectOnsets(spectralData);
            
            // Track rhythm patterns
            if (this.config.enableRhythmTracking) {
                this.updateRhythmTracking();
            }
            
            // Update performance metrics
            const processingTime = performance.now() - startTime;
            this.updatePerformanceMetrics(processingTime);
            
            // Create enhanced output
            const enhancedOutput = this.createEnhancedOutput(audioData);
            
            return enhancedOutput;
            
        } catch (error) {
            console.error('Beat detection analysis error:', error);
            return audioData;
        }
    }
    
    /**
     * Extract spectral data from audio input
     */
    extractSpectralData(audioData) {
        const fft = audioData.fft;
        if (!fft || !fft.magnitude) {
            return null;
        }
        
        return {
            magnitude: fft.magnitude,
            phase: fft.phase || new Float32Array(fft.magnitude.length),
            powerSpectrum: fft.powerSpectrum,
            frequencies: fft.frequencies,
            timestamp: performance.now()
        };
    }
    
    /**
     * Update analysis buffers with new spectral data
     */
    updateBuffers(spectralData) {
        if (!spectralData) return;
        
        // Shift history buffers
        for (let i = this.buffers.magnitudeHistory.length - 1; i > 0; i--) {
            this.buffers.magnitudeHistory[i].set(this.buffers.magnitudeHistory[i - 1]);
            this.buffers.phaseHistory[i].set(this.buffers.phaseHistory[i - 1]);
        }
        
        // Add new data
        this.buffers.magnitudeHistory[0].set(spectralData.magnitude);
        this.buffers.phaseHistory[0].set(spectralData.phase);
        
        // Calculate current energy
        this.buffers.instantaneousEnergy = this.calculateInstantaneousEnergy(spectralData.magnitude);
        
        // Shift energy history
        for (let i = this.buffers.energyHistory.length - 1; i > 0; i--) {
            this.buffers.energyHistory[i] = this.buffers.energyHistory[i - 1];
        }
        this.buffers.energyHistory[0] = this.buffers.instantaneousEnergy;
        
        // Update local energy average
        this.updateLocalEnergyAverage();
        
        // Update complex spectrum representation
        this.updateComplexSpectrum(spectralData);
        
        // Calculate band energies
        this.calculateBandEnergies(spectralData.magnitude);
    }
    
    /**
     * Calculate instantaneous energy from magnitude spectrum
     */
    calculateInstantaneousEnergy(magnitude) {
        let energy = 0;
        for (let i = 0; i < magnitude.length; i++) {
            energy += magnitude[i] * magnitude[i];
        }
        return energy / magnitude.length;
    }
    
    /**
     * Update local energy average for adaptive thresholding
     */
    updateLocalEnergyAverage() {
        const windowSize = 43; // Approximately 1 second at ~43fps
        let sum = 0;
        let count = 0;
        
        for (let i = 0; i < Math.min(windowSize, this.buffers.energyHistory.length); i++) {
            if (this.buffers.energyHistory[i] > 0) {
                sum += this.buffers.energyHistory[i];
                count++;
            }
        }
        
        this.buffers.localEnergyAverage = count > 0 ? sum / count : 0;
    }
    
    /**
     * Update complex spectrum representation for advanced analysis
     */
    updateComplexSpectrum(spectralData) {
        for (let i = 0; i < spectralData.magnitude.length; i++) {
            const magnitude = spectralData.magnitude[i];
            const phase = spectralData.phase[i];
            
            this.buffers.complexSpectrum[i] = {
                real: magnitude * Math.cos(phase),
                imag: magnitude * Math.sin(phase),
                magnitude: magnitude,
                phase: phase
            };
        }
        
        // Calculate instantaneous frequency
        this.calculateInstantaneousFrequency();
    }
    
    /**
     * Calculate instantaneous frequency using phase derivatives
     */
    calculateInstantaneousFrequency() {
        if (this.buffers.phaseHistory.length < 2) return;
        
        const current = this.buffers.phaseHistory[0];
        const previous = this.buffers.phaseHistory[1];
        const hopTime = this.config.hopSize / this.config.sampleRate;
        
        for (let i = 0; i < current.length; i++) {
            let phaseDiff = current[i] - previous[i];
            
            // Unwrap phase
            while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
            while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
            
            this.buffers.instantaneousFreq[i] = phaseDiff / (2 * Math.PI * hopTime);
        }
    }
    
    /**
     * Calculate energy in different frequency bands
     */
    calculateBandEnergies(magnitude) {
        this.bandMappings.forEach((band, index) => {
            let energy = 0;
            for (let i = band.startBin; i <= band.endBin; i++) {
                energy += magnitude[i] * magnitude[i];
            }
            this.buffers.bandEnergies[index] = energy / band.binCount;
        });
    }
    
    /**
     * Run all detection algorithms and collect results
     */
    runDetectionAlgorithms(spectralData) {
        const results = {};
        
        // Spectral flux analysis
        results.spectralFlux = this.algorithms.spectralFlux.analyze({
            current: this.buffers.magnitudeHistory[0],
            previous: this.buffers.magnitudeHistory[1] || new Float32Array(spectralData.magnitude.length)
        });
        
        // Complex domain analysis
        if (this.config.enableComplexDomain) {
            results.complexDomain = this.algorithms.complexDomain.analyze({
                complexSpectrum: this.buffers.complexSpectrum,
                instantaneousFreq: this.buffers.instantaneousFreq
            });
        }
        
        // Energy-based detection
        results.energyBased = this.algorithms.energyBased.analyze({
            currentEnergy: this.buffers.instantaneousEnergy,
            localAverage: this.buffers.localEnergyAverage,
            energyHistory: this.buffers.energyHistory
        });
        
        // Phase vocoder analysis
        results.phaseVocoder = this.algorithms.phaseVocoder.analyze({
            phase: this.buffers.phaseHistory[0],
            previousPhase: this.buffers.phaseHistory[1] || new Float32Array(spectralData.magnitude.length),
            magnitude: spectralData.magnitude
        });
        
        return results;
    }
    
    /**
     * Combine results from multiple algorithms
     */
    combineAlgorithmResults(results) {
        const weights = this.config.algorithmWeights;
        let combinedOnsetStrength = 0;
        let combinedConfidence = 0;
        let weightSum = 0;
        
        // Weighted combination of onset strengths
        Object.keys(results).forEach(algorithm => {
            if (weights[algorithm] && results[algorithm]) {
                const weight = weights[algorithm];
                combinedOnsetStrength += results[algorithm].onsetStrength * weight;
                combinedConfidence += results[algorithm].confidence * weight;
                weightSum += weight;
            }
        });
        
        if (weightSum > 0) {
            combinedOnsetStrength /= weightSum;
            combinedConfidence /= weightSum;
        }
        
        // Apply adaptive threshold
        const threshold = this.config.adaptiveThreshold ? 
            this.calibration.adaptiveThreshold : 
            this.config.beatThreshold;
        
        const isBeat = combinedOnsetStrength > threshold;
        
        return {
            onsetStrength: combinedOnsetStrength,
            confidence: combinedConfidence,
            isBeat: isBeat,
            threshold: threshold,
            algorithmResults: results
        };
    }
    
    /**
     * Update beat tracking state
     */
    updateBeatState(detectionResults) {
        const currentTime = performance.now() / 1000; // Convert to seconds
        
        if (detectionResults.isBeat) {
            // Check if enough time has passed since last beat
            const timeSinceLastBeat = currentTime - this.beatState.lastBeatTime;
            const minBeatInterval = 60 / this.config.bpmRange[1]; // Minimum interval based on max BPM
            
            if (timeSinceLastBeat > minBeatInterval) {
                // Update beat interval history
                this.addBeatInterval(timeSinceLastBeat);
                
                // Update beat state
                this.beatState.lastBeatTime = currentTime;
                this.beatState.strength = detectionResults.onsetStrength;
                this.beatState.isOnBeat = true;
                
                // Trigger beat event
                this.emit('beat', {
                    strength: this.beatState.strength,
                    confidence: detectionResults.confidence,
                    timestamp: currentTime,
                    bpm: this.beatState.currentBPM
                });
            }
        } else {
            this.beatState.isOnBeat = false;
        }
        
        // Update beat phase
        this.updateBeatPhase(currentTime);
        
        // Update adaptive threshold
        if (this.config.adaptiveThreshold) {
            this.updateAdaptiveThreshold(detectionResults.onsetStrength);
        }
    }
    
    /**
     * Add beat interval to history for tempo estimation
     */
    addBeatInterval(interval) {
        // Shift interval history
        for (let i = this.buffers.beatIntervalHistory.length - 1; i > 0; i--) {
            this.buffers.beatIntervalHistory[i] = this.buffers.beatIntervalHistory[i - 1];
        }
        
        this.buffers.beatIntervalHistory[0] = interval;
    }
    
    /**
     * Update beat phase (position within beat cycle)
     */
    updateBeatPhase(currentTime) {
        if (this.beatState.beatPeriod > 0) {
            const timeSinceLastBeat = currentTime - this.beatState.lastBeatTime;
            this.beatState.phase = (timeSinceLastBeat / this.beatState.beatPeriod) % 1.0;
            this.beatState.timeToNextBeat = this.beatState.beatPeriod - (timeSinceLastBeat % this.beatState.beatPeriod);
        }
    }
    
    /**
     * Update adaptive threshold based on recent onset strengths
     */
    updateAdaptiveThreshold(currentOnsetStrength) {
        const learningRate = this.calibration.learningRate;
        const decay = this.config.thresholdDecay;
        
        // Decay current threshold
        this.calibration.adaptiveThreshold *= decay;
        
        // Adapt based on current strength
        if (currentOnsetStrength > this.calibration.adaptiveThreshold) {
            this.calibration.adaptiveThreshold = MathUtils.lerp(
                this.calibration.adaptiveThreshold,
                currentOnsetStrength * 0.7, // Set threshold below peak
                learningRate
            );
        }
        
        // Ensure minimum threshold
        this.calibration.adaptiveThreshold = Math.max(
            this.calibration.adaptiveThreshold,
            this.config.beatThreshold * 0.5
        );
    }
    
    /**
     * Update tempo estimation
     */
    updateTempoEstimation() {
        const tempoResult = this.tempoEstimator.analyze(this.buffers.beatIntervalHistory);
        
        if (tempoResult.confidence > this.config.tempoConfidenceThreshold) {
            // Apply temporal smoothing
            const smoothing = this.config.tempoSmoothing;
            this.beatState.currentBPM = MathUtils.lerp(
                this.beatState.currentBPM,
                tempoResult.bpm,
                1 - smoothing
            );
            
            this.beatState.beatPeriod = 60 / this.beatState.currentBPM;
            this.beatState.confidence = tempoResult.confidence;
        }
        
        // Update tempo hypotheses for visualization
        this.updateTempoHypotheses(tempoResult);
    }
    
    /**
     * Update tempo hypotheses for analysis
     */
    updateTempoHypotheses(tempoResult) {
        this.buffers.tempoHypotheses.forEach((hypothesis, index) => {
            const bpm = 60 + index;
            
            // Calculate confidence for this BPM
            let confidence = 0;
            let strength = 0;
            
            if (tempoResult.hypotheses && tempoResult.hypotheses[bpm]) {
                confidence = tempoResult.hypotheses[bpm].confidence;
                strength = tempoResult.hypotheses[bpm].strength;
            }
            
            // Apply smoothing
            hypothesis.confidence = MathUtils.lerp(hypothesis.confidence, confidence, 0.1);
            hypothesis.strength = MathUtils.lerp(hypothesis.strength, strength, 0.1);
        });
    }
    
    /**
     * Detect onsets using spectral flux and energy changes
     */
    detectOnsets(spectralData) {
        if (!spectralData || this.buffers.magnitudeHistory.length < 2) {
            return;
        }
        
        // Calculate spectral flux
        const spectralFlux = this.calculateSpectralFlux(
            this.buffers.magnitudeHistory[0],
            this.buffers.magnitudeHistory[1]
        );
        
        // Store in history
        for (let i = this.buffers.spectralFluxHistory.length - 1; i > 0; i--) {
            this.buffers.spectralFluxHistory[i] = this.buffers.spectralFluxHistory[i - 1];
        }
        this.buffers.spectralFluxHistory[0] = spectralFlux;
        
        // Detect onset peaks
        const isOnset = this.detectOnsetPeak(spectralFlux);
        
        const currentTime = performance.now();
        
        if (isOnset) {
            // Check minimum interval between onsets
            if (currentTime - this.onsetState.lastOnsetTime > this.config.onsetMinInterval) {
                this.onsetState.isOnset = true;
                this.onsetState.lastOnsetTime = currentTime;
                this.onsetState.strength = spectralFlux;
                
                // Add to onset history
                this.onsetState.onsetHistory.push({
                    timestamp: currentTime,
                    strength: spectralFlux
                });
                
                // Limit history size
                if (this.onsetState.onsetHistory.length > 100) {
                    this.onsetState.onsetHistory.shift();
                }
                
                // Trigger onset event
                this.emit('onset', {
                    strength: spectralFlux,
                    timestamp: currentTime
                });
            }
        } else {
            this.onsetState.isOnset = false;
        }
        
        this.onsetState.spectralFlux = spectralFlux;
    }
    
    /**
     * Calculate spectral flux between two magnitude spectra
     */
    calculateSpectralFlux(current, previous) {
        let flux = 0;
        for (let i = 0; i < current.length; i++) {
            const diff = current[i] - previous[i];
            flux += Math.max(0, diff); // Only positive changes
        }
        return flux / current.length;
    }
    
    /**
     * Detect onset peaks using adaptive peak picking
     */
    detectOnsetPeak(currentFlux) {
        const historyLength = Math.min(10, this.buffers.spectralFluxHistory.length);
        if (historyLength < 3) return false;
        
        // Calculate local average and standard deviation
        let sum = 0;
        let count = 0;
        for (let i = 1; i < historyLength; i++) { // Skip current value
            sum += this.buffers.spectralFluxHistory[i];
            count++;
        }
        
        if (count === 0) return false;
        
        const localAverage = sum / count;
        
        // Calculate standard deviation
        let variance = 0;
        for (let i = 1; i < historyLength; i++) {
            const diff = this.buffers.spectralFluxHistory[i] - localAverage;
            variance += diff * diff;
        }
        const stdDev = Math.sqrt(variance / count);
        
        // Adaptive threshold
        const threshold = localAverage + stdDev * this.config.onsetSensitivity;
        
        // Check if current flux is a peak
        const isPeak = currentFlux > threshold && 
                      currentFlux > this.config.spectralFluxThreshold;
        
        return isPeak;
    }
    
    /**
     * Update rhythm pattern tracking
     */
    updateRhythmTracking() {
        if (!this.beatState.isOnBeat) return;
        
        // Update current step in pattern
        this.rhythmTracker.currentStep = (this.rhythmTracker.currentStep + 1) % 16;
        
        // Record beat strength at current step
        this.rhythmTracker.pattern[this.rhythmTracker.currentStep] = this.beatState.strength;
        
        // Update accent pattern (strong beats)
        if (this.config.enableAccentDetection) {
            this.updateAccentPattern();
        }
        
        // Detect time signature
        this.detectTimeSignature();
    }
    
    /**
     * Update accent pattern for strong/weak beat detection
     */
    updateAccentPattern() {
        const currentBeat = Math.floor(this.rhythmTracker.currentStep / 4);
        const strength = this.beatState.strength;
        
        // Apply exponential smoothing to accent pattern
        const smoothing = 0.8;
        this.rhythmTracker.accentPattern[currentBeat] = MathUtils.lerp(
            this.rhythmTracker.accentPattern[currentBeat],
            strength,
            1 - smoothing
        );
    }
    
    /**
     * Detect time signature based on accent patterns
     */
    detectTimeSignature() {
        // Analyze accent pattern for time signature detection
        const accentStrengths = this.rhythmTracker.accentPattern;
        
        // Common time signatures to test
        const signatures = [
            { num: 4, den: 4, pattern: [1.0, 0.5, 0.7, 0.5] },  // Strong-weak-medium-weak
            { num: 3, den: 4, pattern: [1.0, 0.5, 0.5] },       // Strong-weak-weak
            { num: 2, den: 4, pattern: [1.0, 0.5] },            // Strong-weak
            { num: 6, den: 8, pattern: [1.0, 0.3, 0.3, 0.7, 0.3, 0.3] } // Compound duple
        ];
        
        let bestMatch = { signature: signatures[0], correlation: 0 };
        
        signatures.forEach(sig => {
            const correlation = this.calculatePatternCorrelation(accentStrengths, sig.pattern);
            if (correlation > bestMatch.correlation) {
                bestMatch = { signature: sig, correlation };
            }
        });
        
        // Update meter if confidence is high enough
        if (bestMatch.correlation > 0.7) {
            this.rhythmTracker.meter = {
                numerator: bestMatch.signature.num,
                denominator: bestMatch.signature.den
            };
        }
    }
    
    /**
     * Calculate correlation between accent pattern and expected signature
     */
    calculatePatternCorrelation(observed, expected) {
        // Normalize patterns
        const obsSum = observed.reduce((sum, val) => sum + val, 0);
        const expSum = expected.reduce((sum, val) => sum + val, 0);
        
        if (obsSum === 0 || expSum === 0) return 0;
        
        const obsNorm = observed.map(val => val / obsSum);
        const expNorm = expected.map(val => val / expSum);
        
        // Calculate Pearson correlation
        let correlation = 0;
        const minLength = Math.min(obsNorm.length, expNorm.length);
        
        for (let i = 0; i < minLength; i++) {
            correlation += obsNorm[i] * expNorm[i];
        }
        
        return correlation / minLength;
    }
    
    /**
     * Create enhanced output with beat detection results
     */
    createEnhancedOutput(audioData) {
        return {
            ...audioData,
            
            // AudioEngine expected fields
            beat: this.beatState.isOnBeat,
            beatStrength: this.beatState.strength,
            bpm: this.beatState.currentBPM,
            onset: this.onsetState.isOnset,
            
            // Enhanced beat detection data
            beatAnalysis: {
                // Beat tracking
                isOnBeat: this.beatState.isOnBeat,
                beatStrength: this.beatState.strength,
                beatPhase: this.beatState.phase,
                timeToNextBeat: this.beatState.timeToNextBeat,
                confidence: this.beatState.confidence,
                
                // Tempo analysis
                currentBPM: this.beatState.currentBPM,
                beatPeriod: this.beatState.beatPeriod,
                tempoHypotheses: this.buffers.tempoHypotheses.map(h => ({
                    bpm: h.bpm,
                    confidence: h.confidence,
                    strength: h.strength
                })),
                
                // Onset detection
                onsetStrength: this.onsetState.strength,
                isOnset: this.onsetState.isOnset,
                spectralFlux: this.onsetState.spectralFlux,
                onsetHistory: [...this.onsetState.onsetHistory].slice(-10), // Last 10 onsets
                
                // Rhythm tracking
                rhythmPattern: [...this.rhythmTracker.pattern],
                currentStep: this.rhythmTracker.currentStep,
                accentPattern: [...this.rhythmTracker.accentPattern],
                timeSignature: { ...this.rhythmTracker.meter },
                
                // Band-specific analysis
                bandEnergies: new Float32Array(this.buffers.bandEnergies),
                bandOnsets: [...this.buffers.bandOnsets],
                
                // Adaptive parameters
                adaptiveThreshold: this.calibration.adaptiveThreshold,
                energyThreshold: this.calibration.energyThreshold
            },
            
            // Debug and visualization data
            ...(this.debugData.enabled && {
                beatDebug: {
                    spectralFluxCurve: [...this.debugData.spectralFluxCurve],
                    energyCurve: [...this.debugData.energyCurve],
                    onsetFunction: [...this.debugData.onsetFunction],
                    tempoFunction: [...this.debugData.tempoFunction],
                    algorithmWeights: { ...this.config.algorithmWeights }
                }
            }),
            
            // Performance metrics
            beatProcessing: {
                analysisTime: this.performanceMetrics.analysisTime,
                beatAccuracy: this.performanceMetrics.beatAccuracy,
                onsetPrecision: this.performanceMetrics.onsetPrecision,
                tempoStability: this.performanceMetrics.tempoStability
            }
        };
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(processingTime) {
        this.performanceMetrics.analysisTime = MathUtils.exponentialSmoothing(
            this.performanceMetrics.analysisTime,
            processingTime,
            0.1
        );
        
        // Calculate beat accuracy (simplified metric)
        if (this.beatState.confidence > 0) {
            this.performanceMetrics.beatAccuracy = MathUtils.exponentialSmoothing(
                this.performanceMetrics.beatAccuracy,
                this.beatState.confidence,
                0.05
            );
        }
        
        // Report to global performance monitor
        performanceMonitor.recordCPUTime('audioProcessing', processingTime);
    }
    
    /**
     * Event system implementation
     */
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, new Set());
        }
        this.eventCallbacks.get(event).add(callback);
    }
    
    off(event, callback) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).delete(callback);
        }
    }
    
    emit(event, data) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in beat detector event listener for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Calibrate beat detector for optimal performance
     */
    async calibrate(audioSample, duration = 30) {
        console.log('Starting beat detector calibration...');
        
        const calibrationData = {
            beatIntervals: [],
            onsetStrengths: [],
            energyLevels: [],
            spectralFlux: []
        };
        
        // Reset calibration parameters
        this.calibration = {
            adaptiveThreshold: this.config.beatThreshold,
            energyThreshold: 0.1,
            spectralThreshold: 0.01,
            learningRate: 0.01
        };
        
        const startTime = performance.now();
        const endTime = startTime + (duration * 1000);
        
        // Collect calibration data
        while (performance.now() < endTime) {
            // This would be called with real audio data in practice
            // For now, we'll simulate the calibration process
            
            if (this.beatState.isOnBeat) {
                calibrationData.beatIntervals.push(
                    performance.now() - this.beatState.lastBeatTime
                );
            }
            
            calibrationData.onsetStrengths.push(this.onsetState.strength);
            calibrationData.energyLevels.push(this.buffers.instantaneousEnergy);
            calibrationData.spectralFlux.push(this.onsetState.spectralFlux);
            
            // Simulate analysis delay
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Analyze calibration data
        const analysis = this.analyzeCalibrationData(calibrationData);
        
        // Update calibration parameters
        this.applyCalibrationResults(analysis);
        
        console.log('Beat detector calibration completed', analysis);
        
        return {
            duration: duration,
            analysis: analysis,
            parameters: { ...this.calibration },
            recommendations: this.generateCalibrationRecommendations(analysis)
        };
    }
    
    /**
     * Analyze calibration data to optimize parameters
     */
    analyzeCalibrationData(data) {
        const analysis = {};
        
        // Analyze beat intervals for tempo stability
        if (data.beatIntervals.length > 0) {
            const intervals = data.beatIntervals;
            const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
            
            let variance = 0;
            intervals.forEach(interval => {
                variance += Math.pow(interval - avgInterval, 2);
            });
            variance /= intervals.length;
            
            analysis.tempoStability = 1 / (1 + Math.sqrt(variance));
            analysis.averageBPM = 60000 / avgInterval; // Convert ms to BPM
        }
        
        // Analyze onset strength distribution
        if (data.onsetStrengths.length > 0) {
            const strengths = data.onsetStrengths.filter(s => s > 0);
            strengths.sort((a, b) => a - b);
            
            analysis.onsetThreshold = strengths[Math.floor(strengths.length * 0.8)]; // 80th percentile
            analysis.onsetRange = {
                min: strengths[0],
                max: strengths[strengths.length - 1],
                median: strengths[Math.floor(strengths.length * 0.5)]
            };
        }
        
        // Analyze energy characteristics
        if (data.energyLevels.length > 0) {
            const energies = data.energyLevels.filter(e => e > 0);
            energies.sort((a, b) => a - b);
            
            analysis.energyThreshold = energies[Math.floor(energies.length * 0.7)]; // 70th percentile
            analysis.energyRange = {
                min: energies[0],
                max: energies[energies.length - 1],
                median: energies[Math.floor(energies.length * 0.5)]
            };
        }
        
        return analysis;
    }
    
    /**
     * Apply calibration results to detector parameters
     */
    applyCalibrationResults(analysis) {
        if (analysis.onsetThreshold) {
            this.calibration.adaptiveThreshold = Math.max(
                analysis.onsetThreshold * 0.6,
                this.config.beatThreshold * 0.5
            );
        }
        
        if (analysis.energyThreshold) {
            this.calibration.energyThreshold = analysis.energyThreshold * 0.5;
        }
        
        // Update algorithm weights based on performance
        if (analysis.tempoStability) {
            const stability = analysis.tempoStability;
            
            // Favor more stable algorithms
            if (stability > 0.8) {
                this.config.algorithmWeights.spectralFlux = 0.5;
                this.config.algorithmWeights.energyBased = 0.3;
            } else {
                this.config.algorithmWeights.complexDomain = 0.4;
                this.config.algorithmWeights.phaseVocoder = 0.2;
            }
        }
    }
    
    /**
     * Generate calibration recommendations
     */
    generateCalibrationRecommendations(analysis) {
        const recommendations = [];
        
        if (analysis.tempoStability && analysis.tempoStability < 0.6) {
            recommendations.push({
                type: 'warning',
                message: 'Low tempo stability detected',
                suggestion: 'Consider using higher beat sensitivity or smoother tempo tracking'
            });
        }
        
        if (analysis.onsetRange && analysis.onsetRange.max / analysis.onsetRange.min > 100) {
            recommendations.push({
                type: 'suggestion',
                message: 'Wide dynamic range in onset detection',
                suggestion: 'Enable adaptive thresholding for better performance'
            });
        }
        
        if (analysis.averageBPM && (analysis.averageBPM < 60 || analysis.averageBPM > 180)) {
            recommendations.push({
                type: 'info',
                message: `Detected BPM (${analysis.averageBPM.toFixed(1)}) outside typical range`,
                suggestion: 'Verify audio content or adjust BPM range settings'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Get comprehensive detector status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            config: { ...this.config },
            beatState: { ...this.beatState },
            onsetState: { ...this.onsetState },
            rhythmTracker: {
                pattern: [...this.rhythmTracker.pattern],
                currentStep: this.rhythmTracker.currentStep,
                meter: { ...this.rhythmTracker.meter }
            },
            calibration: { ...this.calibration },
            performance: { ...this.performanceMetrics },
            algorithms: Object.keys(this.algorithms).map(name => ({
                name,
                enabled: this.config.algorithmWeights[name] > 0,
                weight: this.config.algorithmWeights[name]
            }))
        };
    }
    
    /**
     * Update configuration at runtime
     */
    updateConfig(newConfig) {
        const needsReinit = 
            newConfig.fftSize !== this.config.fftSize ||
            newConfig.frequencyBands?.length !== this.config.frequencyBands?.length;
        
        Object.assign(this.config, newConfig);
        
        if (needsReinit && this.isInitialized) {
            console.log('Reinitializing BeatDetector due to config changes');
            this.initializeBuffers();
            this.calculateBandMappings();
        }
        
        // Update algorithm configurations
        Object.values(this.algorithms).forEach(algorithm => {
            if (algorithm.updateConfig) {
                algorithm.updateConfig(this.config);
            }
        });
    }
    
    /**
     * Export beat detection data for analysis
     */
    exportData() {
        return {
            version: '1.0.0',
            timestamp: Date.now(),
            config: { ...this.config },
            calibration: { ...this.calibration },
            beatHistory: {
                intervals: [...this.buffers.beatIntervalHistory],
                tempoHypotheses: this.buffers.tempoHypotheses.map(h => ({ ...h }))
            },
            rhythmPattern: {
                pattern: [...this.rhythmTracker.pattern],
                accentPattern: [...this.rhythmTracker.accentPattern],
                meter: { ...this.rhythmTracker.meter }
            },
            performance: { ...this.performanceMetrics }
        };
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        console.log('Disposing BeatDetector...');
        
        // Dispose algorithms
        Object.values(this.algorithms).forEach(algorithm => {
            if (algorithm.dispose) {
                algorithm.dispose();
            }
        });
        
        // Clear event listeners
        this.eventCallbacks.clear();
        
        // Clear buffers
        Object.keys(this.buffers).forEach(key => {
            this.buffers[key] = null;
        });
        
        // Reset state
        this.beatState = {};
        this.onsetState = {};
        this.rhythmTracker = {};
        
        this.isInitialized = false;
        this.audioContext = null;
        
        console.log('BeatDetector disposed');
    }
}

/**
 * Spectral Flux Detection Algorithm
 * Analyzes changes in spectral magnitude for onset detection
 */
class SpectralFluxDetector {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    analyze(data) {
        if (!data.current || !data.previous) {
            return { onsetStrength: 0, confidence: 0 };
        }
        
        let flux = 0;
        let totalMagnitude = 0;
        
        for (let i = 0; i < data.current.length; i++) {
            const diff = data.current[i] - data.previous[i];
            flux += Math.max(0, diff); // Only positive changes
            totalMagnitude += data.current[i];
        }
        
        const normalizedFlux = totalMagnitude > 0 ? flux / totalMagnitude : 0;
        const confidence = Math.min(1, normalizedFlux * 10);
        
        return {
            onsetStrength: normalizedFlux,
            confidence: confidence
        };
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

/**
 * Complex Domain Detection Algorithm
 * Uses phase and magnitude information for sophisticated onset detection
 */
class ComplexDomainDetector {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
        this.previousMagnitude = null;
        this.previousPhase = null;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    analyze(data) {
        if (!data.complexSpectrum || !data.instantaneousFreq) {
            return { onsetStrength: 0, confidence: 0 };
        }
        
        let complexFlux = 0;
        let phaseDeviation = 0;
        
        for (let i = 0; i < data.complexSpectrum.length; i++) {
            const current = data.complexSpectrum[i];
            
            if (this.previousMagnitude && this.previousPhase) {
                // Magnitude change
                const magDiff = Math.max(0, current.magnitude - this.previousMagnitude[i]);
                
                // Phase deviation
                let phaseDiff = current.phase - this.previousPhase[i];
                while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
                while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
                
                complexFlux += magDiff;
                phaseDeviation += Math.abs(phaseDiff);
            }
        }
        
        // Store for next frame
        this.previousMagnitude = data.complexSpectrum.map(c => c.magnitude);
        this.previousPhase = data.complexSpectrum.map(c => c.phase);
        
        const normalizedFlux = complexFlux / data.complexSpectrum.length;
        const normalizedPhase = phaseDeviation / data.complexSpectrum.length;
        
        const onsetStrength = (normalizedFlux + normalizedPhase * 0.5) / 1.5;
        const confidence = Math.min(1, onsetStrength * 5);
        
        return {
            onsetStrength: onsetStrength,
            confidence: confidence,
            phaseDeviation: normalizedPhase
        };
    }
    
    dispose() {
        this.previousMagnitude = null;
        this.previousPhase = null;
        this.isInitialized = false;
    }
}

/**
 * Energy-Based Detection Algorithm
 * Traditional energy-based onset detection with adaptive thresholding
 */
class EnergyBasedDetector {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    analyze(data) {
        const { currentEnergy, localAverage, energyHistory } = data;
        
        if (!currentEnergy || !localAverage) {
            return { onsetStrength: 0, confidence: 0 };
        }
        
        // Energy-based onset strength
        const energyRatio = localAverage > 0 ? currentEnergy / localAverage : 0;
        const onsetStrength = Math.max(0, energyRatio - 1.0);
        
        // Calculate confidence based on energy consistency
        let confidence = 0;
        if (energyHistory && energyHistory.length > 10) {
            const recentEnergies = Array.from(energyHistory).slice(0, 10);
            const variance = this.calculateVariance(recentEnergies);
            confidence = Math.min(1, onsetStrength / (1 + variance));
        }
        
        return {
            onsetStrength: onsetStrength,
            confidence: confidence,
            energyRatio: energyRatio
        };
    }
    
    calculateVariance(values) {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        
        return variance;
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

/**
 * Phase Vocoder Detection Algorithm
 * Uses phase information for precise onset timing
 */
class PhaseVocoderDetector {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    analyze(data) {
        const { phase, previousPhase, magnitude } = data;
        
        if (!phase || !previousPhase || !magnitude) {
            return { onsetStrength: 0, confidence: 0 };
        }
        
        let phaseDeviation = 0;
        let weightedDeviation = 0;
        let totalWeight = 0;
        
        for (let i = 1; i < phase.length; i++) {
            let phaseDiff = phase[i] - previousPhase[i];
            
            // Unwrap phase
            while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
            while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
            
            const weight = magnitude[i];
            phaseDeviation += Math.abs(phaseDiff);
            weightedDeviation += Math.abs(phaseDiff) * weight;
            totalWeight += weight;
        }
        
        const normalizedDeviation = totalWeight > 0 ? 
            weightedDeviation / totalWeight : 
            phaseDeviation / phase.length;
        
        const onsetStrength = Math.min(1, normalizedDeviation / Math.PI);
        const confidence = Math.min(1, onsetStrength * 2);
        
        return {
            onsetStrength: onsetStrength,
            confidence: confidence,
            phaseDeviation: normalizedDeviation
        };
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

/**
 * Tempo Estimator
 * Advanced tempo tracking using autocorrelation and multiple hypothesis tracking
 */
class TempoEstimator {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
        this.autocorrelationBuffer = new Float32Array(512);
    }
    
    initialize() {
        this.isInitialized = true;
    }
    
    analyze(beatIntervals) {
        if (!beatIntervals || beatIntervals.length < 4) {
            return { bpm: 120, confidence: 0, hypotheses: {} };
        }
        
        // Filter valid intervals
        const validIntervals = Array.from(beatIntervals)
            .filter(interval => interval > 0 && interval < 2.0); // 30-60 BPM range
        
        if (validIntervals.length < 3) {
            return { bpm: 120, confidence: 0, hypotheses: {} };
        }
        
        // Calculate autocorrelation
        this.calculateAutocorrelation(validIntervals);
        
        // Find tempo hypotheses
        const hypotheses = this.findTempoHypotheses();
        
        // Select best tempo
        const bestTempo = this.selectBestTempo(hypotheses);
        
        return {
            bpm: bestTempo.bpm,
            confidence: bestTempo.confidence,
            hypotheses: hypotheses
        };
    }
    
    calculateAutocorrelation(intervals) {
        const maxLag = Math.min(this.autocorrelationBuffer.length, intervals.length);
        
        for (let lag = 0; lag < maxLag; lag++) {
            let correlation = 0;
            let count = 0;
            
            for (let i = 0; i < intervals.length - lag; i++) {
                correlation += intervals[i] * intervals[i + lag];
                count++;
            }
            
            this.autocorrelationBuffer[lag] = count > 0 ? correlation / count : 0;
        }
    }
    
    findTempoHypotheses() {
        const hypotheses = {};
        const [minBPM, maxBPM] = this.config.bpmRange;
        
        // Convert BPM to intervals
        const maxInterval = 60 / minBPM;
        const minInterval = 60 / maxBPM;
        
        for (let bpm = minBPM; bpm <= maxBPM; bpm++) {
            const expectedInterval = 60 / bpm;
            const lag = Math.round(expectedInterval * 43); // Approximate frame rate
            
            if (lag < this.autocorrelationBuffer.length) {
                const strength = this.autocorrelationBuffer[lag];
                const confidence = Math.min(1, strength * 2);
                
                hypotheses[bpm] = {
                    bpm: bpm,
                    strength: strength,
                    confidence: confidence
                };
            }
        }
        
        return hypotheses;
    }
    
    selectBestTempo(hypotheses) {
        let bestTempo = { bpm: 120, confidence: 0 };
        
        Object.values(hypotheses).forEach(hypothesis => {
            if (hypothesis.confidence > bestTempo.confidence) {
                bestTempo = hypothesis;
            }
        });
        
        return bestTempo;
    }
    
    dispose() {
        this.autocorrelationBuffer = null;
        this.isInitialized = false;
    }
}