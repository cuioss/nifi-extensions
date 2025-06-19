# NiFi CUI-OSS Processors

This module contains custom Apache NiFi processors developed by CUI-OSS.

## JavaScript Development

This project includes JavaScript components for the MultiIssuerJWTTokenAuthenticator processor. The JavaScript code is located in the `src/main/webapp/js` directory.

### Code Structure

- `src/main/webapp/js/components/` - UI components
- `src/main/webapp/js/services/` - Service modules
- `src/main/webapp/js/utils/` - Utility functions
- `src/main/webapp/js/main.js` - Main entry point

### Development Tools

This project follows the centralized JavaScript and ESLint standards defined in the organization's coding standards repository.

[NOTE]
====
For complete ESLint configuration, rules, and implementation guidelines, see:
* **JavaScript Standards**: `/standards/javascript/`
* **JavaScript Linting Standards**: `/standards/javascript/linting-standards.adoc`
====

#### JavaScript Development

The project uses:
- **ESLint** for code quality and standards enforcement
- **Jest** for JavaScript testing and coverage
- **Prettier** for code formatting
- **Babel** for modern JavaScript transpilation

#### Available Commands

```bash
# Run ESLint checks
npm run lint

# Run ESLint with automatic fixes
npm run lint:fix

# Run JavaScript tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Development Workflow

1. Follow centralized JavaScript coding standards
2. Write tests for your code using Jest
3. Run linting and tests before committing
4. Ensure all quality gates pass

## Building the Project

This module is built as part of the parent project. See the parent project's README for build instructions.