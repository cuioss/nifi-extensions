# NiFi Integration Test Tasks - Prioritized

## Current Status
- **Test Success Rate**: 71% (10/14 tests passing)
- **Login Stability**: 100% reliable (4/4 tests)
- **Infrastructure**: Docker environment operational  

## Priority 1: Project Organization & Infrastructure (Critical)

### 1. Move e-2-e-cypress Artifacts to Module
**Goal**: Consolidate all end-to-end testing artifacts into the `e-2-e-cypress` module
- [ ] Move `run-tests-quick.sh` from root to `e-2-e-cypress/scripts/`
- [ ] Move `run-integration-tests.sh` from root to `e-2-e-cypress/scripts/`
- [ ] Move root `package.json` and `package-lock.json` to `e-2-e-cypress/` (or remove if redundant)
- [ ] Move `docs/local-integration-testing.md` to `e-2-e-cypress/doc/` (or determine if still needed)
- [ ] Update script paths in pom.xml `local-integration-tests` profile
- [ ] Update script references in documentation
- [ ] Verify script paths in:
  - `integration-testing/src/main/docker/copy-deployment.sh`
  - `.github/workflows/e2e-tests.yml`
  - All documentation references

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 2. Robust Login Pattern
**File**: `/cypress/support/commands/login.js`
- [ ] Simplify login approach - focus on "am I logged in?" not "how does login work?"
- [ ] Add login state detection - check if already logged in before attempting login
- [ ] Create login recovery - if login fails, try alternative approaches
- [ ] Remove deep NiFi testing - we don't need to validate NiFi's login flow

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 2: Authentication & Navigation

### 3. Simple Navigation Pattern  
- [ ] Direct URL navigation - use direct URLs when possible instead of clicking through UI
- [ ] State-based navigation - check current location, navigate only if needed
- [ ] Remove navigation testing - we don't need to test NiFi's navigation
- [ ] Focus on destination reached - verify we're where we need to be, not how we got there

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

### 7. Remove NiFi Testing, Focus on Custom Logic
- [ ] Audit existing tests - identify what's testing NiFi vs our code
- [ ] Simplify test scenarios - remove complex NiFi interaction testing
- [ ] Focus on processor functionality - test our JWT validation, not NiFi's processor framework
- [ ] Use minimal viable NiFi setup - just enough to run our processors

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 8. Robust Test Patterns
- [ ] Create stable test setup pattern (Login → Navigate → Verify processor → Test our logic)
- [ ] Add test isolation (each test gets clean processor state)
- [ ] Implement graceful degradation (tests continue if minor UI elements change)

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 5: Infrastructure Cleanup

### 9. Docker Script Consolidation
- [ ] Standardize remaining infrastructure scripts
- [ ] Create consistent script naming convention
- [ ] Improve script documentation
- [ ] Validate script dependencies

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 10. Infrastructure Documentation Cleanup  
- [ ] Audit infrastructure references in all documentation
- [ ] Update setup guides to use simplified docker-compose approach
- [ ] Remove references to deleted scripts from README files
- [ ] Create single source of truth for infrastructure setup instructions

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 11. Rewrite GitHub Actions E2E Workflow
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

## Priority 6: Advanced Features

### 12. Advanced Workflow Testing
- [ ] Multi-processor pipeline creation
- [ ] Processor configuration testing
- [ ] Data flow validation
- [ ] Error handling workflow testing

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 13. Performance Benchmarking
- [ ] Establish baseline performance metrics
- [ ] Create performance regression tests
- [ ] Monitor test execution times
- [ ] Optimize slow test scenarios

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 14. Test Data Management
- [ ] Implement test data setup/teardown
- [ ] Create reusable test fixtures
- [ ] Add data validation utilities
- [ ] Implement test isolation mechanisms

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 7: Documentation & Maintenance

### 15. Troubleshooting Documentation
- [ ] Create common failure pattern guide
- [ ] Document debugging procedures
- [ ] Add environment setup troubleshooting
- [ ] Create test maintenance procedures

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 16. Recipe Documentation
- [ ] Create "how-to" guides for common test patterns
- [ ] Document custom command usage
- [ ] Add integration examples
- [ ] Create best practices guide

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

## Priority 8: Long-term Vision

### 17. Advanced Integration Testing
- [ ] End-to-end workflow automation
- [ ] Performance load testing
- [ ] Security testing integration
- [ ] Multi-environment test support

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message

### 18. CI/CD Integration Enhancement
- [ ] Parallel test execution
- [ ] Test result reporting and analytics
- [ ] Automated test maintenance
- [ ] Integration with deployment pipeline

**Completion Steps:**
- [ ] Run full Maven build: `./mvnw clean install` - Fix all issues
- [ ] Run integration tests: `./mvnw test -Plocal-integration-tests -Dintegration.test.local=true` - Fix all issues
- [ ] Update `e-2-e-cypress/doc/tasks-and-next-steps.md` with completion status
- [ ] Git commit with descriptive message
