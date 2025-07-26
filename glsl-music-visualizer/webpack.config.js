const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ImageminPlugin = require('imagemin-webpack-plugin').default;

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/main.js',
    
    output: {
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
      publicPath: '/',
    },
    
    resolve: {
      extensions: ['.js', '.glsl', '.frag', '.vert'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shaders': path.resolve(__dirname, 'src/shaders'),
        '@audio': path.resolve(__dirname, 'src/audio'),
        '@core': path.resolve(__dirname, 'src/core'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@ui': path.resolve(__dirname, 'src/ui'),
        '@visualizers': path.resolve(__dirname, 'src/visualizers'),
        '@physics': path.resolve(__dirname, 'src/physics'),
        '@materials': path.resolve(__dirname, 'src/materials'),
        '@assets': path.resolve(__dirname, 'assets'),
      }
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              cacheDirectory: true,
            }
          }
        },
        {
          test: /\.(glsl|frag|vert)$/,
          use: [
            {
              loader: 'raw-loader'
            },
            {
              loader: 'glslify-loader',
              options: {
                transform: [
                  ['glslify-hex'],
                  ['glslify-import']
                ]
              }
            }
          ]
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpe?g|gif|svg|ico)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name].[hash][ext]'
          }
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name].[hash][ext]'
          }
        },
        {
          test: /\.(mp3|wav|ogg|m4a)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'audio/[name].[hash][ext]'
          }
        },
        {
          test: /\.json$/,
          type: 'asset/resource',
          generator: {
            filename: 'data/[name].[hash][ext]'
          }
        }
      ]
    },
    
    plugins: [
      new HtmlWebpackPlugin({
        template: './index.html',
        filename: 'index.html',
        inject: 'head',
        scriptLoading: 'defer',
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        } : false
      }),
      
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'assets',
            to: 'assets',
            noErrorOnMissing: true
          },
          {
            from: 'plugins',
            to: 'plugins',
            noErrorOnMissing: true
          }
        ]
      }),
      
      ...(isProduction ? [
        new ImageminPlugin({
          test: /\.(jpe?g|png|gif|svg)$/i,
          pngquant: {
            quality: '65-90'
          },
          optipng: {
            optimizationLevel: 5
          },
          mozjpeg: {
            progressive: true,
            quality: 85
          },
          svgo: {
            plugins: [
              { removeViewBox: false },
              { removeUnusedNS: false },
              { removeUselessStrokeAndFill: false },
              { cleanupIDs: false },
              { removeComments: false },
              { removeEmptyAttrs: false },
              { removeEmptyText: false },
              { removeEmptyContainers: false }
            ]
          }
        })
      ] : [])
    ],
    
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10
          },
          shaders: {
            test: /\.(glsl|frag|vert)$/,
            name: 'shaders',
            chunks: 'all',
            priority: 20
          },
          audio: {
            test: /[\\/]src[\\/]audio[\\/]/,
            name: 'audio-engine',
            chunks: 'all',
            priority: 15
          },
          ui: {
            test: /[\\/]src[\\/]ui[\\/]/,
            name: 'ui-components',
            chunks: 'all',
            priority: 15
          }
        }
      },
      
      minimizer: isProduction ? [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug']
            },
            mangle: {
              safari10: true
            },
            format: {
              comments: false
            }
          },
          extractComments: false
        })
      ] : []
    },
    
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist'),
      },
      compress: true,
      port: 3000,
      hot: true,
      open: true,
      historyApiFallback: true,
      client: {
        overlay: {
          errors: true,
          warnings: false
        }
      },
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin'
      }
    },
    
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
    
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 1024 * 1024, // 1MB
      maxAssetSize: 1024 * 1024 // 1MB
    },
    
    stats: {
      children: false,
      chunks: false,
      modules: false,
      assets: isProduction,
      entrypoints: false,
      performance: isProduction,
      timings: true,
      warnings: true,
      errors: true
    }
  };
};