# CI/CD Integration Documentation

## Overview

The e-2-e-cypress module is fully integrated with GitHub Actions for automated testing and quality assurance. This document describes the CI/CD process and how to work with it.

## Workflow Structure

### GitHub Actions Workflow (`.github/workflows/e2e-tests.yml`)

The workflow consists of two main jobs:

#### 1. Frontend Quality Checks Job
- **Purpose**: Validates code quality before running expensive E2E tests
- **Actions**:
  - Installs Node.js 20.12.2 and Java 21
  - Caches Maven and NPM dependencies
  - Runs linting with `--max-warnings 0` (zero tolerance for warnings)
  - Executes unit tests for both frontend modules
  - Uploads test results and coverage reports

#### 2. E2E Integration Tests Job
- **Purpose**: Runs complete end-to-end tests in Docker environment
- **Dependencies**: Only runs if frontend quality checks pass
- **Actions**:
  - Builds NAR package for testing
  - Starts Docker test environment (NiFi + Keycloak)
  - Waits for services to be ready (5-minute timeout)
  - Runs self-verification tests first
  - Executes full E2E test suite
  - Collects artifacts (reports, videos, screenshots)
  - Performs console error analysis on failures
  - Guarantees environment cleanup

## Triggers

The workflow automatically runs on:

- **Push** to branches:
  - `main`
  - `develop` 
  - `feature/end-to-end-testing`

- **Pull Request** to branches:
  - `main`
  - `develop`

- **Path filters** - only when changes affect:
  - `e-2-e-cypress/**`
  - `nifi-cuioss-processors/**`
  - `nifi-cuioss-ui/**`
  - `integration-testing/**`
  - `pom.xml`

## Environment Variables

The CI/CD process uses these environment variables:

- `CYPRESS_BASE_URL`: https://localhost:8443/nifi
- `CYPRESS_KEYCLOAK_URL`: https://localhost:8443/auth

## Artifacts Collected

### Test Results (30-day retention)
- `e-2-e-cypress/tests-report/` - JUnit XML and HTML reports
- `e-2-e-cypress/cypress/videos/` - Test execution videos
- `e-2-e-cypress/cypress/screenshots/` - Failure screenshots

### Frontend Test Results (7-day retention)
- `nifi-cuioss-ui/coverage/` - Code coverage reports
- `e-2-e-cypress/tests-report/` - Self-test results

### Test Reports (for GitHub integration)
- `e-2-e-cypress/tests-report/*.xml` - JUnit XML for test reporting

## Console Error Analysis

On test failures, the workflow automatically:

1. Searches test reports for console errors
2. Runs console error analysis script if available
3. Reports findings in the workflow output

Manual console error analysis:

```bash
# Analyze console errors for a specific run
npm run analyze-console-errors [run-id]

# Example
npm run analyze-console-errors 2025-06-11T14-30-00
```

## Working with CI/CD

### Local Development

Before pushing changes:

```bash
# Run quality checks locally
npm run lint:check
npm run format:check

# Run self-tests (fast unit tests)
npm run cypress:selftests

# Run full E2E tests (requires test environment)
cd ../integration-testing
./run-test-container.sh
cd ../e-2-e-cypress
npm run cypress:run
```

### Debugging CI Failures

1. **Check workflow logs** in GitHub Actions tab
2. **Download artifacts** for detailed analysis
3. **Review console error analysis** if available
4. **Run locally** to reproduce issues

### Artifact Download

To download and analyze test artifacts:

1. Go to the failed workflow run in GitHub
2. Scroll to "Artifacts" section
3. Download relevant artifact zip files
4. Extract and review:
   - HTML reports for visual test results
   - Videos to see what happened during tests
   - Screenshots of failures
   - JUnit XML for detailed test data

## Performance Considerations

### Caching Strategy
- **Maven dependencies**: Cached by POM file hash
- **NPM dependencies**: Cached by package-lock.json hash
- **Node.js binaries**: Cached by setup-node action

### Parallel Execution
- Frontend quality checks and E2E tests run sequentially
- This prevents resource conflicts and ensures quality gates

### Timeout Configuration
- Service readiness: 5 minutes (300 seconds)
- Individual test timeouts: Configured in Cypress settings
- Overall job timeout: GitHub Actions default (6 hours)

## Maintenance

### Regular Tasks

1. **Monitor test stability** - Check for flaky tests
2. **Update dependencies** - Keep workflow actions current
3. **Review artifacts retention** - Adjust as needed
4. **Analyze console errors** - Regular review of allowed warnings

### Updating the Workflow

When modifying `.github/workflows/e2e-tests.yml`:

1. Test changes in a feature branch
2. Verify all jobs complete successfully
3. Check artifact collection works
4. Update documentation if needed

## Troubleshooting

### Common Issues

**Docker service startup failures:**
- Check Docker daemon status
- Verify sufficient system resources
- Review container logs in workflow output

**Environment readiness timeouts:**
- Services may take longer to start in CI
- Check service health check endpoints
- Verify port configurations

**Artifact upload failures:**
- Check path specifications in workflow
- Ensure artifacts exist before upload
- Verify retention settings

**Console error analysis missing:**
- Ensure console logging is configured in Cypress
- Check that log files are generated
- Verify script permissions and syntax

### Getting Help

1. Check workflow logs for specific error messages
2. Review this documentation for common solutions
3. Examine successful runs for comparison
4. Test locally to isolate CI-specific issues

## Security Considerations

- No sensitive data in workflow logs
- Environment variables properly scoped
- Artifacts automatically expire
- Workflow permissions follow least-privilege principle
