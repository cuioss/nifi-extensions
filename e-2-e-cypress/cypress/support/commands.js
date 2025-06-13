// ***********************************************
// This file will be imported in support/e2e.js
// which will be processed before the test files
// ***********************************************

// Import all command files to ensure they're registered

// Authentication commands
import './commands/auth/login';
import './commands/auth/simplified-login';
import './commands/auth/enhanced-auth';

// Navigation commands
import './commands/navigation/navigation';

// Processor commands
import './commands/processor/processor';
import './commands/processor/processor-add-alternatives';
import './commands/processor/processor-testing-strategy';
import './commands/processor/processor-config';
import './commands/processor/processor-utils';
import './commands/processor/enhanced-processor';

// Validation commands
import './commands/validation/validation';

// UI commands
import './commands/ui/i18n';
import './commands/ui/browser';
import './commands/ui/accessibility';
import './commands/ui/visual';
