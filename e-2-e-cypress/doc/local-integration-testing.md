# Local Integration Testing Guide

This guide explains how to run the complete integration test suite locally, including automatic container management.

## Overview

The local integration testing setup provides three ways to run tests:

1. **Full Integration Test Suite** - Complete pipeline with container management
2. **Maven Profile** - Direct Maven execution with container lifecycle
3. **Quick Test Runner** - Run tests against already running containers

## Prerequisites

- Docker and Docker Compose installed
- Maven 3.6+ or use the included `mvnw` wrapper
- Node.js 20+ (automatically installed by Maven frontend plugin)
- 8GB+ available RAM for containers

## Method 1: Full Integration Test Suite (Recommended)

The easiest way to run all tests locally:

```bash
# Run complete test suite
./e-2-e-cypress/scripts/run-integration-tests.sh

# Available options:
./e-2-e-cypress/scripts/run-integration-tests.sh --help
./e-2-e-cypress/scripts/run-integration-tests.sh --skip-build      # Use existing artifacts
./e-2-e-cypress/scripts/run-integration-tests.sh --keep-containers # Keep containers running after tests
./e-2-e-cypress/scripts/run-integration-tests.sh --only-selftests  # Run only command validation tests
```

This script will:
1. Build the project and NAR files
2. Deploy NAR files to the Docker environment
3. Start NiFi and Keycloak containers
4. Wait for containers to be healthy
5. Run linting and integration tests
6. Clean up containers (unless `--keep-containers` is used)

## Method 2: Maven Profile

Use the Maven profile directly for more control:

```bash
# Run with Maven wrapper
./mvnw integration-test -Plocal-integration-tests -Dintegration.test.local=true

# Or with system Maven
mvn integration-test -Plocal-integration-tests -Dintegration.test.local=true

# Run only the e-2-e-cypress module
./mvnw integration-test -Plocal-integration-tests -Dintegration.test.local=true -pl e-2-e-cypress
```

## Method 3: Quick Test Runner

If containers are already running, use the quick runner:

```bash
# Run self-tests only (fast)
./e-2-e-cypress/scripts/run-tests-quick.sh

# Run full E2E test suite
./e-2-e-cypress/scripts/run-tests-quick.sh --full

# Run specific tests
./e-2-e-cypress/scripts/run-tests-quick.sh --spec '**/login*.cy.js'

# Run with browser visible (debugging)
./e-2-e-cypress/scripts/run-tests-quick.sh --headed
```

## Manual Container Management

Start containers manually for development:

```bash
cd integration-testing/src/main/docker

# Build and deploy NAR files first
./copy-deployment.sh

# Start containers
docker compose up -d --build

# Check container status
docker compose ps

# View logs
docker compose logs -f nifi
docker compose logs -f keycloak

# Stop containers
docker compose down -v
```

## Test Environment Access

While containers are running:

- **NiFi UI**: https://localhost:9095/nifi/
- **Keycloak**: https://localhost:9085/auth/
- **Keycloak Admin**: https://localhost:9085/auth/admin/ (admin/admin)

## Development Workflow

### Running Tests During Development

1. Start containers once:
   ```bash
   ./e-2-e-cypress/scripts/run-integration-tests.sh --keep-containers --only-selftests
   ```

2. Make changes to tests or code

3. Run quick tests:
   ```bash
   ./e-2-e-cypress/scripts/run-tests-quick.sh
   ```

4. Open Cypress UI for debugging:
   ```bash
   cd e-2-e-cypress
   npm run cypress:open
   ```

### Adding New Tests

1. Create test files in `e-2-e-cypress/cypress/e2e/` or `e-2-e-cypress/cypress/selftests/`
2. Use the existing custom commands in `e-2-e-cypress/cypress/support/commands/`
3. Test locally with `./e-2-e-cypress/scripts/run-tests-quick.sh`
4. Commit and push - CI will run the same tests

## Troubleshooting

### Container Issues

```bash
# Check container health
docker compose ps

# View container logs
docker compose logs nifi
docker compose logs keycloak

# Restart containers
docker compose restart

# Full reset
docker compose down -v
docker compose up -d --build
```

### Test Failures

```bash
# Run with browser visible for debugging
./e-2-e-cypress/scripts/run-tests-quick.sh --headed

# Run specific test file
./e-2-e-cypress/scripts/run-tests-quick.sh --spec '**/failing-test.cy.js'

# Check test artifacts
ls -la e-2-e-cypress/cypress/screenshots/
ls -la e-2-e-cypress/cypress/videos/
```

### Port Conflicts

If ports 9095, 9085, or 9080 are in use:

```bash
# Check what's using the ports
lsof -i :9095
lsof -i :9085
lsof -i :9080

# Kill processes if needed
sudo lsof -ti:9095 | xargs kill -9
```

### Build Issues

```bash
# Clean rebuild
./mvnw clean package -DskipTests

# Force NAR rebuild
rm -rf target/nifi-deploy
./mvnw clean package -DskipTests
```

## Integration with CI/CD

The local setup matches the CI environment:
- Same Docker containers
- Same test configuration
- Same environment variables
- Same build process

This ensures that tests passing locally will also pass in CI.

## Performance Tips

1. Use `--skip-build` if you haven't changed code
2. Use `--keep-containers` to avoid restart overhead
3. Use `--only-selftests` for faster feedback
4. Use `./e-2-e-cypress/scripts/run-tests-quick.sh` for rapid iteration

## Configuration

### Environment Variables

Tests use these environment variables (automatically set):
- `CYPRESS_BASE_URL=https://localhost:9095/nifi`
- `CYPRESS_KEYCLOAK_URL=https://localhost:9085/auth`

### Container Configuration

Container settings are in `integration-testing/src/main/docker/docker-compose.yml`:
- NiFi: Port 9095, open access configuration
- Keycloak: Ports 9080 (HTTP), 9085 (HTTPS), 9086 (Management)

### Test Configuration

Test settings are in:
- `e-2-e-cypress/cypress.config.js` - Main E2E tests
- `e-2-e-cypress/cypress.selftests.config.js` - Self-tests
