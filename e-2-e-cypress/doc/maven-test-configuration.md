# Maven Test Configuration Summary

## Overview
The pom.xml has been updated to implement auto-starting NiFi containers for selftests:

- **Selftests**: Now **automatically start NiFi containers** if needed during `verify` phase
- **Real tests**: Only run with `ui-tests` profile  
- **Containers**: Automatically managed during test execution

## Configuration Changes

### 1. Normal Build (verify phase) - **AUTO-START ENABLED**
```bash
mvn clean verify
```
- **✅ Automatically starts NiFi containers if not running**
- **✅ Waits for NiFi to become ready**
- **✅ Runs selftests with correct NiFi URL**
- **✅ Build succeeds with full test execution**

### 2. Skip All Tests
```bash
mvn clean verify -DskipTests=true
```
- Completely skips all tests including selftests
- Fast build for cases where no testing is needed

### 3. UI Tests Profile
```bash
mvn clean integration-test -P ui-tests
```
- Runs real end-to-end UI tests
- Requires NiFi containers to be running
- Will fail if containers are not available (expected behavior)

### 4. Safe Selftests Profile (Legacy)
```bash
mvn clean verify -P safe-selftests
```
- Uses old behavior: gracefully skips if NiFi not available
- Useful for environments where auto-start is not desired

## Implementation Details

### Auto-Start Functionality
Created `scripts/auto-start-nifi-and-run-selftests.js` that:
- **🔍 Checks if NiFi is accessible** (HTTPS then HTTP)
- **🚀 Automatically starts containers** if NiFi not found
- **⏳ Waits for NiFi to become ready** with health checks
- **🧪 Runs selftests** with correct URL (HTTP or HTTPS)
- **✅ Provides clear feedback** about what's happening

### Updated Package.json Scripts
- `cypress:selftests`: Original script (direct test execution)
- `cypress:selftests-safe`: Safe script (graceful skip if no NiFi)
- `cypress:selftests-auto`: **New auto-start script** (default)
- `cypress:run`: Real UI tests script

### Profile Configuration
- **Default build**: Uses `cypress:selftests-auto` (auto-start enabled)
- **ui-tests profile**: Runs `cypress:run` for full UI testing  
- **safe-selftests profile**: Uses `cypress:selftests-safe` (legacy behavior)

## Usage Examples

### Developer Workflow
```bash
# Auto-start build - starts NiFi automatically and runs selftests
mvn clean verify

# Fast build without any tests
mvn clean verify -DskipTests=true

# Full UI testing (requires containers)
mvn clean integration-test -P ui-tests

# Legacy safe mode (skip if no NiFi)
mvn clean verify -P safe-selftests
```

### CI/CD Integration
```bash
# Auto-start CI build (recommended)
mvn clean verify

# Full integration testing in CI (with containers)
mvn clean integration-test -P ui-tests
```

## Auto-Start Process Flow

1. **🔍 Check HTTPS NiFi** (port 9095)
2. **🔄 Check HTTP NiFi** (port 9094) if HTTPS fails
3. **🚀 Start containers** if neither accessible
4. **⏳ Wait for ready** with health checks (up to 5 minutes)
5. **🧪 Run selftests** with correct URL
6. **✅ Report results**

## Verification Results
All scenarios tested and working correctly:
- ✅ Auto-start detects missing NiFi and starts containers
- ✅ Auto-start waits for NiFi to become ready  
- ✅ Auto-start runs selftests with correct URL
- ✅ skipTests=true skips all tests
- ✅ ui-tests profile runs real tests
- ✅ safe-selftests profile uses legacy behavior
- ✅ Build works both with and without running containers
