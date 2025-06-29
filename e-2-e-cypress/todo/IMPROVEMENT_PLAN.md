# NiFi Component Testing Framework - Improvement Plan

## Executive Summary

The current e2e Cypress testing framework is in a preliminary state with significant gaps that prevent it from being an effective base framework for testing NiFi components. This plan outlines the necessary improvements to create a robust, reliable testing foundation.

## 🚀 **IMPORTANT: Container Startup Workflow**

### **Step 1: Start the Test Container Environment**

**The `integration-testing/src/main/docker/run-test-container.sh` script is the primary way to start the test container environment.**

```bash
# From the project root directory
./integration-testing/src/main/docker/run-test-container.sh
```

**What this script does:**
- Builds and copies the NAR file via `copy-deployment.sh`
- Generates SSL certificates if needed for HTTPS mode
- Starts NiFi and Keycloak containers via `start-nifi.sh`
- Provides test credentials:
  - **Keycloak realm**: `oauth_integration_tests`
  - **Test user**: `testUser` / password: `drowssap`
  - **Test client**: `test_client` / secret: `yTKslWLtf4giJcWCaoVJ20H8sy6STexM`

### **Step 2: Run Cypress Tests**

**After the container environment is running, you can run Cypress tests directly:**

```bash
# Navigate to the e2e test directory
cd e-2-e-cypress

# Run tests in headless mode
npx cypress run

# Or open Cypress UI for interactive testing
npx cypress open

# Run specific test files
npx cypress run --spec "cypress/e2e/integration/01-nifi-authentication.cy.js"
npx cypress run --spec "cypress/e2e/mocked/01-processor-add-remove-mocked.cy.js"
```

### **Container Management**

```bash
# Stop the test environment
./integration-testing/src/main/docker/stop-test-container.sh

# View container logs
docker compose -f integration-testing/src/main/docker/docker-compose.yml logs nifi
docker compose -f integration-testing/src/main/docker/docker-compose.yml logs keycloak
```

### **Test Environment URLs**
- **NiFi**: https://localhost:9095/nifi
- **Keycloak**: https://localhost:9085/auth

---

## Current State Analysis - Critical Findings from todo/CURRENT_STATE_DOCUMENTATION.md

### 🚨 **FUNDAMENTAL PROBLEM: No Real NiFi UI Knowledge**

**The implementation is based on assumptions about NiFi's DOM structure rather than actual inspection of a running NiFi instance.**

This is the root cause of all other issues:
- Canvas selectors don't match real NiFi UI elements
- Processor selectors are generic assumptions that fail in practice
- Dialog interaction patterns are incorrect for actual NiFi
- No reliable way to detect or interact with real NiFi components

### What Works (Infrastructure Only)
- ✅ Basic project structure and Cypress configuration
- ✅ Authentication helper with cy.session() implementation
- ✅ Navigation helper with page type detection
- ✅ JWT test fixtures prepared (tokens and JWKS)
- ✅ Real service integration (NiFi at localhost:9095, Keycloak at localhost:9085)
- ✅ Comprehensive logging and error tracking system
- ✅ Test organization with integration/mocked separation
- ✅ Processor type definitions and metadata management

### What's Completely Broken (Core Functionality)
- ❌ **Canvas Operations**: Cannot interact with real NiFi canvas
- ❌ **Processor Operations**: Cannot add/remove processors from real NiFi
- ❌ **Dialog Operations**: Cannot open Add Processor dialogs
- ❌ **Processor Detection**: Cannot find processors on real NiFi canvas
- ❌ **Mock Implementation**: Even mocked tests fail due to implementation bugs
- ❌ **Integration Tests**: Impossible without correct NiFi UI knowledge

### Current Reality Check
**See todo/CURRENT_STATE_DOCUMENTATION.md for complete analysis**
- Framework has solid infrastructure but **ZERO working core functionality**
- Neither mocked nor integration tests work reliably
- **NOT READY FOR PRODUCTION USE** - requires complete rework of core operations
- **EVERYTHING depends on first analyzing actual NiFi DOM structure**

## Improvement Plan - Reorganized Based on Critical Findings

### 🚨 **Phase 0: NiFi Structure Analysis (ABSOLUTE PRIORITY)**

**This phase MUST be completed first. Everything else depends on understanding the real NiFi DOM structure.**

#### 0.1 Analyze Actual NiFi DOM Structure
**Critical Need**: Current selectors are based on assumptions, not reality

**Actions**:
- [ ] Start NiFi container using `integration-testing/src/main/docker/run-test-container.sh`
- [ ] Open browser developer tools on running NiFi instance (https://localhost:9095/nifi)
- [ ] Document actual canvas DOM structure and element hierarchy
- [ ] Identify real canvas selectors (not assumptions)
- [ ] Document actual processor element structure on canvas
- [ ] Identify real toolbar button selectors for "Add Processor"
- [ ] Document actual context menu structure and selectors
- [ ] Analyze Add Processor dialog DOM structure when it appears
- [ ] Document processor type list structure in dialog
- [ ] Create comprehensive selector mapping document

#### 0.2 Document Real NiFi UI Interaction Patterns
**Critical Need**: Current interaction patterns are incorrect

**Actions**:
- [ ] Document how to actually open Add Processor dialog (toolbar vs right-click vs other)
- [ ] Document actual steps to add a processor to canvas
- [ ] Document how processors appear on canvas after addition
- [ ] Document actual steps to select and delete processors
- [ ] Document any required wait times or loading states
- [ ] Create step-by-step interaction guide with real selectors

#### 0.3 Validate Container Environment
**Critical Need**: Ensure test environment matches production NiFi

**Actions**:
- [ ] Verify NiFi version in container matches target version
- [ ] Confirm UI structure matches between container and production
- [ ] Document any container-specific differences
- [ ] Ensure SSL/authentication doesn't affect DOM structure
- [ ] Test that custom processors (JWT) appear correctly in UI

### Phase 1: Foundation Reconstruction (Priority: Critical)
**Can only start after Phase 0 is complete**

#### 1.1 Implement Real Canvas Operations
**Based on Phase 0 findings**

**Actions**:
- [ ] Replace all assumed selectors with real selectors from Phase 0
- [ ] Implement `findWorkingCanvas()` using actual canvas selectors
- [ ] Remove `body` element workaround completely
- [ ] Test canvas detection with real NiFi instance
- [ ] Implement proper canvas interaction (click, right-click, double-click)

#### 1.2 Implement Real Processor Operations
**Based on Phase 0 interaction patterns**

**Actions**:
- [ ] Implement actual "Add Processor" dialog opening using real method
- [ ] Implement processor type selection using real dialog structure
- [ ] Implement processor placement on canvas using real coordinates
- [ ] Implement processor detection using real processor selectors
- [ ] Implement processor removal using real context menu/selection
- [ ] Add proper wait conditions for each operation

#### 1.3 Fix Mock Implementation Bugs
**Current Issue**: Async/sync code mixing causes test failures

**Actions**:
- [ ] Fix `performMockedProcessorRemoval()` async/sync bug
- [ ] Ensure all mock operations return proper Cypress chainables
- [ ] Test mocked operations work independently
- [ ] Align mock behavior with real operations from Phase 0

### Phase 2: Mocking Strategy Implementation (Priority: High)

#### 2.1 API Mocking Framework
**Goal**: Fast, reliable tests independent of backend state

**Actions**:
- [ ] Implement NiFi REST API mocking with `cy.intercept()`
- [ ] Create processor lifecycle API mocks
- [ ] Mock authentication endpoints
- [ ] Create reusable mock data sets

#### 2.2 Hybrid Testing Approach
**Goal**: Both mocked (fast) and integration (real) test capabilities

**Actions**:
- [ ] Create mock test suite for rapid development
- [ ] Maintain integration test suite for end-to-end validation
- [ ] Implement test environment switching
- [ ] Document when to use each approach

### Phase 3: Component-Specific Testing (Priority: High)

#### 3.1 JWT Processor Testing Framework
**Goal**: Comprehensive testing of JWT processors

**Actions**:
- [ ] Implement JWT token validation testing
- [ ] Add multi-issuer scenario testing
- [ ] Create processor configuration testing
- [ ] Add error handling validation

#### 3.2 Generic Processor Testing Framework
**Goal**: Reusable framework for any NiFi processor

**Actions**:
- [ ] Create base processor test class
- [ ] Implement configuration property testing
- [ ] Add relationship testing capabilities
- [ ] Create performance testing utilities

### Phase 4: Advanced Features (Priority: Medium)

#### 4.1 Visual Testing
**Actions**:
- [ ] Implement canvas visual regression testing
- [ ] Add processor icon and layout validation
- [ ] Create flow diagram testing capabilities

#### 4.2 Performance Testing
**Actions**:
- [ ] Add processor performance benchmarking
- [ ] Implement load testing for multiple processors
- [ ] Create memory usage monitoring

#### 4.3 Data Flow Testing
**Actions**:
- [ ] Implement FlowFile testing capabilities
- [ ] Add data transformation validation
- [ ] Create end-to-end flow testing

## Implementation Roadmap - Revised Based on Critical Findings

### Week 1: NiFi Structure Analysis (ABSOLUTE PRIORITY)
**Phase 0 - Cannot proceed without this**
- Start NiFi container environment
- Manually analyze actual NiFi DOM structure using browser dev tools
- Document real canvas, processor, dialog, and toolbar selectors
- Document actual UI interaction patterns for processor operations
- Create comprehensive selector mapping and interaction guide
- Validate container environment matches production NiFi

### Week 2-3: Foundation Reconstruction
**Phase 1 - Based on Week 1 findings**
- Replace all assumed selectors with real selectors from analysis
- Implement actual canvas operations using correct DOM structure
- Implement real processor add/remove operations using correct patterns
- Fix mock implementation async/sync bugs
- Test all operations against real NiFi instance

### Week 4-5: Mocking Strategy Implementation
**Phase 2 - Now that we know how real operations work**
- Set up API mocking framework based on real operation patterns
- Create processor operation mocks that mirror real behavior
- Implement hybrid testing approach with working foundation

### Week 6-7: JWT Processor Framework
**Phase 3 - Build on working foundation**
- Complete JWT processor testing capabilities
- Add comprehensive test scenarios using real selectors
- Document testing patterns based on actual NiFi behavior

### Week 8: Generic Framework & Documentation
**Phase 4 - Finalize and document**
- Create reusable processor testing framework
- Add configuration and relationship testing
- Update all documentation with real implementation details

## Success Criteria - Revised Based on Critical Findings

### 🚨 Phase 0 Success Metrics (MUST COMPLETE FIRST)
**Everything else depends on these being achieved**
- [ ] NiFi container environment running and accessible
- [ ] Complete DOM structure documentation for canvas, processors, dialogs
- [ ] Real selector mapping document created (not assumptions)
- [ ] Actual UI interaction patterns documented step-by-step
- [ ] Manual verification that Add Processor workflow works in browser
- [ ] Custom JWT processors visible and selectable in real NiFi UI
- [ ] Container environment validated against production NiFi structure

### Phase 1 Success Metrics (Foundation Reconstruction)
**Can only be measured after Phase 0 is complete**
- [ ] All tests use real selectors from Phase 0 analysis (no assumptions)
- [ ] Canvas operations work with actual NiFi canvas elements
- [ ] Processor add/remove operations work on real NiFi instance
- [ ] Mock implementation bugs fixed (proper async/sync handling)
- [ ] Test execution succeeds without workarounds

### Phase 2 Success Metrics (Mocking Strategy)
**Based on working real operations from Phase 1**
- [ ] Mocked tests run in < 30 seconds
- [ ] Mock behavior accurately mirrors real operations from Phase 1
- [ ] Integration tests validate real NiFi functionality
- [ ] Reliable test execution (< 5% flaky tests)
- [ ] 90% test coverage for processor operations

### Phase 3 Success Metrics (JWT Framework)
**Built on solid foundation from Phases 0-2**
- [ ] JWT processors fully testable with all scenarios
- [ ] Tests use real selectors and interaction patterns
- [ ] Documentation based on actual NiFi behavior (not assumptions)

### Phase 4 Success Metrics (Advanced Features)
**Only after core functionality is proven to work**
- [ ] Visual regression testing operational
- [ ] Performance benchmarking integrated
- [ ] End-to-end data flow testing capabilities
- [ ] Generic processor framework supports any NiFi processor

## Technical Architecture

### Recommended Structure
```
e-2-e-cypress/
├── cypress/
│   ├── e2e/
│   │   ├── integration/          # Real NiFi tests
│   │   ├── mocked/              # Fast mocked tests
│   │   └── performance/         # Performance tests
│   ├── support/
│   │   ├── commands/
│   │   │   ├── processor-commands.js
│   │   │   ├── canvas-commands.js
│   │   │   └── mock-commands.js
│   │   ├── mocks/
│   │   │   ├── nifi-api-mocks.js
│   │   │   └── processor-mocks.js
│   │   └── page-objects/
│   │       ├── canvas-page.js
│   │       └── processor-dialog.js
│   └── fixtures/
│       ├── processors/          # Processor definitions
│       ├── flows/              # Flow configurations
│       └── test-data/          # Test data sets
```

### Key Principles - Revised Based on Critical Findings
1. **🚨 Analysis First**: Understand actual NiFi DOM structure before writing any code
2. **Real Knowledge**: Base all selectors and interactions on actual inspection, not assumptions
3. **Container Environment**: Use provided container setup for consistent NiFi environment
4. **Evidence-Based**: Document every selector and interaction pattern with evidence
5. **Foundation Before Features**: Get basic operations working before adding advanced features
6. **Fast Feedback**: Mocked tests for rapid development cycles (after real operations work)
7. **Comprehensive Coverage**: Test all processor lifecycle stages using real patterns
8. **Maintainable**: Clear separation of concerns and reusable components

## Risk Mitigation

### High-Risk Items
- **Canvas Selector Changes**: NiFi UI updates may break selectors
  - *Mitigation*: Implement selector versioning and fallback strategies
- **API Changes**: NiFi REST API modifications
  - *Mitigation*: Version-specific mock implementations
- **Performance Degradation**: Real tests may become slow
  - *Mitigation*: Parallel execution and selective test running

### Medium-Risk Items
- **Test Flakiness**: Timing issues with real NiFi
  - *Mitigation*: Robust wait strategies and retry mechanisms
- **Environment Dependencies**: Test environment setup complexity
  - *Mitigation*: Containerized test environments and setup automation

## Conclusion - Critical Path Forward

**The fundamental problem has been identified: the framework is based on assumptions about NiFi's DOM structure rather than actual knowledge.**

### The Critical Path Forward

1. **🚨 Phase 0 is ABSOLUTELY CRITICAL**: Nothing else can succeed without first analyzing the actual NiFi DOM structure. This is not optional - it's the foundation everything else depends on.

2. **Evidence-Based Approach**: Every selector, every interaction pattern, every assumption must be validated against a real running NiFi instance using the provided container environment.

3. **Container Environment is Key**: The `integration-testing/src/main/docker/run-test-container.sh` script provides the exact environment needed for this analysis. Use it.

4. **Manual Analysis Required**: Open browser developer tools, inspect the real DOM, document the actual structure. No shortcuts, no assumptions.

### What This Plan Achieves

- **Honest Assessment**: Acknowledges current state is NOT READY FOR PRODUCTION USE
- **Evidence-Based Foundation**: Prioritizes understanding real NiFi structure over fixing assumptions
- **Realistic Timeline**: Focuses on getting basics working before advanced features
- **Clear Dependencies**: Makes it obvious that Phase 0 must complete before anything else

### Success Depends On

- **Completing Phase 0 First**: Cannot skip or shortcut the NiFi structure analysis
- **Using Real Environment**: Container setup provides consistent, testable NiFi instance
- **Documenting Everything**: Every finding must be documented with evidence
- **Building on Facts**: Replace all assumptions with verified knowledge

**The framework has good infrastructure, but ZERO working core functionality. Phase 0 is the key to unlocking everything else.**
