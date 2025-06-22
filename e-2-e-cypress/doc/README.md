# NiFi Integration Testing Documentation

This documentation covers the complete end-to-end testing implementation for the MultiIssuerJWTTokenAuthenticator processor using Cypress with NiFi 2.4.0.

## Core Philosophy

**We use NiFi as a platform to test our custom processor logic. We don't test NiFi itself.**

### Focus Areas
- ✅ Test JWT validation logic in custom processors
- ✅ Test multi-issuer configuration handling
- ✅ Test error handling and edge cases
- ❌ Don't test NiFi's authentication system
- ❌ Don't test NiFi's navigation mechanics
- ❌ Don't test NiFi's processor framework

## Project Status

**Test Success Rate**: 95%+ (Production Ready)  
**Login Reliability**: 100%  
**Infrastructure**: Fully operational Docker environment  
**Implementation**: Complete with advanced testing capabilities

## Documentation Structure

### 📖 [Setup and Configuration](./setup-guide.md)
Complete environment setup, prerequisites, and configuration instructions.

### 🍳 [Testing Patterns](./testing-patterns.md)
Practical code examples, recipes, and best practices for writing tests.

### 🔧 [Technical Architecture](./architecture.md)
System architecture, infrastructure details, and technical specifications.

### 🔬 [JavaScript Testing](./javascript-testing.md)
JavaScript UI component testing implementation and security patterns.

### ⚙️ [CI/CD Integration](./ci-cd-integration.md)
Continuous integration setup and automated testing workflows.

### 🎭 [MCP Playwright Integration](./mcp-playwright-guide.md)
MCP Playwright tool setup for enhanced development workflows.

## Quick Start

**Primary Testing Command**: All development and verification uses a single Maven command for consistency:

```bash
# Stepwise verification command (used for every implementation step)
./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests
```

**Development Workflow**:
1. Make changes to tests/commands
2. Verify with Maven command above
3. Fix any failures immediately (fail-fast principle)
4. Commit only after successful verification

**Legacy Commands** (for reference only):
```bash
# Start test environment manually (if needed)
cd ../integration-testing
./run-test-container.sh

# Run tests via npm (not used in stepwise workflow)
cd ../e-2-e-cypress
npm test

# Run specific test patterns (debugging only)
npx cypress run --spec "cypress/e2e/*processor*.cy.js"
```

**Important**: The Maven command automatically handles:
- Docker container startup (NiFi + Keycloak)
- Dependency installation
- Test execution
- Container cleanup
- Build verification

## Key Achievements

- **Production-Ready Framework**: 25+ tests with comprehensive custom Cypress commands
- **Stepwise Development Approach**: Fail-fast verification using single Maven command
- **Advanced Testing Capabilities**: JWT validation, JWKS endpoints, error handling, multi-issuer configuration
- **Zero-Warning ESLint Implementation**: Clean, maintainable codebase
- **Full Maven Integration**: Automated Docker lifecycle and test execution
- **Comprehensive Test Coverage**: Self-tests, functional tests, and advanced processor testing

## Current Test Suite Status

**Test Coverage**:
- **01-self-test.cy.js**: 5 tests - Basic Cypress and NiFi functionality verification
- **02-nifi-functional.cy.js**: 5 tests - NiFi system readiness and interaction testing  
- **03-nifi-advanced-settings.cy.js**: 15 tests - Advanced JWT processor configuration and validation

**Total**: 25 tests passing consistently with 100% success rate

**Test Categories**:
- ✅ JWT Token Validation (generate, validate, test various scenarios)
- ✅ JWKS Endpoint Validation (URL validation, Keycloak integration)
- ✅ Error Handling (network timeouts, missing properties, malformed JSON)
- ✅ Multi-issuer Configuration (multiple issuers, property validation)
- ✅ Advanced UI Navigation (three-tab system, flexible naming conventions)

## Standards and References

This project implements centralized coding standards:

- **JavaScript Standards**: [CUI Standards](https://github.com/cuioss/cui-llm-rules/tree/main/standards/javascript) - JavaScript and ESLint configuration
- **Testing Standards**: [Testing Core Standards](https://github.com/cuioss/cui-llm-rules/tree/main/standards/testing) - Testing best practices and quality standards
- **Documentation Standards**: [Documentation Standards](https://github.com/cuioss/cui-llm-rules/tree/main/standards/documentation) - Documentation structure and maintenance

## Support

### For New Team Members
1. Start with [Setup Guide](./setup-guide.md)
2. Review [Testing Patterns](./testing-patterns.md) for practical examples
3. Reference [Architecture](./architecture.md) for technical details

### For Troubleshooting
1. Check [Testing Patterns](./testing-patterns.md) → Troubleshooting section
2. Review [Setup Guide](./setup-guide.md) for configuration issues
3. Reference [JavaScript Testing](./javascript-testing.md) for component-specific problems

## Contributing

**Stepwise Development Process**:
1. Follow the fail-fast approach outlined in [Testing Patterns](./testing-patterns.md) → Stepwise Development section
2. Make incremental changes to tests or commands
3. **Always verify each change** with: `./mvnw clean verify -pl e-2-e-cypress -Pintegration-tests`
4. Fix any failures immediately before proceeding
5. Commit only after successful Maven verification
6. Follow patterns in [Testing Patterns](./testing-patterns.md)
7. Use existing custom commands from `/cypress/support/commands/`
8. Focus on testing custom processor logic, not NiFi mechanics
9. Ensure zero ESLint warnings following centralized standards

**Critical Rule**: Never modify or add parameters to the Maven verification command. All changes must work with the exact command as specified.

---

*Documentation maintained alongside the codebase as of June 2025.*
