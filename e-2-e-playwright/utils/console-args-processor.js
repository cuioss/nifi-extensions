/**
 * @file Console Arguments Processor - Extract console message processing logic
 * Handles serialization and processing of browser console arguments
 * @version 1.0.0
 */

/**
 * Process console arguments to extract their values with enhanced serialization
 * @param {Array} args - Console message arguments
 * @returns {Promise<Array>} Processed arguments
 */
export async function processConsoleArgs(args) {
  if (!args || args.length === 0) {
    return [];
  }

  const processedArgs = [];

  for (const arg of args) {
    try {
      // Try to get the JSON value first
      const jsonValue = await arg.jsonValue();

      // Handle different types of values
      if (typeof jsonValue === 'object' && jsonValue !== null) {
        processedArgs.push(serializeComplexObject(jsonValue));
      } else {
        // For primitives, use the value directly
        processedArgs.push(String(jsonValue));
      }
    } catch (jsonError) {
      // If jsonValue() fails, try alternative serialization
      try {
        const stringValue = await arg.evaluate(serializeObjectInBrowser);
        processedArgs.push(stringValue);
      } catch (evalError) {
        // Final fallback
        processedArgs.push(`[Unable to serialize: ${String(arg)}]`);
      }
    }
  }

  return processedArgs;
}

/**
 * Serialize complex objects (arrays, objects) with proper formatting
 * @param {any} value - Value to serialize
 * @returns {string} Serialized value
 */
function serializeComplexObject(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => 
      typeof item === 'object' ? JSON.stringify(item) : String(item)
    ).join(', ')}]`;
  } else {
    return JSON.stringify(value, null, 2);
  }
}

/**
 * Custom serialization function to run in browser context
 * @param {any} obj - Object to serialize
 * @returns {string} Serialized representation
 */
function serializeObjectInBrowser(obj) {
  // Custom serialization for different object types
  if (typeof obj === 'function') {
    return `[Function: ${obj.name || 'anonymous'}]`;
  }
  
  if (obj instanceof Error) {
    return `${obj.name}: ${obj.message}${obj.stack ? '\nStack: ' + obj.stack : ''}`;
  }
  
  if (typeof obj === 'object' && obj !== null) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return `[Object: ${obj.constructor?.name || 'Unknown'}]`;
    }
  }
  
  return String(obj);
}