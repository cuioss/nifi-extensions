# Log Analysis Tools Documentation

This document describes the comprehensive log analysis tools available for the NiFi Extensions E2E testing suite.

## Overview

The E2E testing framework includes several sophisticated log analysis tools designed to help you:

- **Debug test failures** with detailed error analysis
- **Monitor performance trends** over time
- **Identify problematic patterns** in console logs
- **Track network request issues** 
- **Generate comprehensive reports** for stakeholders

## Available Tools

### 1. Enhanced Log Analyzer (`enhanced-log-analyzer.js`)

**Primary Tool** - Provides comprehensive analysis combining multiple metrics.

**Features**:
- Console error analysis with pattern recognition
- Performance metrics and trend analysis
- Network request failure analysis
- HTML report generation with recommendations
- Historical trend tracking

**Usage**:
```bash
# Analyze latest test run
node scripts/enhanced-log-analyzer.js

# Analyze specific run
node scripts/enhanced-log-analyzer.js run-12345

# View generated report
open e-2-e-cypress/cypress/reports/enhanced-analysis/comprehensive-report.html
```

**Generated Reports**:
- `comprehensive-report.html` - Interactive HTML dashboard
- `enhanced-analysis-{runId}.json` - Machine-readable results
- `trends/` directory - Historical trend data

### 2. Console Error Analyzer (`analyze-console-errors.js`)

**Specialized Tool** - Focuses specifically on browser console errors and warnings.

**Features**:
- Parses Cypress console logs
- Categorizes errors vs warnings
- Filters against allowlist patterns
- Groups similar errors for pattern analysis
- Generates both JSON and HTML reports

**Usage**:
```bash
# Analyze console errors for latest run
node scripts/analyze-console-errors.js latest

# Analyze specific run
node scripts/analyze-console-errors.js run-abc123
```

**Configuration**:
Edit `cypress/support/console-warnings-allowlist.js` to manage acceptable warnings:
```javascript
module.exports = [
  'DevTools failed to load SourceMap',
  'Download the React DevTools',
  'Warning: componentWillMount has been renamed'
];
```

### 3. NiFi Health Checker (`check-nifi-and-run-selftests.js`)

**Infrastructure Tool** - Ensures services are available before running tests.

**Features**:
- Checks NiFi service availability
- Handles SSL certificate issues
- Graceful degradation when services unavailable
- Timeout management for health checks

**Usage**:
```bash
# Check NiFi and run tests if available
node scripts/check-nifi-and-run-selftests.js

# Configure base URL
CYPRESS_BASE_URL=https://localhost:9095/nifi node scripts/check-nifi-and-run-selftests.js
```

### 4. Auto-start Integration (`auto-start-nifi-and-run-selftests.js`)

**Automation Tool** - Manages the complete test environment lifecycle.

**Features**:
- Starts Docker containers for NiFi and Keycloak
- Waits for services to be ready
- Runs tests automatically
- Cleans up containers after completion
- Error handling for startup failures

**Usage**:
```bash
# Auto-start environment and run tests
node scripts/auto-start-nifi-and-run-selftests.js

# Custom configuration
AUTO_START_TIMEOUT=300 node scripts/auto-start-nifi-and-run-selftests.js
```

## Integration with CI/CD

### GitHub Actions Integration

The tools are automatically integrated into the E2E testing workflow:

```yaml
- name: Run E2E Integration Tests
  run: ./mvnw -B --no-transfer-progress integration-test -Plocal-integration-tests

- name: Analyze Console Errors
  run: |
    cd e-2-e-cypress
    node scripts/enhanced-log-analyzer.js latest
  if: always()

- name: Deploy E2E Results to cuioss.github.io
  # Results are automatically deployed to GitHub Pages
```

### Maven Site Integration

E2E test results are integrated into the Maven Site generation:

```bash
# Generate site with E2E reports
./mvnw site:site site:stage

# Results available at target/staging/
```

### Automated Deployment

Test results are automatically deployed to:
- **GitHub Pages**: `https://cuioss.github.io/nifi-extensions/e2e-reports/{run-number}/`
- **GitHub Actions Artifacts**: 30-day retention for detailed logs and videos

## Available Log Analysis Capabilities

### 1. Performance Analysis
- **Test execution times** - Identify slow tests
- **Failure rates** - Track test stability
- **Retry patterns** - Detect flaky tests
- **Trend analysis** - Monitor performance over time

### 2. Console Error Analysis
- **Error categorization** - Critical vs warnings
- **Pattern recognition** - Group similar issues  
- **Allowlist filtering** - Ignore known acceptable warnings
- **Source tracking** - Identify error origins

### 3. Network Request Analysis
- **Request/response patterns** - HTTP method distribution
- **Failure analysis** - Network timeouts and errors
- **Performance tracking** - Slow request identification
- **Error pattern analysis** - Common failure types

### 4. Visual Analysis
- **Test videos** - Screen recordings of test execution
- **Screenshots** - Failure point visualization
- **HTML reports** - Interactive dashboards
- **Trend charts** - Historical performance visualization

## Report Access Methods

### 1. GitHub Pages (Recommended for Stakeholders)
```
https://cuioss.github.io/nifi-extensions/e2e-reports/latest/
https://cuioss.github.io/nifi-extensions/e2e-reports/{run-number}/
```

**Pros**:
- Permanent, shareable URLs
- No GitHub login required
- Professional presentation
- Historical access

**Cons**:
- Only deployed for tags and manual runs
- Slight delay for deployment

### 2. GitHub Actions Artifacts (Best for Debugging)
- Available immediately after test completion
- Full logs, videos, and screenshots
- 30-day retention
- Requires GitHub login

**Access**: Go to Actions → E2E Tests → specific run → Artifacts

### 3. Local Analysis (Development)
```bash
# Run analysis locally
cd e-2-e-cypress
node scripts/enhanced-log-analyzer.js latest

# View results
open cypress/reports/enhanced-analysis/comprehensive-report.html
```

## Best Practices

### 1. Regular Monitoring
- Check trend reports weekly
- Set up alerts for failure rate increases
- Monitor console error patterns

### 2. Allowlist Management
- Keep console warnings allowlist current
- Remove patterns for fixed issues
- Document why patterns are allowed

### 3. Performance Optimization
- Use performance metrics to identify optimization opportunities
- Track slow test trends
- Optimize based on network analysis

### 4. Failure Investigation
- Use video recordings for visual debugging
- Check console errors for application issues
- Analyze network requests for service problems

## Environment Configuration

### Required Environment Variables
```bash
# Base URLs for services
CYPRESS_BASE_URL=https://localhost:9095/nifi
CYPRESS_KEYCLOAK_URL=https://localhost:9085/auth

# Analysis configuration
CONSOLE_ANALYSIS_ENABLED=true
CONSOLE_LOG_LEVEL=info
CONSOLE_PATTERN_THRESHOLD=3
```

### Optional Configuration
```bash
# Auto-start configuration
AUTO_START_TIMEOUT=300
AUTO_START_CLEANUP=true

# Performance thresholds
SLOW_TEST_THRESHOLD=30000
SLOW_REQUEST_THRESHOLD=5000
```

## Troubleshooting

### Common Issues

1. **"Log file not found" error**
   - Ensure Cypress tests have run first
   - Check tests-report directory exists
   - Verify test execution completed

2. **"No analysis data" in reports**
   - Check console logging is enabled in Cypress config
   - Verify test results are in JSON format
   - Ensure proper file permissions

3. **Trend analysis shows "insufficient data"**
   - Run tests multiple times to build history
   - Check trends directory for historical data
   - Verify date formatting in trend files

### Debug Commands
```bash
# Check log files
ls -la e-2-e-cypress/cypress/logs/
ls -la e-2-e-cypress/tests-report/

# Verify analysis output
node scripts/enhanced-log-analyzer.js latest --verbose

# Check trend data
ls -la e-2-e-cypress/cypress/reports/enhanced-analysis/trends/
```

## Future Enhancements

Planned improvements include:
- Integration with monitoring tools (Grafana, DataDog)
- Slack/Teams notifications for critical issues
- Machine learning for anomaly detection
- Integration with issue tracking systems
- Performance regression alerts
