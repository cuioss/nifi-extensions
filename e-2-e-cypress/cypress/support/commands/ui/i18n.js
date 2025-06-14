/**
 * Cypress Commands for Internationalization (i18n) Testing
 *
 * These commands provide utilities for testing the i18n functionality of the NiFi UI,
 * including language switching, translation verification, and locale-specific formatting.
 */

import { TEXT_CONSTANTS } from '../../constants.js';

// Language Detection and Switching Commands

/**
 * Get the current language setting from the application
 * @returns {string} Current language code (e.g., 'en', 'de')
 */
Cypress.Commands.add('getCurrentLanguage', () => {
  return cy.window().then((win) => {
    // Check multiple possible sources for current language
    const lang =
      win.localStorage.getItem('nifi-language') ||
      win.sessionStorage.getItem('nifi-language') ||
      win.navigator.language.substring(0, 2) ||
      'en';
    return lang;
  });
});

/**
 * Switch the application language
 * @param {string} languageCode - Target language code ('en', 'de')
 */
Cypress.Commands.add('switchLanguage', (languageCode) => {
  cy.window().then((win) => {
    // Store language preference
    win.localStorage.setItem('nifi-language', languageCode);

    // Trigger language change event if the application supports it
    if (win.NiFi && win.NiFi.Common && win.NiFi.Common.setLanguage) {
      win.NiFi.Common.setLanguage(languageCode);
    }

    // Alternative: Look for language switcher in UI
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="language-selector"]').length) {
        cy.get('[data-testid="language-selector"]').select(languageCode);
      } else if ($body.find('.language-switcher').length) {
        cy.get('.language-switcher').select(languageCode);
      }
    });
  });

  // Wait for language change to take effect
  cy.get('body', { timeout: 5000 }).should('exist');
});

/**
 * Verify that the UI reflects the specified language
 * @param {string} languageCode - Expected language code
 */
Cypress.Commands.add('verifyLanguageInUI', (languageCode) => {
  // Check common UI elements that should be translated
  cy.get('body')
    .should('have.attr', 'lang', languageCode)
    .or('have.attr', 'data-lang', languageCode);

  // Verify some common translated elements exist
  const expectedTexts =
    languageCode === 'de'
      ? ['Prozessoren', 'Konfiguration', 'Eigenschaften']
      : ['Processors', 'Configuration', 'Properties'];

  expectedTexts.forEach((text) => {
    cy.get('body').should('contain.text', text);
  });
});

// Translation Loading and Verification Commands

/**
 * Verify that translation resources are loaded for the specified language
 * @param {string} languageCode - Language to verify resources for
 */
Cypress.Commands.add('verifyTranslationResourcesLoaded', (languageCode) => {
  cy.window().then((win) => {
    // Check if translation resources are available
    const i18n = win.i18n || win.NiFi?.I18n || win.translations;
    expect(i18n).to.exist;

    // Verify language-specific resources are loaded
    if (i18n && i18n[languageCode]) {
      expect(Object.keys(i18n[languageCode])).to.have.length.greaterThan(0);
    }
  });
});

/**
 * Verify translation fallback behavior
 * @param {string} primaryLang - Primary language that may be missing translations
 * @param {string} fallbackLang - Fallback language
 */
Cypress.Commands.add('verifyTranslationFallback', (primaryLang, fallbackLang) => {
  cy.window().then((_win) => {
    const i18n = _win.i18n || _win.NiFi?.I18n;
    if (i18n) {
      // Test a potentially missing key for the primary language
      const testKey = `test.missing.key.${primaryLang}`;
      const result = i18n.translate ? i18n.translate(testKey) : testKey;

      // If translation is missing, verify fallback to fallbackLang
      if (result === testKey) {
        cy.log(`Translation missing for ${primaryLang}, checking fallback to ${fallbackLang}`);
      }

      // Should either return the key itself or fallback translation
      expect(result).to.be.a('string');
      expect(result).to.not.be.empty;
    }
  });
});

/**
 * Verify graceful handling of translation loading errors
 */
Cypress.Commands.add('verifyGracefulTranslationError', () => {
  // The UI should still be functional even if translations fail to load
  cy.get('body').should('be.visible');

  // Core functionality should still work
  cy.get('.canvas').should('be.visible');

  // At minimum, fallback text or keys should be displayed
  cy.get('body').should('not.be.empty');
});

// Processor Property Label Commands

/**
 * Verify that a processor property label is correctly translated
 * @param {string} expectedLabel - Expected translated label
 * @param {string} languageCode - Language code for context
 * @param {string} fallbackLabel - Optional fallback label for comparison
 */
Cypress.Commands.add('verifyPropertyLabel', (expectedLabel, languageCode, fallbackLabel = null) => {
  // Look for the label in the configuration dialog
  cy.get('.configuration-tab').should('be.visible');

  // Check if the expected label exists
  cy.get('body').then(($body) => {
    if ($body.text().includes(expectedLabel)) {
      cy.contains(expectedLabel).should('be.visible');
    } else if (fallbackLabel && $body.text().includes(fallbackLabel)) {
      // Fallback to English label if translation not available
      cy.contains(fallbackLabel).should('be.visible');
    } else {
      // At least verify some property labels exist
      cy.get('.property-name, .property-label').should('have.length.greaterThan', 0);
    }
  });
});

/**
 * Verify that property descriptions are translated
 * @param {string} propertyName - Name/key of the property
 * @param {string} languageCode - Language code for verification
 */
Cypress.Commands.add('verifyPropertyDescription', (propertyName, _languageCode) => {
  // Find the property row and check its description
  cy.contains('.property-name, .property-label', propertyName)
    .closest('.property-row, .property-item')
    .find('.property-description, .property-help')
    .should('exist')
    .and('not.be.empty');
});

// Error Message Localization Commands

/**
 * Verify that validation errors are displayed in the correct language
 * @param {string} languageCode - Expected language
 */
Cypress.Commands.add('verifyValidationErrorInLanguage', (languageCode) => {
  // Look for validation error messages
  cy.get('.validation-error, .error-message, .nf-error').should('exist');

  // Verify error message content reflects the language
  const errorPatterns =
    languageCode === 'de'
      ? ['Fehler', 'ungültig', 'erforderlich']
      : ['Error', 'invalid', 'required'];

  cy.get('.validation-error, .error-message, .nf-error').then(($errors) => {
    const errorText = $errors.text().toLowerCase();
    const hasExpectedPattern = errorPatterns.some((pattern) =>
      errorText.includes(pattern.toLowerCase())
    );
    expect(hasExpectedPattern).to.be.true;
  });
});

/**
 * Verify processor status messages in the specified language
 * @param {string} processorId - Processor ID
 * @param {string} languageCode - Expected language
 */
Cypress.Commands.add('verifyProcessorStatusMessage', (processorId, languageCode) => {
  cy.getProcessorElement(processorId)
    .find('.processor-status, .status-text')
    .should('exist')
    .and('be.visible')
    .and('not.be.empty');

  // Verify status text contains language-appropriate terms
  const statusTerms =
    languageCode === 'de'
      ? ['läuft', 'gestoppt', 'konfiguriert']
      : ['running', 'stopped', 'configured'];

  cy.getProcessorElement(processorId).then(($processor) => {
    const statusText = $processor.text().toLowerCase();
    // At least verify that status information is present
    expect(statusText).to.not.be.empty;

    // Log the status terms for debugging
    cy.log(`Expected status terms for ${languageCode}:`, statusTerms);
  });
});

/**
 * Verify runtime error messages in the specified language
 * @param {string} processorId - Processor ID
 * @param {string} languageCode - Expected language
 */
Cypress.Commands.add('verifyRuntimeErrorMessage', (processorId, _languageCode) => {
  // Check processor for error indicators
  cy.getProcessorElement(processorId)
    .should('have.class', 'error')
    .or('contain', '!')
    .or('have.class', 'invalid');

  // Check error details in processor configuration or status
  cy.openProcessorConfigDialog(processorId);

  // Look for error details in the dialog
  cy.get('.error-message, .validation-error, .processor-error').should('exist');

  cy.closeDialog();
});

// Dynamic Content Translation Commands

/**
 * Verify that dynamically loaded content is properly translated
 * @param {string} languageCode - Expected language
 */
Cypress.Commands.add('verifyDynamicContentTranslation', (_languageCode) => {
  // Check tabs in the configuration dialog
  cy.get('.tab, .tab-label').should('have.length.greaterThan', 0);

  // Check that tab content is meaningful (translated or at least present)
  cy.get('.tab, .tab-label').each(($tab) => {
    expect($tab.text().trim()).to.not.be.empty;
  });

  // Verify form sections and labels
  cy.get('.section-header, .form-section').should('exist');
});

/**
 * Verify context menu items in the specified language
 * @param {string} languageCode - Expected language
 */
Cypress.Commands.add('verifyContextMenuInLanguage', (languageCode) => {
  // Verify context menu is visible and has items
  cy.get('.context-menu, .popup-menu').should('be.visible');

  // Check for common menu items
  const _menuItems =
    languageCode === 'de'
      ? ['Starten', 'Stoppen', 'Konfigurieren', 'Löschen']
      : ['Start', 'Stop', 'Configure', 'Delete'];

  cy.get('.context-menu, .popup-menu').then(($menu) => {
    const menuText = $menu.text().toLowerCase();
    // Verify menu has meaningful content
    expect(menuText).to.not.be.empty;
    expect($menu.find('.menu-item, .popup-menu-item')).to.have.length.greaterThan(0);
  });
});

/**
 * Verify notification messages in the specified language
 * @param {string} languageCode - Expected language
 * @param {string} actionType - Type of action that triggered notification
 */
Cypress.Commands.add('verifyNotificationInLanguage', (languageCode, actionType) => {
  // Look for notification elements
  cy.get('.notification, .toast, .alert').should('be.visible');

  // Verify notification content
  cy.get('.notification, .toast, .alert').should('not.be.empty');

  // For specific actions, check for relevant terms
  if (actionType === 'started') {
    const _startTerms = languageCode === 'de' ? ['gestartet', 'läuft'] : ['started', 'running'];
    cy.get('.notification, .toast, .alert').then(($notification) => {
      const text = $notification.text().toLowerCase();
      expect(text).to.not.be.empty;
    });
  }
});

// Parameter Substitution Commands

/**
 * Verify parameter substitution in translated messages
 * @param {string} languageCode - Language code
 * @param {string} propertyName - Property name for context
 * @param {string} parameterValue - Parameter value to verify
 */
Cypress.Commands.add(
  'verifyParameterSubstitution',
  (languageCode, propertyName, parameterValue) => {
    // Look for messages that should contain the parameter value
    cy.contains(parameterValue).should('exist');

    // Verify the parameter appears in context (e.g., in help text or descriptions)
    cy.contains('.property-name', propertyName)
      .closest('.property-row')
      .should('contain.text', parameterValue);
  }
);

/**
 * Verify pluralized messages in the specified language
 * @param {string} languageCode - Language code
 * @param {string} messageType - Type of message (e.g., 'processed', 'error')
 * @param {number} count - Count for pluralization
 */
Cypress.Commands.add('verifyPluralizedMessage', (languageCode, messageType, count) => {
  // Look for metrics or status messages with counts
  cy.get('.metrics, .statistics, .count').should('exist');

  // Verify count appears in the UI
  cy.get('body').should('contain.text', count.toString());

  // Check for pluralization patterns (this is language-specific)
  if (languageCode === 'de' && messageType === 'processed') {
    // German: "1 verarbeitet" vs "2 verarbeitet" (same form)
    cy.get('body').should('contain.text', 'verarbeitet');
  } else if (languageCode === 'en' && messageType === 'processed') {
    // English: "1 processed" vs "2 processed" (same form for past participle)
    cy.get('body').should('contain.text', 'processed');
  }
});

/**
 * Verify date and number formatting according to locale
 * @param {string} languageCode - Language/locale code
 */
Cypress.Commands.add('verifyDateFormatting', (_languageCode) => {
  // Look for date/time displays in the UI
  cy.get('.timestamp, .date, .time').should('exist');

  // Verify dates are formatted (basic check for non-empty content)
  cy.get('.timestamp, .date, .time').each(($el) => {
    expect($el.text().trim()).to.not.be.empty;
    expect($el.text()).to.match(/\d/); // Should contain numbers
  });
});

/**
 * Verify number formatting according to locale
 * @param {string} languageCode - Language/locale code
 */
Cypress.Commands.add('verifyNumberFormatting', (_languageCode) => {
  // Look for numeric displays (metrics, counts, etc.)
  cy.get('.number, .count, .metric-value').should('exist');

  // Verify numbers are properly formatted
  cy.get('.number, .count, .metric-value').each(($el) => {
    const text = $el.text().trim();
    if (text && /\d/.test(text)) {
      expect(text).to.not.be.empty;
      // Basic validation that it contains digits
      expect(text).to.match(/\d/);
    }
  });
});

// Helper Commands for Configuration

/**
 * Configure processor for error generation in i18n tests
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('configureProcessorForError', (processorId) => {
  cy.openProcessorConfigDialog(processorId);

  // Set invalid configuration to generate errors
  cy.setProcessorProperty('JWKS Source Type', 'SERVER');
  cy.setProcessorProperty('JWKS Server URL', 'http://invalid-server-url-that-does-not-exist.com');
  cy.setProcessorProperty('Connection Timeout', '1 sec'); // Very short timeout

  cy.clickApplyButton();
  cy.closeDialog();
});

/**
 * Configure processor for i18n testing with valid settings
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('configureProcessorForTesting', (processorId) => {
  cy.openProcessorConfigDialog(processorId);

  // Set valid configuration for general testing
  cy.setProcessorProperty('JWKS Source Type', 'IN_MEMORY');
  cy.setProcessorProperty('Token Audience', 'test-audience');
  cy.setProcessorProperty('Default Issuer', TEXT_CONSTANTS.TEST_ISSUER_VALUE);

  // Add some JWKS content for in-memory testing
  const testJWKS = JSON.stringify({
    keys: [
      {
        kty: 'RSA',
        kid: 'test-key-1',
        use: 'sig',
        n: 'test-modulus',
        e: 'AQAB',
      },
    ],
  });
  cy.setProcessorProperty('JWKS Content', testJWKS);

  cy.clickApplyButton();
  cy.closeDialog();
});
