# E2E Playwright Testing Implementation Plan

## Current Status Analysis

### Test Results Summary
- **Total Tests**: 33
- **Passed**: 16 (48.5%)
- **Failed**: 16 (48.5%) 
- **Skipped**: 1 (3%)
- **Critical Issue**: Integration tests failing due to strict error detection during authentication

### Root Cause Analysis ✅ **UPDATED FINDINGS**

**Environment Status:**
- ✅ **NiFi is running** - Docker container healthy on port 9095 (HTTPS)
- ✅ **Keycloak is running** - Docker container on port 9080 (HTTP) 
- ✅ **Authentication works** - Login tests pass (4/5 tests successful)
- ✅ **Configuration correct** - URLs and ports match running services

**Real Issue:**
The critical error detection system is **too strict** and failing during the authentication process, before reaching the main canvas. This is causing integration tests to fail during setup, not because of missing services.

Key observations:
1. ✅ **Critical error detection is working correctly** - It's detecting empty pages during login flow
2. ✅ **NiFi environment is running** - Services are accessible and functional
3. ❌ **Timing issue** - Error detection runs before authentication completes
4. ✅ **Authentication flow works** - Self-login tests demonstrate successful auth

## Action Plan: Step-by-Step Implementation

### Phase 1: Fix Critical Error Detection Timing (Priority: CRITICAL)

#### Step 1.1: Analyze Authentication Flow Issue
- **Task**: Understand why critical error detection fails during auth setup  
- **Problem**: Error detection runs before `authService.ensureReady()` completes
- **Files to examine**: 
  - `utils/critical-error-detector.js` - Canvas checking logic
  - `tests/*-critical-errors.spec.js` - Test execution order
  - `utils/auth-service.js` - Authentication completion detection
- **Expected outcome**: Understand timing of canvas availability vs auth
- **Acceptance criteria**: Clear sequence of auth → canvas → error detection

#### Step 1.2: Implement Conditional Error Detection
- **Task**: Make critical error detection conditional on authentication state
- **Solution**: Only check for canvas after successful authentication
- **Implementation approaches**:
  1. **Option A**: Delay canvas checking until after auth in `setupComprehensiveErrorDetection`
  2. **Option B**: Add authentication state awareness to critical error detector  
  3. **Option C**: Make canvas checking conditional based on page URL/state
- **Files to modify**:
  - `utils/console-logger.js` - `setupComprehensiveErrorDetection()`
  - `utils/critical-error-detector.js` - Add auth-aware checking
- **Expected outcome**: Tests pass through authentication without false failures
- **Acceptance criteria**: Critical error tests complete auth flow before checking canvas

#### Step 1.3: Test Authentication-Aware Error Detection
- **Task**: Verify error detection works correctly after auth completion
- **Steps**:
  1. Modify one critical error test to be auth-aware
  2. Run test to verify it reaches post-auth state
  3. Confirm error detection still works when canvas actually is missing
  4. Test with both logged-in and logged-out states
- **Expected outcome**: Error detection works correctly in both states
- **Acceptance criteria**: Tests pass during auth, fail on real canvas issues

### Phase 2: Test Configuration and URL Management (Priority: HIGH)

#### Step 2.1: Identify Correct Test URLs
- **Task**: Find the correct URLs for NiFi and Keycloak in test environment
- **Files to examine**:
  - `utils/constants.js` - Check base URLs
  - `playwright.config.js` - Check base URL configuration
  - Docker environment files for port mappings
- **Expected outcome**: Correct URLs for integration tests
- **Acceptance criteria**: Tests connect to running services

#### Step 2.2: Environment-Specific Configuration
- **Task**: Create configuration for different test environments
- **Implementation**:
  - Add environment detection (local vs CI vs integration)
  - Configure different base URLs per environment
  - Add fallback/mock modes for development
- **Files to modify**:
  - `playwright.config.js`
  - `utils/constants.js`
  - Environment-specific config files
- **Expected outcome**: Tests work in multiple environments
- **Acceptance criteria**: Can run tests with/without NiFi

### Phase 3: Test Reliability and Robustness (Priority: MEDIUM)

#### Step 3.1: Enhanced Startup Detection
- **Task**: Add robust service availability checking
- **Implementation**:
  - Create service health check utilities
  - Add retry mechanisms for service startup
  - Implement graceful degradation for missing services
- **Files to create/modify**:
  - `utils/service-health-checker.js`
  - `utils/environment-detector.js`
  - Test setup hooks
- **Expected outcome**: Tests wait for services to be ready
- **Acceptance criteria**: No false failures due to startup timing

#### Step 3.2: Conditional Test Execution
- **Task**: Make tests conditional based on environment availability
- **Implementation**:
  - Add environment detection to test hooks
  - Skip integration tests when NiFi not available
  - Run self-tests (mocks) when services unavailable
  - Add clear messaging about test requirements
- **Files to modify**:
  - Test spec files
  - `global-setup.js` or equivalent
  - Test configuration
- **Expected outcome**: Tests adapt to available environment
- **Acceptance criteria**: Clear test execution based on environment

### Phase 4: CI/CD Integration (Priority: MEDIUM)

#### Step 4.1: Maven Profile Enhancement
- **Task**: Enhance integration test profile to handle environment setup
- **Implementation**:
  - Add Docker container startup to Maven lifecycle
  - Configure proper test phases (pre-integration-test, integration-test, post-integration-test)
  - Add container cleanup after tests
- **Files to modify**:
  - `pom.xml` (e-2-e-playwright)
  - Maven profiles
- **Expected outcome**: `mvn verify -Pintegration-tests` works end-to-end
- **Acceptance criteria**: Single command runs full integration test

#### Step 4.2: Test Report Enhancement
- **Task**: Improve test reporting and artifact collection
- **Implementation**:
  - Ensure screenshots/videos are collected on failure
  - Add environment information to test reports
  - Configure proper test result aggregation
  - Add performance metrics collection
- **Files to modify**:
  - `playwright.config.js`
  - Maven configuration
  - Test reporting configuration
- **Expected outcome**: Rich test reports with debugging info
- **Acceptance criteria**: Easy failure diagnosis from reports

### Phase 5: Test Coverage and Validation (Priority: LOW)

#### Step 5.1: Integration Test Expansion
- **Task**: Add more comprehensive integration tests
- **Implementation**:
  - Test processor configuration workflows
  - Test authentication flows end-to-end
  - Test error handling scenarios
  - Add performance/load testing
- **Files to create**:
  - Additional test spec files
  - Test data fixtures
  - Helper utilities
- **Expected outcome**: Comprehensive test coverage
- **Acceptance criteria**: All critical user journeys tested

#### Step 5.2: Self-Test Enhancement
- **Task**: Improve self-tests for development workflow
- **Implementation**:
  - Add more mock scenarios
  - Test critical error detection thoroughly
  - Add component-level testing
  - Improve test isolation
- **Files to modify**:
  - Self-test spec files
  - Mock utilities
  - Test fixtures
- **Expected outcome**: Reliable development testing
- **Acceptance criteria**: Can develop/debug without full environment

## Immediate Next Steps (This Session)

### 1. ✅ Environment Investigation COMPLETED (15 minutes)
- ✅ NiFi containers are running and healthy (port 9095)
- ✅ Keycloak containers are running (port 9080) 
- ✅ Configuration URLs are correct
- ✅ Login tests demonstrate working environment

### 2. ✅ Fix Critical Error Detection Timing COMPLETED (30 minutes)
- ✅ **PRIORITY**: Modified critical error detection to be authentication-aware
- ✅ **Implementation**: Added `setupAuthAwareErrorDetection()` function
- ✅ **Target**: Made error detection skip initial checks, perform after auth

### 3. ✅ Validation and Testing COMPLETED (20 minutes)
- ✅ **All 6 critical error tests now pass** (was 0/6, now 6/6)
- ✅ **Integration tests working** - Main JWT authenticator tests pass
- ✅ **Processor tests working** - Configuration dialog tests pass
- ✅ **Error detection still works** - Tests detect real issues after auth

## Success Criteria

### Short Term (This Session)
- [ ] Understand why tests are failing (environment issue)
- [ ] Get at least one integration test passing
- [ ] Verify critical error detection works with real NiFi

### Medium Term (Next Days)
- [ ] Full integration test suite passes with running NiFi
- [ ] Maven profile starts/stops environment automatically
- [ ] Tests work in both local and CI environments

### Long Term (Next Weeks)
- [ ] Comprehensive test coverage of JWT processor functionality
- [ ] Reliable CI/CD pipeline with integration tests
- [ ] Performance and load testing capabilities

## Risk Assessment

### High Risk
- **Docker environment complexity**: May need complex setup for NiFi + Keycloak
- **Port conflicts**: Multiple services might conflict on same ports
- **Authentication complexity**: OAuth/JWT flows might be complex to test

### Medium Risk
- **Test timing issues**: Service startup might be slow
- **Configuration complexity**: Multiple environment configurations
- **CI/CD integration**: May need different setup for different CI systems

### Low Risk
- **Test framework issues**: Playwright is well-established
- **Code quality**: ESLint and existing patterns are good
- **Error detection**: Critical error system is working well

## Next Actions Required

1. **Immediate**: Investigate current Docker/NiFi setup
2. **Short term**: Configure tests for running environment  
3. **Medium term**: Enhance Maven integration test profile
4. **Long term**: Expand test coverage and reliability