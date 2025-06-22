// ***********************************************
// This file will be imported in support/e2e.js
// which will be processed before the test files
// ***********************************************

// Import all command files to ensure they're registered

// Fail-fast commands
import './commands/fail-fast/timeout';

// Authentication commands
import './commands/auth/login';
import './commands/auth/simplified-login';
import './commands/auth/enhanced-auth';

// Navigation commands
import './commands/navigation/navigation';

// Processor commands - use clean implementation
import './commands/processor/processor-clean';
import './commands/processor/processor-add-alternatives';
import './commands/processor/processor-testing-strategy';
import './commands/processor/processor-config';
import './commands/processor/processor-utils';
import './commands/processor/enhanced-processor';
import './commands/processor/missing-commands';
import './commands/processor/task4-commands';
import './commands/processor/task4-ui-commands';
import './commands/processor/task4-additional-commands';

// Validation commands
import './commands/validation/validation';
import './commands/validation/jwt-token-commands';

// UI commands
import './commands/ui/i18n';
import './commands/ui/browser';
import './commands/ui/accessibility';
import './commands/ui/visual';

// Advanced settings commands
import './commands/processor/advanced-settings-commands';
