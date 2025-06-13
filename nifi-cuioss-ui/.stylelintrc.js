/**
 * Stylelint configuration for CUI CSS standards compliance.
 * Enforces modern CSS practices, property ordering, and design token usage.
 */
module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-prettier'
  ],
  plugins: [
    'stylelint-order'
    // Note: stylelint-declaration-strict-value temporarily disabled due to config complexity
  ],
  rules: {
    // CUI Standards - Property ordering for maintainability
    'order/properties-order': [
      'content',
      'display',
      'position',
      'top',
      'right',
      'bottom',
      'left',
      'z-index',
      'flex',
      'flex-grow',
      'flex-shrink',
      'flex-basis',
      'flex-direction',
      'flex-wrap',
      'justify-content',
      'align-items',
      'align-content',
      'grid',
      'grid-template',
      'grid-template-rows',
      'grid-template-columns',
      'grid-template-areas',
      'grid-area',
      'grid-row',
      'grid-column',
      'gap',
      'width',
      'height',
      'min-width',
      'min-height',
      'max-width',
      'max-height',
      'margin',
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'padding',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'border',
      'border-top',
      'border-right',
      'border-bottom',
      'border-left',
      'border-radius',
      'background',
      'background-color',
      'background-image',
      'background-size',
      'background-position',
      'background-repeat',
      'color',
      'font',
      'font-family',
      'font-size',
      'font-weight',
      'line-height',
      'text-align',
      'text-decoration',
      'text-transform',
      'opacity',
      'visibility',
      'overflow',
      'transform',
      'transition',
      'animation'
    ],

    // CUI Standards - Quality Rules
    "no-duplicate-selectors": true,
    "color-named": "never",
    "selector-max-id": 1,
    "selector-attribute-quotes": "always",
    "property-no-vendor-prefix": true,
    "value-no-vendor-prefix": true,
    "function-url-quotes": "always",
    "comment-whitespace-inside": "always",
    "comment-empty-line-before": ["always", {
      "except": ["first-nested"],
      "ignore": ["stylelint-commands"]
    }],
    "rule-empty-line-before": ["always-multi-line", {
      "except": ["first-nested"],
      "ignore": ["after-comment"]
    }],
    "selector-pseudo-element-colon-notation": "double",
    "custom-property-empty-line-before": "never",
    "declaration-empty-line-before": "never",
    "block-no-empty": true,
    "shorthand-property-no-redundant-values": true,
    "declaration-block-no-duplicate-properties": true,
    "declaration-block-no-shorthand-property-overrides": true,
    "font-family-no-duplicate-names": true,
    "length-zero-no-unit": true,

    // CUI Standards - Modern CSS features
    "custom-property-pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*$",
    "selector-class-pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$",
    "max-nesting-depth": 3,
    "selector-max-compound-selectors": 4,
    
    // CUI Standards - Performance and maintainability
    "font-family-no-missing-generic-family-keyword": true,
    "no-descending-specificity": null, // Allow for component-specific overrides
    "declaration-block-single-line-max-declarations": 1
  }
}
