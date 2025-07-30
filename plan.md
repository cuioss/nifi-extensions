# Fix Integration Tests Plan

## 🚨 CRITICAL: Prerequisites
1. Start NiFi: `./integration-testing/src/main/docker/run-and-deploy.sh`
2. Add Multi Issuer JWT Authenticator processor to canvas manually
3. Run tests: `./mvnw clean install`

## Critical Rule: Vanilla JavaScript Preference
**The preferred way is to use vanilla JavaScript where possible: fetch instead of ajax. If it is not too complex to implement without jQuery/cash, always resort to vanilla JS.**

## Test Strategy: Complete Rewrite Over jQuery Replication
**Important**: When fixing failing tests, DO NOT attempt to replicate the previous jQuery-based structure with mocks and workarounds. Instead:
- Completely rewrite tests to match the new vanilla JavaScript implementation
- Test actual DOM behavior instead of mocking jQuery methods
- Example: Instead of mocking `fadeOut()`, test CSS transitions directly
- This approach is cleaner, more maintainable, and tests what actually happens

## 🔴 CRITICAL TASKS - Build Blocking

### 1. Fix Unit Test Failures - IN PROGRESS 🔄

**Status**: Unit tests being fixed one by one

#### Test Files Fixed: ✅
1. **domBuilder-coverage.test.js** ✅
   - ✅ Added FormFieldBuilder export alias for SimpleDOMFieldBuilder
   - ✅ Fixed test compatibility with vanilla JS implementation

2. **bundle.test.js** ✅
   - ✅ Created bundle-wrapper.js to provide expected interface
   - ✅ Updated vite config to build from wrapper
   - ✅ Simplified tests to work with minified bundle

3. **confirmationDialog.test.js** ✅
   - ✅ Fixed button text whitespace issue

4. **uiErrorDisplay.test.js** ✅
   - ✅ Fixed jQuery object handling in display functions
   - ✅ Rewrote fadeOut tests for CSS transitions instead of jQuery
   - ✅ All 48 tests passing (0 skipped)

#### Test Files Remaining:
1. **issuerConfigEditor.test.js** - HEAVY jQuery migration needed
   - [ ] Remove extensive cash-dom mocking (find, val, html, text, append)
   - [ ] Replace $.ajax mocks with fetch API mocks
   - [ ] Convert jQuery-style selectors to vanilla JS
   - [ ] Replace addClass/removeClass/show/hide tests with actual DOM tests
   - [ ] Fix form.querySelector is not a function
   - [ ] Fix JWKS validation response handling

2. **main.real.test.js** - jQuery event migration needed
   - [ ] Remove cash-dom import
   - [ ] Replace $(document).trigger() with native dispatchEvent
   - [ ] Convert jQuery-style document ready tests
   - [ ] Fix dialogOpen event handling
   - [ ] Fix initTooltips not being called

### 2. Implement Backend Endpoints

#### Required Endpoints:
1. **JWKS Validation** `/nifi-api/processors/jwks/validate-url`
   - [ ] Implement endpoint (currently returns 403)
   - [ ] Required for 2 failing integration tests

2. **Metrics** `/nifi-api/processors/jwt/metrics`
   - [ ] Implement endpoint (currently returns 404)
   - [ ] UI already handles 404 gracefully

3. **Token Verification**
   - [ ] Implement backend verification logic
   - [ ] UI works with mock data currently

## Test Status Summary

### Build Status: 🔄 IN PROGRESS
- **Unit Tests**: ~6 failures remaining (4 test suites fixed)
- **Integration Tests** (with processor on canvas):
  - Self-tests: ✅ All 5 pass
  - JWKS tests: 2 pass, 2 fail (backend 403)
  - Tests fail fast when processor missing (correct behavior)

### 3. Additional Test Files Needing jQuery Migration

Based on analysis, these test files also contain jQuery patterns:

1. **uiErrorDisplay.test.js** - Despite being "fixed", still uses cash-dom
   - [ ] Remove cash-dom import
   - [ ] Replace $('<div>') with document.createElement()
   - [ ] Convert $(document.body).append() to native appendChild
   - [ ] Replace $targetElement.find() with querySelector
   - [ ] Convert .text(), .html(), .hasClass() to native methods

2. **test-utils.js** - Contains jQuery ajax mock utilities
   - [ ] Replace createAjaxMock with fetch-based mock utilities
   - [ ] Remove cash-dom specific test helpers

3. **apiClient.test.js** - Still has jQuery-style patterns
   - [ ] Remove mockAjax object simulating jQuery behavior
   - [ ] Remove jQuery promise pattern tests (done, fail, always)
   - [ ] Simplify to pure fetch API testing

4. **bundle.test.js** - Still mocks jQuery
   - [ ] Remove jest.mock('jquery') call
   - [ ] Verify no jQuery dependencies remain

### Completed Items:
- ✅ jQuery/Cash-DOM migration complete (for implementation)
- ✅ ESLint errors fixed
- ✅ Bundle loading fixed
- ✅ DOM manipulation fixed
- ✅ Error handling implemented
- ✅ Test strategy defined: Complete rewrite over jQuery replication