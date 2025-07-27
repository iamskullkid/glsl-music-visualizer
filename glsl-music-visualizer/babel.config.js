module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: [
            '> 1%',
            'last 2 versions',
            'not dead',
            'not ie 11'
          ]
        },
        modules: false, // Let webpack handle modules
        useBuiltIns: 'usage',
        corejs: {
          version: 3,
          proposals: true
        },
        // Enable newer JS features for better performance
        loose: true,
        bugfixes: true,
        // Optimize for modern browsers that support WebGL
        ignoreBrowserslistConfig: false,
        exclude: [
          // Exclude transforms that might interfere with WebGL performance
          'transform-typeof-symbol',
          'transform-regenerator'
        ]
      }
    ]
  ],
  
  plugins: [
    // Dynamic imports for code splitting
    '@babel/plugin-syntax-dynamic-import',
    
    // Class properties for cleaner syntax
    '@babel/plugin-proposal-class-properties',
    
    // Optional chaining and nullish coalescing
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-nullish-coalescing-operator',
    
    // Async/await optimizations
    [
      '@babel/plugin-transform-runtime',
      {
        corejs: false,
        helpers: true,
        regenerator: true,
        useESModules: false,
        absoluteRuntime: false,
        version: '^7.22.0'
      }
    ]
  ],
  
  env: {
    development: {
      plugins: [
        // Hot module replacement support
        'react-hot-loader/babel'
      ],
      // Preserve more readable code in development
      compact: false,
      minified: false,
      sourceMaps: true
    },
    
    production: {
      plugins: [
        // Remove console.log statements in production
        [
          'transform-remove-console',
          {
            exclude: ['error', 'warn']
          }
        ],
        // Dead code elimination
        '@babel/plugin-transform-dead-code-elimination'
      ],
      // Optimize for production
      compact: true,
      minified: true,
      sourceMaps: false
    },
    
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current'
            },
            modules: 'commonjs'
          }
        ]
      ],
      plugins: [
        // Test utilities
        '@babel/plugin-transform-modules-commonjs'
      ]
    }
  },
  
  // Ignore node_modules except for specific packages that need transpilation
  ignore: [
    /node_modules\/(?!(gl-matrix|meyda|tone)\/)/
  ],
  
  // Cache babel compilations for faster builds
  cacheDirectory: true,
  cacheCompression: false,
  
  // Source type configuration
  sourceType: 'module',
  
  // Parser options for modern JavaScript features
  parserOpts: {
    strictMode: true,
    allowImportExportEverywhere: false,
    allowReturnOutsideFunction: false,
    ranges: false,
    tokens: false
  },
  
  // Generator options
  generatorOpts: {
    quotes: 'single',
    compact: 'auto',
    minified: false,
    concise: false,
    retainLines: false
  }
};