# Functional Tests Implementation Plan

## Overview
Implement comprehensive functional tests for JWT processors in NiFi:
- `MultiIssuerJWTTokenAuthenticator` 
- `JWTTokenAuthenticator`

## Objectives
1. Create feature branch for implementing functional tests
2. Develop functional tests to verify processor deployment and accessibility
3. Implement advanced configuration testing for MultiIssuerJWTTokenAuthenticator
4. Verify UI tabs and functionality without warnings/errors
5. Follow fail-fast development approach with mandatory build verification

## Development Standards and Process

### Build Verification Requirements
**CRITICAL**: Before every commit, both Maven commands MUST pass:
```bash
# 1. Full build verification (required)
./mvnw clean verify

# 2. Integration tests (required)  
./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests
```

### Development Workflow
1. **Fail-Fast Approach**: Verify each change immediately with both Maven commands
2. **Incremental Development**: Make small, testable changes
3. **Zero ESLint Warnings**: Follow centralized JavaScript standards
4. **Focus on Custom Logic**: Test JWT validation logic, not NiFi mechanics

## Feature Branch Strategy

### Branch Creation
- Branch name: `feature/functional-processor-tests`
- Base: `main` branch (clean working tree confirmed)
- Purpose: Isolated development of functional test suite

## Implementation Plan

### Phase 1: Project Setup and Branch Creation
```bash
# Create feature branch
git checkout -b feature/functional-processor-tests

# Verify clean baseline
./mvnw clean verify
./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests
```

### Phase 2: Test File Structure
Create new test files:
- `06-processor-functional-multi-issuer.cy.js` - MultiIssuerJWTTokenAuthenticator tests
- `07-processor-functional-single-issuer.cy.js` - JWTTokenAuthenticator tests

### Phase 3: MultiIssuerJWTTokenAuthenticator Analysis

#### ✅ Already Implemented (in 03-nifi-advanced-settings.cy.js)
**DISCOVERY**: The MultiIssuerJWTTokenAuthenticator testing is already comprehensively covered with 15 tests including:

1. **✅ Processor Deployment & Configuration**
   - Advanced settings access
   - Custom UI component verification
   - Configuration interface access

2. **✅ Advanced UI and Tab Testing**
   - JWT configuration components
   - Issuer configuration interface  
   - Token verification interface
   - Advanced dialog navigation
   - Tab content validation

3. **✅ Comprehensive Functionality Testing**
   - JWT token validation
   - JWKS endpoint configuration
   - Multiple issuer configurations
   - Multi-issuer property configurations
   - Error handling (timeouts, invalid paths, malformed JSON)

**CONCLUSION**: No additional MultiIssuerJWTTokenAuthenticator tests needed - full coverage exists.

### Phase 4: JWTTokenAuthenticator Functional Tests (NEEDED)

#### Test Scope - Single Issuer Processor
**REQUIREMENT**: JWTTokenAuthenticator currently only has basic deployment tests, needs comprehensive functional testing:

1. **Processor Deployment and Access**
   - Verify processor availability and instantiation  
   - Test basic configuration access
   - Validate processor properties dialog

2. **Single-Issuer Configuration Testing**
   - Test JWT configuration for single issuer
   - Verify issuer-specific properties
   - Test JWKS endpoint configuration for single issuer

3. **Advanced UI Testing (if different from multi-issuer)**
   - Navigate to advanced configuration/settings
   - Verify custom UI loads without warnings/errors
   - Test any single-issuer specific UI elements

4. **Functional Validation**
   - Test JWT token validation with single issuer
   - Verify configuration persistence  
   - Test error handling for invalid single-issuer configurations

### Phase 5: Enhanced Testing Features

#### Processor Management Utilities
- Leverage existing custom commands from `/cypress/support/commands/processor/`
- Enhance processor discovery and interaction
- Implement robust processor configuration testing

#### UI Interaction Patterns
- Use existing navigation commands from `/cypress/support/commands/navigation/`
- Implement tab navigation utilities
- Add UI validation helpers

#### Error Detection and Handling
- Integrate with existing console error tracking
- Implement warning detection for UI tabs
- Add comprehensive error reporting

## Test Implementation Strategy

### Test File Structure
```javascript
describe('MultiIssuerJWTTokenAuthenticator Functional Tests', () => {
  beforeEach(() => {
    // Standard NiFi navigation setup
    // Processor cleanup if needed
  });

  it('should verify processor deployment and availability', () => {
    // Test processor catalog access
    // Verify processor can be found and added
  });

  it('should access processor configuration successfully', () => {
    // Test basic properties access
    // Verify configuration dialog loads
  });

  it('should navigate to advanced settings without errors', () => {
    // Access advanced configuration
    // Verify no console warnings/errors
  });

  it('should verify all advanced UI tabs load correctly', () => {
    // Test each tab individually
    // Verify UI elements and functionality
  });
});
```

### Custom Command Integration
Utilize existing commands:
- `cy.addProcessorToCanvas()` - From processor commands
- `cy.testProcessorAdvancedSettings()` - From advanced-settings-commands.js
- `cy.navigateToProcessor()` - From navigation commands
- `cy.validateUIWithoutErrors()` - From validation commands

### Error Tracking Integration
- Use existing console error tracking from `console-error-tracking.js`
- Implement warning allowlist checking from `console-warnings-allowlist.js`
- Add comprehensive error reporting for UI issues

## Development Checkpoints

### Checkpoint 1: Branch Setup and Baseline
- [x] Create feature branch
- [ ] Verify baseline build passes
- [ ] Confirm existing tests still pass

### Checkpoint 2: ~~MultiIssuer Processor Tests~~ (ALREADY COMPLETE)
- [x] ✅ MultiIssuerJWTTokenAuthenticator fully tested in 03-nifi-advanced-settings.cy.js (15 tests)
- [x] ✅ Advanced UI, tabs, configuration, error handling all covered
- [x] ✅ No additional tests needed for MultiIssuer processor

### Checkpoint 3: Remove Duplicate Files and Focus on Single Issuer
- [ ] Remove 06-processor-functional-multi-issuer.cy.js (duplicate of existing functionality)
- [ ] Focus 07-processor-functional-single-issuer.cy.js on JWTTokenAuthenticator only
- [ ] Verify build with: `./mvnw clean verify`

### Checkpoint 4: Single Issuer Processor Implementation  
- [ ] Enhance 07-processor-functional-single-issuer.cy.js for JWTTokenAuthenticator
- [ ] Implement single-issuer specific tests
- [ ] Add configuration validation unique to single issuer
- [ ] Verify integration tests: `./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests`

### Checkpoint 5: Integration and Cleanup
- [ ] Verify JWTTokenAuthenticator tests pass consistently
- [ ] Clean up duplicate/unnecessary test files  
- [ ] Ensure zero ESLint warnings
- [ ] Final verification with both Maven commands
- [ ] Update documentation to reflect actual test coverage

## Success Criteria

### Functional Requirements
- ✅ MultiIssuerJWTTokenAuthenticator: **ALREADY COMPLETE** (15 comprehensive tests in 03-nifi-advanced-settings.cy.js)
- ✅ JWTTokenAuthenticator: **IMPLEMENT NEEDED** functional tests for single-issuer processor
- ✅ Advanced configuration testing for single-issuer processor
- ✅ Comprehensive error detection and reporting for single-issuer scenarios

### Technical Requirements
- ✅ Zero ESLint warnings
- ✅ Both Maven commands pass successfully  
- ✅ Tests focus on custom processor logic, not NiFi mechanics
- ✅ Remove duplicate test files (06-processor-functional-multi-issuer.cy.js)
- ✅ Integration with existing custom commands

### Quality Standards
- ✅ Tests focus on custom processor logic, not NiFi mechanics
- ✅ Fail-fast development approach followed
- ✅ Comprehensive test coverage for processor functionality
- ✅ Robust error handling and reporting

## Risk Mitigation

### Potential Issues
1. **UI Tab Discovery**: Advanced UI may have dynamic or non-standard tab structures
   - **Mitigation**: Implement flexible tab detection using existing patterns from 03-nifi-advanced-settings.cy.js

2. **Processor Catalog Navigation**: Processor discovery may be complex
   - **Mitigation**: Use existing processor-add-alternatives.js patterns

3. **Console Error Detection**: Advanced UI may generate expected warnings
   - **Mitigation**: Leverage console-warnings-allowlist.js for filtering

### Testing Strategy
- **Incremental Verification**: Test each component individually before integration
- **Fallback Patterns**: Implement alternative approaches for UI navigation
- **Comprehensive Logging**: Add detailed logging for debugging complex interactions

## Timeline

### Day 1: Setup and Foundation
- Create feature branch
- Implement basic processor deployment tests
- Verify baseline functionality

### Day 2: Advanced Configuration Testing
- Implement advanced settings navigation
- Add comprehensive UI tab testing
- Integrate error detection

### Day 3: Integration and Polish
- Complete both processor test suites
- Verify full integration
- Final verification and cleanup

## Documentation Updates

### Required Documentation
- Update main README.md with new test files
- Add test documentation to doc/testing-patterns.md
- Update test coverage information

### Standards Compliance
- Follow JavaScript standards from cui-llm-rules
- Maintain testing standards consistency
- Document any new custom commands created

---

## Execution Commands

### Start Development
```bash
git checkout -b feature/functional-processor-tests
./mvnw clean verify
./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests
```

### Development Cycle (for each change)
```bash
# Make changes
./mvnw clean verify
./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests
# Fix any issues, repeat until both pass
git add .
git commit -m "descriptive commit message"
```

### Final Verification
```bash
./mvnw clean verify
./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests
# Both must pass before merge
```

*Plan created: June 23, 2025*
*Framework: Cypress + NiFi 2.4.0*
*Standards: CUI LLM Rules compliance*
