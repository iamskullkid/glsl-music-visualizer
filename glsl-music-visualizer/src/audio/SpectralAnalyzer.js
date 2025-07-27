/**
 * Advanced Spectral Analyzer
 * Sophisticated spectral feature extraction and perceptual audio analysis
 * Location: src/audio/SpectralAnalyzer.js
 * 
 * Builds upon FFTProcessor to provide advanced spectral features including
 * MFCCs, chromagram, harmonic analysis, and perceptual audio characteristics
 */

import { MathUtils } from '../utils/MathUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class SpectralAnalyzer {
    constructor(config = {}) {
        this.isInitialized = false;
        this.audioContext = null;
        
        // Configuration
        this.config = {
            sampleRate: 44100,
            fftSize: 4096,
            
            // Mel-frequency analysis
            melFilterBanks: 128,
            mfccCoefficients: 13,
            melMinFreq: 80,
            melMaxFreq: 8000,
            
            // Chromagram settings
            chromaBins: 12,
            chromaMinFreq: 65,      // C2
            chromaMaxFreq: 2093,    // C7
            chromaThreshold: 0.01,
            
            // Harmonic analysis
            harmonicCount: 8,
            pitchMinFreq: 50,
            pitchMaxFreq: 2000,
            pitchConfidenceThreshold: 0.3,
            
            // Spectral contrast
            contrastOctaves: 6,
            contrastAlpha: 0.02,
            
            // Perceptual modeling
            barkBands: 24,
            erbBands: 32,
            loudnessModel: 'zwicker',  // 'zwicker', 'moore', 'stevens'
            
            // Temporal modeling
            temporalWindow: 32,       // Frames for temporal analysis
            onsetSensitivity: 0.3,
            spectralMemory: 0.95,     // Exponential decay for spectral memory
            
            // Performance settings
            enableCaching: true,
            cacheSize: 64,
            parallelProcessing: false,
            
            ...config
        };
        
        // Mel filter bank matrix
        this.melFilterBank = null;
        this.melFrequencies = null;
        
        // Chromagram analysis
        this.chromaFilterBank = null;
        this.pitchClasses = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Harmonic analysis
        this.harmonicTemplates = null;
        this.pitchCandidates = null;
        
        // Spectral contrast filters
        this.contrastFilterBanks = null;
        
        // Perceptual model parameters
        this.barkFilterBank = null;
        this.erbFilterBank = null;
        this.loudnessWeights = null;
        
        // Analysis buffers
        this.buffers = {
            // Mel-frequency analysis
            melSpectrum: null,
            melSpectrogram: null,
            mfcc: null,
            deltaMfcc: null,
            deltaDeltaMfcc: null,
            
            // Chromagram
            chroma: null,
            chromaVector: null,
            chromaHistory: null,
            
            // Harmonic analysis
            harmonics: null,
            pitchSalience: null,
            harmonicStrength: null,
            
            // Spectral features
            spectralContrast: null,
            spectralCrest: null,
            spectralValley: null,
            
            // Perceptual features
            loudness: null,
            sharpness: null,
            roughness: null,
            fluctuationStrength: null,
            
            // Temporal features
            spectralHistory: null,
            onsetStrength: null,
            tempogram: null
        };
        
        // Feature cache for performance
        this.featureCache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        // Temporal state
        this.frameCounter = 0;
        this.previousSpectrum = null;
        this.spectralMemoryState = null;
        
        // Performance metrics
        this.performanceMetrics = {
            analysisTime: 0,
            mfccTime: 0,
            chromaTime: 0,
            harmonicTime: 0,
            cacheHitRate: 0
        };
        
        // Pitch detection state
        this.pitchTracker = {
            previousPitch: 0,
            pitchConfidence: 0,
            pitchStability: 0,
            voicingProbability: 0
        };
        
        // Musical key detection
        this.keyProfiles = this.initializeKeyProfiles();
        this.currentKey = { key: 'C', mode: 'major', confidence: 0 };
    }
    
    /**
     * Initialize spectral analyzer with audio context
     * @param {AudioContext} audioContext - Web Audio context
     */
    async initialize(audioContext) {
        try {
            this.audioContext = audioContext;
            this.config.sampleRate = audioContext.sampleRate;
            
            // Initialize mel filter bank
            this.initializeMelFilterBank();
            
            // Initialize chromagram analysis
            this.initializeChromaFilterBank();
            
            // Initialize harmonic analysis
            this.initializeHarmonicAnalysis();
            
            // Initialize spectral contrast
            this.initializeSpectralContrast();
            
            // Initialize perceptual models
            this.initializePerceptualModels();
            
            // Setup analysis buffers
            this.initializeBuffers();
            
            this.isInitialized = true;
            
            console.log('SpectralAnalyzer initialized', {
                sampleRate: this.config.sampleRate,
                melFilterBanks: this.config.melFilterBanks,
                mfccCoefficients: this.config.mfccCoefficients,
                chromaBins: this.config.chromaBins
            });
            
        } catch (error) {
            console.error('Failed to initialize SpectralAnalyzer:', error);
            throw error;
        }
    }
    
    /**
     * Initialize mel filter bank for MFCC computation
     */
    initializeMelFilterBank() {
        const { melFilterBanks, melMinFreq, melMaxFreq, sampleRate, fftSize } = this.config;
        const nyquist = sampleRate / 2;
        const fftBins = fftSize / 2;
        
        // Convert frequency range to mel scale
        const melMin = MathUtils.frequencyToMel(melMinFreq);
        const melMax = MathUtils.frequencyToMel(Math.min(melMaxFreq, nyquist));
        
        // Create mel frequency points
        this.melFrequencies = new Float32Array(melFilterBanks + 2);
        for (let i = 0; i < melFilterBanks + 2; i++) {
            const mel = melMin + (melMax - melMin) * i / (melFilterBanks + 1);
            this.melFrequencies[i] = MathUtils.melToFrequency(mel);
        }
        
        // Create filter bank matrix
        this.melFilterBank = new Array(melFilterBanks);
        for (let m = 0; m < melFilterBanks; m++) {
            this.melFilterBank[m] = new Float32Array(fftBins);
            
            const leftFreq = this.melFrequencies[m];
            const centerFreq = this.melFrequencies[m + 1];
            const rightFreq = this.melFrequencies[m + 2];
            
            for (let k = 0; k < fftBins; k++) {
                const freq = (k * nyquist) / fftBins;
                
                if (freq >= leftFreq && freq <= rightFreq) {
                    if (freq <= centerFreq) {
                        // Rising edge
                        this.melFilterBank[m][k] = (freq - leftFreq) / (centerFreq - leftFreq);
                    } else {
                        // Falling edge
                        this.melFilterBank[m][k] = (rightFreq - freq) / (rightFreq - centerFreq);
                    }
                } else {
                    this.melFilterBank[m][k] = 0;
                }
            }
        }
        
        console.log(`Mel filter bank initialized: ${melFilterBanks} filters, ${melMinFreq}-${melMaxFreq} Hz`);
    }
    
    /**
     * Initialize chromagram filter bank for harmonic analysis
     */
    initializeChromaFilterBank() {
        const { chromaBins, chromaMinFreq, chromaMaxFreq, sampleRate, fftSize } = this.config;
        const nyquist = sampleRate / 2;
        const fftBins = fftSize / 2;
        
        this.chromaFilterBank = new Array(chromaBins);
        
        for (let c = 0; c < chromaBins; c++) {
            this.chromaFilterBank[c] = new Float32Array(fftBins);
            
            for (let k = 0; k < fftBins; k++) {
                const freq = (k * nyquist) / fftBins;
                
                if (freq >= chromaMinFreq && freq <= chromaMaxFreq) {
                    // Calculate pitch class for this frequency
                    const pitchClass = this.frequencyToPitchClass(freq);
                    
                    // Create Gaussian filter around target pitch class
                    const pitchDiff = Math.abs(pitchClass - c);
                    const wrappedDiff = Math.min(pitchDiff, chromaBins - pitchDiff);
                    const sigma = 0.5; // Standard deviation in semitones
                    
                    this.chromaFilterBank[c][k] = Math.exp(-0.5 * Math.pow(wrappedDiff / sigma, 2));
                } else {
                    this.chromaFilterBank[c][k] = 0;
                }
            }
            
            // Normalize filter
            const sum = this.chromaFilterBank[c].reduce((acc, val) => acc + val, 0);
            if (sum > 0) {
                for (let k = 0; k < fftBins; k++) {
                    this.chromaFilterBank[c][k] /= sum;
                }
            }
        }
        
        console.log(`Chromagram filter bank initialized: ${chromaBins} chroma bins`);
    }
    
    /**
     * Initialize harmonic analysis templates
     */
    initializeHarmonicAnalysis() {
        const { harmonicCount, pitchMinFreq, pitchMaxFreq, sampleRate, fftSize } = this.config;
        const nyquist = sampleRate / 2;
        const fftBins = fftSize / 2;
        
        // Create pitch candidate frequencies (logarithmic spacing)
        const pitchCandidateCount = 200;
        this.pitchCandidates = new Float32Array(pitchCandidateCount);
        
        for (let i = 0; i < pitchCandidateCount; i++) {
            const t = i / (pitchCandidateCount - 1);
            this.pitchCandidates[i] = pitchMinFreq * Math.pow(pitchMaxFreq / pitchMinFreq, t);
        }
        
        // Create harmonic templates for each pitch candidate
        this.harmonicTemplates = new Array(pitchCandidateCount);
        
        for (let p = 0; p < pitchCandidateCount; p++) {
            const fundamental = this.pitchCandidates[p];
            this.harmonicTemplates[p] = new Float32Array(fftBins);
            
            // Add harmonics with decreasing amplitude
            for (let h = 1; h <= harmonicCount; h++) {
                const harmonicFreq = fundamental * h;
                if (harmonicFreq > nyquist) break;
                
                const binIndex = Math.round((harmonicFreq * fftBins) / nyquist);
                if (binIndex < fftBins) {
                    // Harmonic amplitude decreases as 1/h
                    const amplitude = 1.0 / h;
                    this.harmonicTemplates[p][binIndex] += amplitude;
                    
                    // Add neighboring bins for better frequency resolution
                    if (binIndex > 0) {
                        this.harmonicTemplates[p][binIndex - 1] += amplitude * 0.5;
                    }
                    if (binIndex < fftBins - 1) {
                        this.harmonicTemplates[p][binIndex + 1] += amplitude * 0.5;
                    }
                }
            }
            
            // Normalize template
            const sum = this.harmonicTemplates[p].reduce((acc, val) => acc + val, 0);
            if (sum > 0) {
                for (let k = 0; k < fftBins; k++) {
                    this.harmonicTemplates[p][k] /= sum;
                }
            }
        }
        
        console.log(`Harmonic analysis initialized: ${pitchCandidateCount} pitch candidates, ${harmonicCount} harmonics`);
    }
    
    /**
     * Initialize spectral contrast analysis
     */
    initializeSpectralContrast() {
        const { contrastOctaves, sampleRate, fftSize } = this.config;
        const nyquist = sampleRate / 2;
        const fftBins = fftSize / 2;
        
        this.contrastFilterBanks = new Array(contrastOctaves);
        
        // Create octave-based filter banks
        for (let oct = 0; oct < contrastOctaves; oct++) {
            const centerFreq = 200 * Math.pow(2, oct); // Starting from 200 Hz
            const lowFreq = centerFreq / Math.sqrt(2);
            const highFreq = centerFreq * Math.sqrt(2);
            
            this.contrastFilterBanks[oct] = {
                lowBin: Math.max(0, Math.floor((lowFreq * fftBins) / nyquist)),
                highBin: Math.min(fftBins - 1, Math.ceil((highFreq * fftBins) / nyquist)),
                centerFreq: centerFreq
            };
        }
        
        console.log(`Spectral contrast initialized: ${contrastOctaves} octave bands`);
    }
    
    /**
     * Initialize perceptual models (Bark, ERB, loudness)
     */
    initializePerceptualModels() {
        const { barkBands, erbBands, sampleRate, fftSize } = this.config;
        const nyquist = sampleRate / 2;
        const fftBins = fftSize / 2;
        
        // Bark scale filter bank
        this.barkFilterBank = new Array(barkBands);
        for (let b = 0; b < barkBands; b++) {
            this.barkFilterBank[b] = new Float32Array(fftBins);
            
            const barkValue = (b + 1) * 24 / barkBands; // 0-24 Bark range
            const centerFreq = this.barkToFrequency(barkValue);
            const bandwidth = this.getBarkBandwidth(barkValue);
            
            for (let k = 0; k < fftBins; k++) {
                const freq = (k * nyquist) / fftBins;
                const freqBark = this.frequencyToBark(freq);
                
                // Triangular filter shape
                const distance = Math.abs(freqBark - barkValue);
                if (distance <= bandwidth / 2) {
                    this.barkFilterBank[b][k] = 1 - (2 * distance / bandwidth);
                } else {
                    this.barkFilterBank[b][k] = 0;
                }
            }
        }
        
        // ERB scale filter bank
        this.erbFilterBank = new Array(erbBands);
        for (let e = 0; e < erbBands; e++) {
            this.erbFilterBank[e] = new Float32Array(fftBins);
            
            const erbValue = (e + 1) * 40 / erbBands; // 0-40 ERB range
            const centerFreq = this.erbToFrequency(erbValue);
            const bandwidth = this.getErbBandwidth(centerFreq);
            
            for (let k = 0; k < fftBins; k++) {
                const freq = (k * nyquist) / fftBins;
                
                // Gaussian filter shape
                const sigma = bandwidth / 4;
                const distance = Math.abs(freq - centerFreq);
                this.erbFilterBank[e][k] = Math.exp(-0.5 * Math.pow(distance / sigma, 2));
            }
        }
        
        // Loudness weighting (ISO 226 approximation)
        this.loudnessWeights = new Float32Array(fftBins);
        for (let k = 0; k < fftBins; k++) {
            const freq = (k * nyquist) / fftBins;
            this.loudnessWeights[k] = this.calculateLoudnessWeight(freq);
        }
        
        console.log(`Perceptual models initialized: ${barkBands} Bark, ${erbBands} ERB bands`);
    }
    
    /**
     * Initialize analysis buffers
     */
    initializeBuffers() {
        const { melFilterBanks, mfccCoefficients, chromaBins, harmonicCount, 
                contrastOctaves, barkBands, erbBands, temporalWindow } = this.config;
        
        // Mel-frequency analysis buffers
        this.buffers.melSpectrum = new Float32Array(melFilterBanks);
        this.buffers.melSpectrogram = new Float32Array(128); // Standard size for AudioEngine
        this.buffers.mfcc = new Float32Array(mfccCoefficients);
        this.buffers.deltaMfcc = new Float32Array(mfccCoefficients);
        this.buffers.deltaDeltaMfcc = new Float32Array(mfccCoefficients);
        
        // Chromagram buffers
        this.buffers.chroma = new Float32Array(chromaBins);
        this.buffers.chromaVector = new Float32Array(chromaBins);
        this.buffers.chromaHistory = new Array(temporalWindow);
        for (let i = 0; i < temporalWindow; i++) {
            this.buffers.chromaHistory[i] = new Float32Array(chromaBins);
        }
        
        // Harmonic analysis buffers
        this.buffers.harmonics = new Float32Array(harmonicCount);
        this.buffers.pitchSalience = new Float32Array(this.pitchCandidates.length);
        this.buffers.harmonicStrength = new Float32Array(harmonicCount);
        
        // Spectral contrast buffers
        this.buffers.spectralContrast = new Float32Array(contrastOctaves);
        this.buffers.spectralCrest = new Float32Array(contrastOctaves);
        this.buffers.spectralValley = new Float32Array(contrastOctaves);
        
        // Perceptual feature buffers
        this.buffers.loudness = new Float32Array(barkBands);
        this.buffers.sharpness = 0;
        this.buffers.roughness = 0;
        this.buffers.fluctuationStrength = 0;
        
        // Temporal analysis buffers
        this.buffers.spectralHistory = new Array(temporalWindow);
        this.buffers.onsetStrength = new Float32Array(temporalWindow);
        this.buffers.tempogram = new Array(temporalWindow);
        
        for (let i = 0; i < temporalWindow; i++) {
            this.buffers.spectralHistory[i] = new Float32Array(melFilterBanks);
            this.buffers.tempogram[i] = new Float32Array(melFilterBanks);
        }
        
        // Initialize spectral memory state
        this.spectralMemoryState = new Float32Array(melFilterBanks);
        
        console.log('Spectral analysis buffers initialized');
    }
    
    /**
     * Main analysis function - processes FFT data and extracts spectral features
     * @param {Object} audioData - Enhanced audio data from FFTProcessor
     * @returns {Object} Audio data with advanced spectral features
     */
    analyze(audioData) {
        if (!this.isInitialized) {
            console.warn('SpectralAnalyzer not initialized');
            return audioData;
        }
        
        const startTime = performance.now();
        
        try {
            // Extract FFT data
            const fftData = audioData.fft;
            if (!fftData || !fftData.magnitude) {
                return audioData;
            }
            
            const magnitude = fftData.magnitude;
            const powerSpectrum = fftData.powerSpectrum;
            
            // Perform mel-frequency analysis
            const mfccStartTime = performance.now();
            this.analyzeMelFrequency(magnitude);
            this.performanceMetrics.mfccTime = performance.now() - mfccStartTime;
            
            // Perform chromagram analysis
            const chromaStartTime = performance.now();
            this.analyzeChromagram(magnitude);
            this.performanceMetrics.chromaTime = performance.now() - chromaStartTime;
            
            // Perform harmonic analysis
            const harmonicStartTime = performance.now();
            this.analyzeHarmonics(magnitude);
            this.performanceMetrics.harmonicTime = performance.now() - harmonicStartTime;
            
            // Perform spectral contrast analysis
            this.analyzeSpectralContrast(magnitude);
            
            // Perform perceptual analysis
            this.analyzePerceptualFeatures(magnitude);
            
            // Perform temporal analysis
            this.analyzeTemporalFeatures(magnitude);
            
            // Update musical key estimation
            this.updateKeyEstimation();
            
            // Calculate performance metrics
            const totalTime = performance.now() - startTime;
            this.performanceMetrics.analysisTime = totalTime;
            this.updatePerformanceMetrics();
            
            // Create enhanced output
            const enhancedOutput = this.createEnhancedOutput(audioData);
            
            this.frameCounter++;
            this.previousSpectrum = new Float32Array(magnitude);
            
            return enhancedOutput;
            
        } catch (error) {
            console.error('Spectral analysis error:', error);
            return audioData;
        }
    }
    
    /**
     * Analyze mel-frequency spectrum and compute MFCCs
     */
    analyzeMelFrequency(magnitude) {
        const melFilterBanks = this.config.melFilterBanks;
        
        // Apply mel filter bank
        for (let m = 0; m < melFilterBanks; m++) {
            let melValue = 0;
            for (let k = 0; k < magnitude.length; k++) {
                melValue += magnitude[k] * this.melFilterBank[m][k];
            }
            this.buffers.melSpectrum[m] = Math.max(melValue, 1e-10); // Avoid log(0)
        }
        
        // Compute log mel spectrum
        const logMelSpectrum = new Float32Array(melFilterBanks);
        for (let m = 0; m < melFilterBanks; m++) {
            logMelSpectrum[m] = Math.log(this.buffers.melSpectrum[m]);
        }
        
        // Compute MFCCs using DCT
        this.computeMFCC(logMelSpectrum);
        
        // Update mel spectrogram for AudioEngine (resample to 128 bins)
        for (let i = 0; i < 128; i++) {
            const sourceIndex = Math.floor((i * melFilterBanks) / 128);
            this.buffers.melSpectrogram[i] = this.buffers.melSpectrum[sourceIndex];
        }
        
        // Update spectral history and compute delta features
        this.updateSpectralHistory();
        this.computeDeltaFeatures();
    }
    
    /**
     * Compute MFCC coefficients using Discrete Cosine Transform
     */
    computeMFCC(logMelSpectrum) {
        const melFilterBanks = this.config.melFilterBanks;
        const mfccCoefficients = this.config.mfccCoefficients;
        
        for (let c = 0; c < mfccCoefficients; c++) {
            let mfcc = 0;
            for (let m = 0; m < melFilterBanks; m++) {
                mfcc += logMelSpectrum[m] * Math.cos(Math.PI * c * (m + 0.5) / melFilterBanks);
            }
            this.buffers.mfcc[c] = mfcc * Math.sqrt(2 / melFilterBanks);
        }
        
        // Apply liftering to enhance higher coefficients
        const lifterParam = 22;
        for (let c = 1; c < mfccCoefficients; c++) {
            const lifter = 1 + (lifterParam / 2) * Math.sin(Math.PI * c / lifterParam);
            this.buffers.mfcc[c] *= lifter;
        }
    }
    
    /**
     * Analyze chromagram for harmonic content and pitch class analysis
     */
    analyzeChromagram(magnitude) {
        const chromaBins = this.config.chromaBins;
        
        // Apply chroma filter bank
        for (let c = 0; c < chromaBins; c++) {
            let chromaValue = 0;
            for (let k = 0; k < magnitude.length; k++) {
                chromaValue += magnitude[k] * this.chromaFilterBank[c][k];
            }
            this.buffers.chromaVector[c] = chromaValue;
        }
        
        // Normalize chroma vector
        const chromaSum = this.buffers.chromaVector.reduce((sum, val) => sum + val, 0);
        if (chromaSum > 0) {
            for (let c = 0; c < chromaBins; c++) {
                this.buffers.chroma[c] = this.buffers.chromaVector[c] / chromaSum;
            }
        } else {
            this.buffers.chroma.fill(1 / chromaBins); // Uniform distribution
        }
        
        // Apply temporal smoothing
        if (this.buffers.chromaHistory[0]) {
            const smoothing = 0.8;
            for (let c = 0; c < chromaBins; c++) {
                this.buffers.chroma[c] = MathUtils.exponentialSmoothing(
                    this.buffers.chromaHistory[0][c],
                    this.buffers.chroma[c],
                    1 - smoothing
                );
            }
        }
        
        // Update chroma history
        for (let i = this.buffers.chromaHistory.length - 1; i > 0; i--) {
            this.buffers.chromaHistory[i].set(this.buffers.chromaHistory[i - 1]);
        }
        this.buffers.chromaHistory[0].set(this.buffers.chroma);
    }
    
    /**
     * Analyze harmonic content and estimate fundamental frequency
     */
    analyzeHarmonics(magnitude) {
        const harmonicCount = this.config.harmonicCount;
        const pitchCandidateCount = this.pitchCandidates.length;
        
        // Calculate pitch salience for each candidate
        for (let p = 0; p < pitchCandidateCount; p++) {
            let salience = 0;
            const template = this.harmonicTemplates[p];
            
            for (let k = 0; k < magnitude.length; k++) {
                salience += magnitude[k] * template[k];
            }
            
            this.buffers.pitchSalience[p] = salience;
        }
        
        // Find best pitch candidate
        let maxSalience = 0;
        let bestPitchIndex = 0;
        
        for (let p = 0; p < pitchCandidateCount; p++) {
            if (this.buffers.pitchSalience[p] > maxSalience) {
                maxSalience = this.buffers.pitchSalience[p];
                bestPitchIndex = p;
            }
        }
        
        // Extract pitch and confidence
        const estimatedPitch = this.pitchCandidates[bestPitchIndex];
        const pitchConfidence = maxSalience / (magnitude.reduce((sum, val) => sum + val, 0) + 1e-10);
        
        // Update pitch tracker with smoothing
        if (pitchConfidence > this.config.pitchConfidenceThreshold) {
            this.pitchTracker.previousPitch = MathUtils.exponentialSmoothing(
                this.pitchTracker.previousPitch,
                estimatedPitch,
                0.3
            );
            this.pitchTracker.pitchConfidence = MathUtils.exponentialSmoothing(
                this.pitchTracker.pitchConfidence,
                pitchConfidence,
                0.2
            );
        }
        
        // Extract harmonic amplitudes
        const fundamental = this.pitchTracker.previousPitch;
        if (fundamental > 0) {
            const nyquist = this.config.sampleRate / 2;
            const binResolution = nyquist / magnitude.length;
            
            for (let h = 0; h < harmonicCount; h++) {
                const harmonicFreq = fundamental * (h + 1);
                if (harmonicFreq <= nyquist) {
                    const binIndex = Math.round(harmonicFreq / binResolution);
                    if (binIndex < magnitude.length) {
                        // Use parabolic interpolation for more accurate amplitude
                        this.buffers.harmonics[h] = this.parabolicInterpolation(
                            magnitude, binIndex
                        );
                    } else {
                        this.buffers.harmonics[h] = 0;
                    }
                } else {
                    this.buffers.harmonics[h] = 0;
                }
            }
            
            // Calculate harmonic strength (ratio of harmonic to total energy)
            const totalEnergy = magnitude.reduce((sum, val) => sum + val * val, 0);
            for (let h = 0; h < harmonicCount; h++) {
                this.buffers.harmonicStrength[h] = totalEnergy > 0 ? 
                    (this.buffers.harmonics[h] * this.buffers.harmonics[h]) / totalEnergy : 0;
            }
        } else {
            this.buffers.harmonics.fill(0);
            this.buffers.harmonicStrength.fill(0);
        }
    }
    
    /**
     * Analyze spectral contrast across different frequency bands
     */
    analyzeSpectralContrast(magnitude) {
        const contrastOctaves = this.config.contrastOctaves;
        const alpha = this.config.contrastAlpha;
        
        for (let oct = 0; oct < contrastOctaves; oct++) {
            const filter = this.contrastFilterBanks[oct];
            const bandMagnitudes = [];
            
            // Extract magnitudes in this octave band
            for (let k = filter.lowBin; k <= filter.highBin; k++) {
                bandMagnitudes.push(magnitude[k]);
            }
            
            if (bandMagnitudes.length === 0) {
                this.buffers.spectralContrast[oct] = 0;
                this.buffers.spectralCrest[oct] = 0;
                this.buffers.spectralValley[oct] = 0;
                continue;
            }
            
            // Sort magnitudes to find peaks and valleys
            const sortedMagnitudes = [...bandMagnitudes].sort((a, b) => b - a);
            
            // Calculate spectral peaks (top alpha percentile)
            const peakCount = Math.max(1, Math.floor(sortedMagnitudes.length * alpha));
            let peakSum = 0;
            for (let i = 0; i < peakCount; i++) {
                peakSum += sortedMagnitudes[i];
            }
            const peakMean = peakSum / peakCount;
            
            // Calculate spectral valleys (bottom alpha percentile)
            const valleyCount = Math.max(1, Math.floor(sortedMagnitudes.length * alpha));
            let valleySum = 0;
            for (let i = sortedMagnitudes.length - valleyCount; i < sortedMagnitudes.length; i++) {
                valleySum += sortedMagnitudes[i];
            }
            const valleyMean = valleySum / valleyCount;
            
            // Spectral contrast (dB difference between peaks and valleys)
            this.buffers.spectralContrast[oct] = valleyMean > 0 ? 
                20 * Math.log10((peakMean + 1e-10) / (valleyMean + 1e-10)) : 0;
            
            // Spectral crest factor
            const maxMagnitude = sortedMagnitudes[0];
            const meanMagnitude = bandMagnitudes.reduce((sum, val) => sum + val, 0) / bandMagnitudes.length;
            this.buffers.spectralCrest[oct] = meanMagnitude > 0 ? maxMagnitude / meanMagnitude : 0;
            
            // Store valley information
            this.buffers.spectralValley[oct] = valleyMean;
        }
    }
    
    /**
     * Analyze perceptual features (loudness, sharpness, roughness)
     */
    analyzePerceptualFeatures(magnitude) {
        // Loudness analysis using Bark bands
        this.analyzeLoudness(magnitude);
        
        // Sharpness calculation (based on higher frequency content)
        this.analyzeSharpness(magnitude);
        
        // Roughness estimation (based on beating patterns)
        this.analyzeRoughness(magnitude);
        
        // Fluctuation strength (based on amplitude modulation)
        this.analyzeFluctuationStrength(magnitude);
    }
    
    /**
     * Analyze loudness using psychoacoustic models
     */
    analyzeLoudness(magnitude) {
        const barkBands = this.config.barkBands;
        
        for (let b = 0; b < barkBands; b++) {
            let loudness = 0;
            for (let k = 0; k < magnitude.length; k++) {
                const weightedMagnitude = magnitude[k] * this.loudnessWeights[k];
                loudness += weightedMagnitude * this.barkFilterBank[b][k];
            }
            
            // Apply Stevens' power law (perceived loudness)
            this.buffers.loudness[b] = Math.pow(Math.max(loudness, 1e-10), 0.67);
        }
    }
    
    /**
     * Analyze sharpness (brightness perception)
     */
    analyzeSharpness(magnitude) {
        const nyquist = this.config.sampleRate / 2;
        let weightedSum = 0;
        let totalSum = 0;
        
        for (let k = 0; k < magnitude.length; k++) {
            const freq = (k * nyquist) / magnitude.length;
            const sharpnessWeight = this.calculateSharpnessWeight(freq);
            
            weightedSum += magnitude[k] * sharpnessWeight;
            totalSum += magnitude[k];
        }
        
        this.buffers.sharpness = totalSum > 0 ? weightedSum / totalSum : 0;
    }
    
    /**
     * Analyze roughness (perceived dissonance)
     */
    analyzeRoughness(magnitude) {
        let roughness = 0;
        const nyquist = this.config.sampleRate / 2;
        
        // Look for beating patterns between frequency components
        for (let i = 0; i < magnitude.length - 1; i++) {
            for (let j = i + 1; j < Math.min(i + 50, magnitude.length); j++) {
                const freq1 = (i * nyquist) / magnitude.length;
                const freq2 = (j * nyquist) / magnitude.length;
                const beatFreq = Math.abs(freq2 - freq1);
                
                // Roughness peaks around 70 Hz beat frequency
                const roughnessWeight = this.calculateRoughnessWeight(beatFreq);
                const componentRoughness = magnitude[i] * magnitude[j] * roughnessWeight;
                
                roughness += componentRoughness;
            }
        }
        
        this.buffers.roughness = roughness;
    }
    
    /**
     * Analyze fluctuation strength (amplitude modulation perception)
     */
    analyzeFluctuationStrength(magnitude) {
        // This would require temporal analysis of amplitude modulation
        // Simplified implementation based on spectral variability
        if (this.previousSpectrum) {
            let fluctuation = 0;
            for (let k = 0; k < magnitude.length; k++) {
                const diff = Math.abs(magnitude[k] - this.previousSpectrum[k]);
                fluctuation += diff;
            }
            
            this.buffers.fluctuationStrength = MathUtils.exponentialSmoothing(
                this.buffers.fluctuationStrength,
                fluctuation / magnitude.length,
                0.1
            );
        }
    }
    
    /**
     * Analyze temporal features and update spectral memory
     */
    analyzeTemporalFeatures(magnitude) {
        // Update spectral memory with exponential decay
        const memoryFactor = this.config.spectralMemory;
        for (let i = 0; i < this.spectralMemoryState.length; i++) {
            const melIndex = Math.floor((i * this.buffers.melSpectrum.length) / this.spectralMemoryState.length);
            this.spectralMemoryState[i] = memoryFactor * this.spectralMemoryState[i] + 
                                         (1 - memoryFactor) * this.buffers.melSpectrum[melIndex];
        }
        
        // Calculate onset strength
        if (this.previousSpectrum) {
            let onsetStrength = 0;
            for (let k = 0; k < magnitude.length; k++) {
                const diff = magnitude[k] - this.previousSpectrum[k];
                onsetStrength += Math.max(0, diff); // Only positive changes
            }
            
            // Update onset strength history
            for (let i = this.buffers.onsetStrength.length - 1; i > 0; i--) {
                this.buffers.onsetStrength[i] = this.buffers.onsetStrength[i - 1];
            }
            this.buffers.onsetStrength[0] = onsetStrength / magnitude.length;
        }
    }
    
    /**
     * Update musical key estimation based on chromagram
     */
    updateKeyEstimation() {
        const chroma = this.buffers.chroma;
        let bestKey = this.currentKey.key;
        let bestMode = this.currentKey.mode;
        let bestCorrelation = 0;
        
        // Test against all key profiles
        for (const key in this.keyProfiles) {
            for (const mode of ['major', 'minor']) {
                const profile = this.keyProfiles[key][mode];
                const correlation = this.calculateChromaCorrelation(chroma, profile);
                
                if (correlation > bestCorrelation) {
                    bestCorrelation = correlation;
                    bestKey = key;
                    bestMode = mode;
                }
            }
        }
        
        // Apply temporal smoothing to key estimation
        if (bestCorrelation > 0.3) { // Minimum confidence threshold
            const smoothing = 0.95;
            this.currentKey.confidence = MathUtils.exponentialSmoothing(
                this.currentKey.confidence,
                bestCorrelation,
                1 - smoothing
            );
            
            if (this.currentKey.confidence > 0.5) {
                this.currentKey.key = bestKey;
                this.currentKey.mode = bestMode;
            }
        }
    }
    
    /**
     * Create enhanced output with all spectral features
     */
    createEnhancedOutput(audioData) {
        return {
            ...audioData,
            
            // AudioEngine expected fields
            pitch: this.pitchTracker.previousPitch,
            harmonics: new Float32Array(this.buffers.harmonics),
            chroma: new Float32Array(this.buffers.chroma),
            mfcc: new Float32Array(this.buffers.mfcc),
            melSpectrogram: new Float32Array(this.buffers.melSpectrogram),
            
            // Enhanced spectral features
            spectralAnalysis: {
                // Mel-frequency analysis
                melSpectrum: new Float32Array(this.buffers.melSpectrum),
                deltaMfcc: new Float32Array(this.buffers.deltaMfcc),
                deltaDeltaMfcc: new Float32Array(this.buffers.deltaDeltaMfcc),
                
                // Harmonic analysis
                pitchConfidence: this.pitchTracker.pitchConfidence,
                harmonicStrength: new Float32Array(this.buffers.harmonicStrength),
                voicingProbability: this.pitchTracker.voicingProbability,
                
                // Spectral characteristics
                spectralContrast: new Float32Array(this.buffers.spectralContrast),
                spectralCrest: new Float32Array(this.buffers.spectralCrest),
                
                // Perceptual features
                loudness: new Float32Array(this.buffers.loudness),
                sharpness: this.buffers.sharpness,
                roughness: this.buffers.roughness,
                fluctuationStrength: this.buffers.fluctuationStrength,
                
                // Musical analysis
                key: { ...this.currentKey },
                chromaVector: new Float32Array(this.buffers.chromaVector),
                
                // Temporal features
                onsetStrength: this.buffers.onsetStrength[0],
                spectralMemory: new Float32Array(this.spectralMemoryState)
            },
            
            // Processing metadata
            spectralProcessing: {
                frameNumber: this.frameCounter,
                analysisTime: this.performanceMetrics.analysisTime,
                pitchTracker: { ...this.pitchTracker },
                performance: { ...this.performanceMetrics }
            }
        };
    }
    
    /**
     * Helper functions for spectral analysis
     */
    
    frequencyToPitchClass(frequency) {
        const A4 = 440; // Hz
        const semitones = 12 * Math.log2(frequency / A4);
        return ((Math.round(semitones) % 12) + 12) % 12;
    }
    
    parabolicInterpolation(spectrum, peakIndex) {
        if (peakIndex <= 0 || peakIndex >= spectrum.length - 1) {
            return spectrum[peakIndex];
        }
        
        const y1 = spectrum[peakIndex - 1];
        const y2 = spectrum[peakIndex];
        const y3 = spectrum[peakIndex + 1];
        
        const a = (y1 - 2 * y2 + y3) / 2;
        const b = (y3 - y1) / 2;
        
        if (Math.abs(a) < 1e-10) return y2;
        
        const x0 = -b / (2 * a);
        return y2 - b * x0 / 2;
    }
    
    frequencyToBark(frequency) {
        return 13 * Math.atan(0.00076 * frequency) + 3.5 * Math.atan(Math.pow(frequency / 7500, 2));
    }
    
    barkToFrequency(bark) {
        // Approximate inverse Bark transform
        return 600 * Math.sinh(bark / 4);
    }
    
    getBarkBandwidth(bark) {
        return 25 + 75 * Math.pow(1 + 1.4 * Math.pow(bark / 1000, 2), 0.69);
    }
    
    frequencyToERB(frequency) {
        return 21.4 * Math.log10(1 + 0.00437 * frequency);
    }
    
    erbToFrequency(erb) {
        return (Math.pow(10, erb / 21.4) - 1) / 0.00437;
    }
    
    getErbBandwidth(frequency) {
        return 24.7 * (4.37 * frequency / 1000 + 1);
    }
    
    calculateLoudnessWeight(frequency) {
        // ISO 226 equal loudness contour approximation
        const f = frequency;
        const af = 0.00447 * (Math.pow(f, 0.025) - 1.15) + 
                   Math.pow(0.4 * Math.pow(f / 1000, -0.8), 2.5);
        return Math.pow(10, af / 20);
    }
    
    calculateSharpnessWeight(frequency) {
        // Aures sharpness model
        const gz = this.frequencyToBark(frequency);
        if (gz < 15.8) {
            return 1;
        } else {
            return 0.066 * Math.exp(0.171 * gz);
        }
    }
    
    calculateRoughnessWeight(beatFrequency) {
        // Roughness perception model
        const f = beatFrequency;
        if (f < 20) return 0;
        return Math.pow(f / 70, 2) * Math.exp(-3.5 * f / 70);
    }
    
    calculateChromaCorrelation(chroma1, chroma2) {
        let correlation = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < chroma1.length; i++) {
            correlation += chroma1[i] * chroma2[i];
            norm1 += chroma1[i] * chroma1[i];
            norm2 += chroma2[i] * chroma2[i];
        }
        
        const normProduct = Math.sqrt(norm1 * norm2);
        return normProduct > 0 ? correlation / normProduct : 0;
    }
    
    updateSpectralHistory() {
        // Shift spectral history
        for (let i = this.buffers.spectralHistory.length - 1; i > 0; i--) {
            this.buffers.spectralHistory[i].set(this.buffers.spectralHistory[i - 1]);
        }
        this.buffers.spectralHistory[0].set(this.buffers.melSpectrum);
    }
    
    computeDeltaFeatures() {
        const mfccCoefficients = this.config.mfccCoefficients;
        const historyLength = this.buffers.spectralHistory.length;
        
        if (historyLength < 3) return; // Need at least 3 frames
        
        // Compute delta MFCC (first derivative)
        for (let c = 0; c < mfccCoefficients; c++) {
            const current = this.buffers.mfcc[c];
            const previous = this.buffers.spectralHistory[1] ? 
                this.buffers.spectralHistory[1][c] || 0 : 0;
            this.buffers.deltaMfcc[c] = current - previous;
        }
        
        // Compute delta-delta MFCC (second derivative)
        if (historyLength >= 5) {
            for (let c = 0; c < mfccCoefficients; c++) {
                const current = this.buffers.deltaMfcc[c];
                const previous = this.buffers.spectralHistory[2] ? 
                    (this.buffers.spectralHistory[2][c] || 0) - 
                    (this.buffers.spectralHistory[3] ? this.buffers.spectralHistory[3][c] || 0 : 0) : 0;
                this.buffers.deltaDeltaMfcc[c] = current - previous;
            }
        }
    }
    
    updatePerformanceMetrics() {
        this.performanceMetrics.cacheHitRate = 
            this.cacheHits / Math.max(1, this.cacheHits + this.cacheMisses);
        
        // Report to global performance monitor
        performanceMonitor.recordCPUTime('audioProcessing', this.performanceMetrics.analysisTime);
    }
    
    initializeKeyProfiles() {
        // Krumhansl-Schmuckler key profiles
        const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
        const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
        
        const profiles = {};
        const pitchClasses = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        for (let i = 0; i < 12; i++) {
            const key = pitchClasses[i];
            profiles[key] = {
                major: new Float32Array(12),
                minor: new Float32Array(12)
            };
            
            // Rotate profiles for each key
            for (let j = 0; j < 12; j++) {
                profiles[key].major[j] = majorProfile[(j - i + 12) % 12];
                profiles[key].minor[j] = minorProfile[(j - i + 12) % 12];
            }
        }
        
        return profiles;
    }
    
    /**
     * Get current spectral analysis status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            frameCounter: this.frameCounter,
            config: { ...this.config },
            performance: { ...this.performanceMetrics },
            pitchTracker: { ...this.pitchTracker },
            currentKey: { ...this.currentKey },
            bufferSizes: {
                melSpectrum: this.buffers.melSpectrum?.length || 0,
                mfcc: this.buffers.mfcc?.length || 0,
                chroma: this.buffers.chroma?.length || 0,
                harmonics: this.buffers.harmonics?.length || 0
            }
        };
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        const needsReinit = 
            newConfig.melFilterBanks !== this.config.melFilterBanks ||
            newConfig.mfccCoefficients !== this.config.mfccCoefficients ||
            newConfig.chromaBins !== this.config.chromaBins;
        
        Object.assign(this.config, newConfig);
        
        if (needsReinit && this.isInitialized) {
            console.log('Reinitializing SpectralAnalyzer due to config changes');
            this.initializeMelFilterBank();
            this.initializeChromaFilterBank();
            this.initializeBuffers();
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        console.log('Disposing SpectralAnalyzer...');
        
        // Clear caches
        this.featureCache.clear();
        
        // Clear buffers
        Object.keys(this.buffers).forEach(key => {
            this.buffers[key] = null;
        });
        
        // Clear filter banks
        this.melFilterBank = null;
        this.chromaFilterBank = null;
        this.harmonicTemplates = null;
        this.contrastFilterBanks = null;
        this.barkFilterBank = null;
        this.erbFilterBank = null;
        
        this.isInitialized = false;
        this.audioContext = null;
        
        console.log('SpectralAnalyzer disposed');
    }
}