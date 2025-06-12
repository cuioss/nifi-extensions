# End-to-End Cypress Testing Module

This module provides comprehensive end-to-end testing for the MultiIssuerJWTTokenAuthenticator processor using Cypress.

## 📚 Documentation

**For complete documentation, see [doc/README.md](./doc/README.md)**

## Quick Start

```bash
# Install dependencies
cd e-2-e-cypress
npm install

# Start test environment
cd ../integration-testing
./run-test-container.sh

# Run tests
cd ../e-2-e-cypress
npm test
```

## Status: Production Ready

- ✅ **71% test success rate** (10/14 tests passing)
- ✅ **100% login reliability** (4/4 tests)
- ✅ **Angular 2.4.0 UI compatibility**
- ✅ **Complete Docker environment**
- ✅ **Full CI/CD integration**

## Core Philosophy

**We use NiFi as a platform to test our custom processor logic. We don't test NiFi itself.**

## Documentation Structure

- [Project Overview](./doc/overview.md) - Core philosophy and quick start
- [Current Status](./doc/current-status.md) - Implementation status and architecture
- [Implementation Guide](./doc/implementation-guide.md) - Complete setup and usage
- [Testing Recipes](./doc/recipes-and-howto.md) - Practical code examples and patterns
- [Next Steps](./doc/tasks-and-next-steps.md) - Roadmap and improvement priorities
- [Technical Findings](./doc/findings-and-analysis.md) - Angular UI migration analysis

## Current Priorities

1. **Navigation Stabilization** - Fix controller services timeout issues
2. **Processor State Detection** - Reliable configuration detection
3. **Test Simplification** - Focus on custom processor logic

---

*For comprehensive documentation, see [doc/README.md](./doc/README.md)*