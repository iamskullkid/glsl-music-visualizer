/**
 * Advanced Feature Extractor
 * Comprehensive audio feature extraction for perceptual analysis and machine learning
 * Location: src/audio/FeatureExtractor.js
 * 
 * Extracts high-level musical and perceptual features including MFCCs, chromagram,
 * timbral features, harmonic analysis, and genre classification markers
 */

import { MathUtils } from '../utils/MathUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

export class FeatureExtractor {
    constructor(config = {}) {
        this.isInitialized = false;
        this.audioContext = null;
        
        // Configuration with comprehensive feature settings
        this.config = {
            sampleRate: 44100,
            fftSize: 4096,
            hopSize: 1024,
            
            // MFCC configuration
            mfccCoefficients: 13,
            melFilterBanks: 128,
            melMinFreq: 80,
            melMaxFreq: 8000,
            lifterParam: 22,
            
            // Chromagram configuration
            chromaBins: 12,
            chromaMinFreq: 65,      // C2
            chromaMaxFreq: 2093,    // C7
            chromaThreshold: 0.01,
            tuningFreq: 440,        // A4 reference
            
            // Spectral feature settings
            spectralBands: [
                { name: 'sub-bass', min: 20, max: 60 },
                { name: 'bass', min: 60, max: 250 },
                { name: 'low-mid', min: 250, max: 500 },
                { name: 'mid', min: 500, max: 2000 },
                { name: 'high-mid', min: 2000, max: 4000 },
                { name: 'presence', min: 4000, max: 8000 },
                { name: 'brilliance', min: 8000, max: 20000 }
            ],
            
            // Timbral analysis
            enableZeroCrossingRate: true,
            enableSpectralCentroid: true,
            enableSpectralBandwidth: true,
            enableSpectralRolloff: true,
            enableSpectralFlatness: true,
            enableMelFrequencyCepstrum: true,
            
            // Harmonic analysis
            enableHarmonicAnalysis: true,
            harmonicCount: 8,
            fundamentalMinFreq: 50,
            fundamentalMaxFreq: 2000,
            harmonicThreshold: 0.1,
            
            // Perceptual features
            enableLoudnessAnalysis: true,
            loudnessModel: 'stevens',    // 'stevens', 'zwicker', 'moore'
            enableSharpness: true,
            enableRoughness: true,
            enableFluctuationStrength: true,
            
            // Musical features
            enableKeyDetection: true,
            enableChordDetection: true,
            enableModeDetection: true,
            enableTonalCentroid: true,
            
            // Temporal features
            enableOnsetDensity: true,
            enableTempo: true,
            enableRhythmicRegularity: true,
            temporalWindow: 4.0,        // Seconds for temporal analysis
            
            // Genre classification features
            enableGenreFeatures: true,
            genreFeatureSet: 'comprehensive', // 'basic', 'extended', 'comprehensive'
            
            // Performance settings
            enableCaching: true,
            cacheSize: 128,
            enableParallelProcessing: false,
            qualityMode: 'high',        // 'low', 'medium', 'high', 'ultra'
            
            ...config
        };
        
        // Feature extraction modules
        this.extractors = {
            mfcc: null,
            chroma: null,
            spectral: null,
            harmonic: null,
            perceptual: null,
            musical: null,
            temporal: null,
            genre: null
        };
        
        // Filter banks and transformation matrices
        this.filterBanks = {
            mel: null,
            chroma: null,
            bark: null,
            erb: null
        };
        
        // Analysis buffers
        this.buffers = {
            // Mel-frequency analysis
            melSpectrum: null,
            melSpectrogram: null,
            mfcc: null,
            deltaMfcc: null,
            deltaDeltaMfcc: null,
            
            // Chromagram analysis
            chroma: null,
            chromaVector: null,
            chromaNormalized: null,
            
            // Spectral features
            spectralFeatures: null,
            spectralHistory: null,
            bandEnergies: null,
            
            // Harmonic analysis
            harmonics: null,
            harmonicRatios: null,
            inharmonicity: null,
            
            // Perceptual features
            loudness: null,
            sharpness: 0,
            roughness: 0,
            fluctuationStrength: 0,
            
            // Musical features
            tonalCentroid: null,
            keyProfile: null,
            chordProfile: null,
            modeProfile: null,
            
            // Temporal features
            onsetDensity: 0,
            rhythmicRegularity: 0,
            tempoConsistency: 0,
            
            // Feature history for temporal modeling
            featureHistory: null
        };
        
        // Musical knowledge bases
        this.musicalKnowledge = {
            keyProfiles: null,
            chordTemplates: null,
            scaleTemplates: null,
            genreModels: null
        };
        
        // Feature statistics for normalization
        this.featureStats = {
            means: new Map(),
            variances: new Map(),
            mins: new Map(),
            maxs: new Map(),
            sampleCount: 0
        };
        
        // Performance metrics
        this.performanceMetrics = {
            extractionTime: 0,
            mfccTime: 0,
            chromaTime: 0,
            spectralTime: 0,
            harmonicTime: 0,
            perceptualTime: 0,
            musicalTime: 0,
            cacheHitRate: 0,
            memoryUsage: 0
        };
        
        // Feature cache for performance optimization
        this.featureCache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        // Frame counter for temporal analysis
        this.frameCounter = 0;
        this.analysisStartTime = performance.now();
        
        // Event system
        this.eventCallbacks = new Map();
        
        // Debug and visualization data
        this.debugData = {
            enabled: process.env.NODE_ENV === 'development',
            spectralShape: new Array(512).fill(0),
            harmonicProfile: new Array(16).fill(0),
            chromaWheel: new Array(12).fill(0),
            featureTimeline: {
                mfcc: [],
                chroma: [],
                spectral: [],
                temporal: []
            }
        };
    }
    
    /**
     * Initialize feature extractor with audio context
     * @param {AudioContext} audioContext - Web Audio context
     */
    async initialize(audioContext) {
        try {
            this.audioContext = audioContext;
            this.config.sampleRate = audioContext.sampleRate;
            
            // Initialize filter banks
            await this.initializeFilterBanks();
            
            // Initialize feature extractors
            await this.initializeExtractors();
            
            // Initialize musical knowledge bases
            this.initializeMusicalKnowledge();
            
            // Initialize analysis buffers
            this.initializeBuffers();
            
            // Load pre-trained models if available
            await this.loadPretrainedModels();
            
            this.isInitialized = true;
            
            console.log('FeatureExtractor initialized', {
                sampleRate: this.config.sampleRate,
                mfccCoefficients: this.config.mfccCoefficients,
                chromaBins: this.config.chromaBins,
                spectralBands: this.config.spectralBands.length,
                qualityMode: this.config.qualityMode
            });
            
        } catch (error) {
            console.error('Failed to initialize FeatureExtractor:', error);
            throw error;
        }
    }
    
    /**
     * Initialize mel, chroma, and perceptual filter banks
     */
    async initializeFilterBanks() {
        const nyquist = this.config.sampleRate / 2;
        const fftBins = this.config.fftSize / 2;
        
        // Mel filter bank for MFCC computation
        this.filterBanks.mel = this.createMelFilterBank(
            this.config.melFilterBanks,
            this.config.melMinFreq,
            this.config.melMaxFreq,
            nyquist,
            fftBins
        );
        
        // Chroma filter bank for harmonic analysis
        this.filterBanks.chroma = this.createChromaFilterBank(
            this.config.chromaBins,
            this.config.chromaMinFreq,
            this.config.chromaMaxFreq,
            nyquist,
            fftBins
        );
        
        // Bark filter bank for perceptual analysis
        this.filterBanks.bark = this.createBarkFilterBank(24, nyquist, fftBins);
        
        // ERB filter bank for auditory modeling
        this.filterBanks.erb = this.createERBFilterBank(32, nyquist, fftBins);
        
        console.log('Filter banks initialized:', {
            mel: this.filterBanks.mel.length,
            chroma: this.filterBanks.chroma.length,
            bark: this.filterBanks.bark.length,
            erb: this.filterBanks.erb.length
        });
    }
    
    /**
     * Create mel-frequency filter bank
     */
    createMelFilterBank(numFilters, minFreq, maxFreq, nyquist, fftBins) {
        // Convert to mel scale
        const melMin = MathUtils.frequencyToMel(minFreq);
        const melMax = MathUtils.frequencyToMel(Math.min(maxFreq, nyquist));
        
        // Create mel frequency points
        const melPoints = [];
        for (let i = 0; i <= numFilters + 1; i++) {
            const mel = melMin + (melMax - melMin) * i / (numFilters + 1);
            melPoints.push(MathUtils.melToFrequency(mel));
        }
        
        // Create triangular filters
        const filterBank = [];
        for (let m = 0; m < numFilters; m++) {
            const filter = new Float32Array(fftBins);
            
            const leftFreq = melPoints[m];
            const centerFreq = melPoints[m + 1];
            const rightFreq = melPoints[m + 2];
            
            for (let k = 0; k < fftBins; k++) {
                const freq = (k * nyquist) / fftBins;
                
                if (freq >= leftFreq && freq <= rightFreq) {
                    if (freq <= centerFreq) {
                        filter[k] = (freq - leftFreq) / (centerFreq - leftFreq);
                    } else {
                        filter[k] = (rightFreq - freq) / (rightFreq - centerFreq);
                    }
                }
            }
            
            filterBank.push(filter);
        }
        
        return filterBank;
    }
    
    /**
     * Create chromagram filter bank
     */
    createChromaFilterBank(chromaBins, minFreq, maxFreq, nyquist, fftBins) {
        const filterBank = [];
        
        for (let c = 0; c < chromaBins; c++) {
            const filter = new Float32Array(fftBins);
            
            for (let k = 0; k < fftBins; k++) {
                const freq = (k * nyquist) / fftBins;
                
                if (freq >= minFreq && freq <= maxFreq) {
                    // Map frequency to pitch class
                    const pitchClass = this.frequencyToPitchClass(freq);
                    
                    // Create circular Gaussian around target pitch class
                    const distance = this.circularDistance(pitchClass, c, chromaBins);
                    const sigma = 0.5; // Standard deviation in semitones
                    
                    filter[k] = Math.exp(-0.5 * Math.pow(distance / sigma, 2));
                }
            }
            
            // Normalize filter
            const sum = filter.reduce((acc, val) => acc + val, 0);
            if (sum > 0) {
                for (let k = 0; k < fftBins; k++) {
                    filter[k] /= sum;
                }
            }
            
            filterBank.push(filter);
        }
        
        return filterBank;
    }
    
    /**
     * Create Bark scale filter bank for perceptual analysis
     */
    createBarkFilterBank(numBands, nyquist, fftBins) {
        const filterBank = [];
        
        for (let b = 0; b < numBands; b++) {
            const filter = new Float32Array(fftBins);
            
            const barkValue = (b + 1) * 24 / numBands;
            const centerFreq = this.barkToFrequency(barkValue);
            const bandwidth = this.getBarkBandwidth(barkValue);
            
            for (let k = 0; k < fftBins; k++) {
                const freq = (k * nyquist) / fftBins;
                const freqBark = this.frequencyToBark(freq);
                
                const distance = Math.abs(freqBark - barkValue);
                if (distance <= bandwidth / 2) {
                    filter[k] = 1 - (2 * distance / bandwidth);
                }
            }
            
            filterBank.push(filter);
        }
        
        return filterBank;
    }
    
    /**
     * Create ERB scale filter bank
     */
    createERBFilterBank(numBands, nyquist, fftBins) {
        const filterBank = [];
        
        for (let e = 0; e < numBands; e++) {
            const filter = new Float32Array(fftBins);
            
            const erbValue = (e + 1) * 40 / numBands;
            const centerFreq = this.erbToFrequency(erbValue);
            const bandwidth = this.getERBBandwidth(centerFreq);
            
            for (let k = 0; k < fftBins; k++) {
                const freq = (k * nyquist) / fftBins;
                
                const sigma = bandwidth / 4;
                const distance = Math.abs(freq - centerFreq);
                filter[k] = Math.exp(-0.5 * Math.pow(distance / sigma, 2));
            }
            
            filterBank.push(filter);
        }
        
        return filterBank;
    }
    
    /**
     * Initialize feature extraction modules
     */
    async initializeExtractors() {
        this.extractors.mfcc = new MFCCExtractor(this.config, this.filterBanks.mel);
        this.extractors.chroma = new ChromaExtractor(this.config, this.filterBanks.chroma);
        this.extractors.spectral = new SpectralFeatureExtractor(this.config);
        this.extractors.harmonic = new HarmonicAnalyzer(this.config);
        this.extractors.perceptual = new PerceptualFeatureExtractor(this.config, this.filterBanks);
        this.extractors.musical = new MusicalFeatureExtractor(this.config);
        this.extractors.temporal = new TemporalFeatureExtractor(this.config);
        
        if (this.config.enableGenreFeatures) {
            this.extractors.genre = new GenreFeatureExtractor(this.config);
        }
        
        // Initialize each extractor
        await Promise.all(
            Object.values(this.extractors)
                .filter(extractor => extractor !== null)
                .map(extractor => extractor.initialize())
        );
        
        console.log('Feature extractors initialized');
    }
    
    /**
     * Initialize musical knowledge bases
     */
    initializeMusicalKnowledge() {
        // Key profiles (Krumhansl-Schmuckler)
        this.musicalKnowledge.keyProfiles = this.createKeyProfiles();
        
        // Chord templates
        this.musicalKnowledge.chordTemplates = this.createChordTemplates();
        
        // Scale templates
        this.musicalKnowledge.scaleTemplates = this.createScaleTemplates();
        
        // Genre classification models (placeholder)
        this.musicalKnowledge.genreModels = this.createGenreModels();
        
        console.log('Musical knowledge bases initialized');
    }
    
    /**
     * Initialize analysis buffers
     */
    initializeBuffers() {
        const { mfccCoefficients, chromaBins, melFilterBanks, spectralBands } = this.config;
        const historyLength = 128;
        
        // MFCC buffers
        this.buffers.melSpectrum = new Float32Array(melFilterBanks);
        this.buffers.melSpectrogram = new Float32Array(128); // Standard size
        this.buffers.mfcc = new Float32Array(mfccCoefficients);
        this.buffers.deltaMfcc = new Float32Array(mfccCoefficients);
        this.buffers.deltaDeltaMfcc = new Float32Array(mfccCoefficients);
        
        // Chroma buffers
        this.buffers.chroma = new Float32Array(chromaBins);
        this.buffers.chromaVector = new Float32Array(chromaBins);
        this.buffers.chromaNormalized = new Float32Array(chromaBins);
        
        // Spectral feature buffers
        this.buffers.spectralFeatures = {
            centroid: 0,
            bandwidth: 0,
            rolloff: 0,
            flatness: 0,
            skewness: 0,
            kurtosis: 0,
            slope: 0,
            decrease: 0,
            spread: 0
        };
        
        this.buffers.bandEnergies = new Float32Array(spectralBands.length);
        
        // Harmonic analysis buffers
        this.buffers.harmonics = new Float32Array(this.config.harmonicCount);
        this.buffers.harmonicRatios = new Float32Array(this.config.harmonicCount - 1);
        this.buffers.inharmonicity = 0;
        
        // Perceptual buffers
        this.buffers.loudness = new Float32Array(24); // Bark bands
        
        // Musical analysis buffers
        this.buffers.tonalCentroid = new Float32Array(6);
        this.buffers.keyProfile = new Float32Array(24); // 12 major + 12 minor
        this.buffers.chordProfile = new Float32Array(24); // Basic chord types
        this.buffers.modeProfile = new Float32Array(7); // Church modes
        
        // Feature history for temporal analysis
        this.buffers.featureHistory = new Array(historyLength);
        for (let i = 0; i < historyLength; i++) {
            this.buffers.featureHistory[i] = {
                timestamp: 0,
                mfcc: new Float32Array(mfccCoefficients),
                chroma: new Float32Array(chromaBins),
                spectral: { ...this.buffers.spectralFeatures },
                perceptual: { loudness: 0, sharpness: 0, roughness: 0 }
            };
        }
        
        console.log('Feature extraction buffers initialized');
    }
    
    /**
     * Load pre-trained models for advanced analysis
     */
    async loadPretrainedModels() {
        // Placeholder for loading ML models
        // In a full implementation, this would load neural networks
        // for genre classification, mood detection, etc.
        
        if (this.config.enableGenreFeatures) {
            try {
                // Load genre classification model
                // const genreModel = await this.loadGenreModel();
                console.log('Genre classification models ready');
            } catch (error) {
                console.warn('Failed to load genre models:', error);
            }
        }
    }
    
    /**
     * Main feature extraction function
     * @param {Object} audioData - Enhanced audio data from previous analysis modules
     * @returns {Object} Audio data with extracted features
     */
    analyze(audioData) {
        if (!this.isInitialized) {
            console.warn('FeatureExtractor not initialized');
            return audioData;
        }
        
        const startTime = performance.now();
        
        try {
            // Extract basic spectral data
            const spectralData = this.extractSpectralData(audioData);
            if (!spectralData) {
                return audioData;
            }
            
            // Extract MFCC features
            const mfccStartTime = performance.now();
            const mfccFeatures = this.extractMFCCFeatures(spectralData);
            this.performanceMetrics.mfccTime = performance.now() - mfccStartTime;
            
            // Extract chromagram features
            const chromaStartTime = performance.now();
            const chromaFeatures = this.extractChromaFeatures(spectralData);
            this.performanceMetrics.chromaTime = performance.now() - chromaStartTime;
            
            // Extract spectral features
            const spectralStartTime = performance.now();
            const spectralFeatures = this.extractSpectralFeatures(spectralData);
            this.performanceMetrics.spectralTime = performance.now() - spectralStartTime;
            
            // Extract harmonic features
            const harmonicStartTime = performance.now();
            const harmonicFeatures = this.extractHarmonicFeatures(spectralData);
            this.performanceMetrics.harmonicTime = performance.now() - harmonicStartTime;
            
            // Extract perceptual features
            const perceptualStartTime = performance.now();
            const perceptualFeatures = this.extractPerceptualFeatures(spectralData);
            this.performanceMetrics.perceptualTime = performance.now() - perceptualStartTime;
            
            // Extract musical features
            const musicalStartTime = performance.now();
            const musicalFeatures = this.extractMusicalFeatures(chromaFeatures, harmonicFeatures);
            this.performanceMetrics.musicalTime = performance.now() - musicalStartTime;
            
            // Extract temporal features
            const temporalFeatures = this.extractTemporalFeatures(audioData);
            
            // Extract genre features (if enabled)
            let genreFeatures = {};
            if (this.config.enableGenreFeatures) {
                genreFeatures = this.extractGenreFeatures({
                    mfcc: mfccFeatures,
                    spectral: spectralFeatures,
                    harmonic: harmonicFeatures,
                    temporal: temporalFeatures
                });
            }
            
            // Update feature history
            this.updateFeatureHistory({
                mfcc: mfccFeatures,
                chroma: chromaFeatures,
                spectral: spectralFeatures,
                perceptual: perceptualFeatures
            });
            
            // Update feature statistics
            this.updateFeatureStatistics({
                mfcc: mfccFeatures,
                spectral: spectralFeatures,
                perceptual: perceptualFeatures
            });
            
            // Update performance metrics
            const totalTime = performance.now() - startTime;
            this.updatePerformanceMetrics(totalTime);
            
            // Create enhanced output
            const enhancedOutput = this.createEnhancedOutput(audioData, {
                mfcc: mfccFeatures,
                chroma: chromaFeatures,
                spectral: spectralFeatures,
                harmonic: harmonicFeatures,
                perceptual: perceptualFeatures,
                musical: musicalFeatures,
                temporal: temporalFeatures,
                genre: genreFeatures
            });
            
            this.frameCounter++;
            
            return enhancedOutput;
            
        } catch (error) {
            console.error('Feature extraction error:', error);
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
     * Extract MFCC features
     */
    extractMFCCFeatures(spectralData) {
        // Apply mel filter bank
        const melSpectrum = new Float32Array(this.filterBanks.mel.length);
        
        for (let m = 0; m < this.filterBanks.mel.length; m++) {
            let melValue = 0;
            for (let k = 0; k < spectralData.magnitude.length; k++) {
                melValue += spectralData.magnitude[k] * this.filterBanks.mel[m][k];
            }
            melSpectrum[m] = Math.max(melValue, 1e-10); // Avoid log(0)
        }
        
        // Store mel spectrum
        this.buffers.melSpectrum.set(melSpectrum);
        
        // Compute log mel spectrum
        const logMelSpectrum = new Float32Array(melSpectrum.length);
        for (let i = 0; i < melSpectrum.length; i++) {
            logMelSpectrum[i] = Math.log(melSpectrum[i]);
        }
        
        // Compute MFCCs using DCT
        const mfcc = this.computeMFCC(logMelSpectrum);
        this.buffers.mfcc.set(mfcc);
        
        // Apply liftering
        this.applyLiftering(this.buffers.mfcc);
        
        // Compute delta and delta-delta features
        const deltaMfcc = this.computeDeltaFeatures(this.buffers.mfcc, 'mfcc');
        const deltaDeltaMfcc = this.computeDeltaFeatures(deltaMfcc, 'deltaMfcc');
        
        this.buffers.deltaMfcc.set(deltaMfcc);
        this.buffers.deltaDeltaMfcc.set(deltaDeltaMfcc);
        
        // Resample for AudioEngine compatibility
        this.resampleMelSpectrogram(melSpectrum);
        
        return {
            mfcc: new Float32Array(this.buffers.mfcc),
            deltaMfcc: new Float32Array(this.buffers.deltaMfcc),
            deltaDeltaMfcc: new Float32Array(this.buffers.deltaDeltaMfcc),
            melSpectrum: new Float32Array(this.buffers.melSpectrum),
            melSpectrogram: new Float32Array(this.buffers.melSpectrogram)
        };
    }
    
    /**
     * Compute MFCC coefficients using DCT
     */
    computeMFCC(logMelSpectrum) {
        const numCoeffs = this.config.mfccCoefficients;
        const numFilters = logMelSpectrum.length;
        const mfcc = new Float32Array(numCoeffs);
        
        for (let c = 0; c < numCoeffs; c++) {
            let sum = 0;
            for (let m = 0; m < numFilters; m++) {
                sum += logMelSpectrum[m] * Math.cos(Math.PI * c * (m + 0.5) / numFilters);
            }
            mfcc[c] = sum * Math.sqrt(2 / numFilters);
        }
        
        return mfcc;
    }
    
    /**
     * Apply liftering to MFCC coefficients
     */
    applyLiftering(mfcc) {
        const lifterParam = this.config.lifterParam;
        
        for (let c = 1; c < mfcc.length; c++) {
            const lifter = 1 + (lifterParam / 2) * Math.sin(Math.PI * c / lifterParam);
            mfcc[c] *= lifter;
        }
    }
    
    /**
     * Extract chromagram features
     */
    extractChromaFeatures(spectralData) {
        // Apply chroma filter bank
        const chromaVector = new Float32Array(this.config.chromaBins);
        
        for (let c = 0; c < this.config.chromaBins; c++) {
            let chromaValue = 0;
            for (let k = 0; k < spectralData.magnitude.length; k++) {
                chromaValue += spectralData.magnitude[k] * this.filterBanks.chroma[c][k];
            }
            chromaVector[c] = chromaValue;
        }
        
        // Store raw chroma vector
        this.buffers.chromaVector.set(chromaVector);
        
        // Normalize chroma vector
        const chromaSum = chromaVector.reduce((sum, val) => sum + val, 0);
        if (chromaSum > 0) {
            for (let c = 0; c < this.config.chromaBins; c++) {
                this.buffers.chroma[c] = chromaVector[c] / chromaSum;
            }
        } else {
            this.buffers.chroma.fill(1 / this.config.chromaBins);
        }
        
        // Apply temporal smoothing
        this.applyTemporalSmoothing(this.buffers.chroma, 'chroma');
        
        // Compute normalized chroma (for key detection)
        this.computeNormalizedChroma();
        
        return {
            chroma: new Float32Array(this.buffers.chroma),
            chromaVector: new Float32Array(this.buffers.chromaVector),
            chromaNormalized: new Float32Array(this.buffers.chromaNormalized)
        };
    }
    
    /**
     * Extract comprehensive spectral features
     */
    extractSpectralFeatures(spectralData) {
        const magnitude = spectralData.magnitude;
        const powerSpectrum = spectralData.powerSpectrum;
        const frequencies = spectralData.frequencies;
        
        const features = {};
        
        // Spectral centroid (brightness)
        features.centroid = this.calculateSpectralCentroid(magnitude, frequencies);
        
        // Spectral bandwidth (spread around centroid)
        features.bandwidth = this.calculateSpectralBandwidth(magnitude, frequencies, features.centroid);
        
        // Spectral rolloff (85% energy point)
        features.rolloff = this.calculateSpectralRolloff(powerSpectrum, frequencies);
        
        // Spectral flatness (Wiener entropy)
        features.flatness = this.calculateSpectralFlatness(magnitude);
        
        // Spectral skewness (asymmetry)
        features.skewness = this.calculateSpectralSkewness(magnitude, frequencies, features.centroid);
        
        // Spectral kurtosis (peakedness)
        features.kurtosis = this.calculateSpectralKurtosis(magnitude, frequencies, features.centroid);
        
        // Spectral slope (tilt)
        features.slope = this.calculateSpectralSlope(magnitude, frequencies);
        
        // Spectral decrease
        features.decrease = this.calculateSpectralDecrease(magnitude);
        
        // Spectral spread (alternative bandwidth measure)
        features.spread = this.calculateSpectralSpread(magnitude, frequencies);
        
        // High frequency content
        features.hfc = this.calculateHighFrequencyContent(magnitude);
        
        // Spectral irregularity
        features.irregularity = this.calculateSpectralIrregularity(magnitude);
        
        // Band-specific energies
        features.bandEnergies = this.calculateBandEnergies(magnitude, frequencies);
        
        // Store in buffers
        Object.assign(this.buffers.spectralFeatures, features);
        this.buffers.bandEnergies.set(features.bandEnergies);
        
        return features;
    }
    
    /**
     * Calculate spectral centroid
     */
    calculateSpectralCentroid(magnitude, frequencies) {
        let weightedSum = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < magnitude.length; i++) {
            weightedSum += frequencies[i] * magnitude[i];
            magnitudeSum += magnitude[i];
        }
        
        return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    }
    
    /**
     * Calculate spectral bandwidth
     */
    calculateSpectralBandwidth(magnitude, frequencies, centroid) {
        let weightedVariance = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < magnitude.length; i++) {
            const diff = frequencies[i] - centroid;
            weightedVariance += diff * diff * magnitude[i];
            magnitudeSum += magnitude[i];
        }
        
        return magnitudeSum > 0 ? Math.sqrt(weightedVariance / magnitudeSum) : 0;
    }
    
    /**
     * Calculate spectral rolloff
     */
    calculateSpectralRolloff(powerSpectrum, frequencies, threshold = 0.85) {
        const totalEnergy = powerSpectrum.reduce((sum, val) => sum + val, 0);
        const rolloffThreshold = totalEnergy * threshold;
        
        let cumulativeEnergy = 0;
        for (let i = 0; i < powerSpectrum.length; i++) {
            cumulativeEnergy += powerSpectrum[i];
            if (cumulativeEnergy >= rolloffThreshold) {
                return frequencies[i];
            }
        }
        
        return frequencies[frequencies.length - 1];
    }
    
    /**
     * Calculate spectral flatness (Wiener entropy)
     */
    calculateSpectralFlatness(magnitude) {
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
        
        if (validBins === 0) return 0;
        
        geometricMean = Math.pow(geometricMean, 1 / validBins);
        arithmeticMean /= validBins;
        
        return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
    }
    
    /**
     * Calculate spectral skewness
     */
    calculateSpectralSkewness(magnitude, frequencies, centroid) {
        let thirdMoment = 0;
        let variance = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < magnitude.length; i++) {
            const diff = frequencies[i] - centroid;
            thirdMoment += Math.pow(diff, 3) * magnitude[i];
            variance += diff * diff * magnitude[i];
            magnitudeSum += magnitude[i];
        }
        
        if (magnitudeSum === 0 || variance === 0) return 0;
        
        thirdMoment /= magnitudeSum;
        variance /= magnitudeSum;
        
        const standardDev = Math.sqrt(variance);
        return standardDev > 0 ? thirdMoment / Math.pow(standardDev, 3) : 0;
    }
    
    /**
     * Calculate spectral kurtosis
     */
    calculateSpectralKurtosis(magnitude, frequencies, centroid) {
        let fourthMoment = 0;
        let variance = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < magnitude.length; i++) {
            const diff = frequencies[i] - centroid;
            fourthMoment += Math.pow(diff, 4) * magnitude[i];
            variance += diff * diff * magnitude[i];
            magnitudeSum += magnitude[i];
        }
        
        if (magnitudeSum === 0 || variance === 0) return 0;
        
        fourthMoment /= magnitudeSum;
        variance /= magnitudeSum;
        
        return (fourthMoment / (variance * variance)) - 3;
    }
    
    /**
     * Calculate spectral slope
     */
    calculateSpectralSlope(magnitude, frequencies) {
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
        
        return denominator > 0 ? numerator / denominator : 0;
    }
    
    /**
     * Calculate spectral decrease
     */
    calculateSpectralDecrease(magnitude) {
        let decrease = 0;
        const k1_magnitude = magnitude[0];
        
        for (let i = 1; i < magnitude.length; i++) {
            decrease += (magnitude[i] - k1_magnitude) / i;
        }
        
        return k1_magnitude > 0 ? decrease / k1_magnitude : 0;
    }
    
    /**
     * Calculate spectral spread
     */
    calculateSpectralSpread(magnitude, frequencies) {
        const centroid = this.calculateSpectralCentroid(magnitude, frequencies);
        let spread = 0;
        let magnitudeSum = 0;
        
        for (let i = 0; i < magnitude.length; i++) {
            const diff = frequencies[i] - centroid;
            spread += diff * diff * magnitude[i];
            magnitudeSum += magnitude[i];
        }
        
        return magnitudeSum > 0 ? spread / magnitudeSum : 0;
    }
    
    /**
     * Calculate high frequency content
     */
    calculateHighFrequencyContent(magnitude) {
        let hfc = 0;
        for (let i = 0; i < magnitude.length; i++) {
            hfc += (i + 1) * magnitude[i];
        }
        return hfc;
    }
    
    /**
     * Calculate spectral irregularity
     */
    calculateSpectralIrregularity(magnitude) {
        let irregularity = 0;
        
        for (let i = 1; i < magnitude.length - 1; i++) {
            irregularity += Math.abs(magnitude[i] - (magnitude[i-1] + magnitude[i+1]) / 2);
        }
        
        return irregularity / (magnitude.length - 2);
    }
    
    /**
     * Calculate energy in frequency bands
     */
    calculateBandEnergies(magnitude, frequencies) {
        const bandEnergies = new Float32Array(this.config.spectralBands.length);
        
        this.config.spectralBands.forEach((band, index) => {
            let energy = 0;
            let count = 0;
            
            for (let i = 0; i < frequencies.length; i++) {
                if (frequencies[i] >= band.min && frequencies[i] <= band.max) {
                    energy += magnitude[i] * magnitude[i];
                    count++;
                }
            }
            
            bandEnergies[index] = count > 0 ? energy / count : 0;
        });
        
        return bandEnergies;
    }
    
    /**
     * Extract harmonic features
     */
    extractHarmonicFeatures(spectralData) {
        const magnitude = spectralData.magnitude;
        const frequencies = spectralData.frequencies;
        
        // Find fundamental frequency
        const fundamental = this.findFundamentalFrequency(magnitude, frequencies);
        
        // Extract harmonic amplitudes
        const harmonics = this.extractHarmonics(magnitude, frequencies, fundamental);
        this.buffers.harmonics.set(harmonics);
        
        // Calculate harmonic ratios
        const harmonicRatios = this.calculateHarmonicRatios(harmonics);
        this.buffers.harmonicRatios.set(harmonicRatios);
        
        // Calculate inharmonicity
        const inharmonicity = this.calculateInharmonicity(magnitude, frequencies, fundamental);
        this.buffers.inharmonicity = inharmonicity;
        
        // Calculate harmonic-to-noise ratio
        const hnr = this.calculateHarmonicToNoiseRatio(magnitude, harmonics);
        
        return {
            fundamental: fundamental,
            harmonics: new Float32Array(harmonics),
            harmonicRatios: new Float32Array(harmonicRatios),
            inharmonicity: inharmonicity,
            harmonicToNoiseRatio: hnr,
            harmonicStrength: harmonics.reduce((sum, h) => sum + h, 0) / harmonics.length
        };
    }
    
    /**
     * Find fundamental frequency using autocorrelation
     */
    findFundamentalFrequency(magnitude, frequencies) {
        const minFreq = this.config.fundamentalMinFreq;
        const maxFreq = this.config.fundamentalMaxFreq;
        
        let maxAmplitude = 0;
        let fundamentalFreq = 0;
        
        for (let i = 0; i < frequencies.length; i++) {
            const freq = frequencies[i];
            
            if (freq >= minFreq && freq <= maxFreq && magnitude[i] > maxAmplitude) {
                maxAmplitude = magnitude[i];
                fundamentalFreq = freq;
            }
        }
        
        return fundamentalFreq;
    }
    
    /**
     * Extract harmonic amplitudes
     */
    extractHarmonics(magnitude, frequencies, fundamental) {
        const harmonics = new Float32Array(this.config.harmonicCount);
        
        if (fundamental <= 0) return harmonics;
        
        for (let h = 1; h <= this.config.harmonicCount; h++) {
            const harmonicFreq = fundamental * h;
            const binIndex = this.findClosestBin(frequencies, harmonicFreq);
            
            if (binIndex >= 0) {
                harmonics[h - 1] = magnitude[binIndex];
            }
        }
        
        return harmonics;
    }
    
    /**
     * Calculate harmonic ratios
     */
    calculateHarmonicRatios(harmonics) {
        const ratios = new Float32Array(harmonics.length - 1);
        
        for (let i = 1; i < harmonics.length; i++) {
            ratios[i - 1] = harmonics[0] > 0 ? harmonics[i] / harmonics[0] : 0;
        }
        
        return ratios;
    }
    
    /**
     * Calculate inharmonicity coefficient
     */
    calculateInharmonicity(magnitude, frequencies, fundamental) {
        if (fundamental <= 0) return 0;
        
        let inharmonicity = 0;
        let count = 0;
        
        for (let h = 2; h <= this.config.harmonicCount; h++) {
            const expectedFreq = fundamental * h;
            const actualBin = this.findPeakNear(magnitude, frequencies, expectedFreq, fundamental * 0.1);
            
            if (actualBin >= 0) {
                const actualFreq = frequencies[actualBin];
                const deviation = Math.abs(actualFreq - expectedFreq) / expectedFreq;
                inharmonicity += deviation;
                count++;
            }
        }
        
        return count > 0 ? inharmonicity / count : 0;
    }
    
    /**
     * Calculate harmonic-to-noise ratio
     */
    calculateHarmonicToNoiseRatio(magnitude, harmonics) {
        const harmonicEnergy = harmonics.reduce((sum, h) => sum + h * h, 0);
        const totalEnergy = magnitude.reduce((sum, m) => sum + m * m, 0);
        const noiseEnergy = totalEnergy - harmonicEnergy;
        
        return noiseEnergy > 0 ? 10 * Math.log10(harmonicEnergy / noiseEnergy) : Infinity;
    }
    
    /**
     * Extract perceptual features
     */
    extractPerceptualFeatures(spectralData) {
        const magnitude = spectralData.magnitude;
        const frequencies = spectralData.frequencies;
        
        // Loudness analysis using Bark bands
        const loudness = this.calculateLoudness(magnitude, frequencies);
        this.buffers.loudness.set(loudness);
        
        // Sharpness (brightness perception)
        const sharpness = this.calculateSharpness(magnitude, frequencies);
        this.buffers.sharpness = sharpness;
        
        // Roughness (perceived dissonance)
        const roughness = this.calculateRoughness(magnitude, frequencies);
        this.buffers.roughness = roughness;
        
        // Fluctuation strength (amplitude modulation perception)
        const fluctuationStrength = this.calculateFluctuationStrength(magnitude);
        this.buffers.fluctuationStrength = fluctuationStrength;
        
        return {
            loudness: new Float32Array(loudness),
            totalLoudness: loudness.reduce((sum, l) => sum + l, 0),
            sharpness: sharpness,
            roughness: roughness,
            fluctuationStrength: fluctuationStrength
        };
    }
    
    /**
     * Calculate loudness using psychoacoustic models
     */
    calculateLoudness(magnitude, frequencies) {
        const loudness = new Float32Array(this.filterBanks.bark.length);
        
        for (let b = 0; b < this.filterBanks.bark.length; b++) {
            let bandLoudness = 0;
            
            for (let k = 0; k < magnitude.length; k++) {
                const freq = frequencies[k];
                const loudnessWeight = this.calculateLoudnessWeight(freq);
                bandLoudness += magnitude[k] * loudnessWeight * this.filterBanks.bark[b][k];
            }
            
            // Apply Stevens' power law
            loudness[b] = Math.pow(Math.max(bandLoudness, 1e-10), 0.67);
        }
        
        return loudness;
    }
    
    /**
     * Calculate sharpness (Aures model)
     */
    calculateSharpness(magnitude, frequencies) {
        let weightedSum = 0;
        let totalSum = 0;
        
        for (let i = 0; i < magnitude.length; i++) {
            const freq = frequencies[i];
            const sharpnessWeight = this.calculateSharpnessWeight(freq);
            
            weightedSum += magnitude[i] * sharpnessWeight;
            totalSum += magnitude[i];
        }
        
        return totalSum > 0 ? weightedSum / totalSum : 0;
    }
    
    /**
     * Calculate roughness
     */
    calculateRoughness(magnitude, frequencies) {
        let roughness = 0;
        
        // Look for beating patterns between frequency components
        for (let i = 0; i < magnitude.length - 1; i++) {
            for (let j = i + 1; j < Math.min(i + 50, magnitude.length); j++) {
                const freq1 = frequencies[i];
                const freq2 = frequencies[j];
                const beatFreq = Math.abs(freq2 - freq1);
                
                const roughnessWeight = this.calculateRoughnessWeight(beatFreq);
                const componentRoughness = magnitude[i] * magnitude[j] * roughnessWeight;
                
                roughness += componentRoughness;
            }
        }
        
        return roughness;
    }
    
    /**
     * Calculate fluctuation strength
     */
    calculateFluctuationStrength(magnitude) {
        // Simplified implementation based on temporal envelope modulation
        const recentFrames = this.buffers.featureHistory.slice(0, 10);
        
        if (recentFrames.length < 2) return 0;
        
        let modulation = 0;
        for (let i = 1; i < recentFrames.length; i++) {
            const currentEnergy = magnitude.reduce((sum, m) => sum + m * m, 0);
            const previousEnergy = recentFrames[i].spectral.energy || 0;
            
            modulation += Math.abs(currentEnergy - previousEnergy);
        }
        
        return modulation / recentFrames.length;
    }
    
    /**
     * Extract musical features
     */
    extractMusicalFeatures(chromaFeatures, harmonicFeatures) {
        // Key detection
        const keyAnalysis = this.detectKey(chromaFeatures.chromaNormalized);
        
        // Chord detection
        const chordAnalysis = this.detectChord(chromaFeatures.chroma);
        
        // Mode detection
        const modeAnalysis = this.detectMode(chromaFeatures.chroma);
        
        // Tonal centroid
        const tonalCentroid = this.calculateTonalCentroid(chromaFeatures.chroma);
        this.buffers.tonalCentroid.set(tonalCentroid);
        
        return {
            key: keyAnalysis,
            chord: chordAnalysis,
            mode: modeAnalysis,
            tonalCentroid: new Float32Array(tonalCentroid),
            harmonicity: harmonicFeatures.harmonicStrength,
            consonance: this.calculateConsonance(chromaFeatures.chroma)
        };
    }
    
    /**
     * Detect musical key using template matching
     */
    detectKey(chromaNormalized) {
        const keyProfiles = this.musicalKnowledge.keyProfiles;
        let bestKey = { key: 'C', mode: 'major', confidence: 0 };
        
        for (const keyName in keyProfiles) {
            for (const mode of ['major', 'minor']) {
                const profile = keyProfiles[keyName][mode];
                const correlation = this.calculateCorrelation(chromaNormalized, profile);
                
                if (correlation > bestKey.confidence) {
                    bestKey = { key: keyName, mode: mode, confidence: correlation };
                }
            }
        }
        
        return bestKey;
    }
    
    /**
     * Detect chord using template matching
     */
    detectChord(chroma) {
        const chordTemplates = this.musicalKnowledge.chordTemplates;
        let bestChord = { root: 'C', quality: 'major', confidence: 0 };
        
        for (const chordName in chordTemplates) {
            const template = chordTemplates[chordName];
            const correlation = this.calculateCorrelation(chroma, template.pattern);
            
            if (correlation > bestChord.confidence) {
                bestChord = {
                    root: template.root,
                    quality: template.quality,
                    confidence: correlation
                };
            }
        }
        
        return bestChord;
    }
    
    /**
     * Extract temporal features
     */
    extractTemporalFeatures(audioData) {
        // Onset density
        const onsetDensity = this.calculateOnsetDensity(audioData);
        this.buffers.onsetDensity = onsetDensity;
        
        // Rhythmic regularity
        const rhythmicRegularity = this.calculateRhythmicRegularity(audioData);
        this.buffers.rhythmicRegularity = rhythmicRegularity;
        
        // Tempo consistency
        const tempoConsistency = this.calculateTempoConsistency(audioData);
        this.buffers.tempoConsistency = tempoConsistency;
        
        return {
            onsetDensity: onsetDensity,
            rhythmicRegularity: rhythmicRegularity,
            tempoConsistency: tempoConsistency,
            averageTempo: audioData.bpm || 120
        };
    }
    
    /**
     * Extract genre classification features
     */
    extractGenreFeatures(allFeatures) {
        if (!this.config.enableGenreFeatures) {
            return {};
        }
        
        // Combine relevant features for genre classification
        const genreVector = this.createGenreFeatureVector(allFeatures);
        
        // Apply genre classification model (placeholder)
        const genreScores = this.classifyGenre(genreVector);
        
        return {
            featureVector: genreVector,
            genreScores: genreScores,
            predictedGenre: this.findTopGenre(genreScores)
        };
    }
    
    /**
     * Helper functions for psychoacoustic modeling
     */
    
    frequencyToPitchClass(frequency) {
        const A4 = this.config.tuningFreq;
        const semitones = 12 * Math.log2(frequency / A4);
        return ((Math.round(semitones) % 12) + 12) % 12;
    }
    
    circularDistance(a, b, range) {
        const diff = Math.abs(a - b);
        return Math.min(diff, range - diff);
    }
    
    frequencyToBark(frequency) {
        return 13 * Math.atan(0.00076 * frequency) + 3.5 * Math.atan(Math.pow(frequency / 7500, 2));
    }
    
    barkToFrequency(bark) {
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
    
    getERBBandwidth(frequency) {
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
        const gz = this.frequencyToBark(frequency);
        if (gz < 15.8) {
            return 1;
        } else {
            return 0.066 * Math.exp(0.171 * gz);
        }
    }
    
    calculateRoughnessWeight(beatFrequency) {
        const f = beatFrequency;
        if (f < 20) return 0;
        return Math.pow(f / 70, 2) * Math.exp(-3.5 * f / 70);
    }
    
    /**
     * Utility functions
     */
    
    findClosestBin(frequencies, targetFreq) {
        let minDistance = Infinity;
        let closestBin = -1;
        
        for (let i = 0; i < frequencies.length; i++) {
            const distance = Math.abs(frequencies[i] - targetFreq);
            if (distance < minDistance) {
                minDistance = distance;
                closestBin = i;
            }
        }
        
        return closestBin;
    }
    
    findPeakNear(magnitude, frequencies, targetFreq, tolerance) {
        let maxAmplitude = 0;
        let peakBin = -1;
        
        for (let i = 0; i < frequencies.length; i++) {
            if (Math.abs(frequencies[i] - targetFreq) <= tolerance) {
                if (magnitude[i] > maxAmplitude) {
                    maxAmplitude = magnitude[i];
                    peakBin = i;
                }
            }
        }
        
        return peakBin;
    }
    
    calculateCorrelation(vector1, vector2) {
        let correlation = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < Math.min(vector1.length, vector2.length); i++) {
            correlation += vector1[i] * vector2[i];
            norm1 += vector1[i] * vector1[i];
            norm2 += vector2[i] * vector2[i];
        }
        
        const normProduct = Math.sqrt(norm1 * norm2);
        return normProduct > 0 ? correlation / normProduct : 0;
    }
    
    computeDeltaFeatures(features, bufferName) {
        const history = this.buffers.featureHistory;
        if (history.length < 2) return new Float32Array(features.length);
        
        const delta = new Float32Array(features.length);
        const previous = history[1][bufferName] || new Float32Array(features.length);
        
        for (let i = 0; i < features.length; i++) {
            delta[i] = features[i] - previous[i];
        }
        
        return delta;
    }
    
    applyTemporalSmoothing(buffer, bufferName, smoothing = 0.8) {
        const history = this.buffers.featureHistory;
        if (history.length === 0) return;
        
        const previous = history[0][bufferName];
        if (!previous) return;
        
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = MathUtils.lerp(previous[i], buffer[i], 1 - smoothing);
        }
    }
    
    computeNormalizedChroma() {
        const chroma = this.buffers.chroma;
        const normalized = this.buffers.chromaNormalized;
        
        // Apply log compression
        for (let i = 0; i < chroma.length; i++) {
            normalized[i] = Math.log(1 + chroma[i] * 1000);
        }
        
        // Normalize to unit vector
        const norm = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0));
        if (norm > 0) {
            for (let i = 0; i < normalized.length; i++) {
                normalized[i] /= norm;
            }
        }
    }
    
    resampleMelSpectrogram(melSpectrum) {
        // Resample to 128 bins for AudioEngine compatibility
        for (let i = 0; i < 128; i++) {
            const sourceIndex = Math.floor((i * melSpectrum.length) / 128);
            this.buffers.melSpectrogram[i] = melSpectrum[sourceIndex];
        }
    }
    
    /**
     * Feature history and statistics management
     */
    
    updateFeatureHistory(features) {
        // Shift history
        for (let i = this.buffers.featureHistory.length - 1; i > 0; i--) {
            const current = this.buffers.featureHistory[i];
            const previous = this.buffers.featureHistory[i - 1];
            
            current.timestamp = previous.timestamp;
            current.mfcc.set(previous.mfcc);
            current.chroma.set(previous.chroma);
            Object.assign(current.spectral, previous.spectral);
            Object.assign(current.perceptual, previous.perceptual);
        }
        
        // Add current frame
        const current = this.buffers.featureHistory[0];
        current.timestamp = performance.now();
        current.mfcc.set(features.mfcc.mfcc);
        current.chroma.set(features.chroma.chroma);
        Object.assign(current.spectral, features.spectral);
        current.perceptual.loudness = features.perceptual.totalLoudness;
        current.perceptual.sharpness = features.perceptual.sharpness;
        current.perceptual.roughness = features.perceptual.roughness;
    }
    
    updateFeatureStatistics(features) {
        this.featureStats.sampleCount++;
        
        // Update MFCC statistics
        this.updateVectorStatistics('mfcc', features.mfcc.mfcc);
        
        // Update spectral feature statistics
        Object.keys(features.spectral).forEach(key => {
            if (typeof features.spectral[key] === 'number') {
                this.updateScalarStatistics(key, features.spectral[key]);
            }
        });
        
        // Update perceptual feature statistics
        this.updateScalarStatistics('loudness', features.perceptual.totalLoudness);
        this.updateScalarStatistics('sharpness', features.perceptual.sharpness);
        this.updateScalarStatistics('roughness', features.perceptual.roughness);
    }
    
    updateVectorStatistics(name, vector) {
        if (!this.featureStats.means.has(name)) {
            this.featureStats.means.set(name, new Float32Array(vector.length));
            this.featureStats.variances.set(name, new Float32Array(vector.length));
            this.featureStats.mins.set(name, new Float32Array(vector.length).fill(Infinity));
            this.featureStats.maxs.set(name, new Float32Array(vector.length).fill(-Infinity));
        }
        
        const means = this.featureStats.means.get(name);
        const variances = this.featureStats.variances.get(name);
        const mins = this.featureStats.mins.get(name);
        const maxs = this.featureStats.maxs.get(name);
        
        for (let i = 0; i < vector.length; i++) {
            // Update running mean
            const delta = vector[i] - means[i];
            means[i] += delta / this.featureStats.sampleCount;
            
            // Update running variance (Welford's algorithm)
            const delta2 = vector[i] - means[i];
            variances[i] += delta * delta2;
            
            // Update min/max
            mins[i] = Math.min(mins[i], vector[i]);
            maxs[i] = Math.max(maxs[i], vector[i]);
        }
    }
    
    updateScalarStatistics(name, value) {
        if (!this.featureStats.means.has(name)) {
            this.featureStats.means.set(name, 0);
            this.featureStats.variances.set(name, 0);
            this.featureStats.mins.set(name, Infinity);
            this.featureStats.maxs.set(name, -Infinity);
        }
        
        const currentMean = this.featureStats.means.get(name);
        const currentVariance = this.featureStats.variances.get(name);
        
        // Update running mean
        const delta = value - currentMean;
        const newMean = currentMean + delta / this.featureStats.sampleCount;
        this.featureStats.means.set(name, newMean);
        
        // Update running variance
        const delta2 = value - newMean;
        this.featureStats.variances.set(name, currentVariance + delta * delta2);
        
        // Update min/max
        this.featureStats.mins.set(name, Math.min(this.featureStats.mins.get(name), value));
        this.featureStats.maxs.set(name, Math.max(this.featureStats.maxs.get(name), value));
    }
    
    /**
     * Musical knowledge base initialization
     */
    
    createKeyProfiles() {
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
    
    createChordTemplates() {
        const templates = {};
        const pitchClasses = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Major and minor triads
        const majorIntervals = [0, 4, 7]; // Root, major third, perfect fifth
        const minorIntervals = [0, 3, 7]; // Root, minor third, perfect fifth
        
        pitchClasses.forEach((root, rootIndex) => {
            // Major chord
            const majorPattern = new Float32Array(12);
            majorIntervals.forEach(interval => {
                majorPattern[(rootIndex + interval) % 12] = 1.0;
            });
            
            templates[`${root}_major`] = {
                root: root,
                quality: 'major',
                pattern: majorPattern
            };
            
            // Minor chord
            const minorPattern = new Float32Array(12);
            minorIntervals.forEach(interval => {
                minorPattern[(rootIndex + interval) % 12] = 1.0;
            });
            
            templates[`${root}_minor`] = {
                root: root,
                quality: 'minor',
                pattern: minorPattern
            };
        });
        
        return templates;
    }
    
    createScaleTemplates() {
        const templates = {};
        const modes = [
            { name: 'ionian', intervals: [0, 2, 4, 5, 7, 9, 11] },
            { name: 'dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
            { name: 'phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
            { name: 'lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
            { name: 'mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
            { name: 'aeolian', intervals: [0, 2, 3, 5, 7, 8, 10] },
            { name: 'locrian', intervals: [0, 1, 3, 5, 6, 8, 10] }
        ];
        
        modes.forEach(mode => {
            const pattern = new Float32Array(12);
            mode.intervals.forEach(interval => {
                pattern[interval] = 1.0;
            });
            
            templates[mode.name] = {
                name: mode.name,
                intervals: mode.intervals,
                pattern: pattern
            };
        });
        
        return templates;
    }
    
    createGenreModels() {
        // Placeholder for genre classification models
        // In a full implementation, this would load pre-trained ML models
        return {
            rock: { model: null, threshold: 0.5 },
            jazz: { model: null, threshold: 0.5 },
            classical: { model: null, threshold: 0.5 },
            electronic: { model: null, threshold: 0.5 },
            folk: { model: null, threshold: 0.5 }
        };
    }
    
    /**
     * Advanced analysis functions
     */
    
    calculateTonalCentroid(chroma) {
        // Tonnetz (tonal network) representation
        const centroid = new Float32Array(6);
        
        // Circle of fifths coordinates
        let cos_5ths = 0, sin_5ths = 0;
        let cos_3rds = 0, sin_3rds = 0;
        let cos_min3rds = 0, sin_min3rds = 0;
        
        for (let i = 0; i < 12; i++) {
            const weight = chroma[i];
            
            // Circle of fifths (multiply by 7 semitones, convert to radians)
            cos_5ths += weight * Math.cos(2 * Math.PI * i * 7 / 12);
            sin_5ths += weight * Math.sin(2 * Math.PI * i * 7 / 12);
            
            // Circle of major thirds (multiply by 4 semitones)
            cos_3rds += weight * Math.cos(2 * Math.PI * i * 4 / 12);
            sin_3rds += weight * Math.sin(2 * Math.PI * i * 4 / 12);
            
            // Circle of minor thirds (multiply by 3 semitones)
            cos_min3rds += weight * Math.cos(2 * Math.PI * i * 3 / 12);
            sin_min3rds += weight * Math.sin(2 * Math.PI * i * 3 / 12);
        }
        
        centroid[0] = cos_5ths;
        centroid[1] = sin_5ths;
        centroid[2] = cos_3rds;
        centroid[3] = sin_3rds;
        centroid[4] = cos_min3rds;
        centroid[5] = sin_min3rds;
        
        return centroid;
    }
    
    calculateConsonance(chroma) {
        // Calculate consonance based on interval relationships
        let consonance = 0;
        const consonantIntervals = [0, 3, 4, 5, 7, 8, 9]; // Unison, minor/major third, fourth, fifth, etc.
        
        for (let i = 0; i < 12; i++) {
            for (let j = i + 1; j < 12; j++) {
                const interval = j - i;
                if (consonantIntervals.includes(interval)) {
                    consonance += chroma[i] * chroma[j];
                }
            }
        }
        
        return consonance;
    }
    
    detectMode(chroma) {
        const scaleTemplates = this.musicalKnowledge.scaleTemplates;
        let bestMode = { name: 'ionian', confidence: 0 };
        
        Object.values(scaleTemplates).forEach(template => {
            const correlation = this.calculateCorrelation(chroma, template.pattern);
            if (correlation > bestMode.confidence) {
                bestMode = { name: template.name, confidence: correlation };
            }
        });
        
        return bestMode;
    }
    
    calculateOnsetDensity(audioData) {
        if (!audioData.beatAnalysis || !audioData.beatAnalysis.onsetHistory) {
            return 0;
        }
        
        const onsetHistory = audioData.beatAnalysis.onsetHistory;
        const timeWindow = this.config.temporalWindow * 1000; // Convert to milliseconds
        const currentTime = performance.now();
        
        // Count onsets in the time window
        const recentOnsets = onsetHistory.filter(onset => 
            currentTime - onset.timestamp < timeWindow
        );
        
        return recentOnsets.length / this.config.temporalWindow; // Onsets per second
    }
    
    calculateRhythmicRegularity(audioData) {
        if (!audioData.beatAnalysis || !audioData.beatAnalysis.rhythmPattern) {
            return 0;
        }
        
        const pattern = audioData.beatAnalysis.rhythmPattern;
        
        // Calculate variance of beat strengths
        const mean = pattern.reduce((sum, val) => sum + val, 0) / pattern.length;
        const variance = pattern.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pattern.length;
        
        // Regularity is inverse of variance (normalized)
        return 1 / (1 + variance);
    }
    
    calculateTempoConsistency(audioData) {
        if (!audioData.beatAnalysis || !audioData.beatAnalysis.tempoHypotheses) {
            return 0;
        }
        
        const tempoHypotheses = audioData.beatAnalysis.tempoHypotheses;
        
        // Find the strongest tempo hypothesis
        let maxConfidence = 0;
        tempoHypotheses.forEach(hypothesis => {
            maxConfidence = Math.max(maxConfidence, hypothesis.confidence);
        });
        
        return maxConfidence;
    }
    
    createGenreFeatureVector(allFeatures) {
        // Combine selected features for genre classification
        const vector = [];
        
        // MFCC features (first 13 coefficients)
        vector.push(...Array.from(allFeatures.mfcc.mfcc));
        
        // Spectral features
        vector.push(allFeatures.spectral.centroid);
        vector.push(allFeatures.spectral.bandwidth);
        vector.push(allFeatures.spectral.rolloff);
        vector.push(allFeatures.spectral.flatness);
        
        // Harmonic features
        vector.push(allFeatures.harmonic.harmonicStrength);
        vector.push(allFeatures.harmonic.inharmonicity);
        
        // Temporal features
        vector.push(allFeatures.temporal.onsetDensity);
        vector.push(allFeatures.temporal.rhythmicRegularity);
        vector.push(allFeatures.temporal.averageTempo);
        
        return new Float32Array(vector);
    }
    
    classifyGenre(featureVector) {
        // Placeholder genre classification
        // In a real implementation, this would use a trained ML model
        const genres = ['rock', 'jazz', 'classical', 'electronic', 'folk'];
        const scores = {};
        
        genres.forEach(genre => {
            // Simple heuristic-based classification
            scores[genre] = Math.random(); // Replace with actual model prediction
        });
        
        return scores;
    }
    
    findTopGenre(genreScores) {
        let topGenre = { name: 'unknown', score: 0 };
        
        Object.entries(genreScores).forEach(([genre, score]) => {
            if (score > topGenre.score) {
                topGenre = { name: genre, score: score };
            }
        });
        
        return topGenre;
    }
    
    /**
     * Create enhanced output with all extracted features
     */
    createEnhancedOutput(audioData, extractedFeatures) {
        return {
            ...audioData,
            
            // AudioEngine expected fields
            mfcc: extractedFeatures.mfcc.mfcc,
            chroma: extractedFeatures.chroma.chroma,
            melSpectrogram: extractedFeatures.mfcc.melSpectrogram,
            
            // Enhanced feature extraction data
            features: {
                // Mel-frequency analysis
                mfcc: {
                    coefficients: new Float32Array(extractedFeatures.mfcc.mfcc),
                    delta: new Float32Array(extractedFeatures.mfcc.deltaMfcc),
                    deltaDelta: new Float32Array(extractedFeatures.mfcc.deltaDeltaMfcc),
                    melSpectrum: new Float32Array(extractedFeatures.mfcc.melSpectrum),
                    melSpectrogram: new Float32Array(extractedFeatures.mfcc.melSpectrogram)
                },
                
                // Chromagram analysis
                chroma: {
                    vector: new Float32Array(extractedFeatures.chroma.chromaVector),
                    normalized: new Float32Array(extractedFeatures.chroma.chromaNormalized),
                    chroma: new Float32Array(extractedFeatures.chroma.chroma)
                },
                
                // Spectral characteristics
                spectral: { ...extractedFeatures.spectral },
                
                // Harmonic analysis
                harmonic: { ...extractedFeatures.harmonic },
                
                // Perceptual features
                perceptual: { ...extractedFeatures.perceptual },
                
                // Musical analysis
                musical: { ...extractedFeatures.musical },
                
                // Temporal features
                temporal: { ...extractedFeatures.temporal },
                
                // Genre classification
                ...(this.config.enableGenreFeatures && {
                    genre: { ...extractedFeatures.genre }
                })
            },
            
            // Feature statistics (for normalization)
            featureStats: {
                sampleCount: this.featureStats.sampleCount,
                means: Object.fromEntries(this.featureStats.means),
                variances: Object.fromEntries(this.featureStats.variances)
            },
            
            // Debug and visualization data
            ...(this.debugData.enabled && {
                featureDebug: {
                    spectralShape: [...this.debugData.spectralShape],
                    harmonicProfile: [...this.debugData.harmonicProfile],
                    chromaWheel: [...this.debugData.chromaWheel],
                    featureTimeline: { ...this.debugData.featureTimeline }
                }
            }),
            
            // Processing metadata
            featureProcessing: {
                extractionTime: this.performanceMetrics.extractionTime,
                frameNumber: this.frameCounter,
                analysisStartTime: this.analysisStartTime,
                performance: { ...this.performanceMetrics }
            }
        };
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(totalTime) {
        this.performanceMetrics.extractionTime = MathUtils.exponentialSmoothing(
            this.performanceMetrics.extractionTime,
            totalTime,
            0.1
        );
        
        // Calculate cache hit rate
        this.performanceMetrics.cacheHitRate = 
            this.cacheHits / Math.max(1, this.cacheHits + this.cacheMisses);
        
        // Report to global performance monitor
        performanceMonitor.recordCPUTime('audioProcessing', totalTime);
    }
    
    /**
     * Configuration and calibration
     */
    
    updateConfig(newConfig) {
        const needsReinit = 
            newConfig.mfccCoefficients !== this.config.mfccCoefficients ||
            newConfig.chromaBins !== this.config.chromaBins ||
            newConfig.melFilterBanks !== this.config.melFilterBanks;
        
        Object.assign(this.config, newConfig);
        
        if (needsReinit && this.isInitialized) {
            console.log('Reinitializing FeatureExtractor due to config changes');
            this.initializeFilterBanks();
            this.initializeBuffers();
        }
        
        // Update extractor configurations
        Object.values(this.extractors).forEach(extractor => {
            if (extractor && extractor.updateConfig) {
                extractor.updateConfig(this.config);
            }
        });
    }
    
    /**
     * Get comprehensive status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            frameCounter: this.frameCounter,
            config: { ...this.config },
            performance: { ...this.performanceMetrics },
            featureStats: {
                sampleCount: this.featureStats.sampleCount,
                featuresTracked: this.featureStats.means.size
            },
            extractors: Object.keys(this.extractors).map(name => ({
                name,
                enabled: this.extractors[name] !== null,
                initialized: this.extractors[name]?.isInitialized || false
            })),
            filterBanks: {
                mel: this.filterBanks.mel?.length || 0,
                chroma: this.filterBanks.chroma?.length || 0,
                bark: this.filterBanks.bark?.length || 0,
                erb: this.filterBanks.erb?.length || 0
            }
        };
    }
    
    /**
     * Export feature extraction data
     */
    exportData() {
        return {
            version: '1.0.0',
            timestamp: Date.now(),
            config: { ...this.config },
            featureStats: {
                sampleCount: this.featureStats.sampleCount,
                means: Object.fromEntries(this.featureStats.means),
                variances: Object.fromEntries(this.featureStats.variances),
                mins: Object.fromEntries(this.featureStats.mins),
                maxs: Object.fromEntries(this.featureStats.maxs)
            },
            performance: { ...this.performanceMetrics },
            musicalKnowledge: {
                keyProfiles: Object.keys(this.musicalKnowledge.keyProfiles || {}),
                chordTemplates: Object.keys(this.musicalKnowledge.chordTemplates || {}),
                scaleTemplates: Object.keys(this.musicalKnowledge.scaleTemplates || {})
            }
        };
    }
    
    /**
     * Event system
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
                    console.error(`Error in feature extractor event listener for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        console.log('Disposing FeatureExtractor...');
        
        // Dispose extractors
        Object.values(this.extractors).forEach(extractor => {
            if (extractor && extractor.dispose) {
                extractor.dispose();
            }
        });
        
        // Clear caches
        this.featureCache.clear();
        
        // Clear event listeners
        this.eventCallbacks.clear();
        
        // Clear buffers
        Object.keys(this.buffers).forEach(key => {
            this.buffers[key] = null;
        });
        
        // Clear filter banks
        Object.keys(this.filterBanks).forEach(key => {
            this.filterBanks[key] = null;
        });
        
        // Clear statistics
        this.featureStats.means.clear();
        this.featureStats.variances.clear();
        this.featureStats.mins.clear();
        this.featureStats.maxs.clear();
        
        this.isInitialized = false;
        this.audioContext = null;
        
        console.log('FeatureExtractor disposed');
    }
}

/**
 * Specialized feature extractor classes
 */

class MFCCExtractor {
    constructor(config, melFilterBank) {
        this.config = config;
        this.melFilterBank = melFilterBank;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

class ChromaExtractor {
    constructor(config, chromaFilterBank) {
        this.config = config;
        this.chromaFilterBank = chromaFilterBank;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

class SpectralFeatureExtractor {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

class HarmonicAnalyzer {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

class PerceptualFeatureExtractor {
    constructor(config, filterBanks) {
        this.config = config;
        this.filterBanks = filterBanks;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

class MusicalFeatureExtractor {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

class TemporalFeatureExtractor {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    
    dispose() {
        this.isInitialized = false;
    }
}

class GenreFeatureExtractor {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
    }
    
    async initialize() {
        this.isInitialized = true;
    }
    
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    
    dispose() {
        this.isInitialized = false;
    }
}