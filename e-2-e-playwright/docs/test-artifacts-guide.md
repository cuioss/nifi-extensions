# Test Artifacts Guide

## Understanding Test Artifact Storage

Playwright stores test artifacts in two locations:

### 1. HTML Report Data Directory (`target/playwright-report/data/`)
When using the HTML reporter (configured in this project), all test artifacts are stored here:
- Traces (`.zip` files containing test execution details)
- Screenshots (`.png` files)
- Videos (`.webm` files)

These artifacts are referenced by the HTML report and persist until `maven clean` is run.

### 2. Test Results Directory (`target/test-results/`)
This directory is used for temporary storage during test execution and typically remains empty after tests complete successfully.

## Default Behavior

**As of the current configuration, all test artifacts are saved by default** for every test run. This ensures complete test execution history is available until `maven clean` is run, which clears the entire `target` directory.

The following artifacts are saved for each test:
- **Trace files**: Complete test execution details for debugging
- **Screenshots**: Final state of each test
- **Videos**: Full recording of test execution

## Configuration Options

### Environment Variables

You can override the default behavior using environment variables:

```bash
# Disable trace collection
PLAYWRIGHT_TRACE=off mvn -pl e-2-e-playwright -Pintegration-tests clean verify

# Save screenshots only on failure
PLAYWRIGHT_SCREENSHOT=only-on-failure mvn -pl e-2-e-playwright -Pintegration-tests clean verify

# Save videos only on failure
PLAYWRIGHT_VIDEO=retain-on-failure mvn -pl e-2-e-playwright -Pintegration-tests clean verify

# Disable all artifacts (not recommended)
PLAYWRIGHT_TRACE=off PLAYWRIGHT_SCREENSHOT=off PLAYWRIGHT_VIDEO=off mvn -pl e-2-e-playwright -Pintegration-tests clean verify
```

### Available Options

#### Trace Options
- `'off'` - Do not record trace
- `'on'` - Record trace for each test
- `'retain-on-failure'` - Record trace for each test, but remove all traces from successful test runs (default)
- `'on-first-retry'` - Record trace only when retrying a test for the first time
- `'on-all-retries'` - Record trace only when retrying a test

#### Screenshot Options
- `'off'` - Do not capture screenshots
- `'on'` - Capture screenshot after each test
- `'only-on-failure'` - Capture screenshot after each test failure (default)

#### Video Options
- `'off'` - Do not record video
- `'on'` - Record video for each test
- `'retain-on-failure'` - Record video for each test, but remove all videos from successful test runs (default)
- `'on-first-retry'` - Record video only when retrying a test for the first time

## Viewing Test Results

Test execution information and artifacts are available in:

1. **HTML Report with Artifacts**: `target/playwright-report/index.html`
   - Contains all test results with embedded artifacts
   - View the report:
   ```bash
   cd e-2-e-playwright
   npm run playwright:report
   ```
   - All artifacts (traces, screenshots, videos) are stored in `target/playwright-report/data/`

2. **JSON Report**: `target/test-results.json`
   - Contains detailed test execution data

3. **JUnit XML Report**: `target/junit-results.xml`
   - Compatible with CI/CD systems
   - Contains test execution summary

## Best Practices

1. **Development**: The current configuration saves all artifacts by default, which is ideal for debugging
2. **CI/CD**: Consider using environment variables to save only failure artifacts to conserve disk space:
   ```bash
   PLAYWRIGHT_TRACE=retain-on-failure PLAYWRIGHT_SCREENSHOT=only-on-failure PLAYWRIGHT_VIDEO=retain-on-failure mvn verify
   ```
3. **Debugging**: Use the HTML report along with saved artifacts for comprehensive test analysis

## Disk Space Considerations

Test artifacts can be large:
- Traces: ~1-5MB per test
- Videos: ~5-20MB per test
- Screenshots: ~100-500KB per test

For a test suite with 80 tests, always saving all artifacts could consume 1-2GB of disk space per test run.