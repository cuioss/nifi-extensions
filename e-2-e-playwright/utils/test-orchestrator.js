/**
 * @file Test Orchestrator
 * Ensures self-tests pass before running actual tests
 * @version 1.0.0
 */

import { execSync } from 'child_process';
import { processorLogger } from './shared-logger.js';

/**
 * Run self-tests and check if they pass
 * @returns {boolean} true if all self-tests pass
 */
export async function runSelfTests() {
    processorLogger.info('Running self-tests to validate test environment...');
    
    try {
        // Run all self-tests
        execSync('npm run playwright:test -- tests/self-*.spec.js --reporter=list', {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        processorLogger.success('✅ All self-tests passed! Environment is ready for testing.');
        return true;
    } catch (error) {
        processorLogger.error('❌ Self-tests failed! Please fix the following issues before running tests:');
        processorLogger.error('');
        processorLogger.error('Common issues:');
        processorLogger.error('1. No processor on canvas - Add MultiIssuerJWTTokenAuthenticator manually');
        processorLogger.error('2. NiFi not running - Run ./integration-testing/src/main/docker/run-and-deploy.sh');
        processorLogger.error('3. Authentication issues - Check Keycloak is running');
        processorLogger.error('');
        processorLogger.error('Run self-tests separately to see detailed errors:');
        processorLogger.error('npm run test:self');
        return false;
    }
}

/**
 * Run specific test files after self-tests pass
 * @param {string[]} testFiles - Array of test file paths
 */
export async function runTestsWithPrecheck(testFiles) {
    processorLogger.info('=== Test Orchestrator Starting ===');
    
    // First run self-tests
    const selfTestsPassed = await runSelfTests();
    
    if (!selfTestsPassed) {
        processorLogger.error('');
        processorLogger.error('⛔ Aborting test execution - Self-tests must pass first!');
        processorLogger.error('');
        process.exit(1);
    }
    
    // If self-tests passed, run the actual tests
    processorLogger.info('');
    processorLogger.info('Running actual tests...');
    
    try {
        const testCommand = `npm run playwright:test -- ${testFiles.join(' ')} --reporter=list`;
        execSync(testCommand, {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        processorLogger.success('✅ All tests completed successfully!');
    } catch (error) {
        processorLogger.error('❌ Some tests failed. Check the output above for details.');
        process.exit(1);
    }
}

// If called directly from command line
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        processorLogger.error('Usage: node test-orchestrator.js <test-file1> [test-file2] ...');
        process.exit(1);
    }
    
    runTestsWithPrecheck(args);
}