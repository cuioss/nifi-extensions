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

#### ESLint

This project uses ESLint for JavaScript code linting. ESLint helps maintain code quality and consistency by enforcing coding standards and best practices.

##### ESLint Configuration

The ESLint configuration is defined in `.eslintrc.js` and includes:

- Support for AMD pattern with define()
- Support for jQuery
- Support for Jest testing
- Code style rules for consistent formatting
- Best practices for JavaScript development

Files and directories to be ignored by ESLint are specified in `.eslintignore`.

##### ESLint Commands

The following npm scripts are available for linting:

```bash
# Run ESLint on all JavaScript files
npm run lint

# Run ESLint and automatically fix issues where possible
npm run lint:fix

# Run ESLint in watch mode
npm run lint:watch
```

#### Jest Testing

This project uses Jest for JavaScript testing. Test files are located in the `src/test/js` directory.

##### Jest Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Development Workflow

1. Write code following the ESLint rules
2. Run `npm run lint` to check for issues
3. Run `npm run lint:fix` to automatically fix simple issues
4. Write tests for your code
5. Run `npm test` to ensure all tests pass
6. Run `npm run test:coverage` to check test coverage

## Building the Project

This module is built as part of the parent project. See the parent project's README for build instructions.