# NiFi E2E Playwright Testing Framework - Scope and Capabilities

## Overview

This document defines the scope and capabilities of the NiFi E2E Playwright testing framework after refactoring to focus on processor verification and interaction rather than lifecycle management.

## ✅ Supported Operations

### Authentication & Navigation
- **Login/Logout**: Full authentication flow with NiFi instances
- **Page Navigation**: Navigate between different NiFi pages
- **Session Management**: Maintain and verify authentication state
- **Page Verification**: Verify correct page types and readiness

### Processor Discovery & Verification
- **Processor Finding**: Locate existing processors on the canvas by name/type
- **Deployment Verification**: Verify processors are correctly deployed
- **Status Checking**: Extract processor status and state information
- **Property Inspection**: Access processor properties and configuration
- **Visibility Verification**: Confirm processors are visible on the canvas

### Canvas Analysis
- **Element Detection**: Find and analyze canvas elements
- **Position Tracking**: Get processor positions and layout information
- **State Monitoring**: Monitor processor states and changes
- **Screenshot Capture**: Take screenshots for debugging and verification

### Processor Interaction
- **Double-click Actions**: Attempt to open processor configuration dialogs
- **Element Access**: Direct access to processor DOM elements
- **Basic Interactions**: Simple interactions with processor elements

## ❌ Limitations and Restrictions

### UI Lifecycle Management
- **Adding Processors**: Cannot drag-and-drop processors from toolbar to canvas
- **Removing Processors**: Cannot delete processors through context menus
- **Component Creation**: Cannot create new NiFi components
- **Component Deletion**: Cannot remove existing NiFi components

### Complex UI Interactions
- **Drag-and-Drop**: Limited support for complex drag-and-drop operations
- **Context Menus**: Unreliable interaction with right-click context menus
- **Modal Dialogs**: Configuration dialogs may not consistently appear
- **Complex Workflows**: Multi-step UI workflows are not supported

### Technical Reasons for Limitations
1. **Angular Material Complexity**: NiFi's Angular Material UI has complex event handling
2. **Dynamic DOM**: Canvas elements are dynamically generated and managed
3. **Event Propagation**: UI events don't always propagate correctly in test environment
4. **State Management**: NiFi's state management interferes with test automation

## 🎯 Recommended Testing Strategy

### Pre-Test Setup
1. **Deploy processors manually** through NiFi's standard deployment process
2. **Configure test environment** with required processors already on canvas
3. **Ensure clean state** before running tests

### Test Implementation
1. **Focus on verification** rather than creation
2. **Test processor functionality** rather than UI operations
3. **Verify deployment and status** of existing processors
4. **Check configuration and properties** of deployed processors

### Example Test Patterns

#### ✅ Good Test Pattern
```javascript
test("should verify processor deployment", async ({ page }) => {
  // Verify processor is deployed and accessible
  const verification = await verifyProcessorDeployment(page, "MyProcessor");
  
  expect(verification.found).toBeTruthy();
  expect(verification.visible).toBeTruthy();
  expect(verification.details.name).toContain("MyProcessor");
});
```

#### ❌ Avoid This Pattern
```javascript
test("should add and remove processor", async ({ page }) => {
  // This will fail due to technical limitations
  await addProcessor(page, "MyProcessor");  // NOT SUPPORTED
  await removeProcessor(page, "MyProcessor");  // NOT SUPPORTED
});
```

## 🔧 Framework Architecture

### Core Components
- **processor-tool.js**: Processor discovery and verification utilities
- **login-tool.js**: Authentication and session management
- **navigation-tool.js**: Page navigation and verification
- **constants.js**: Selectors and configuration constants

### Test Structure
```
tests/
├── self-processor.spec.js          # Processor verification tests
├── self-login-tool.spec.js         # Authentication tests
└── self-navigation-tool.spec.js    # Navigation tests
```

### Utility Functions
- `findProcessor()`: Locate processors on canvas
- `verifyProcessorDeployment()`: Comprehensive processor verification
- `interactWithProcessor()`: Basic processor interaction
- `ensureNiFiReady()`: Prepare NiFi for testing

## 📋 Test Checklist

Before writing tests, ensure:
- [ ] Processors are deployed through standard NiFi deployment
- [ ] Test focuses on verification rather than creation
- [ ] Expectations are realistic for framework capabilities
- [ ] Error handling accounts for UI limitations
- [ ] Screenshots are captured for debugging

## 🐛 Troubleshooting

### Common Issues
1. **Processor not found**: Check deployment and selector accuracy
2. **Interaction failures**: Expected due to dialog complexity
3. **Authentication issues**: Verify credentials and service availability
4. **Timeout errors**: Increase timeouts for slow UI loading

### Debug Resources
- Screenshots automatically captured in `target/screenshots/`
- Browser console logs available in test output
- Network requests logged for authentication debugging
- Page context information for state verification

## 📈 Future Enhancements

### Potential Improvements
1. **Enhanced Status Detection**: More sophisticated processor state analysis
2. **Configuration Reading**: Better property extraction from processors
3. **Batch Operations**: Support for testing multiple processors
4. **Integration Testing**: Cross-processor workflow verification

### Research Areas
1. **Alternative Interaction Methods**: Find ways to bypass UI limitations
2. **API Integration**: Combine UI tests with REST API verification
3. **Performance Monitoring**: Add performance metrics to tests
4. **Error Pattern Analysis**: Improve error detection and reporting

This framework provides a solid foundation for verifying NiFi processor deployment and basic functionality within the defined scope and limitations.