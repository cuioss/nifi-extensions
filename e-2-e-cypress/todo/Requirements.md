# E2E Cypress Testing Requirements

## 🎯 Purpose

This document defines **WHAT** should be tested by each self-test category, not **HOW** to implement the tests. These requirements ensure comprehensive validation of the NiFi JWT authentication extension across all critical user workflows and system integration points.

## 📋 Test Categories & Requirements

### 1. 🔐 Authentication & Login Tests (`**/login*.cy.js`)

#### Core Requirements:
- **Anonymous Access Validation**: Verify system correctly handles anonymous access mode without requiring credentials
- **Login State Detection**: Validate accurate detection of logged-in vs logged-out states across different UI contexts
- **Session Persistence**: Confirm authentication state persists across page navigation and browser refresh
- **Login Flow Integrity**: Ensure complete user authentication workflow functions end-to-end
- **Permission Verification**: Validate user has appropriate permissions to access processor configuration

#### Success Criteria:
- ✅ User can access NiFi UI without authentication prompts
- ✅ All UI components are accessible and interactive after login
- ✅ Authentication state correctly detected in all scenarios
- ✅ No false positives from shallow element presence checks
- ✅ Full user workflow functionality verified, not just UI element existence

#### Critical Integration Points:
- Canvas accessibility and interaction
- Processor configuration dialogs
- Advanced settings access
- Administrative functions

---

### 2. 🔧 Processor Deployment Tests (`**/deployment*.cy.js`)

#### Core Requirements:
- **NAR Deployment Verification**: Confirm custom JWT processors are properly deployed and discoverable
- **Processor Availability**: Validate both `MultiIssuerJWTTokenAuthenticator` and `JWTTokenAuthenticator` appear in processor catalog
- **Processor Instantiation**: Verify processors can be successfully added to NiFi canvas
- **Configuration Interface Access**: Ensure processor configuration dialogs open and are interactive
- **Advanced UI Loading**: Validate custom JWT validator UI loads without hanging or errors

#### Success Criteria:
- ✅ All JWT processors visible in processor catalog
- ✅ Processors can be added to canvas successfully
- ✅ Configuration dialogs open and display properly
- ✅ Advanced settings accessible without UI hang
- ✅ Custom UI components load and function correctly
- ✅ No "Loading JWT Validator UI..." infinite loading states

#### Critical Failure Detection:
- UI loading hangs or timeout errors
- Missing processor types in catalog
- Configuration dialog access failures
- Custom UI component loading failures

---

### 3. ⚙️ Advanced Settings Tests (`**/advanced-settings*.cy.js`)

#### Core Requirements:
- **UI Component Loading**: Verify all custom JWT validation UI components load properly
- **Tab Navigation**: Validate tab-based navigation within advanced settings works correctly
- **Form Interaction**: Ensure all form fields, dropdowns, and inputs are accessible and functional
- **Help System Integration**: Confirm help tooltips and documentation display correctly
- **Configuration Persistence**: Validate settings are saved and retrieved accurately
- **Error Handling**: Verify appropriate error messages for invalid configurations

#### Success Criteria:
- ✅ Advanced settings dialog opens without errors
- ✅ All tabs and sections are accessible
- ✅ Form controls respond to user input
- ✅ Help tooltips display relevant information
- ✅ Configuration changes persist correctly
- ✅ Invalid inputs show appropriate validation errors

#### UI Component Requirements:
- Issuer configuration interface accessibility
- Token verification interface functionality
- JWKS endpoint configuration options
- Multi-issuer property management
- Interactive custom UI elements

---

### 4. 🔍 Functional Validation Tests (`**/functional*.cy.js`)

#### Core Requirements:
- **JWT Token Processing**: Validate actual JWT token validation functionality works correctly
- **Multi-Issuer Support**: Verify support for multiple JWT issuers functions as designed
- **JWKS Integration**: Confirm JWKS endpoint configuration and key retrieval works
- **Token Verification**: Validate token verification process handles valid and invalid tokens appropriately
- **Error Scenario Handling**: Ensure system gracefully handles malformed tokens, network errors, and configuration issues

#### Success Criteria:
- ✅ Valid JWT tokens are processed successfully
- ✅ Invalid tokens are properly rejected with appropriate error messages
- ✅ Multiple issuer configurations function independently
- ✅ JWKS endpoint connectivity and key validation works
- ✅ Network timeouts and errors handled gracefully
- ✅ System degrades gracefully under error conditions

#### Test Scenarios:
- Valid token validation workflows
- Invalid token rejection scenarios
- Network connectivity issues
- Malformed configuration handling
- Performance under normal load

---

### 5. 🏗️ Integration & System Tests (`**/integration*.cy.js`)

#### Core Requirements:
- **End-to-End Workflow**: Validate complete user workflows from login to JWT validation
- **System Integration**: Verify integration with NiFi core components functions correctly
- **Performance Validation**: Ensure system performs adequately under expected load
- **Compatibility Testing**: Validate compatibility with different NiFi versions and configurations
- **Container Integration**: Verify system works correctly in containerized environments

#### Success Criteria:
- ✅ Complete user workflows execute successfully
- ✅ Integration with NiFi core is seamless
- ✅ Performance meets acceptable thresholds
- ✅ System works across supported NiFi versions
- ✅ Container deployment and operation is stable

#### Integration Points:
- NiFi Flow File processing
- Processor lifecycle management
- Configuration management integration
- Administrative interface integration

---

### 6. 🚨 Error Detection & Recovery Tests (`**/error-handling*.cy.js`)

#### Core Requirements:
- **Console Error Detection**: Identify and report all JavaScript console errors during operation
- **UI Error States**: Validate appropriate error messages display for various failure scenarios
- **Recovery Mechanisms**: Verify system can recover from transient errors
- **Logging Integration**: Ensure errors are properly logged for debugging purposes
- **User Experience**: Confirm users receive clear, actionable error messages

#### Success Criteria:
- ✅ All console errors are captured and reported
- ✅ Error messages are clear and actionable
- ✅ System recovers gracefully from transient failures
- ✅ Error states don't prevent system usage
- ✅ Debugging information is available when needed

#### Error Scenarios:
- Network connectivity failures
- Invalid configuration states
- Resource unavailability
- Permission denied scenarios
- System timeout conditions

---

## 🎯 Cross-Cutting Requirements

### Performance Requirements:
- **Startup Time**: System components load within acceptable time limits
- **Response Time**: User interactions receive feedback within 2 seconds
- **Memory Usage**: System operates within reasonable memory constraints
- **Stability**: System remains stable during extended operation

### Usability Requirements:
- **Accessibility**: UI components are accessible to users with disabilities
- **Intuitive Operation**: Common workflows are discoverable and logical
- **Help Integration**: Context-sensitive help is available throughout the system
- **Error Prevention**: System prevents common user errors through good design

### Security Requirements:
- **Token Security**: JWT tokens are handled securely throughout the system
- **Configuration Security**: Sensitive configuration data is protected
- **Access Control**: Appropriate access controls are enforced
- **Audit Trail**: Security-relevant actions are logged appropriately

---

## 🔄 Test Execution Principles

### 1. **Complete Workflow Testing**
Tests must validate entire user workflows, not just individual component functionality. Shallow tests that only check element presence can provide false confidence.

### 2. **Real-World Scenarios**
Tests should mirror actual user behavior and real-world usage patterns, including error conditions and edge cases.

### 3. **Integration Over Isolation**
While unit tests focus on isolation, these E2E tests must validate integration between components and systems.

### 4. **Failure Detection**
Tests must be capable of detecting both obvious failures and subtle degradation in system behavior.

### 5. **Maintainability**
Test requirements should be stable even as implementation details change, focusing on user-visible behavior rather than internal mechanics.

---

## 📊 Success Metrics

### Overall System Health:
- **Test Pass Rate**: ≥95% of tests should pass consistently
- **Coverage**: All critical user workflows covered by automated tests
- **Reliability**: Tests should be stable and not prone to false failures
- **Execution Time**: Full test suite completes within reasonable time limits

### Quality Gates:
- No console errors during normal operation
- All processor types available and functional
- Complete user workflows execute successfully
- System performs adequately under expected load
- Error conditions are handled gracefully

This requirements document serves as the foundation for implementing comprehensive E2E tests that validate the complete JWT authentication extension functionality within the NiFi environment.
