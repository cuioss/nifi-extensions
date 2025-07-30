# Fix Integration Tests Plan

## 🚨 CRITICAL: Prerequisites
1. Start NiFi: `./integration-testing/src/main/docker/run-and-deploy.sh`
2. Add Multi Issuer JWT Authenticator processor to canvas manually
3. Run tests: `./mvnw clean install`

## Critical Rule: Vanilla JavaScript Preference
**The preferred way is to use vanilla JavaScript where possible: fetch instead of ajax. If it is not too complex to implement without jQuery/cash, always resort to vanilla JS.**

## 🔴 CRITICAL TASKS - Build Blocking

### 1. Fix Unit Test Failures (74 failures) - BUILD BLOCKING ❌

**Status**: `mvn clean install` fails in nifi-cuioss-ui module

#### Test Files to Fix:
1. **domBuilder-coverage.test.js**
   - [ ] Fix FormFieldBuilder.createField undefined error
   - [ ] Fix FormFieldBuilder.createFields undefined error
   - [ ] Align test with vanilla JS implementation

2. **bundle.test.js**
   - [ ] Fix hideLoadingIndicatorImmediate not a function error
   - [ ] Fix main.init not being called
   - [ ] Fix module export issues

3. **uiErrorDisplay.test.js**
   - [ ] Fix DOM manipulation failures
   - [ ] Update mocks for vanilla JS

4. **issuerConfigEditor.test.js**
   - [ ] Fix form.querySelector is not a function
   - [ ] Fix JWKS validation response handling
   - [ ] Add DOM methods to mock objects

5. **main.real.test.js**
   - [ ] Fix dialogOpen event handling
   - [ ] Fix initTooltips not being called

6. **tokenVerifier.test.js**
   - [ ] Fix remaining test failures from vanilla JS migration

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

### Build Status: ❌ FAILING
- **Unit Tests**: 74 failures, 482 passed - BUILD BLOCKING
- **Integration Tests** (with processor on canvas):
  - Self-tests: ✅ All 5 pass
  - JWKS tests: 2 pass, 2 fail (backend 403)
  - Tests fail fast when processor missing (correct behavior)

### Completed Items:
- ✅ jQuery/Cash-DOM migration complete
- ✅ ESLint errors fixed
- ✅ Bundle loading fixed
- ✅ DOM manipulation fixed
- ✅ Error handling implemented