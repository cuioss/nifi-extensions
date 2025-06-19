# Setup and Configuration Guide

This guide provides complete setup instructions for the NiFi integration testing framework.

## Prerequisites

### System Requirements
- **Java**: 11+ (required for Maven)
- **Maven**: 3.8.0+ (build system)
- **Docker**: Latest version with docker-compose
- **Node.js**: 20.x (auto-installed via Maven)

### Verification Commands
```bash
# Check Java version
java -version

# Check Maven version
mvn -version

# Check Docker availability
docker --version && docker compose version

# Verify Docker daemon is running
docker ps
```

## Environment Setup

### 1. Project Structure
```
nifi-extensions/
├── e-2-e-cypress/           # Cypress testing module
├── integration-testing/     # Docker environment
├── nifi-cuioss-processors/ # Custom processors
└── target/nifi-deploy/     # NAR deployment
```

### 2. Start Test Environment
```bash
# Navigate to integration testing
cd integration-testing

# Start NiFi and Keycloak containers
./run-test-container.sh

# Verify containers are running
docker ps | grep -E "(nifi|keycloak)"
```

### 3. Install Testing Dependencies
```bash
# Navigate to Cypress module
cd e-2-e-cypress

# Install dependencies (automatic via Maven)
mvn clean install

# Alternative: Direct npm install
npm install
```

## Configuration

### Test Environment URLs
- **NiFi UI**: `http://localhost:9094/nifi/`
- **Keycloak**: `http://localhost:9080/`
- **Health Check**: `http://localhost:9094/nifi-api/system-diagnostics`

### Authentication
- **Username**: `admin`
- **Password**: `ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB`

### NAR Deployment Verification
```bash
# Check NAR file exists
ls -la ../target/nifi-deploy/

# Verify processor availability in NiFi UI
# Navigate to: Add Processor → Filter: "MultiIssuer"
```

## Test Execution

### Running All Tests
```bash
# Full test suite
npm test

# Maven integration
mvn verify -Pui-tests
```

### Running Specific Tests
```bash
# Authentication tests only
npx cypress run --spec "cypress/e2e/auth/*.cy.js"

# Processor tests only
npx cypress run --spec "cypress/e2e/processors/*.cy.js"

# Single test file
npx cypress run --spec "cypress/e2e/auth/login.cy.js"
```

### Interactive Mode
```bash
# Open Cypress Test Runner
npx cypress open

# Open with specific configuration
npx cypress open --config-file cypress.config.js
```

## Build Integration

### Maven Profiles
```bash
# Run self-tests (safe mode)
mvn verify -Pselftests

# Run UI tests (requires containers)
mvn verify -Pui-tests

# Combined build with testing
mvn clean install -Pui-tests
```

### Maven Profile Configuration
The integration tests use Maven profiles for container management:

```xml
<!-- CUI-compliant container lifecycle management -->
<profile>
  <id>integration-tests</id>
  <build>
    <plugins>
      <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>exec-maven-plugin</artifactId>
        <executions>
          <execution>
            <id>start-containers</id>
            <phase>pre-integration-test</phase>
            <goals>
              <goal>exec</goal>
            </goals>
            <configuration>
              <executable>./scripts/start-integration-containers.sh</executable>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
</profile>
```

## Verification Procedures

### Health Checks
```bash
# Check system status
npm run status

# Verify NiFi API availability
curl -f http://localhost:9094/nifi-api/system-diagnostics

# Check authentication
curl -f http://localhost:9080/realms/nifi
```

### Test Environment Validation
```bash
# Run verification script
./scripts/verification/verify-setup.sh

# Verify processor deployment
./scripts/verification/verify-processors.sh
```

## Troubleshooting

### Common Issues

#### Container Startup Problems
```bash
# Check container logs
docker compose logs nifi
docker compose logs keycloak

# Restart containers
docker compose down && docker compose up -d

# Clean restart
docker compose down -v && docker compose up -d
```

#### Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep -E "(9080|9094|9085)"

# Alternative ports in docker-compose.yml if needed
```

#### NAR Deployment Issues
```bash
# Rebuild and redeploy
cd ..
mvn clean install
ls -la target/nifi-deploy/

# Check NiFi logs for deployment
docker compose logs nifi | grep -i "nar\|deploy"
```

#### Authentication Failures
```bash
# Verify Keycloak status
curl http://localhost:9080/realms/nifi

# Check Keycloak logs
docker compose logs keycloak | tail -50

# Reset authentication state
rm -rf cypress/downloads cypress/screenshots
```

### Performance Issues

#### Slow Test Execution
- Increase timeouts in `cypress.config.js`
- Use `cy.wait()` strategically, not excessively
- Optimize selectors for better performance

#### Memory Issues
```bash
# Increase Docker memory allocation
# In Docker Desktop: Settings → Resources → Memory → 8GB+

# Monitor resource usage
docker stats
```

## Development Workflow

### Code Quality Standards
This project follows [CUI JavaScript Standards](https://github.com/cuioss/cui-llm-rules/tree/main/standards/javascript):

```bash
# Lint check
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Type checking (if applicable)
npm run type-check
```

### Testing Best Practices
1. **Focus on Custom Logic**: Test JWT validation, not NiFi mechanics
2. **Minimal NiFi Interaction**: Use utilities for setup, focus on testing
3. **Error Handling**: Test edge cases and error scenarios
4. **Clean State**: Ensure proper cleanup in `afterEach()` hooks

### File Organization
```
cypress/
├── e2e/
│   ├── auth/           # Authentication tests
│   ├── processors/     # Processor-specific tests
│   └── integration/    # Integration scenarios
├── support/
│   ├── commands/       # Custom commands
│   ├── constants.js    # Test constants
│   └── e2e.js         # Global configuration
└── fixtures/          # Test data
```

## Environment Variables

### Configuration Options
```bash
# Set test environment
export CYPRESS_ENV=local

# Custom timeouts
export CYPRESS_DEFAULT_TIMEOUT=10000

# Debug mode
export DEBUG=cypress:*

# Custom base URL
export CYPRESS_BASE_URL=http://localhost:9094
```

### CI/CD Variables
```bash
# GitHub Actions environment
export CI=true
export CYPRESS_RECORD_KEY=<record-key>

# Container health check
export CONTAINER_HEALTH_TIMEOUT=60
```

## Performance Optimization

### Resource Management
- **Container Resources**: Allocate sufficient Docker memory (8GB+)
- **Test Parallelization**: Use Cypress Dashboard for parallel execution
- **Caching**: Leverage Maven and npm caching in CI/CD

### Test Optimization
- **Selective Testing**: Run only relevant test suites
- **Fast Feedback**: Prioritize critical path tests
- **Efficient Selectors**: Use data attributes over CSS selectors

---

*For troubleshooting specific issues, see [Testing Patterns](./testing-patterns.md) or [Technical Architecture](./architecture.md).*
