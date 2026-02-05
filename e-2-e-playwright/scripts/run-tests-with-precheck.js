#!/usr/bin/env node

/**
 * @file Run Tests with Pre-check
 * Ensures self-tests pass before running actual tests
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runCommand(command, args, description) {
    return new Promise((resolve, reject) => {
        log(`\n${description}...`, 'cyan');
        
        const proc = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            cwd: join(__dirname, '..')
        });
        
        proc.on('close', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                reject(new Error(`${description} failed with code ${code}`));
            }
        });
        
        proc.on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    const args = process.argv.slice(2);
    
    log('\n🔍 E2E Test Runner with Pre-checks', 'blue');
    log('=====================================\n', 'blue');
    
    try {
        // Step 1: Run self-tests
        log('Step 1: Running self-tests to validate environment', 'yellow');
        await runCommand('npm', ['run', 'playwright:test', '--', 'tests/self-*.spec.js', '--reporter=list'], 'Self-tests');
        log('✅ Self-tests passed!', 'green');
        
        // Step 2: Run actual tests
        if (args.length > 0) {
            log('\nStep 2: Running requested tests', 'yellow');
            const testArgs = ['run', 'playwright:test', '--', ...args, '--reporter=list'];
            await runCommand('npm', testArgs, 'Actual tests');
            log('✅ All tests completed successfully!', 'green');
        } else {
            log('\nStep 2: Running all non-self tests', 'yellow');
            await runCommand('npm', ['run', 'playwright:test', '--', '--grep-invert', 'self-', '--reporter=list'], 'All tests');
            log('✅ All tests completed successfully!', 'green');
        }
        
    } catch (error) {
        log(`\n❌ ${error.message}`, 'red');
        log('\nTroubleshooting:', 'yellow');
        log('1. Ensure MultiIssuerJWTTokenAuthenticator is on the canvas', 'yellow');
        log('2. Check NiFi is running: https://localhost:9095/nifi', 'yellow');
        log('3. Verify Keycloak is running: https://localhost:9085', 'yellow');
        log('4. Run self-tests separately: npm run test:self', 'yellow');
        process.exit(1);
    }
}

main();