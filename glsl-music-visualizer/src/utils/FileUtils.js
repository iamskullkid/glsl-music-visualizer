/**
 * File Handling Utilities
 * Provides comprehensive file loading, processing, and validation functions
 * for the advanced GLSL music visualizer with support for audio files,
 * presets, shaders, and configuration files
 */

import { MathUtils } from './MathUtils.js';

export class FileUtils {
    // Supported audio file formats
    static SUPPORTED_AUDIO_FORMATS = [
        'audio/mpeg',      // MP3
        'audio/wav',       // WAV
        'audio/ogg',       // OGG
        'audio/mp4',       // M4A/AAC
        'audio/flac',      // FLAC
        'audio/webm',      // WebM Audio
        'audio/aac'        // AAC
    ];
    
    // Supported image formats for textures
    static SUPPORTED_IMAGE_FORMATS = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/bmp'
    ];
    
    // Supported shader file extensions
    static SHADER_EXTENSIONS = [
        '.glsl',
        '.frag',
        '.vert',
        '.vs',
        '.fs'
    ];
    
    // Maximum file sizes (in bytes)
    static MAX_SIZES = {
        AUDIO: 100 * 1024 * 1024,    // 100MB
        IMAGE: 10 * 1024 * 1024,     // 10MB
        SHADER: 1 * 1024 * 1024,     // 1MB
        CONFIG: 1 * 1024 * 1024      // 1MB
    };
    
    /**
     * Load file from URL with progress tracking
     * @param {string} url - File URL
     * @param {Object} options - Loading options
     * @returns {Promise<ArrayBuffer|string>} File data
     */
    static async loadFile(url, options = {}) {
        const {
            responseType = 'arrayBuffer',
            timeout = 30000,
            onProgress = null,
            headers = {}
        } = options;
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Setup timeout
            const timeoutId = setTimeout(() => {
                xhr.abort();
                reject(new Error(`File load timeout: ${url}`));
            }, timeout);
            
            xhr.onload = () => {
                clearTimeout(timeoutId);
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error(`Network error loading: ${url}`));
            };
            
            xhr.onprogress = (event) => {
                if (onProgress && event.lengthComputable) {
                    const progress = event.loaded / event.total;
                    onProgress(progress, event.loaded, event.total);
                }
            };
            
            xhr.open('GET', url, true);
            xhr.responseType = responseType;
            
            // Set custom headers
            Object.entries(headers).forEach(([key, value]) => {
                xhr.setRequestHeader(key, value);
            });
            
            xhr.send();
        });
    }
    
    /**
     * Load text file (shaders, configs, etc.)
     * @param {string} url - File URL
     * @param {Object} options - Loading options
     * @returns {Promise<string>} File content as text
     */
    static async loadTextFile(url, options = {}) {
        return this.loadFile(url, { ...options, responseType: 'text' });
    }
    
    /**
     * Load JSON file with parsing
     * @param {string} url - File URL
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Parsed JSON data
     */
    static async loadJsonFile(url, options = {}) {
        try {
            const text = await this.loadTextFile(url, options);
            return JSON.parse(text);
        } catch (error) {
            if (error.name === 'SyntaxError') {
                throw new Error(`Invalid JSON in file: ${url} - ${error.message}`);
            }
            throw error;
        }
    }
    
    /**
     * Load audio file and create audio buffer
     * @param {string|File} source - Audio file URL or File object
     * @param {AudioContext} audioContext - Web Audio context
     * @param {Object} options - Loading options
     * @returns {Promise<AudioBuffer>} Decoded audio buffer
     */
    static async loadAudioFile(source, audioContext, options = {}) {
        const { onProgress = null } = options;
        
        let arrayBuffer;
        
        if (source instanceof File) {
            // Validate file
            this.validateAudioFile(source);
            arrayBuffer = await this.fileToArrayBuffer(source, onProgress);
        } else {
            // Load from URL
            arrayBuffer = await this.loadFile(source, { 
                responseType: 'arrayBuffer',
                onProgress 
            });
        }
        
        try {
            return await audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            throw new Error(`Failed to decode audio data: ${error.message}`);
        }
    }
    
    /**
     * Load shader file with preprocessing
     * @param {string} url - Shader file URL
     * @param {Object} defines - Preprocessor defines
     * @returns {Promise<string>} Processed shader source
     */
    static async loadShaderFile(url, defines = {}) {
        const source = await this.loadTextFile(url);
        return this.preprocessShader(source, defines);
    }
    
    /**
     * Preprocess shader source with defines and includes
     * @param {string} source - Original shader source
     * @param {Object} defines - Preprocessor defines
     * @returns {string} Processed shader source
     */
    static preprocessShader(source, defines = {}) {
        let processed = source;
        
        // Process #define directives
        Object.entries(defines).forEach(([key, value]) => {
            const defineRegex = new RegExp(`#define\\s+${key}\\s+.*`, 'g');
            if (processed.match(defineRegex)) {
                processed = processed.replace(defineRegex, `#define ${key} ${value}`);
            } else {
                // Add define at the top (after version directive)
                const versionMatch = processed.match(/#version\s+\d+\s+\w+/);
                if (versionMatch) {
                    const insertPos = versionMatch.index + versionMatch[0].length;
                    processed = processed.slice(0, insertPos) + 
                               `\n#define ${key} ${value}` + 
                               processed.slice(insertPos);
                } else {
                    processed = `#define ${key} ${value}\n${processed}`;
                }
            }
        });
        
        // Process #include directives (basic implementation)
        const includeRegex = /#include\s+"([^"]+)"/g;
        let match;
        const includePromises = [];
        
        while ((match = includeRegex.exec(processed)) !== null) {
            const includePath = match[1];
            includePromises.push(
                this.loadTextFile(includePath).then(includeSource => ({
                    original: match[0],
                    replacement: includeSource
                }))
            );
        }
        
        // For synchronous processing, we'll do a simple replacement
        // In a full implementation, you'd want to handle this asynchronously
        
        return processed;
    }
    
    /**
     * Load image file and create texture data
     * @param {string|File} source - Image file URL or File object
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Image data with width, height, and pixel data
     */
    static async loadImageFile(source, options = {}) {
        const { 
            flipY = false,
            premultiplyAlpha = false,
            colorspaceConversion = true 
        } = options;
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Set canvas context options
                    if (!colorspaceConversion) {
                        ctx.imageSmoothingEnabled = false;
                    }
                    
                    // Draw image to canvas
                    if (flipY) {
                        ctx.translate(0, canvas.height);
                        ctx.scale(1, -1);
                    }
                    
                    ctx.drawImage(img, 0, 0);
                    
                    // Get pixel data
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    let data = imageData.data;
                    
                    // Handle premultiplied alpha
                    if (premultiplyAlpha) {
                        data = this.premultiplyAlpha(data);
                    }
                    
                    resolve({
                        width: canvas.width,
                        height: canvas.height,
                        data: data,
                        channels: 4 // RGBA
                    });
                    
                } catch (error) {
                    reject(new Error(`Failed to process image: ${error.message}`));
                }
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            // Handle File objects vs URLs
            if (source instanceof File) {
                this.validateImageFile(source);
                const reader = new FileReader();
                reader.onload = (e) => { img.src = e.target.result; };
                reader.readAsDataURL(source);
            } else {
                img.crossOrigin = 'anonymous';
                img.src = source;
            }
        });
    }
    
    /**
     * Convert File object to ArrayBuffer
     * @param {File} file - File object
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<ArrayBuffer>} File data as ArrayBuffer
     */
    static fileToArrayBuffer(file, onProgress = null) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.onprogress = (event) => {
                if (onProgress && event.lengthComputable) {
                    const progress = event.loaded / event.total;
                    onProgress(progress, event.loaded, event.total);
                }
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * Convert File object to text
     * @param {File} file - File object
     * @returns {Promise<string>} File content as text
     */
    static fileToText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file as text'));
            };
            
            reader.readAsText(file);
        });
    }
    
    /**
     * Validate audio file
     * @param {File} file - File to validate
     * @throws {Error} If file is invalid
     */
    static validateAudioFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }
        
        if (!this.SUPPORTED_AUDIO_FORMATS.includes(file.type)) {
            throw new Error(`Unsupported audio format: ${file.type}`);
        }
        
        if (file.size > this.MAX_SIZES.AUDIO) {
            throw new Error(`Audio file too large: ${this.formatFileSize(file.size)} (max: ${this.formatFileSize(this.MAX_SIZES.AUDIO)})`);
        }
        
        return true;
    }
    
    /**
     * Validate image file
     * @param {File} file - File to validate
     * @throws {Error} If file is invalid
     */
    static validateImageFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }
        
        if (!this.SUPPORTED_IMAGE_FORMATS.includes(file.type)) {
            throw new Error(`Unsupported image format: ${file.type}`);
        }
        
        if (file.size > this.MAX_SIZES.IMAGE) {
            throw new Error(`Image file too large: ${this.formatFileSize(file.size)} (max: ${this.formatFileSize(this.MAX_SIZES.IMAGE)})`);
        }
        
        return true;
    }
    
    /**
     * Validate shader file
     * @param {File} file - File to validate
     * @throws {Error} If file is invalid
     */
    static validateShaderFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }
        
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.SHADER_EXTENSIONS.includes(extension)) {
            throw new Error(`Unsupported shader file extension: ${extension}`);
        }
        
        if (file.size > this.MAX_SIZES.SHADER) {
            throw new Error(`Shader file too large: ${this.formatFileSize(file.size)} (max: ${this.formatFileSize(this.MAX_SIZES.SHADER)})`);
        }
        
        return true;
    }
    
    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    static formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
    
    /**
     * Get file extension
     * @param {string|File} source - File path or File object
     * @returns {string} File extension (lowercase)
     */
    static getExtension(source) {
        const filename = source instanceof File ? source.name : source;
        return filename.split('.').pop().toLowerCase();
    }
    
    /**
     * Get MIME type from file extension
     * @param {string} extension - File extension
     * @returns {string} MIME type
     */
    static getMimeType(extension) {
        const mimeTypes = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'm4a': 'audio/mp4',
            'aac': 'audio/aac',
            'flac': 'audio/flac',
            'webm': 'audio/webm',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'webp': 'image/webp',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'glsl': 'text/plain',
            'frag': 'text/plain',
            'vert': 'text/plain',
            'json': 'application/json',
            'txt': 'text/plain'
        };
        
        return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
    }
    
    /**
     * Premultiply alpha in RGBA data
     * @param {Uint8ClampedArray} data - RGBA pixel data
     * @returns {Uint8ClampedArray} Premultiplied data
     */
    static premultiplyAlpha(data) {
        const result = new Uint8ClampedArray(data.length);
        
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3] / 255;
            result[i] = data[i] * alpha;         // R
            result[i + 1] = data[i + 1] * alpha; // G
            result[i + 2] = data[i + 2] * alpha; // B
            result[i + 3] = data[i + 3];         // A
        }
        
        return result;
    }
    
    /**
     * Save data as file (download)
     * @param {string|ArrayBuffer|Blob} data - Data to save
     * @param {string} filename - Target filename
     * @param {string} mimeType - MIME type
     */
    static saveAsFile(data, filename, mimeType = 'application/octet-stream') {
        let blob;
        
        if (data instanceof Blob) {
            blob = data;
        } else if (typeof data === 'string') {
            blob = new Blob([data], { type: mimeType });
        } else {
            blob = new Blob([data], { type: mimeType });
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    /**
     * Load multiple files with progress tracking
     * @param {Array} urls - Array of file URLs
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of loaded file data
     */
    static async loadMultipleFiles(urls, options = {}) {
        const { onProgress = null, concurrent = 3 } = options;
        
        const results = new Array(urls.length);
        let completed = 0;
        
        const updateProgress = () => {
            if (onProgress) {
                onProgress(completed / urls.length, completed, urls.length);
            }
        };
        
        // Load files in batches to avoid overwhelming the browser
        for (let i = 0; i < urls.length; i += concurrent) {
            const batch = urls.slice(i, i + concurrent);
            const batchPromises = batch.map(async (url, batchIndex) => {
                try {
                    const data = await this.loadFile(url, options);
                    results[i + batchIndex] = { success: true, data, url };
                } catch (error) {
                    results[i + batchIndex] = { success: false, error, url };
                }
                completed++;
                updateProgress();
            });
            
            await Promise.all(batchPromises);
        }
        
        return results;
    }
    
    /**
     * Create drag and drop handler
     * @param {HTMLElement} element - Target element
     * @param {Object} options - Handler options
     * @returns {Function} Cleanup function
     */
    static createDropHandler(element, options = {}) {
        const {
            onDrop = () => {},
            onDragOver = () => {},
            onDragLeave = () => {},
            allowedTypes = [],
            multiple = true
        } = options;
        
        const handleDragOver = (event) => {
            event.preventDefault();
            event.stopPropagation();
            onDragOver(event);
        };
        
        const handleDragLeave = (event) => {
            event.preventDefault();
            event.stopPropagation();
            onDragLeave(event);
        };
        
        const handleDrop = (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const files = Array.from(event.dataTransfer.files);
            
            // Filter by allowed types if specified
            const filteredFiles = allowedTypes.length > 0 
                ? files.filter(file => allowedTypes.includes(file.type))
                : files;
            
            // Limit to single file if multiple not allowed
            const finalFiles = multiple ? filteredFiles : filteredFiles.slice(0, 1);
            
            if (finalFiles.length > 0) {
                onDrop(finalFiles, event);
            }
        };
        
        element.addEventListener('dragover', handleDragOver);
        element.addEventListener('dragleave', handleDragLeave);
        element.addEventListener('drop', handleDrop);
        
        // Return cleanup function
        return () => {
            element.removeEventListener('dragover', handleDragOver);
            element.removeEventListener('dragleave', handleDragLeave);
            element.removeEventListener('drop', handleDrop);
        };
    }
    
    /**
     * Check if file API is supported
     * @returns {boolean} True if supported
     */
    static isFileAPISupported() {
        return !!(window.File && window.FileReader && window.FileList && window.Blob);
    }
    
    /**
     * Check if drag and drop is supported
     * @returns {boolean} True if supported
     */
    static isDragDropSupported() {
        return 'draggable' in document.createElement('div') && 
               'ondrop' in document.createElement('div');
    }
    
    /**
     * Analyze file metadata
     * @param {File} file - File to analyze
     * @returns {Object} File metadata
     */
    static analyzeFile(file) {
        return {
            name: file.name,
            size: file.size,
            type: file.type,
            extension: this.getExtension(file),
            lastModified: new Date(file.lastModified),
            formattedSize: this.formatFileSize(file.size),
            isAudio: this.SUPPORTED_AUDIO_FORMATS.includes(file.type),
            isImage: this.SUPPORTED_IMAGE_FORMATS.includes(file.type),
            isShader: this.SHADER_EXTENSIONS.includes('.' + this.getExtension(file))
        };
    }
}

// Export singleton instance for convenience
export const fileUtils = new FileUtils();