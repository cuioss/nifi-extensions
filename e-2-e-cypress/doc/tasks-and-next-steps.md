# NiFi Integration Test Tasks - Prioritized

## Current Status
- **Test Success Rate**: 71% (10/14 tests passing)
- **Login Stability**: 100% reliable (4/4 tests)
- **Infrastructure**: Docker environment operational  
- **Implementation Phase**: Production Ready - All core phases completed
- **Test Distribution**:
  - Login Tests: 4/4 ✅ (100%)
  - Processor Tests: 2/3 ⚠️ (67%)
  - Navigation Tests: 1/3 ⚠️ (33%)
  - Error Handling: 2/2 ✅ (100%)
  - Performance: 1/2 ⚠️ (50%)

## Performance Metrics
- **Total Test Suite**: ~45 seconds
- **Individual Test**: 2-5 seconds average
- **Login Overhead**: 7-8 seconds per session
- **Processor Addition**: 2-3 seconds per processor
- **Memory Usage**: ~500MB for Cypress + browser
- **Test Artifacts**: ~50MB per run

## Architecture Overview
- **Infrastructure**: Docker-based with NiFi 2.4.0 + Keycloak
- **Framework**: Cypress with 15+ custom commands
- **NAR Deployment**: Automatic via Maven (20MB NAR size)
- **Authentication**: Keycloak OIDC (admin/ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB)
- **Test Philosophy**: Testing custom processor logic using NiFi as a platform  

## Priority 1: Project Organization & Infrastructure (Critical)

### 1. Move e-2-e-cypress Artifacts to Module
**Goal**: Consolidate all end-to-end testing artifacts into the `e-2-e-cypress` module
- [x] Move `run-tests-quick.sh` from root to `e-2-e-cypress/scripts/`
- [x] Move `run-integration-tests.sh` from root to `e-2-e-cypress/scripts/`
- [x] Move root `package.json` and `package-lock.json` to `e-2-e-cypress/` (or remove if redundant)
- [x] Move `docs/local-integration-testing.md` to `e-2-e-cypress/doc/` (or determine if still needed)
- [x] Update script paths in pom.xml `local-integration-tests` profile
- [x] Update script references in documentation
- [x] Verify script paths in:
  - `.github/workflows/e2e-tests.yml`
  - All documentation references

**Completion Steps:**
- [x] Run full Maven build: `./mvnw clean install` - Fix all issues
- [x] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [x] Git commit with descriptive message

### 2. Robust Login Pattern
**File**: `/cypress/support/commands/login.js`
- [x] Simplify login approach - focus on "am I logged in?" not "how does login work?"
- [x] Add login state detection - check if already logged in before attempting login
- [x] Create login recovery - if login fails, try alternative approaches
- [x] Remove deep NiFi testing - we don't need to validate NiFi's login flow

**Implementation Details:**
- ✅ **State Detection**: `isLoggedIn()` command checks current authentication state
- ✅ **Robust Authentication**: `ensureAuthenticatedAndReady()` main command for tests
- ✅ **Recovery Mechanisms**: Multiple fallback strategies with retry logic
- ✅ **Performance Optimization**: `quickLoginCheck()` for beforeEach hooks
- ✅ **Backward Compatibility**: Legacy `nifiLogin()` command maintained
- ✅ **Anonymous Access Support**: Automatic detection and handling
- ✅ **Focus on Testing**: Commands prioritize getting to processor testing quickly

**Usage Examples:**
```javascript
// Recommended for new tests
cy.ensureAuthenticatedAndReady();

// Fast check for beforeEach
cy.quickLoginCheck();

// Legacy compatibility 
cy.nifiLogin(); // Uses robust pattern internally
```

**Test Results:** ✅ All login tests passing with new robust pattern

**Completion Steps:**
- [x] Run full Maven build: `./mvnw clean install` - All builds successful
- [x] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [x] Git commit with descriptive message

## Priority 2: Authentication & Navigation

### 3. Simple Navigation Pattern  
- [ ] Direct URL navigation - use direct URLs when possible instead of clicking through UI
- [ ] State-based navigation - check current location, navigate only if needed
- [ ] Remove navigation testing - we don't need to test NiFi's navigation
- [ ] Focus on destination reached - verify we're where we need to be, not how we got there
- [ ] Fix controller services navigation timeout (currently times out after 30 seconds)
- [ ] Improve cross-section navigation session maintenance
- [ ] Enhance Angular routing detection mechanisms

**Current Status**: 33% success rate (1/3 tests passing) - Navigation is a major improvement target

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 3: Processor State Detection (Foundation)

### 4. Processor Configuration Detection
**File**: `/cypress/support/commands/processor.js`
- [ ] Create `isProcessorConfigured()` command
- [ ] Add processor property inspection
- [ ] Create processor setup detection patterns
- [ ] Fix processor ID extraction inconsistency from Angular UI
- [ ] Improve processor element discovery mechanisms
- [ ] Create reliable processor reference system for testing

**Current Status**: 67% success rate (2/3 tests passing) - Processor ID extraction inconsistent

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 5. Processor ID Management
- [ ] Focus on functional ID extraction - get any working ID, don't test how IDs work
- [ ] Use processor types for identification - find processor by type when ID fails
- [ ] Create processor reference system - our own way to track processors for testing
- [ ] Remove complex ID validation - just get something that works for testing
- [ ] Improve multi-processor coordination reliability
- [ ] Enhance cleanup mechanisms for complex scenarios

**Current Issue**: Modern Angular UI doesn't expose IDs consistently, affecting multi-processor workflows

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 6. Custom Processor Testing Focus
- [ ] Create custom processor test patterns (JWT validation, multi-issuer configuration, error handling)
- [ ] Minimal NiFi interaction required (setup → trigger → verify)
- [ ] Focus on processor business logic (JWT token validation, multi-issuer handling, error conditions)

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 4: Test Optimization

### 7. Address Current Failure Patterns
**Goal**: Fix the most common test failure patterns identified from current testing
- [ ] Fix navigation timeouts - Angular routing detection issues (affects 33% success rate)
- [ ] Improve element discovery for dynamic UI elements
- [ ] Resolve processor ID extraction from modern UI (currently inconsistent)
- [ ] Fix session management across cross-navigation states
- [ ] Address controller services navigation timeout (currently fails after 30 seconds)

**Current Impact**: These issues affect 4/14 tests currently failing
**Estimated Effort**: 4-6 hours for navigation fixes, 6-8 hours for processor state detection

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 8. Remove NiFi Testing, Focus on Custom Logic
- [ ] Audit existing tests - identify what's testing NiFi vs our code
- [ ] Simplify test scenarios - remove complex NiFi interaction testing
- [ ] Focus on processor functionality - test our JWT validation, not NiFi's processor framework
- [ ] Use minimal viable NiFi setup - just enough to run our processors

**Goal**: Improve test stability from 71% to 90%+ by focusing on what we actually need to test

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 9. Robust Test Patterns
- [ ] Create stable test setup pattern (Login → Navigate → Verify processor → Test our logic)
- [ ] Add test isolation (each test gets clean processor state)
- [ ] Implement graceful degradation (tests continue if minor UI elements change)
- [ ] Improve test cleanup mechanisms for complex scenarios
- [ ] Create standard error recovery patterns for common failures

**Current Performance**: Average test takes 2-5 seconds, login overhead 7-8 seconds per session

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 5: Performance & Resource Optimization

### 10. Test Performance Improvements
**Goal**: Optimize test execution time and resource usage
- [ ] Reduce login overhead (currently 7-8 seconds per session)
- [ ] Optimize test suite execution (currently ~45 seconds total)
- [ ] Improve processor addition performance (currently 2-3 seconds per processor)
- [ ] Reduce memory usage (currently ~500MB for Cypress + browser)
- [ ] Minimize test artifacts size (currently ~50MB per run)

**Current Metrics**:
- Total Test Suite: ~45 seconds
- Individual Test: 2-5 seconds average
- Login Success Rate: 100%
- Basic Processor Operations: 95% success rate

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 6: Infrastructure Cleanup

### 11. Docker Script Consolidation
- [ ] Standardize remaining infrastructure scripts
- [ ] Create consistent script naming convention
- [ ] Improve script documentation
- [ ] Validate script dependencies
- [ ] Document current Docker environment setup (NiFi 2.4.0 + Keycloak)
- [ ] Update NAR deployment documentation (current location: `/target/nifi-deploy/`)

**Current Environment**: 
- NiFi Container (port 9094)
- Keycloak Container (port 9085) 
- NAR Size: ~20MB
- Authentication: Keycloak OIDC with 30-minute session timeout

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 12. Infrastructure Documentation Cleanup
- [ ] Audit infrastructure references in all documentation
- [ ] Update setup guides to use simplified docker-compose approach
- [ ] Remove references to deleted scripts from README files
- [ ] Create single source of truth for infrastructure setup instructions
- [ ] Document health check procedures and environment verification
- [ ] Update test environment access documentation (NiFi UI, Keycloak Admin)

**Current Test Environment Access**:
- NiFi UI: https://localhost:9095/nifi/
- Keycloak Admin: http://localhost:9085/auth/admin/
- Test Reports: `./tests-report/` directory
- Cypress UI: `npx cypress open`

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 13. Rewrite GitHub Actions E2E Workflow
**File**: `.github/workflows/e2e-tests.yml`
**Goal**: Completely rewrite workflow to use Maven profile-based structure with improved triggers
- [ ] Replace current workflow with Maven profile execution (`local-integration-tests`)
- [ ] Update workflow triggers to:
  - Manual triggering (`workflow_dispatch`)
  - Run on merges to main branch (`pull_request: closed` on `main`)
  - Run on version tags (`push: tags: v*.*.*`)
- [ ] Simplify workflow steps to use Maven profile instead of custom Docker orchestration
- [ ] Remove redundant script execution and use centralized Maven approach
- [ ] Update artifact collection to work with Maven-based execution
- [ ] Improve error handling and debugging output
- [ ] Test workflow changes in feature branch before merging

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 7: Advanced Features

### 14. Advanced Workflow Testing
- [ ] Multi-processor pipeline creation
- [ ] Processor configuration testing
- [ ] Data flow validation
- [ ] Error handling workflow testing

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 15. Performance Benchmarking
- [ ] Establish baseline performance metrics
- [ ] Create performance regression tests
- [ ] Monitor test execution times
- [ ] Optimize slow test scenarios

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 16. Test Data Management
- [ ] Implement test data setup/teardown
- [ ] Create reusable test fixtures
- [ ] Add data validation utilities
- [ ] Implement test isolation mechanisms

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 8: Documentation & Maintenance

### 17. Troubleshooting Documentation
- [ ] Create common failure pattern guide
- [ ] Document debugging procedures
- [ ] Add environment setup troubleshooting
- [ ] Create test maintenance procedures
- [ ] Document common failure patterns (navigation timeouts, element discovery, processor ID extraction, session management)
- [ ] Create debugging guide for Angular UI compatibility issues

**Common Failure Patterns Identified**:
1. Navigation Timeouts: Angular routing detection issues
2. Element Discovery: Dynamic UI element identification  
3. Processor ID Extraction: Modern UI doesn't expose IDs consistently
4. Session Management: Cross-navigation state maintenance

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 18. Recipe Documentation
- [ ] Create "how-to" guides for common test patterns
- [ ] Document custom command usage
- [ ] Add integration examples
- [ ] Create best practices guide
- [ ] Document the custom commands architecture
- [ ] Create examples for authentication, processor management, and navigation commands

**Current Custom Commands Available**:
- Authentication: `nifiLogin()`, `verifyLoggedIn()`, `ensureAuthenticatedAndReady()`
- Processor Management: `addProcessor()`, `isProcessorConfigured()`, `configureProcessor()`, `getProcessorElement()`, `cleanupAllProcessors()`
- Navigation: `navigateToCanvas()`, `navigateToControllerServices()`, `verifyCanvasAccessible()`

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 9: Long-term Vision

### 19. Advanced Integration Testing
- [ ] End-to-end workflow automation
- [ ] Performance load testing
- [ ] Security testing integration
- [ ] Multi-environment test support

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 20. CI/CD Integration Enhancement
- [ ] Parallel test execution
- [ ] Test result reporting and analytics
- [ ] Automated test maintenance
- [ ] Integration with deployment pipeline

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message
