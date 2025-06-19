# CI/CD Integration

This document covers continuous integration and deployment setup for the NiFi integration testing framework.

## GitHub Actions Workflow

### Main Workflow Configuration
The project uses GitHub Actions for automated testing and deployment:

```yaml
# .github/workflows/e2e-tests.yml
name: End-to-End Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    strategy:
      matrix:
        node-version: [20.x]
        java-version: [11, 17]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: ${{ matrix.java-version }}
          distribution: 'temurin'
          
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          cache-dependency-path: e-2-e-cypress/package-lock.json
          
      - name: Cache Maven dependencies
        uses: actions/cache@v3
        with:
          path: ~/.m2
          key: ${{ runner.os }}-m2-${{ hashFiles('**/pom.xml') }}
          restore-keys: ${{ runner.os }}-m2
          
      - name: Start test environment
        run: |
          cd integration-testing
          docker-compose up -d
          ./scripts/wait-for-services.sh
          
      - name: Build and test
        run: |
          mvn clean install -Pui-tests
          
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ matrix.java-version }}
          path: |
            e-2-e-cypress/cypress/screenshots/
            e-2-e-cypress/cypress/videos/
            e-2-e-cypress/tests-report/
            
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./e-2-e-cypress/coverage/lcov.info
          flags: e2e-tests
          name: e2e-coverage
```

### Pull Request Workflow
```yaml
# .github/workflows/pr-validation.yml
name: Pull Request Validation

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  validate-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: '11'
          distribution: 'temurin'
          
      - name: Run affected tests only
        run: |
          # Detect changed files
          CHANGED_FILES=$(git diff --name-only origin/main...HEAD)
          
          if echo "$CHANGED_FILES" | grep -q "e-2-e-cypress/"; then
            echo "E2E tests affected, running full suite"
            mvn clean install -Pui-tests
          else
            echo "E2E tests not affected, running selftests only"
            mvn clean install -Pselftests
          fi
```
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

## Next Steps and Enhancement Opportunities

### 4. CI/CD Integration Enhancement (Next Priority)
**Goal**: Optimize continuous integration and deployment workflows  
**Impact**: High - improves development velocity and deployment reliability  
**Effort**: 2-3 hours

**Implementation Areas**:
- Pipeline optimization and parallelization
- Environment-specific test configurations  
- Automated reporting and notifications
- Test result analysis and trending

**Success Criteria**:
- Reduced CI/CD execution time (target: < 15 minutes total)
- Improved test reliability in automated environments (target: > 95% success rate)
- Comprehensive test reporting and metrics
- Automated failure detection and notification

**Technical Tasks**:
1. **Pipeline Parallelization**:
   ```yaml
   # Parallel test execution
   strategy:
     matrix:
       test-group: [auth, processors, ui-validation, error-handling]
   ```

2. **Environment-Specific Configurations**:
   ```bash
   # Separate configs for different environments
   cypress.config.ci.js    # CI-optimized settings
   cypress.config.dev.js   # Development settings
   cypress.config.prod.js  # Production-like testing
   ```

3. **Enhanced Reporting**:
   ```yaml
   # Advanced test reporting
   - name: Generate Test Report
     uses: dorny/test-reporter@v1
     with:
       name: E2E Test Results
       path: 'cypress/reports/*.xml'
       reporter: java-junit
   ```

4. **Performance Monitoring**:
   ```yaml
   # Track test execution metrics
   - name: Performance Analysis
     run: |
       echo "Test Duration: ${{ steps.e2e-tests.outputs.duration }}"
       echo "Success Rate: ${{ steps.e2e-tests.outputs.success-rate }}"
   ```

### 5. Test Maintenance and Optimization (Ongoing)
**Goal**: Establish sustainable test maintenance practices  
**Impact**: Medium - ensures long-term test reliability and maintainability  
**Effort**: 2 hours

**Implementation Areas**:
- Test code refactoring and cleanup
- Performance optimization and monitoring
- Legacy test cleanup and modernization
- Documentation updates and maintenance

**Success Criteria**:
- Clean, maintainable test codebase
- Optimized test execution performance (target: < 45 seconds total)
- Up-to-date comprehensive documentation
- Established maintenance workflows and practices

**Technical Tasks**:
1. **Code Quality Monitoring**:
   ```bash
   # Automated code quality checks
   npx eslint cypress/ --max-warnings 0
   npm audit --audit-level moderate
   ```

2. **Performance Optimization**:
   ```javascript
   // Optimize test execution
   cy.configureTestOptimization({
     parallelExecution: true,
     resourceCleanup: 'aggressive',
     elementWaitStrategy: 'optimized'
   });
   ```

3. **Maintenance Automation**:
   ```yaml
   # Scheduled maintenance workflow  
   on:
     schedule:
       - cron: '0 2 * * 1'  # Weekly maintenance
   ```

## Implementation Roadmap

### Current Status (June 2025)
- **✅ Phase 1**: Project Cleanup and Restructuring (Complete)
- **✅ Phase 2**: Custom Processor UI Testing (Complete)  
- **✅ Phase 3**: Advanced Test Automation (Complete)
- **🔄 Phase 4**: CI/CD Integration Enhancement (Next Priority)
- **📋 Phase 5**: Test Maintenance and Optimization (Ongoing)

### Success Metrics
- **Overall Test Success Rate**: Current 71% → Target 85%+
- **CI/CD Execution Time**: Current ~20 minutes → Target < 15 minutes
- **Test Maintenance Effort**: Target < 2 hours/week
- **Code Quality**: Maintain 0 ESLint warnings/errors

## Maven Integration

### Profile Configuration
The Maven build integrates testing profiles for different scenarios:

```xml
<!-- pom.xml profiles -->
<profiles>
  <profile>
    <id>selftests</id>
    <activation>
      <activeByDefault>true</activeByDefault>
    </activation>
    <properties>
      <cypress.spec>cypress/e2e/selftests/**/*.cy.js</cypress.spec>
      <docker.skip>true</docker.skip>
    </properties>
  </profile>
  
  <profile>
    <id>ui-tests</id>
    <properties>
      <cypress.spec>cypress/e2e/**/*.cy.js</cypress.spec>
      <docker.skip>false</docker.skip>
      <cypress.auto.start>true</cypress.auto.start>
    </properties>
    <build>
      <plugins>
        <plugin>
          <groupId>org.apache.maven.plugins</groupId>
          <artifactId>maven-failsafe-plugin</artifactId>
          <executions>
            <execution>
              <id>start-containers</id>
              <phase>pre-integration-test</phase>
              <goals>
                <goal>integration-test</goal>
              </goals>
              <configuration>
                <includes>
                  <include>**/ContainerStartupIT.java</include>
                </includes>
              </configuration>
            </execution>
          </executions>
        </plugin>
      </plugins>
    </build>
  </profile>
</profiles>
```

### Build Lifecycle Integration
```xml
<!-- Frontend Maven Plugin for Node.js/Cypress -->
<plugin>
  <groupId>com.github.eirslett</groupId>
  <artifactId>frontend-maven-plugin</artifactId>
  <version>1.15.0</version>
  <configuration>
    <nodeVersion>v20.11.0</nodeVersion>
    <npmVersion>10.4.0</npmVersion>
    <workingDirectory>e-2-e-cypress</workingDirectory>
  </configuration>
  <executions>
    <execution>
      <id>install-node-and-npm</id>
      <phase>initialize</phase>
      <goals>
        <goal>install-node-and-npm</goal>
      </goals>
    </execution>
    <execution>
      <id>npm-install</id>
      <phase>initialize</phase>
      <goals>
        <goal>npm</goal>
      </goals>
      <configuration>
        <arguments>ci</arguments>
      </configuration>
    </execution>
    <execution>
      <id>cypress-tests</id>
      <phase>integration-test</phase>
      <goals>
        <goal>npm</goal>
      </goals>
      <configuration>
        <arguments>run test:ci</arguments>
        <skip>${skipTests}</skip>
      </configuration>
    </execution>
  </executions>
</plugin>
```

## Quality Gates

### ESLint Integration
Following [CUI JavaScript Standards](https://github.com/cuioss/cui-llm-rules/tree/main/standards/javascript):

```yaml
# Quality check step in CI
- name: Run ESLint
  run: |
    cd e-2-e-cypress
    npm run lint
    
    # Ensure zero warnings
    WARNINGS=$(npm run lint 2>&1 | grep -c "warning" || true)
    if [ "$WARNINGS" -gt 0 ]; then
      echo "❌ ESLint warnings found: $WARNINGS"
      exit 1
    fi
    
    echo "✅ ESLint passed with zero warnings"
```

### Coverage Thresholds
```javascript
// jest.config.js (for JavaScript components)
module.exports = {
  collectCoverageFrom: [
    'src/main/javascript/**/*.js',
    '!src/main/javascript/vendor/**'
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary']
};
```

### Performance Budgets
```yaml
# Performance monitoring in CI
- name: Performance Budget Check
  run: |
    cd e-2-e-cypress
    
    # Extract performance metrics from test results
    AVG_TEST_TIME=$(jq '.runs[].stats.duration' tests-report/combined-report.json | jq -s 'add/length')
    
    # Check against budget (60 seconds)
    if (( $(echo "$AVG_TEST_TIME > 60000" | bc -l) )); then
      echo "❌ Performance budget exceeded: ${AVG_TEST_TIME}ms > 60000ms"
      exit 1
    fi
    
    echo "✅ Performance budget met: ${AVG_TEST_TIME}ms"
```

## Test Reporting

### Cypress Dashboard Integration
```javascript
// cypress.config.js
module.exports = {
  projectId: 'nifi-extensions-e2e',
  e2e: {
    setupNodeEvents(on, config) {
      // Test result processing
      on('after:run', (results) => {
        if (results) {
          const stats = {
            totalTests: results.totalTests,
            totalPassed: results.totalPassed,
            totalFailed: results.totalFailed,
            totalSkipped: results.totalSkipped,
            duration: results.totalDuration
          };
          
          console.log('Test Statistics:', JSON.stringify(stats, null, 2));
          
          // Send to CI dashboard
          if (process.env.CI) {
            sendToDashboard(stats);
          }
        }
      });
    }
  }
};
```

## Local Development Integration

### Pre-commit Hooks
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running pre-commit checks..."

# ESLint check
cd e-2-e-cypress
if ! npm run lint; then
  echo "❌ ESLint failed. Fix errors before committing."
  exit 1
fi

# Quick selftests
if ! npm run test:selftests; then
  echo "❌ Selftests failed. Fix errors before committing."
  exit 1
fi

echo "✅ Pre-commit checks passed"
```

### Development Workflow
```bash
#!/bin/bash
# scripts/dev-workflow.sh

# Complete development workflow
echo "🚀 Starting development workflow..."

# 1. Code quality check
echo "1️⃣ Running code quality checks..."
cd e-2-e-cypress
npm run lint:fix
npm run type-check

# 2. Unit tests
echo "2️⃣ Running unit tests..."
npm run test:unit

# 3. Selftests (fast)
echo "3️⃣ Running selftests..."
npm run test:selftests

# 4. Start containers for integration tests
echo "4️⃣ Starting test environment..."
cd ../integration-testing
docker-compose up -d
./scripts/wait-for-services.sh

# 5. Integration tests
echo "5️⃣ Running integration tests..."
cd ../e-2-e-cypress
npm run test:integration

echo "✅ Development workflow completed successfully!"
```

---

*For detailed setup instructions, see [Setup Guide](./setup-guide.md). For testing patterns, see [Testing Patterns](./testing-patterns.md).*
