/**
 * Jest transformer for AMD modules.
 * This transformer converts AMD modules to CommonJS modules.
 */

module.exports = {
    process(src, filename) {
    // Check if the file uses AMD define
        if (src.includes('define(') && (src.includes('function(') || src.includes('function ('))) {
            // Extract the dependencies and factory function
            const defineRegex = /define\(\s*(\[.*?\])?\s*,?\s*function\s*\((.*?)\)\s*\{([\s\S]*)\}\s*\)\s*;?\s*$/;
            const match = src.match(defineRegex);

            if (match) {
                let [, depsArray, params] = match;
                const factoryBody = match[3];

                // Default values if not provided
                depsArray = depsArray || '[]';
                params = params || '';

                // Create a CommonJS module
                return `
          // Converted from AMD to CommonJS
          const deps = ${depsArray};
          const params = [${params.split(',').map(p => `require('${p.trim()}')`).join(', ')}];

          // Execute the factory function with the dependencies
          const factory = function(${params}) {
            ${factoryBody}
          };

          module.exports = factory(${params});
        `;
            }
        }

        // If not an AMD module or couldn't parse, return the original source
        return src;
    }
};
