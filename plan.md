# jQuery Migration Project - Open Tasks

## 📋 PENDING TASKS (Sorted by Priority)

### 🚨 CRITICAL: E2E PLAYWRIGHT TEST FAILURES

#### 1. Metrics Endpoint Issues
- [ ] Fix: HTTP 404 - `https://localhost:9095/nifi-api/processors/jwt/metrics`
- [ ] Verify servlet mapping in web.xml is correct
- [ ] Check if metrics endpoint is properly deployed during E2E tests

#### 2. Failing E2E Test Cases
- [ ] **tests/05-verify-metrics-tab.spec.js** - "should display issuer-specific metrics" timeout
  - Issue: Waiting for `[data-testid="issuer-metrics"]` element
- [ ] **tests/05-verify-all-tab-content.spec.js** - "all tabs should display their content properly"
  - Issue: Tab content verification failing

#### 3. E2E Test Environment
- [ ] Verify NiFi server configuration for E2E tests
- [ ] Check all required endpoints accessibility
- [ ] Ensure custom UI WAR deployment includes all assets

### 🔧 HIGH PRIORITY: TEST COVERAGE IMPROVEMENTS

**Current Status**: Coverage below required thresholds
- Statements: 67.38% (need 80%) ❌
- Branches: 45.22% (need 78%) ❌  
- Functions: 58.02% (need 80%) ❌

#### 1. keyboardShortcuts.js (73.58% → 80%+ needed)
- [ ] Add tests for keyboard event handling
- [ ] Test shortcut registration and modal interactions
- [ ] Cover lines: 86,89,95,99,142-143,156-157,169,177-180,191-192,206-207,215-222,233,327-328,338,342-362,431-432

#### 2. tabManager.js (65.21% → 80%+ needed)
- [ ] Add tests for tab switching logic
- [ ] Test active tab management and initialization
- [ ] Cover lines: 44,99-106,115-116,126-145

#### 3. main.js (76.62% → 80%+ needed)
- [ ] Add tests for initialization flows
- [ ] Test error handling paths and edge cases
- [ ] Cover lines: 68,79-80,160,168-169,187-188,240,278-279,297-305,383-385,394-395,408-436,442,469-471,496-503,528-535,565-566,615,636-641,653-654,741,761

#### 4. Restore Coverage Thresholds
- [ ] Update package.json to restore original thresholds:
  ```json
  {
    "coverageThreshold": {
      "global": {
        "branches": 78,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
  ```

### 📝 LOW PRIORITY: Code Quality Improvements

#### 1. Console Suppression Review
- [ ] Review `src/test/js/setup.js` (lines 33-67)
- [ ] Evaluate if console.error/warn suppression is still needed
- [ ] Consider impact on debugging (currently suppresses all output unless DEBUG=1)

#### 2. Optional Coverage Improvements
- [ ] **bundle.js** - Auto-generated file (31.18% coverage)
- [ ] **helpTab.js** - Help content rendering (48.71% coverage)
- [ ] **metricsTab.js** - Metrics display logic (55.33% coverage)

---

## ✅ COMPLETED ITEMS

### Backend Implementation
- ✅ All backend servlets implemented and tested
- ✅ Unit tests: 22 tests passing (EasyMock)
- ✅ Integration tests: 17 tests created (REST Assured)

### jQuery Migration
- ✅ Complete jQuery/Cash-DOM removal from all test files
- ✅ 531 JavaScript unit tests passing
- ✅ Vanilla JavaScript implementation throughout
- ✅ Fetch API replacing jQuery AJAX
- ✅ Native DOM manipulation and event handling

### Build Status
- ✅ Pre-commit checks passing
- ✅ Full build successful (with integration tests excluded)
- ✅ ESLint compliance maintained

*Last updated: July 30, 2025*