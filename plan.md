# NiFi JWT Extensions - Open Tasks

## 🚨 HIGH PRIORITY: E2E Integration Test Failures

### Current Test Status:
- ✅ **Unit Tests**: 630/630 passing (100%)
- ✅ **E2E Self-Tests**: 29/29 passing (100%)
- ❌ **E2E Integration Tests**: 11 test files with failures

### Key Finding:
**Since `self-processor-advanced.spec.js` passes, NiFi IS running and the processor IS available.** The failures are likely due to the integration tests not properly using the ProcessorService utility or other test implementation issues.

### 🔧 E2E Integration Test Fixes Needed:

#### 1. Failing Test: `01-verify-multi-issuer-jwt-token-authenticator-advanced.spec.js`
- [ ] Verify test is using ProcessorService.findJwtAuthenticator() correctly
- [ ] Check if test expects specific processor configuration not present
- [ ] Update test to handle dynamic processor IDs

#### 2. Failing Test: `02-verify-jwt-authenticator-customizer.spec.js`
- [ ] Fix locator issues for finding processor elements
- [ ] Ensure test uses proper frame switching for custom UI
- [ ] Update selectors to match current DOM structure

#### 3. Failing Test: `02-verify-jwt-custom-ui-tabs.spec.js`
- [ ] Fix tab navigation selectors
- [ ] Ensure proper wait conditions for tab content loading
- [ ] Update test to use data-testid attributes

#### 4. Failing Test: `03-verify-jwks-validation-button.spec.js`
- [ ] Fix JWKS validation button interaction
- [ ] Handle async validation responses properly
- [ ] Update error message expectations

#### 5. Failing Test: `03-verify-jwt-custom-ui-direct.spec.js`
- [ ] Fix direct UI access navigation
- [ ] Update frame detection logic
- [ ] Fix tab switching test functionality

#### 6. Failing Test: `04-verify-token-verification-tab.spec.js`
- [ ] Fix token input and verification flow
- [ ] Update result display selectors
- [ ] Handle token validation timing

#### 7. Failing Test: `05-verify-all-tab-content.spec.js`
- [ ] Update selectors for all tab content verification
- [ ] Fix content visibility checks
- [ ] Add proper wait conditions

#### 8. Failing Test: `05-verify-metrics-tab.spec.js`
- [ ] Handle missing `/nifi-api/processors/jwt/metrics` endpoint (404)
- [ ] Update test to check UI-only metrics display
- [ ] Add mock data handling or skip backend-dependent tests

#### 9. Failing Test: `06-simple-tab-content-check.spec.js`
- [ ] Simplify content verification approach
- [ ] Use more robust selectors
- [ ] Add retry logic for dynamic content

#### 10. Failing Test: `06-verify-help-tab.spec.js`
- [ ] Fix help content verification
- [ ] Update expected help text
- [ ] Handle dynamic content loading

#### 11. Failing Test: `08-verify-jwks-validation-complete.spec.js`
- [ ] Fix complete JWKS validation flow
- [ ] Update all validation scenarios
- [ ] Handle edge cases properly

### 🔍 Common Issues to Address:
1. **Missing Font Resources**: `fontawesome-webfont` files return 404
2. **Backend Endpoint Not Implemented**: `/nifi-api/processors/jwt/metrics` returns 404
3. **Timeout Issues**: Tests failing to find elements within timeout period
4. **Frame Navigation**: Custom UI iframe handling needs improvement

## 📝 LOW PRIORITY: Optional Improvements

### Infrastructure Setup (Optional)
- [ ] Document E2E test setup requirements clearly
- [ ] Create mock server for missing backend endpoints
- [ ] Add font resource files or update tests to ignore 404s

### Code Quality (Optional)
- [ ] Review console suppression in `src/test/js/setup.js`
- [ ] Improve test error messages and debugging output
- [ ] Add E2E test retry configuration

## ✅ COMPLETED TASKS

### Unit Test Achievements
- All 630 unit tests passing
- Test coverage exceeds 80% threshold for all target files
- Fixed metricsTab test data structure issues

### E2E Self-Test Achievements  
- All 29 self-tests passing
- Fixed browser logging and console capture
- Validated test infrastructure

### jQuery Migration
- Complete removal of jQuery/Cash-DOM
- Full vanilla JavaScript implementation
- All AJAX calls converted to Fetch API

*Last updated: July 30, 2025*