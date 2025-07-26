/**
 * File Upload Component - Advanced Audio File Upload with Drag & Drop
 * Comprehensive file handling for the GLSL music visualizer
 * Location: src/ui/components/FileUpload.js
 *
 * Features:
 * - Advanced drag & drop interface with visual feedback
 * - Multiple audio format support with validation
 * - Progress tracking and error handling
 * - Audio file analysis and metadata extraction
 * - Integration with AudioEngine and particle effects
 * - Batch upload support with queue management
 * - Accessibility compliance and keyboard navigation
 * - Mobile-friendly touch interface
 */

import { FileUtils } from '../../utils/FileUtils.js';
import { SpringSystem } from '../animations/SpringSystem.js';
import { particleUI } from '../animations/ParticleUI.js';
import { MathUtils } from '../../utils/MathUtils.js';
import { ColorUtils } from '../../utils/ColorUtils.js';
import { performanceMonitor } from '../../core/PerformanceMonitor.js';

export class FileUpload {
    constructor(options = {}) {
        // Configuration
        this.config = {
            // File handling
            maxFileSize: options.maxFileSize || FileUtils.MAX_SIZES.AUDIO,
            maxConcurrentUploads: options.maxConcurrentUploads || 3,
            supportedFormats: options.supportedFormats || FileUtils.SUPPORTED_AUDIO_FORMATS,
            enableBatchUpload: options.enableBatchUpload !== false,
            enableDragDrop: options.enableDragDrop !== false,
            
            // UI settings
            showPreview: options.showPreview !== false,
            showProgress: options.showProgress !== false,
            showMetadata: options.showMetadata !== false,
            enableParticleEffects: options.enableParticleEffects !== false,
            
            // Audio analysis
            enableAudioAnalysis: options.enableAudioAnalysis !== false,
            extractWaveform: options.extractWaveform !== false,
            extractSpectrum: options.extractSpectrum !== false,
            
            // Integration
            audioEngine: options.audioEngine || null,
            container: options.container || null,
            
            // Styling
            theme: options.theme || 'dark',
            accentColor: options.accentColor || '#00f5ff',
            borderRadius: options.borderRadius || '12px',
            
            // Accessibility
            enableKeyboardNavigation: options.enableKeyboardNavigation !== false,
            enableScreenReader: options.enableScreenReader !== false,
            
            // Debug
            enableDebug: options.enableDebug === true
        };
        
        // State management
        this.state = {
            isDragOver: false,
            isUploading: false,
            uploadQueue: [],
            completedUploads: [],
            failedUploads: [],
            currentFile: null,
            uploadProgress: 0,
            totalFiles: 0,
            processedFiles: 0
        };
        
        // DOM elements
        this.elements = {
            container: null,
            dropZone: null,
            fileInput: null,
            progressBar: null,
            progressText: null,
            previewArea: null,
            metadataPanel: null,
            errorPanel: null,
            fileList: null,
            browseButton: null,
            clearButton: null
        };
        
        // Event handlers (bound for proper context)
        this.handleDragEnter = this.handleDragEnter.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleFileSelect = this.handleFileSelect.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handlePaste = this.handlePaste.bind(this);
        
        // Animation system
        this.springSystem = new SpringSystem({
            enableAudioReactivity: false,
            targetFPS: 60
        });
        
        // File processing
        this.fileProcessor = {
            audioContext: null,
            processors: new Map(),
            analysisCache: new Map()
        };
        
        // Callbacks
        this.callbacks = {
            onFileSelect: options.onFileSelect || null,
            onUploadStart: options.onUploadStart || null,
            onUploadProgress: options.onUploadProgress || null,
            onUploadComplete: options.onUploadComplete || null,
            onUploadError: options.onUploadError || null,
            onAnalysisComplete: options.onAnalysisComplete || null
        };
        
        // Performance tracking
        this.performanceMetrics = {
            uploadStartTime: 0,
            processingTime: 0,
            averageUploadSpeed: 0,
            totalBytesProcessed: 0,
            cacheHitRate: 0
        };
        
        console.log('FileUpload component initialized', {
            maxFileSize: FileUtils.formatFileSize(this.config.maxFileSize),
            supportedFormats: this.config.supportedFormats.length,
            dragDrop: this.config.enableDragDrop,
            batchUpload: this.config.enableBatchUpload
        });
        
        this.initialize();
    }
    
    /**
     * Initialize the file upload component
     */
    async initialize() {
        try {
            // Create DOM structure
            this.createDOMStructure();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize audio context for analysis
            if (this.config.enableAudioAnalysis) {
                await this.initializeAudioContext();
            }
            
            // Setup particle effects
            if (this.config.enableParticleEffects) {
                this.setupParticleEffects();
            }
            
            // Start spring system
            this.springSystem.start();
            
            console.log('FileUpload component ready');
            
        } catch (error) {
            console.error('Failed to initialize FileUpload:', error);
            this.showError('Initialization failed', error.message);
        }
    }
    
    /**
     * Create the DOM structure for the upload component
     */
    createDOMStructure() {
        // Main container
        this.elements.container = this.config.container || this.createContainer();
        
        // Apply theme and styling
        this.applyTheme();
        
        // Create drop zone
        this.createDropZone();
        
        // Create file input
        this.createFileInput();
        
        // Create progress elements
        this.createProgressElements();
        
        // Create preview area
        if (this.config.showPreview) {
            this.createPreviewArea();
        }
        
        // Create metadata panel
        if (this.config.showMetadata) {
            this.createMetadataPanel();
        }
        
        // Create file list
        this.createFileList();
        
        // Create control buttons
        this.createControlButtons();
        
        // Create error panel
        this.createErrorPanel();
    }
    
    /**
     * Create main container element
     */
    createContainer() {
        const container = document.createElement('div');
        container.className = 'file-upload-container';
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'Audio file upload');
        
        // Add to DOM if no container specified
        if (!this.config.container) {
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    /**
     * Apply theme styling to the component
     */
    applyTheme() {
        const container = this.elements.container;
        const theme = this.config.theme;
        const accentColor = this.config.accentColor;
        
        // Add theme class
        container.classList.add(`file-upload-${theme}`);
        
        // Add CSS custom properties
        container.style.setProperty('--accent-color', accentColor);
        container.style.setProperty('--border-radius', this.config.borderRadius);
        
        // Inject CSS if not already present
        this.injectCSS();
    }
    
    /**
     * Inject component CSS styles
     */
    injectCSS() {
        const styleId = 'file-upload-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .file-upload-container {
                --accent-color: #00f5ff;
                --border-radius: 12px;
                --transition-duration: 0.3s;
                --shadow-color: rgba(0, 245, 255, 0.2);
                
                position: relative;
                max-width: 600px;
                margin: 0 auto;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                color: #ffffff;
            }
            
            .file-upload-dark {
                --bg-primary: #1a1a1a;
                --bg-secondary: #2a2a2a;
                --border-color: #404040;
                --text-primary: #ffffff;
                --text-secondary: #b0b0b0;
            }
            
            .file-upload-light {
                --bg-primary: #ffffff;
                --bg-secondary: #f5f5f5;
                --border-color: #e0e0e0;
                --text-primary: #333333;
                --text-secondary: #666666;
            }
            
            .file-drop-zone {
                position: relative;
                min-height: 200px;
                background: var(--bg-primary);
                border: 2px dashed var(--border-color);
                border-radius: var(--border-radius);
                padding: 40px 20px;
                text-align: center;
                cursor: pointer;
                transition: all var(--transition-duration) ease;
                overflow: hidden;
            }
            
            .file-drop-zone:hover,
            .file-drop-zone:focus-within {
                border-color: var(--accent-color);
                background: var(--bg-secondary);
                box-shadow: 0 0 20px var(--shadow-color);
                transform: translateY(-2px);
            }
            
            .file-drop-zone.drag-over {
                border-color: var(--accent-color);
                background: var(--bg-secondary);
                box-shadow: 0 0 30px var(--shadow-color);
                transform: scale(1.02);
            }
            
            .file-drop-zone.uploading {
                pointer-events: none;
                opacity: 0.7;
            }
            
            .file-input {
                position: absolute;
                opacity: 0;
                width: 100%;
                height: 100%;
                cursor: pointer;
            }
            
            .drop-zone-content {
                position: relative;
                z-index: 2;
            }
            
            .upload-icon {
                width: 48px;
                height: 48px;
                margin: 0 auto 16px;
                background: var(--accent-color);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                transition: transform var(--transition-duration) ease;
            }
            
            .file-drop-zone:hover .upload-icon {
                transform: scale(1.1) rotate(10deg);
            }
            
            .upload-text {
                font-size: 18px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 8px;
            }
            
            .upload-hint {
                font-size: 14px;
                color: var(--text-secondary);
                margin-bottom: 16px;
            }
            
            .supported-formats {
                font-size: 12px;
                color: var(--text-secondary);
                opacity: 0.8;
            }
            
            .progress-container {
                margin-top: 16px;
                opacity: 0;
                transition: opacity var(--transition-duration) ease;
            }
            
            .progress-container.visible {
                opacity: 1;
            }
            
            .progress-bar {
                width: 100%;
                height: 8px;
                background: var(--bg-secondary);
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--accent-color), #00d4ff);
                border-radius: 4px;
                width: 0%;
                transition: width 0.1s ease;
            }
            
            .progress-text {
                font-size: 12px;
                color: var(--text-secondary);
                text-align: center;
            }
            
            .file-list {
                margin-top: 16px;
                max-height: 300px;
                overflow-y: auto;
                border-radius: var(--border-radius);
                background: var(--bg-secondary);
                display: none;
            }
            
            .file-item {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--border-color);
                transition: background var(--transition-duration) ease;
            }
            
            .file-item:hover {
                background: var(--bg-primary);
            }
            
            .file-item:last-child {
                border-bottom: none;
            }
            
            .file-icon {
                width: 32px;
                height: 32px;
                background: var(--accent-color);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 12px;
                font-size: 16px;
            }
            
            .file-info {
                flex: 1;
                min-width: 0;
            }
            
            .file-name {
                font-size: 14px;
                font-weight: 500;
                color: var(--text-primary);
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .file-meta {
                font-size: 12px;
                color: var(--text-secondary);
            }
            
            .file-status {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
                text-transform: uppercase;
            }
            
            .file-status.success {
                background: rgba(0, 255, 100, 0.2);
                color: #00ff64;
            }
            
            .file-status.error {
                background: rgba(255, 50, 50, 0.2);
                color: #ff3232;
            }
            
            .file-status.processing {
                background: rgba(0, 245, 255, 0.2);
                color: var(--accent-color);
            }
            
            .control-buttons {
                display: flex;
                gap: 12px;
                margin-top: 16px;
                justify-content: center;
            }
            
            .control-button {
                padding: 8px 16px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--bg-secondary);
                color: var(--text-primary);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all var(--transition-duration) ease;
            }
            
            .control-button:hover {
                border-color: var(--accent-color);
                background: var(--accent-color);
                color: #000;
                transform: translateY(-1px);
            }
            
            .control-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            
            .error-panel {
                margin-top: 16px;
                padding: 12px 16px;
                background: rgba(255, 50, 50, 0.1);
                border: 1px solid #ff3232;
                border-radius: var(--border-radius);
                color: #ff3232;
                font-size: 14px;
                opacity: 0;
                transition: opacity var(--transition-duration) ease;
                display: none;
            }
            
            .error-panel.visible {
                opacity: 1;
                display: block;
            }
            
            .metadata-panel {
                margin-top: 16px;
                padding: 16px;
                background: var(--bg-secondary);
                border-radius: var(--border-radius);
                border: 1px solid var(--border-color);
                display: none;
            }
            
            .metadata-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }
            
            .metadata-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid var(--border-color);
            }
            
            .metadata-item:last-child {
                border-bottom: none;
            }
            
            .metadata-label {
                font-size: 12px;
                color: var(--text-secondary);
                font-weight: 500;
            }
            
            .metadata-value {
                font-size: 12px;
                color: var(--text-primary);
                font-family: monospace;
            }
            
            .preview-area {
                margin-top: 16px;
                padding: 16px;
                background: var(--bg-secondary);
                border-radius: var(--border-radius);
                border: 1px solid var(--border-color);
                display: none;
            }
            
            .waveform-container {
                height: 80px;
                background: var(--bg-primary);
                border-radius: 6px;
                margin-bottom: 12px;
                position: relative;
                overflow: hidden;
            }
            
            .waveform-canvas {
                width: 100%;
                height: 100%;
                display: block;
            }
            
            /* Accessibility */
            .file-drop-zone:focus-within {
                outline: 2px solid var(--accent-color);
                outline-offset: 2px;
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .file-upload-container {
                    margin: 0 16px;
                }
                
                .file-drop-zone {
                    min-height: 160px;
                    padding: 24px 16px;
                }
                
                .metadata-grid {
                    grid-template-columns: 1fr;
                }
                
                .control-buttons {
                    flex-direction: column;
                }
            }
            
            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                .file-drop-zone,
                .upload-icon,
                .control-button {
                    transition: none;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**
     * Create drop zone element
     */
    createDropZone() {
        this.elements.dropZone = document.createElement('div');
        this.elements.dropZone.className = 'file-drop-zone';
        this.elements.dropZone.setAttribute('tabindex', '0');
        this.elements.dropZone.setAttribute('role', 'button');
        this.elements.dropZone.setAttribute('aria-label', 'Click to select audio files or drag and drop');
        
        // Create drop zone content
        const content = document.createElement('div');
        content.className = 'drop-zone-content';
        
        // Upload icon
        const icon = document.createElement('div');
        icon.className = 'upload-icon';
        icon.innerHTML = '🎵';
        icon.setAttribute('aria-hidden', 'true');
        
        // Upload text
        const text = document.createElement('div');
        text.className = 'upload-text';
        text.textContent = 'Drop your music here';
        
        // Upload hint
        const hint = document.createElement('div');
        hint.className = 'upload-hint';
        hint.textContent = 'or click to browse files';
        
        // Supported formats
        const formats = document.createElement('div');
        formats.className = 'supported-formats';
        const formatList = this.config.supportedFormats
            .map(format => format.split('/')[1].toUpperCase())
            .join(', ');
        formats.textContent = `Supported: ${formatList}`;
        
        content.appendChild(icon);
        content.appendChild(text);
        content.appendChild(hint);
        content.appendChild(formats);
        
        this.elements.dropZone.appendChild(content);
        this.elements.container.appendChild(this.elements.dropZone);
    }
    
    /**
     * Create file input element
     */
    createFileInput() {
        this.elements.fileInput = document.createElement('input');
        this.elements.fileInput.type = 'file';
        this.elements.fileInput.className = 'file-input';
        this.elements.fileInput.accept = this.config.supportedFormats.join(',');
        this.elements.fileInput.multiple = this.config.enableBatchUpload;
        this.elements.fileInput.setAttribute('aria-label', 'Select audio files');
        
        this.elements.dropZone.appendChild(this.elements.fileInput);
    }
    
    /**
     * Create progress elements
     */
    createProgressElements() {
        // Progress container
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        
        // Progress bar
        this.elements.progressBar = document.createElement('div');
        this.elements.progressBar.className = 'progress-bar';
        this.elements.progressBar.setAttribute('role', 'progressbar');
        this.elements.progressBar.setAttribute('aria-label', 'Upload progress');
        
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        this.elements.progressBar.appendChild(progressFill);
        
        // Progress text
        this.elements.progressText = document.createElement('div');
        this.elements.progressText.className = 'progress-text';
        this.elements.progressText.textContent = 'Ready to upload';
        
        progressContainer.appendChild(this.elements.progressBar);
        progressContainer.appendChild(this.elements.progressText);
        
        this.elements.dropZone.appendChild(progressContainer);
    }
    
    /**
     * Create preview area for waveform display
     */
    createPreviewArea() {
        this.elements.previewArea = document.createElement('div');
        this.elements.previewArea.className = 'preview-area';
        
        // Waveform container
        const waveformContainer = document.createElement('div');
        waveformContainer.className = 'waveform-container';
        
        const waveformCanvas = document.createElement('canvas');
        waveformCanvas.className = 'waveform-canvas';
        waveformCanvas.setAttribute('aria-label', 'Audio waveform visualization');
        waveformContainer.appendChild(waveformCanvas);
        
        this.elements.previewArea.appendChild(waveformContainer);
        this.elements.container.appendChild(this.elements.previewArea);
        
        // Store canvas reference
        this.elements.waveformCanvas = waveformCanvas;
    }
    
    /**
     * Create metadata panel
     */
    createMetadataPanel() {
        this.elements.metadataPanel = document.createElement('div');
        this.elements.metadataPanel.className = 'metadata-panel';
        
        const title = document.createElement('h3');
        title.textContent = 'Audio Information';
        title.style.marginTop = '0';
        title.style.marginBottom = '16px';
        title.style.fontSize = '16px';
        title.style.fontWeight = '600';
        
        const metadataGrid = document.createElement('div');
        metadataGrid.className = 'metadata-grid';
        
        this.elements.metadataPanel.appendChild(title);
        this.elements.metadataPanel.appendChild(metadataGrid);
        this.elements.container.appendChild(this.elements.metadataPanel);
        
        this.elements.metadataGrid = metadataGrid;
    }
    
    /**
     * Create file list for batch uploads
     */
    createFileList() {
        this.elements.fileList = document.createElement('div');
        this.elements.fileList.className = 'file-list';
        this.elements.fileList.setAttribute('role', 'list');
        this.elements.fileList.setAttribute('aria-label', 'Uploaded files');
        
        this.elements.container.appendChild(this.elements.fileList);
    }
    
    /**
     * Create control buttons
     */
    createControlButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'control-buttons';
        
        // Browse button
        this.elements.browseButton = document.createElement('button');
        this.elements.browseButton.className = 'control-button';
        this.elements.browseButton.textContent = 'Browse Files';
        this.elements.browseButton.setAttribute('aria-label', 'Browse for audio files');
        
        // Clear button
        this.elements.clearButton = document.createElement('button');
        this.elements.clearButton.className = 'control-button';
        this.elements.clearButton.textContent = 'Clear All';
        this.elements.clearButton.disabled = true;
        this.elements.clearButton.setAttribute('aria-label', 'Clear all uploaded files');
        
        buttonContainer.appendChild(this.elements.browseButton);
        buttonContainer.appendChild(this.elements.clearButton);
        
        this.elements.container.appendChild(buttonContainer);
    }
    
    /**
     * Create error panel
     */
    createErrorPanel() {
        this.elements.errorPanel = document.createElement('div');
        this.elements.errorPanel.className = 'error-panel';
        this.elements.errorPanel.setAttribute('role', 'alert');
        this.elements.errorPanel.setAttribute('aria-live', 'polite');
        
        this.elements.container.appendChild(this.elements.errorPanel);
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Drag and drop events
        if (this.config.enableDragDrop) {
            this.elements.dropZone.addEventListener('dragenter', this.handleDragEnter);
            this.elements.dropZone.addEventListener('dragover', this.handleDragOver);
            this.elements.dropZone.addEventListener('dragleave', this.handleDragLeave);
            this.elements.dropZone.addEventListener('drop', this.handleDrop);
        }
        
        // File input events
        this.elements.fileInput.addEventListener('change', this.handleFileSelect);
        
        // Click events
        this.elements.dropZone.addEventListener('click', () => {
            this.elements.fileInput.click();
        });
        
        this.elements.browseButton.addEventListener('click', () => {
            this.elements.fileInput.click();
        });
        
        this.elements.clearButton.addEventListener('click', () => {
            this.clearAllFiles();
        });
        
        // Keyboard events
        if (this.config.enableKeyboardNavigation) {
            this.elements.dropZone.addEventListener('keypress', this.handleKeyPress);
            document.addEventListener('paste', this.handlePaste);
        }
        
        // Window events for global drag and drop
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => e.preventDefault());
    }
    
    /**
     * Initialize audio context for file analysis
     */
    async initializeAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.fileProcessor.audioContext = new AudioContext();
            console.log('Audio context initialized for file analysis');
        } catch (error) {
            console.warn('Failed to initialize audio context:', error);
            this.config.enableAudioAnalysis = false;
        }
    }
    
    /**
     * Setup particle effects for upload feedback
     */
    setupParticleEffects() {
        // Add particle effects to drop zone
        particleUI.attachToElement(this.elements.dropZone, [
            {
                trigger: 'hover',
                effect: 'hover'
            },
            {
                trigger: 'click',
                effect: 'click'
            }
        ]);
    }
    
    // ===== EVENT HANDLERS =====
    
    handleDragEnter(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.state.isDragOver = true;
        this.elements.dropZone.classList.add('drag-over');
        
        if (this.config.enableParticleEffects) {
            particleUI.emitAt(event.clientX, event.clientY, 0, 'energyFlow', 5);
        }
    }
    
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Update drag feedback
        event.dataTransfer.dropEffect = 'copy';
    }
    
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Only remove drag-over state if leaving the drop zone entirely
        if (!this.elements.dropZone.contains(event.relatedTarget)) {
            this.state.isDragOver = false;
            this.elements.dropZone.classList.remove('drag-over');
        }
    }
    
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.state.isDragOver = false;
        this.elements.dropZone.classList.remove('drag-over');
        
        const files = Array.from(event.dataTransfer.files);
        
        if (this.config.enableParticleEffects) {
            particleUI.emitAt(event.clientX, event.clientY, 0, 'success', 15);
        }
        
        this.processFiles(files);
    }
    
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
        
        // Reset input for reselection of same file
        event.target.value = '';
    }
    
    handleKeyPress(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.elements.fileInput.click();
        }
    }
    
    handlePaste(event) {
        const items = event.clipboardData?.items;
        if (!items) return;
        
        const files = [];
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file && this.isAudioFile(file)) {
                    files.push(file);
                }
            }
        }
        
        if (files.length > 0) {
            event.preventDefault();
            this.processFiles(files);
        }
    }
    
    // ===== FILE PROCESSING =====
    
    /**
     * Process uploaded files
     */
    async processFiles(files) {
        if (!files || files.length === 0) {
            this.showError('No files selected', 'Please select at least one audio file.');
            return;
        }
        
        // Filter and validate files
        const validFiles = [];
        const invalidFiles = [];
        
        for (const file of files) {
            try {
                if (this.isAudioFile(file)) {
                    FileUtils.validateAudioFile(file);
                    validFiles.push(file);
                } else {
                    invalidFiles.push({
                        file,
                        error: `Unsupported file type: ${file.type || 'unknown'}`
                    });
                }
            } catch (error) {
                invalidFiles.push({ file, error: error.message });
            }
        }
        
        // Show errors for invalid files
        if (invalidFiles.length > 0) {
            const errorMessages = invalidFiles.map(item => 
                `${item.file.name}: ${item.error}`
            ).join('\\n');
            this.showError('Invalid files detected', errorMessages);
        }
        
        // Process valid files
        if (validFiles.length > 0) {
            await this.uploadFiles(validFiles);
        }
    }
    
    /**
     * Check if file is a supported audio format
     */
    isAudioFile(file) {
        return this.config.supportedFormats.includes(file.type) ||
               file.type.startsWith('audio/');
    }
    
    /**
     * Upload and process files
     */
    async uploadFiles(files) {
        this.state.isUploading = true;
        this.state.uploadQueue = [...files];
        this.state.totalFiles = files.length;
        this.state.processedFiles = 0;
        this.state.uploadProgress = 0;
        
        // Update UI state
        this.showProgress();
        this.elements.dropZone.classList.add('uploading');
        this.elements.clearButton.disabled = true;
        
        // Track performance
        this.performanceMetrics.uploadStartTime = performance.now();
        
        try {
            // Process files sequentially for simplicity
            for (const file of files) {
                try {
                    await this.processFile(file);
                    this.state.completedUploads.push(file);
                } catch (error) {
                    console.error(`Failed to process ${file.name}:`, error);
                    this.state.failedUploads.push({ file, error: error.message });
                }
                
                this.state.processedFiles++;
                this.updateProgress();
            }
            
            // Upload complete
            this.state.isUploading = false;
            this.elements.dropZone.classList.remove('uploading');
            this.elements.clearButton.disabled = false;
            
            // Show success message
            if (this.state.completedUploads.length > 0) {
                this.updateProgressText(
                    `Successfully processed ${this.state.completedUploads.length} file(s)`
                );
                
                if (this.config.enableParticleEffects) {
                    particleUI.emitAt(
                        window.innerWidth / 2,
                        window.innerHeight / 2,
                        0,
                        'success',
                        20
                    );
                }
            }
            
            // Update file list
            this.updateFileList();
            
            // Report performance
            const totalTime = performance.now() - this.performanceMetrics.uploadStartTime;
            console.log(`File processing completed in ${totalTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('Upload process failed:', error);
            this.showError('Upload failed', error.message);
            this.state.isUploading = false;
            this.elements.dropZone.classList.remove('uploading');
            this.elements.clearButton.disabled = false;
        }
    }
    
    /**
     * Process individual file
     */
    async processFile(file) {
        this.state.currentFile = file;
        this.updateProgressText(`Processing ${file.name}...`);
        
        const startTime = performance.now();
        
        try {
            // Convert file to ArrayBuffer
            const arrayBuffer = await FileUtils.fileToArrayBuffer(file);
            
            let audioBuffer = null;
            let analysisData = null;
            
            // Decode audio if analysis is enabled
            if (this.config.enableAudioAnalysis && this.fileProcessor.audioContext) {
                try {
                    audioBuffer = await this.fileProcessor.audioContext.decodeAudioData(arrayBuffer);
                    
                    // Perform audio analysis
                    analysisData = await this.analyzeAudio(audioBuffer, file);
                } catch (decodeError) {
                    console.warn(`Failed to decode audio for ${file.name}:`, decodeError);
                    // Continue without analysis
                }
            }
            
            // Create file result object
            const result = {
                file,
                metadata: FileUtils.analyzeFile(file),
                arrayBuffer,
                audioBuffer,
                analysisData,
                processingTime: performance.now() - startTime
            };
            
            // Notify completion
            if (this.callbacks.onUploadComplete) {
                this.callbacks.onUploadComplete(result);
            }
            
            // Update preview if this is the first file
            if (this.state.completedUploads.length === 0) {
                this.updatePreview(result);
                this.updateMetadata(result);
            }
            
            return result;
            
        } catch (error) {
            console.error(`Failed to process file ${file.name}:`, error);
            throw error;
        }
    }
    
    /**
     * Analyze audio file
     */
    async analyzeAudio(audioBuffer, file) {
        if (!audioBuffer) return null;
        
        const analysisData = {
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            waveform: null,
            peaks: [],
            rms: 0
        };
        
        try {
            // Extract audio data for analysis
            const channelData = audioBuffer.getChannelData(0); // Use first channel
            
            // Calculate RMS (Root Mean Square) for loudness
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) {
                sum += channelData[i] * channelData[i];
            }
            analysisData.rms = Math.sqrt(sum / channelData.length);
            
            // Generate waveform if enabled
            if (this.config.extractWaveform) {
                analysisData.waveform = this.generateWaveform(channelData);
            }
            
            // Find peaks for visualization
            analysisData.peaks = this.findPeaks(channelData);
            
            // Notify analysis completion
            if (this.callbacks.onAnalysisComplete) {
                this.callbacks.onAnalysisComplete(analysisData, file);
            }
            
        } catch (error) {
            console.warn(`Audio analysis failed for ${file.name}:`, error);
        }
        
        return analysisData;
    }
    
    /**
     * Generate waveform data for visualization
     */
    generateWaveform(channelData, samples = 1000) {
        const waveform = new Float32Array(samples);
        const blockSize = Math.floor(channelData.length / samples);
        
        for (let i = 0; i < samples; i++) {
            const start = i * blockSize;
            const end = Math.min(start + blockSize, channelData.length);
            
            let sum = 0;
            for (let j = start; j < end; j++) {
                sum += Math.abs(channelData[j]);
            }
            
            waveform[i] = sum / (end - start);
        }
        
        return waveform;
    }
    
    /**
     * Find peaks in audio data
     */
    findPeaks(channelData, threshold = 0.5, minDistance = 1000) {
        const peaks = [];
        
        for (let i = minDistance; i < channelData.length - minDistance; i++) {
            const current = Math.abs(channelData[i]);
            
            if (current > threshold) {
                let isPeak = true;
                
                // Check if it's a local maximum
                for (let j = i - minDistance; j <= i + minDistance; j++) {
                    if (j !== i && Math.abs(channelData[j]) > current) {
                        isPeak = false;
                        break;
                    }
                }
                
                if (isPeak) {
                    peaks.push({
                        index: i,
                        time: i / 44100, // Assume 44.1kHz for time calculation
                        amplitude: current
                    });
                }
            }
        }
        
        return peaks.slice(0, 50); // Limit to 50 peaks
    }
    
    // ===== UI UPDATES =====
    
    /**
     * Show progress bar and update state
     */
    showProgress() {
        const progressContainer = this.elements.dropZone.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.classList.add('visible');
        }
    }
    
    /**
     * Hide progress bar
     */
    hideProgress() {
        const progressContainer = this.elements.dropZone.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.classList.remove('visible');
        }
    }
    
    /**
     * Update overall progress
     */
    updateProgress() {
        const progress = this.state.totalFiles > 0 ? 
            (this.state.processedFiles / this.state.totalFiles) * 100 : 0;
        
        this.state.uploadProgress = progress;
        
        const progressFill = this.elements.progressBar.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        this.elements.progressBar.setAttribute('aria-valuenow', progress);
        this.elements.progressBar.setAttribute('aria-valuemin', '0');
        this.elements.progressBar.setAttribute('aria-valuemax', '100');
        
        // Update text
        if (this.state.totalFiles > 1) {
            this.updateProgressText(
                `Processing ${this.state.processedFiles}/${this.state.totalFiles} files... ${Math.round(progress)}%`
            );
        }
    }
    
    /**
     * Update progress text
     */
    updateProgressText(text) {
        if (this.elements.progressText) {
            this.elements.progressText.textContent = text;
            this.elements.progressText.setAttribute('aria-live', 'polite');
        }
    }
    
    /**
     * Update file list display
     */
    updateFileList() {
        if (!this.config.enableBatchUpload) return;
        
        const allFiles = [...this.state.completedUploads, ...this.state.failedUploads.map(f => f.file)];
        
        if (allFiles.length === 0) {
            this.elements.fileList.style.display = 'none';
            return;
        }
        
        this.elements.fileList.style.display = 'block';
        this.elements.fileList.innerHTML = '';
        
        allFiles.forEach(file => {
            const fileItem = this.createFileItem(file);
            this.elements.fileList.appendChild(fileItem);
        });
    }
    
    /**
     * Create file item element for the list
     */
    createFileItem(file) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.fileName = file.name;
        item.setAttribute('role', 'listitem');
        
        // File icon
        const icon = document.createElement('div');
        icon.className = 'file-icon';
        icon.innerHTML = '🎵';
        icon.setAttribute('aria-hidden', 'true');
        
        // File info
        const info = document.createElement('div');
        info.className = 'file-info';
        
        const name = document.createElement('div');
        name.className = 'file-name';
        name.textContent = file.name;
        name.title = file.name; // Tooltip for long names
        
        const meta = document.createElement('div');
        meta.className = 'file-meta';
        meta.textContent = `${FileUtils.formatFileSize(file.size)} • ${file.type}`;
        
        info.appendChild(name);
        info.appendChild(meta);
        
        // Status
        const status = document.createElement('div');
        status.className = 'file-status processing';
        status.textContent = 'Processing...';
        
        // Check if file failed
        const failedFile = this.state.failedUploads.find(f => f.file === file);
        if (failedFile) {
            status.className = 'file-status error';
            status.textContent = 'Error';
            status.title = failedFile.error;
        } else if (this.state.completedUploads.includes(file)) {
            status.className = 'file-status success';
            status.textContent = 'Complete';
        }
        
        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(status);
        
        return item;
    }
    
    /**
     * Update preview display with waveform
     */
    updatePreview(result) {
        if (!this.config.showPreview || !result.analysisData) return;
        
        this.elements.previewArea.style.display = 'block';
        
        // Draw waveform
        if (result.analysisData.waveform && this.elements.waveformCanvas) {
            this.drawWaveform(result.analysisData.waveform);
        }
    }
    
    /**
     * Draw waveform on canvas
     */
    drawWaveform(waveformData) {
        const canvas = this.elements.waveformCanvas;
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // Draw waveform
        ctx.strokeStyle = this.config.accentColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const centerY = height / 2;
        const amplitudeScale = height * 0.4;
        
        for (let i = 0; i < waveformData.length; i++) {
            const x = (i / waveformData.length) * width;
            const y = centerY - (waveformData[i] * amplitudeScale);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Draw center line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
    }
    
    /**
     * Update metadata panel
     */
    updateMetadata(result) {
        if (!this.config.showMetadata || !this.elements.metadataGrid) return;
        
        this.elements.metadataPanel.style.display = 'block';
        this.elements.metadataGrid.innerHTML = '';
        
        const metadata = result.metadata;
        const analysisData = result.analysisData;
        
        // File metadata
        this.addMetadataItem('File Name', metadata.name);
        this.addMetadataItem('File Size', metadata.formattedSize);
        this.addMetadataItem('Type', metadata.type);
        this.addMetadataItem('Last Modified', metadata.lastModified.toLocaleDateString());
        
        // Audio metadata
        if (analysisData) {
            this.addMetadataItem('Duration', this.formatDuration(analysisData.duration));
            this.addMetadataItem('Sample Rate', `${analysisData.sampleRate} Hz`);
            this.addMetadataItem('Channels', analysisData.numberOfChannels);
            this.addMetadataItem('RMS Level', analysisData.rms.toFixed(4));
            this.addMetadataItem('Peaks Found', analysisData.peaks.length);
        }
        
        // Processing metadata
        this.addMetadataItem('Processing Time', `${result.processingTime.toFixed(2)} ms`);
    }
    
    /**
     * Add metadata item to grid
     */
    addMetadataItem(label, value) {
        const item = document.createElement('div');
        item.className = 'metadata-item';
        
        const labelEl = document.createElement('div');
        labelEl.className = 'metadata-label';
        labelEl.textContent = label;
        
        const valueEl = document.createElement('div');
        valueEl.className = 'metadata-value';
        valueEl.textContent = value;
        
        item.appendChild(labelEl);
        item.appendChild(valueEl);
        
        this.elements.metadataGrid.appendChild(item);
    }
    
    /**
     * Format duration in seconds to readable string
     */
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Show error message
     */
    showError(title, message) {
        this.elements.errorPanel.innerHTML = `
            <strong>${title}</strong><br>
            ${message}
        `;
        this.elements.errorPanel.classList.add('visible');
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.hideError();
        }, 10000);
        
        if (this.callbacks.onUploadError) {
            this.callbacks.onUploadError(title, message);
        }
    }
    
    /**
     * Hide error message
     */
    hideError() {
        this.elements.errorPanel.classList.remove('visible');
    }
    
    // ===== PUBLIC API =====
    
    /**
     * Clear all uploaded files
     */
    clearAllFiles() {
        this.state.uploadQueue = [];
        this.state.completedUploads = [];
        this.state.failedUploads = [];
        this.state.currentFile = null;
        this.state.uploadProgress = 0;
        this.state.totalFiles = 0;
        this.state.processedFiles = 0;
        
        // Update UI
        this.elements.fileList.style.display = 'none';
        if (this.elements.previewArea) {
            this.elements.previewArea.style.display = 'none';
        }
        if (this.elements.metadataPanel) {
            this.elements.metadataPanel.style.display = 'none';
        }
        this.hideProgress();
        this.hideError();
        
        this.updateProgressText('Ready to upload');
        this.elements.clearButton.disabled = true;
        
        console.log('All files cleared');
    }
    
    /**
     * Get all uploaded files
     */
    getUploadedFiles() {
        return this.state.completedUploads;
    }
    
    /**
     * Get upload statistics
     */
    getStatistics() {
        return {
            totalFiles: this.state.totalFiles,
            completedFiles: this.state.completedUploads.length,
            failedFiles: this.state.failedUploads.length,
            isUploading: this.state.isUploading,
            progress: this.state.uploadProgress,
            performance: this.performanceMetrics
        };
    }
    
    /**
     * Set callback functions
     */
    setCallbacks(callbacks) {
        Object.assign(this.callbacks, callbacks);
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        
        // Update file input accept attribute
        if (newConfig.supportedFormats) {
            this.elements.fileInput.accept = this.config.supportedFormats.join(',');
        }
    }
    
    /**
     * Destroy the component and clean up
     */
    destroy() {
        // Stop spring system
        if (this.springSystem) {
            this.springSystem.destroy();
        }
        
        // Remove event listeners
        if (this.elements.dropZone) {
            this.elements.dropZone.removeEventListener('dragenter', this.handleDragEnter);
            this.elements.dropZone.removeEventListener('dragover', this.handleDragOver);
            this.elements.dropZone.removeEventListener('dragleave', this.handleDragLeave);
            this.elements.dropZone.removeEventListener('drop', this.handleDrop);
            this.elements.dropZone.removeEventListener('keypress', this.handleKeyPress);
        }
        
        if (this.elements.fileInput) {
            this.elements.fileInput.removeEventListener('change', this.handleFileSelect);
        }
        
        document.removeEventListener('paste', this.handlePaste);
        
        // Close audio context
        if (this.fileProcessor.audioContext && this.fileProcessor.audioContext.state !== 'closed') {
            this.fileProcessor.audioContext.close();
        }
        
        // Clear data structures
        this.state.uploadQueue = [];
        this.state.completedUploads = [];
        this.state.failedUploads = [];
        this.fileProcessor.processors.clear();
        this.fileProcessor.analysisCache.clear();
        
        // Remove DOM elements
        if (this.elements.container && this.elements.container.parentNode) {
            this.elements.container.parentNode.removeChild(this.elements.container);
        }
        
        console.log('FileUpload component destroyed');
    }
}

// ===== HELPER FUNCTIONS =====

/**
 * Create a file upload instance with predefined configurations
 */
export function createFileUpload(container, options = {}) {
    return new FileUpload({
        container,
        ...options
    });
}

/**
 * Create a minimal file upload for quick integration
 */
export function createSimpleFileUpload(container, onFileSelect) {
    return new FileUpload({
        container,
        enableBatchUpload: false,
        enableAudioAnalysis: false,
        showPreview: false,
        showMetadata: false,
        enableParticleEffects: false,
        onUploadComplete: (result) => {
            if (onFileSelect) {
                onFileSelect(result);
            }
        }
    });
}

/**
 * Create an advanced file upload with full features
 */
export function createAdvancedFileUpload(container, callbacks = {}) {
    return new FileUpload({
        container,
        enableBatchUpload: true,
        enableAudioAnalysis: true,
        extractWaveform: true,
        extractSpectrum: true,
        showPreview: true,
        showMetadata: true,
        enableParticleEffects: true,
        enableKeyboardNavigation: true,
        enableScreenReader: true,
        ...callbacks
    });
}

/**
 * File upload preset configurations
 */
export const FileUploadPresets = {
    // Basic file selection only
    minimal: {
        enableDragDrop: false,
        enableBatchUpload: false,
        enableAudioAnalysis: false,
        showPreview: false,
        showMetadata: false,
        enableParticleEffects: false
    },
    
    // Standard file upload with basic features
    standard: {
        enableDragDrop: true,
        enableBatchUpload: true,
        enableAudioAnalysis: false,
        showPreview: false,
        showMetadata: true,
        enableParticleEffects: true
    },
    
    // Full-featured upload with analysis
    professional: {
        enableDragDrop: true,
        enableBatchUpload: true,
        enableAudioAnalysis: true,
        extractWaveform: true,
        extractSpectrum: true,
        showPreview: true,
        showMetadata: true,
        enableParticleEffects: true,
        enableKeyboardNavigation: true,
        enableScreenReader: true
    },
    
    // Mobile-optimized configuration
    mobile: {
        enableDragDrop: false, // Touch interfaces don't support drag/drop well
        enableBatchUpload: false,
        enableAudioAnalysis: true,
        extractWaveform: true,
        showPreview: true,
        showMetadata: false, // Reduce clutter on small screens
        enableParticleEffects: false, // Save performance
        enableKeyboardNavigation: false,
        theme: 'dark',
        borderRadius: '8px'
    }
};

// Export the main class and utilities
export { FileUpload, FileUtils };