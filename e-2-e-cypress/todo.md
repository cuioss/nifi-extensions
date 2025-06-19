# E2E Cypress Testing - Current Status

## ✅ COMPLETED: CUI Standard Compliance

**Container lifecycle management has been fully migrated to Maven profiles following CUI standards.**

### 🎯 Current Architecture

#### Container Management:
- **Maven integration-tests profile** handles all container lifecycle
- **start-integration-containers.sh** - Starts NiFi and Keycloak containers
- **stop-integration-containers.sh** - Stops containers and cleanup

#### Test Execution:
- **cypress:run** - Runs E2E tests (containers must be started externally)
- **cypress:selftests** - Runs verification tests
- **cypress:open** - Opens Cypress UI for development

#### Analysis and Utilities:
- **log-analyzer.js** - Analyzes test logs and generates reports
- **Common utilities** in `scripts/utils/` for shared functionality

### 🔄 Usage

```bash
# Run complete integration tests (preferred method)
mvn clean test -Pintegration-tests

# Run only Cypress tests (containers must be started separately)
npm run cypress:run

# Analyze test results
npm run analyze:logs
```

### 📋 Key Principles

1. **External Container Management**: JavaScript/Cypress never starts containers
2. **Maven-Driven Lifecycle**: All infrastructure managed by Maven profiles  
3. **Fast Fail**: 2-minute timeout for container startup
4. **Clean Separation**: Test code only tests, infrastructure code only manages infrastructure

### ✅ Compliance Achieved

- Container start/stop ONLY through Maven profiles using exec-maven-plugin
- JavaScript/Cypress code NEVER starts containers
- Clear migration path from deprecated functionality
- Follows CUI standard patterns consistently
- ✅ **3 unified scripts created** with multiple modes and comprehensive options
- ✅ **Shared utility library** with 300+ lines of reusable code
