# jQuery Migration Project - Open Tasks

## 📋 PENDING TASKS (Sorted by Priority)

### 🔧 E2E PLAYWRIGHT TEST ISSUES

#### 1. Self-Test Failures
- [ ] Fix: Browser console logging tests (8 failing)
  - Issue: `errorDetection.getCriticalErrors()` undefined
  - Affects: self-browser-logging.spec.js, self-capture-browser-console.spec.js
  
#### 2. Infrastructure Requirements
- [ ] Verify NiFi is running: https://localhost:9095/nifi
- [ ] Verify Keycloak is running: https://localhost:9085
- [ ] Ensure MultiIssuerJWTTokenAuthenticator is on the canvas

#### 3. Previously Fixed Issues
- ✅ **Metrics endpoint**: Fixed HTTP 404 errors by updating metricsTab.js
- ✅ **Tab content verification**: Fixed by adding proper data-testid attributes

### 🎯 PRIORITY: TEST COVERAGE IMPROVEMENTS

**Current Coverage Results**: 
- Statements: 70.7% (need 80%) ❌
- Branches: 47.74% (need 78%) ❌  
- Functions: 60% (need 80%) ❌
- Lines: 89.76% ✓

**Files Needing Coverage Improvements**:
- [ ] Improve branch coverage across all files (30.26% gap)
- [ ] Improve function coverage across all files (20% gap)
- [ ] Improve statement coverage across all files (9.3% gap)

#### 1. keyboardShortcuts.js ✅
- ✅ Improved from 73.58% → 93.08% statements, 94.15% lines
- ✅ Added tests for keyboard event handling
- ✅ Added tests for shortcut registration and modal interactions

#### 2. tabManager.js ✅
- ✅ Improved from 65.21% → 97.1% statements, 100% lines
- ✅ Added tests for tab switching logic
- ✅ Added tests for active tab management and initialization

#### 3. main.js ✅
- ✅ Improved from 76.62% → 88.31% statements, 89.43% lines
- ✅ Added tests for initialization flows
- ✅ Added tests for error handling paths and edge cases

#### 4. Restore Coverage Thresholds ✅
- ✅ Updated package.json to restore original thresholds

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

### Unit Test Fixes (July 30, 2025)
- ✅ Fixed all 7 critical failing unit tests
- ✅ **keyboardShortcuts.test.js**: Fixed 4 tests by adding offsetParent mocks and timing adjustments
- ✅ **main.real.test.js**: Fixed 3 tests with proper window.location mocking and spy usage
- ✅ **Result**: All 568 unit tests now passing!

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