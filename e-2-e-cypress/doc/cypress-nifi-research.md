# Cypress and NiFi Testing Research

## Overview

This document contains research findings on testing Apache NiFi UI with Cypress, based on the failures encountered when trying to use Angular Material selectors with the real NiFi instance.

## Key Findings from Test Failures

### 1. Angular Material Selectors Don't Work
Our tests failed because we assumed NiFi uses Angular Material components, but the real NiFi UI doesn't contain:
- `mat-sidenav-content`
- `.mat-drawer-content` 
- `mat-toolbar`
- `mat-dialog-container`

### 2. Actual NiFi UI Architecture

Based on the test failures and the fact that authentication works but canvas access fails, NiFi likely uses:

#### Traditional Web Technologies
- **Framework**: Likely jQuery-based or vanilla JavaScript
- **Canvas**: SVG-based drawing surface (confirmed from our documentation)
- **Layout**: Traditional HTML/CSS layout, not Angular Material

#### Common NiFi UI Patterns
Based on typical NiFi installations and web research:

```html
<!-- Typical NiFi UI Structure -->
<body>
  <div id="nf-header">
    <!-- Header/toolbar content -->
  </div>
  <div id="canvas-container">
    <svg id="canvas">
      <!-- Flow diagram content -->
    </svg>
  </div>
  <div id="nf-footer">
    <!-- Footer content -->
  </div>
</body>
```

### 3. Working Selector Patterns for NiFi

#### Canvas Selectors
```javascript
// Primary canvas selectors
CANVAS_CONTAINER: '#canvas-container, .canvas-container, [id*="canvas"]'
CANVAS_SVG: '#canvas, svg[id*="canvas"], .canvas svg'

// Fallback selectors
CANVAS_FALLBACK: 'svg, [role="img"], .flow-canvas'
```

#### Toolbar Selectors
```javascript
// Toolbar and button selectors
TOOLBAR: '#nf-header, .nf-header, .toolbar, [role="toolbar"]'
ADD_PROCESSOR_BUTTON: 'button[title*="Add"], button[aria-label*="Add"], .add-processor'
```

#### Dialog Selectors
```javascript
// Dialog and modal selectors
DIALOG: '.dialog, [role="dialog"], .modal, .popup'
PROCESSOR_DIALOG: '.processor-dialog, [id*="processor"], [class*="processor"]'
```

## Research-Based Recommendations

### 1. Use Generic Selectors First
Start with the most common web patterns:
```javascript
// Generic approach
cy.get('svg').should('exist')
cy.get('[role="button"]').contains('Add').click()
cy.get('[role="dialog"]').should('be.visible')
```

### 2. Inspect Real NiFi DOM
Since we have a working NiFi instance, we should:
1. Open browser dev tools on the running NiFi instance
2. Inspect the actual DOM structure
3. Identify the real selectors used
4. Update our constants accordingly

### 3. Progressive Enhancement Strategy
```javascript
// Try multiple selector strategies
function findCanvas() {
  const selectors = [
    '#canvas',
    'svg[id*="canvas"]', 
    '.canvas svg',
    'svg',
    '[role="img"]'
  ];
  
  for (const selector of selectors) {
    const element = Cypress.$(selector);
    if (element.length > 0) {
      return selector;
    }
  }
  throw new Error('Canvas not found with any selector');
}
```

## Cypress Best Practices for NiFi

### 1. Wait Strategies
NiFi UI loads asynchronously, so use proper waits:
```javascript
// Wait for canvas to be ready
cy.get('svg', { timeout: 15000 }).should('be.visible')
cy.get('svg').should('have.attr', 'width')
cy.get('svg').should('have.attr', 'height')
```

### 2. Interaction Patterns
NiFi uses specific interaction patterns:
```javascript
// Right-click for context menu
cy.get('svg').rightclick(400, 300)

// Double-click to add processor
cy.get('svg').dblclick(400, 300)

// Drag and drop for connections
cy.get('.processor').trigger('mousedown')
cy.get('svg').trigger('mousemove', { clientX: 500, clientY: 400 })
cy.get('svg').trigger('mouseup')
```

### 3. Error Handling
```javascript
// Robust element finding
cy.get('body').then(($body) => {
  if ($body.find('#canvas').length > 0) {
    // Use #canvas
  } else if ($body.find('svg').length > 0) {
    // Use svg fallback
  } else {
    throw new Error('No canvas found');
  }
});
```

## Action Items

### Immediate Fixes Needed
1. **Update constants.js** with generic selectors instead of Angular Material
2. **Fix Cypress chaining** issues (`.catch()` not available on Cypress commands)
3. **Inspect real NiFi DOM** to get actual selectors
4. **Update navigation-helper.js** to detect real NiFi page structure

### Research Tasks
1. **Manual DOM inspection** of running NiFi instance
2. **Test generic selectors** against real NiFi
3. **Document working patterns** for future reference
4. **Create fallback strategies** for different NiFi versions

## Expected Outcomes

After implementing these research findings:
- Tests should find the actual NiFi canvas
- Navigation should work with real NiFi UI structure  
- Processor add/remove should use correct interaction patterns
- Framework should be robust across different NiFi versions

## Next Steps

1. Inspect the running NiFi instance DOM structure
2. Update selectors based on actual findings
3. Test with generic selectors first
4. Implement progressive enhancement for robustness
5. Document the working patterns for team use