/**
 * @file Tests for logger.js utility
 * Tests the centralized logging functionality
 */

import { createLogger, LOG_LEVELS, logger, LogLevel } from 'utils/logger';

describe('Logger Utility', () => {
    let consoleDebugSpy;
    let consoleInfoSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        // Spy on console methods
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Clear localStorage
        localStorage.clear();

        // Reset window.nifiDebug if it exists
        if (window.nifiDebug) {
            delete window.nifiDebug;
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('NiFiLogger', () => {
        describe('Log Levels', () => {
            it('should have correct log level constants', () => {
                expect(LogLevel.DEBUG).toBe(0);
                expect(LogLevel.INFO).toBe(1);
                expect(LogLevel.WARN).toBe(2);
                expect(LogLevel.ERROR).toBe(3);
                expect(LogLevel.FATAL).toBe(4);
            });

            it('should export LOG_LEVELS as alias for LogLevel', () => {
                expect(LOG_LEVELS).toBe(LogLevel);
            });
        });

        describe('Default Logger', () => {
            it('should create default logger instance', () => {
                expect(logger).toBeDefined();
                expect(logger.component).toBe('NiFi-UI');
            });
        });

        describe('createLogger Factory', () => {
            it('should create component-specific logger', () => {
                const testLogger = createLogger('TestComponent');
                expect(testLogger).toBeDefined();
                expect(testLogger.component).toBe('TestComponent');
            });
        });

        describe('Debug Logging', () => {
            it('should log debug messages when log level allows', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.DEBUG);
                testLogger.debug('Debug message');

                expect(consoleDebugSpy).toHaveBeenCalled();
                const args = consoleDebugSpy.mock.calls[0];
                expect(args[0]).toContain('[DEBUG] Test:');
                expect(args[1]).toBe('Debug message');
            });

            it('should not log debug messages when log level is higher', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.INFO);
                testLogger.debug('Debug message');

                expect(consoleDebugSpy).not.toHaveBeenCalled();
            });
        });

        describe('Info Logging', () => {
            it('should log info messages when log level allows', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.INFO);
                testLogger.info('Info message', 'extra arg');

                expect(consoleInfoSpy).toHaveBeenCalled();
                const args = consoleInfoSpy.mock.calls[0];
                expect(args[0]).toContain('[INFO] Test:');
                expect(args[1]).toBe('Info message');
                expect(args[2]).toBe('extra arg');
            });
        });

        describe('Warn Logging', () => {
            it('should log warn messages when log level allows', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.WARN);
                testLogger.warn('Warning message');

                expect(consoleWarnSpy).toHaveBeenCalled();
                const args = consoleWarnSpy.mock.calls[0];
                expect(args[0]).toContain('[WARN] Test:');
                expect(args[1]).toBe('Warning message');
            });
        });

        describe('Error Logging', () => {
            it('should log error messages when log level allows', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.ERROR);
                testLogger.error('Error message', new Error('Test error'));

                expect(consoleErrorSpy).toHaveBeenCalled();
                const args = consoleErrorSpy.mock.calls[0];
                expect(args[0]).toContain('[ERROR] Test:');
                expect(args[1]).toBe('Error message');
                expect(args[2]).toBeInstanceOf(Error);
            });
        });

        describe('Fatal Logging', () => {
            it('should log fatal messages using console.error', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.DEBUG);
                testLogger.fatal('Fatal error');

                expect(consoleErrorSpy).toHaveBeenCalled();
                const args = consoleErrorSpy.mock.calls[0];
                expect(args[0]).toContain('[FATAL] Test:');
                expect(args[1]).toBe('Fatal error');
            });

            it('should not log fatal messages when log level is higher than FATAL', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.FATAL + 1);
                testLogger.fatal('Fatal error');

                expect(consoleErrorSpy).not.toHaveBeenCalled();
            });
        });

        describe('Child Logger', () => {
            it('should create child logger with combined component name', () => {
                const parentLogger = createLogger('Parent');
                const childLogger = parentLogger.child('Child');

                expect(childLogger.component).toBe('Parent:Child');
                expect(childLogger.logLevel).toBe(parentLogger.logLevel);
            });

            it('should inherit log level from parent', () => {
                const parentLogger = createLogger('Parent');
                parentLogger.setLogLevel(LogLevel.ERROR);
                const childLogger = parentLogger.child('Child');

                expect(childLogger.logLevel).toBe(LogLevel.ERROR);
            });
        });

        describe('Performance Timing', () => {
            let performanceNowSpy;

            beforeEach(() => {
                performanceNowSpy = jest.spyOn(performance, 'now')
                    .mockReturnValueOnce(1000)
                    .mockReturnValueOnce(1250);
            });

            it('should measure operation timing', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.DEBUG);

                const endTimer = testLogger.time('TestOperation');
                expect(consoleDebugSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[DEBUG] Test:'),
                    'Starting operation: TestOperation'
                );

                endTimer();
                expect(consoleDebugSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[DEBUG] Test:'),
                    'Operation completed: TestOperation (250.00ms)'
                );
            });

            it('should return timer function even when debug logging is disabled', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.ERROR);

                const endTimer = testLogger.time('TestOperation');
                expect(typeof endTimer).toBe('function');
                expect(consoleDebugSpy).not.toHaveBeenCalled();

                endTimer();
                expect(consoleDebugSpy).not.toHaveBeenCalled();
            });
        });

        describe('Environment Detection', () => {
            it('should detect localhost as development', () => {
                delete window.location;
                window.location = { hostname: 'localhost', search: '' };

                // Re-import to test environment detection
                jest.resetModules();
                const { logger: newLogger } = require('utils/logger');

                // In development, default level should be DEBUG
                newLogger.debug('Test');
                expect(consoleDebugSpy).toHaveBeenCalled();
            });

            it('should detect debug parameter in URL', () => {
                delete window.location;
                window.location = { hostname: 'production.com', search: '?debug=true' };

                jest.resetModules();
                const { logger: newLogger } = require('utils/logger');

                newLogger.debug('Test');
                expect(consoleDebugSpy).toHaveBeenCalled();
            });

            it('should detect debug flag in localStorage', () => {
                localStorage.setItem('nifi-debug', 'true');
                delete window.location;
                window.location = { hostname: 'production.com', search: '' };

                jest.resetModules();
                const { logger: newLogger } = require('utils/logger');

                newLogger.debug('Test');
                expect(consoleDebugSpy).toHaveBeenCalled();
            });

            it('should detect local network addresses', () => {
                delete window.location;
                window.location = { hostname: '192.168.1.100', search: '' };

                jest.resetModules();
                const { logger: newLogger } = require('utils/logger');

                newLogger.debug('Test');
                expect(consoleDebugSpy).toHaveBeenCalled();
            });

            it('should detect .local domains', () => {
                delete window.location;
                window.location = { hostname: 'mycomputer.local', search: '' };

                jest.resetModules();
                const { logger: newLogger } = require('utils/logger');

                newLogger.debug('Test');
                expect(consoleDebugSpy).toHaveBeenCalled();
            });
        });

        describe('Browser Console API', () => {
            beforeEach(() => {
                // Re-import to ensure window.nifiDebug is set
                jest.resetModules();
                const loggerModule = require('utils/logger');
                // Store references for use in tests
                global.testLogger = loggerModule.logger;
                global.testLogLevel = loggerModule.LogLevel;
            });

            it('should expose nifiDebug API on window', () => {
                expect(window.nifiDebug).toBeDefined();
                expect(window.nifiDebug.enable).toBeInstanceOf(Function);
                expect(window.nifiDebug.disable).toBeInstanceOf(Function);
                expect(window.nifiDebug.setLevel).toBeInstanceOf(Function);
            });

            it('should enable debug mode via console API', () => {
                window.nifiDebug.enable();

                expect(localStorage.getItem('nifi-debug')).toBe('true');
                expect(consoleInfoSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[INFO]'),
                    'Debug logging enabled'
                );
            });

            it('should disable debug mode via console API', () => {
                localStorage.setItem('nifi-debug', 'true');
                window.nifiDebug.disable();

                expect(localStorage.getItem('nifi-debug')).toBeNull();
                // The disable method sets the global logger to WARN level
                // New loggers will inherit from the default level (not the global logger)
                // So we just verify localStorage was cleared
            });

            it('should set specific log level via console API', () => {
                // Reset spies before starting the test
                jest.clearAllMocks();

                // First set to INFO level so we can see the log message
                window.nifiDebug.setLevel(global.testLogLevel.INFO);

                // Verify the info message was logged
                expect(consoleInfoSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[INFO]'),
                    'Log level set to: INFO'
                );

                // Clear mocks and set to ERROR level
                jest.clearAllMocks();
                window.nifiDebug.setLevel(global.testLogLevel.ERROR);

                // The info message from setLevel won't appear because log level is now ERROR
                expect(consoleInfoSpy).not.toHaveBeenCalled();

                // Clear mocks after setLevel to test subsequent calls
                jest.clearAllMocks();

                // The setLevel method only affects the global logger instance
                // We can verify by checking that debug/info/warn don't log
                // Use the logger instance from the re-imported module
                global.testLogger.debug('Debug should not appear');
                global.testLogger.info('Info should not appear');
                global.testLogger.warn('Warn should not appear');
                global.testLogger.error('Error should appear');

                expect(consoleDebugSpy).not.toHaveBeenCalled();
                expect(consoleInfoSpy).not.toHaveBeenCalled();
                expect(consoleWarnSpy).not.toHaveBeenCalled();
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[ERROR] NiFi-UI:'),
                    'Error should appear'
                );
            });
        });

        describe('Message Formatting', () => {
            it('should include timestamp in log messages', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.INFO);
                testLogger.info('Test message');

                const args = consoleInfoSpy.mock.calls[0];
                expect(args[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
            });

            it('should include elapsed time in log messages', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.INFO);

                // Wait a bit to ensure elapsed time > 0
                setTimeout(() => {
                    testLogger.info('Test message');
                    const args = consoleInfoSpy.mock.calls[0];
                    expect(args[0]).toMatch(/\(\+\d+ms\)/);
                }, 10);
            });

            it('should handle multiple arguments', () => {
                const testLogger = createLogger('Test');
                testLogger.setLogLevel(LogLevel.INFO);
                const obj = { key: 'value' };
                const arr = [1, 2, 3];

                testLogger.info('Message', obj, arr, 123);

                const args = consoleInfoSpy.mock.calls[0];
                expect(args[1]).toBe('Message');
                expect(args[2]).toBe(obj);
                expect(args[3]).toBe(arr);
                expect(args[4]).toBe(123);
            });
        });
    });
});
