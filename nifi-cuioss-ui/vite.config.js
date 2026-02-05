import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    // Entry point for the build
    build: {
    // Output directory relative to project root
        outDir: 'src/main/webapp/js',
        // Don't empty the output directory (preserve other JS files)
        emptyOutDir: false,
        lib: {
            // Entry point
            entry: path.resolve(__dirname, 'src/main/webapp/js/bundle-wrapper.js'),
            // Library name (global variable name when included as script)
            name: 'nifiCuiossUI',
            // Output file name (function to avoid Vite appending format suffix)
            fileName: () => 'bundle.js',
            // Format: UMD for compatibility with existing NiFi infrastructure
            formats: ['umd']
        },
        rollupOptions: {
            // External dependencies that should NOT be bundled
            // These are loaded from WebJars in the HTML
            external: [
                'cash-dom',
                'jquery',
                'tippy.js',
                '@popperjs/core',
                'nf.Common'
            ],
            output: {
                // Global variable names for external dependencies
                globals: {
                    'cash-dom': 'cash',
                    'jquery': 'jQuery',
                    'tippy.js': 'tippy',
                    '@popperjs/core': 'Popper',
                    'nf.Common': 'nfCommon'
                }
            }
        },
        // Generate source maps for debugging
        sourcemap: process.env.NODE_ENV === 'development',
        // Minify in production
        minify: process.env.NODE_ENV === 'production'
    },

    // Development server configuration (for local development)
    server: {
        port: 3000,
        open: false
    },

    // Module resolution
    resolve: {
        alias: {
            // Alias for nf.Common to use mock during development/testing
            'nf.Common': process.env.NODE_ENV === 'test'
                ? path.resolve(__dirname, 'src/test/js/mocks/nf-common.js')
                : 'nf.Common' // Will be external in actual build
        }
    },

    // Define global variables for different environments
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    }
});
