/**
 * @file Mock Commands - Cypress commands for mocked testing
 * Provides the same interface as real processor commands but uses mocks for fast testing
 * @version 1.0.0
 */

import { setupNiFiAPIMocks, createMockProcessor, verifyMockAPICalls } from './nifi-api-mocks';
import { JWT_PROCESSORS } from '../cypress/support/constants';
import { logMessage } from '../cypress/support/utils';

/**
 * Set up mocked NiFi environment for testing
 * @param {Object} options - Mock setup options
 */
Cypress.Commands.add('setupMockedNiFi', (options = {}) => {
  logMessage('info', 'Setting up mocked NiFi environment');

  // Set up API mocks
  setupNiFiAPIMocks(options);

  // Mock the canvas elements in DOM
  cy.get('body').then(($body) => {
    // Create mock canvas structure if it doesn't exist
    if ($body.find('#canvas').length === 0) {
      $body.append(`
        <div id="canvas-container">
          <div id="canvas">
            <svg width="1200" height="800">
              <g class="canvas-background"></g>
              <g class="processors-layer"></g>
            </svg>
          </div>
        </div>
      `);
    }
  });

  logMessage('success', 'Mocked NiFi environment ready');
});

/**
 * Add a processor to canvas using mocks
 * @param {string} processorType - Processor type (JWT_AUTHENTICATOR or MULTI_ISSUER)
 * @param {Object} options - Addition options
 */
Cypress.Commands.add('addMockedProcessorToCanvas', (processorType, options = {}) => {
  const {
    position = { x: 400, y: 300 },
    skipIfExists = true
  } = options;

  logMessage('action', `Adding mocked processor: ${processorType}`);

  return cy.getJWTProcessorTypes().then((types) => {
    const processorDef = types[processorType];
    if (!processorDef) {
      throw new Error(`Unknown processor type: ${processorType}`);
    }

    // Check if processor already exists (if skipIfExists is true)
    if (skipIfExists) {
      return cy.findMockedProcessorOnCanvas(processorType).then((existingProcessor) => {
        if (existingProcessor) {
          logMessage('warn', `Mocked processor ${processorType} already exists, skipping addition`);
          return existingProcessor;
        }
        return performMockedProcessorAddition(processorType, processorDef, position);
      });
    } else {
      return performMockedProcessorAddition(processorType, processorDef, position);
    }
  });
});

/**
 * Find a processor on the mocked canvas
 * @param {string} processorType - Processor type to find
 * @param {Object} options - Search options
 */
Cypress.Commands.add('findMockedProcessorOnCanvas', (processorType, options = {}) => {
  logMessage('search', `Searching for mocked processor: ${processorType}`);

  return cy.get('#canvas').then(($canvas) => {
    const processorSelector = `[data-processor-type="${processorType}"]`;
    const $processor = $canvas.find(processorSelector);

    if ($processor.length > 0) {
      const processorDef = JWT_PROCESSORS[processorType];
      const mockProcessor = {
        id: $processor.attr('data-processor-id'),
        type: processorType,
        name: processorDef.displayName,
        element: $processor,
        position: {
          x: parseInt($processor.attr('data-x') || '400'),
          y: parseInt($processor.attr('data-y') || '300')
        },
        isVisible: true,
        status: 'STOPPED'
      };

      logMessage('success', `Found mocked processor: ${mockProcessor.name}`);
      return cy.wrap(mockProcessor);
    } else {
      logMessage('info', `Mocked processor ${processorType} not found`);
      return cy.wrap(null);
    }
  });
});

/**
 * Remove a processor from the mocked canvas
 * @param {string|Object} processor - Processor type or processor reference
 * @param {Object} options - Removal options
 */
Cypress.Commands.add('removeMockedProcessorFromCanvas', (processor, options = {}) => {
  const { confirmDeletion = true } = options;

  logMessage('action', `Removing mocked processor: ${typeof processor === 'string' ? processor : processor.name}`);

  // If processor is a string (type), find it first
  if (typeof processor === 'string') {
    return cy.findMockedProcessorOnCanvas(processor).then((foundProcessor) => {
      if (!foundProcessor) {
        logMessage('warn', `Mocked processor ${processor} not found on canvas`);
        return false;
      }
      return performMockedProcessorRemoval(foundProcessor, confirmDeletion);
    });
  } else {
    // Processor is already a reference object
    return performMockedProcessorRemoval(processor, confirmDeletion);
  }
});

/**
 * Get all JWT processors on the mocked canvas
 * @param {Object} options - Search options
 */
Cypress.Commands.add('getAllMockedJWTProcessorsOnCanvas', (options = {}) => {
  logMessage('search', 'Searching for all mocked JWT processors on canvas');

  const foundProcessors = [];

  return cy.findMockedProcessorOnCanvas('JWT_AUTHENTICATOR').then((jwtAuthProcessor) => {
    if (jwtAuthProcessor) {
      foundProcessors.push(jwtAuthProcessor);
    }

    return cy.findMockedProcessorOnCanvas('MULTI_ISSUER').then((multiIssuerProcessor) => {
      if (multiIssuerProcessor) {
        foundProcessors.push(multiIssuerProcessor);
      }

      logMessage('success', `Found ${foundProcessors.length} mocked JWT processors on canvas`);
      return cy.wrap(foundProcessors);
    });
  });
});

/**
 * Clean up all mocked JWT processors from canvas
 * @param {Object} options - Cleanup options
 */
Cypress.Commands.add('cleanupMockedJWTProcessors', (options = {}) => {
  const { confirmDeletion = true } = options;

  logMessage('cleanup', 'Cleaning up mocked JWT processors from canvas');

  return cy.getAllMockedJWTProcessorsOnCanvas().then((processors) => {
    if (processors.length === 0) {
      logMessage('success', 'No mocked JWT processors found to clean up');
      return 0;
    }

    logMessage('info', `Found ${processors.length} mocked JWT processors to remove`);

    // Remove each processor sequentially
    function removeProcessorsSequentially(processorList, index = 0, removedCount = 0) {
      if (index >= processorList.length) {
        logMessage('success', `Mocked cleanup complete: ${removedCount} processors removed`);
        return cy.wrap(removedCount);
      }

      const processor = processorList[index];
      return cy.removeMockedProcessorFromCanvas(processor, { confirmDeletion }).then((success) => {
        const newCount = success ? removedCount + 1 : removedCount;
        if (success) {
          logMessage('success', `Removed mocked processor: ${processor.name}`);
        } else {
          logMessage('warn', `Failed to remove mocked processor: ${processor.name}`);
        }
        return removeProcessorsSequentially(processorList, index + 1, newCount);
      });
    }

    return removeProcessorsSequentially(processors);
  });
});

// Helper functions for mocked operations

/**
 * Perform mocked processor addition
 * @param {string} processorType - Processor type
 * @param {Object} processorDef - Processor definition
 * @param {Object} position - Position on canvas
 */
function performMockedProcessorAddition(processorType, processorDef, position) {
  logMessage('action', `Performing mocked addition of ${processorDef.displayName}`);

  // Create mock processor data
  const mockProcessor = createMockProcessor(processorType, { position });

  // Add visual element to mocked canvas
  return cy.get('#canvas svg .processors-layer').then(($layer) => {
    const processorElement = `
      <g class="processor"
         data-processor-type="${processorType}"
         data-processor-id="${mockProcessor.id}"
         data-x="${position.x}"
         data-y="${position.y}"
         transform="translate(${position.x}, ${position.y})">
        <rect width="120" height="60" fill="#e8f4fd" stroke="#004d7a" stroke-width="2" rx="5"/>
        <text x="60" y="35" text-anchor="middle" font-size="12" fill="#004d7a">
          ${processorDef.shortName}
        </text>
      </g>
    `;

    $layer.append(processorElement);

    // Update mock processor with actual element
    mockProcessor.element = $layer.find(`[data-processor-id="${mockProcessor.id}"]`);

    logMessage('success', `Mocked processor added: ${mockProcessor.name}`);
    return cy.wrap(mockProcessor);
  });
}

/**
 * Perform mocked processor removal
 * @param {Object} processor - Processor to remove
 * @param {boolean} confirmDeletion - Whether to confirm deletion
 */
function performMockedProcessorRemoval(processor, confirmDeletion) {
  logMessage('action', `Performing mocked removal of ${processor.name}`);

  // Remove visual element from mocked canvas
  return cy.get('#canvas').then(() => {
    if (processor.element && processor.element.length > 0) {
      processor.element.remove();
      logMessage('success', `Mocked processor removed: ${processor.name}`);
      return true;
    } else {
      logMessage('warn', 'Mocked processor element not found for removal');
      return false;
    }
  });
}
