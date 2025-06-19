/**
 * Stylelint configuration for CUI CSS standards compliance.
 * Basic configuration to get stylelint working properly.
 */
module.exports = {
  extends: [
    'stylelint-config-standard'
  ],
  plugins: [
    'stylelint-order'
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
      'width',
      'height',
      'margin',
      'padding',
      'border',
      'background',
      'color',
      'font',
      'text-align',
      'opacity',
      'overflow',
      'transform',
      'transition'
    ],

    // CUI Standards - Quality Rules
    "color-named": "never",
    "max-nesting-depth": 3,
    "no-descending-specificity": null
  }
}
