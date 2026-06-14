'use strict';

// Regression guard for the global console-silencing setup.
//
// jest.setup-console.js (registered via package.json `jest.setupFilesAfterEnv`)
// replaces console.debug/info/warn/error with no-op jest.fn() stubs so that the
// `log` utility's captured output is never re-printed by Jest — output that the
// frontend-maven-plugin would otherwise surface under Maven's [INFO] prefix,
// reading like a build failure.
//
// These tests fail fast if the setup file is removed or its
// `setupFilesAfterEnv` reference is deleted: in either case the console methods
// revert to their real (printing) implementations and stop being jest mocks.

const SILENCED_METHODS = ['debug', 'info', 'warn', 'error'];

describe('jest.setup-console global stubbing', () => {
    test.each(SILENCED_METHODS)(
        'console.%s is replaced by a jest mock (intercepted, not real)',
        (method) => {
            // Arrange / Act — the global setup has already installed the stub.
            const fn = console[method];

            // Assert — a real console method has no jest mock metadata.
            expect(jest.isMockFunction(fn)).toBe(true);
        }
    );

    test.each(SILENCED_METHODS)(
        'calling console.%s records the call without emitting output',
        (method) => {
            // Arrange — clearMocks:true resets call history before each test.
            const fn = console[method];

            // Act — invoke the silenced method as production code would.
            console[method]('regression probe', { detail: 42 });

            // Assert — the call is intercepted (recorded by the mock), proving
            // the output was swallowed rather than printed to the test log.
            expect(fn.mock.calls.length).toBe(1);
            expect(fn).toHaveBeenLastCalledWith('regression probe', { detail: 42 });
        }
    );

    test('console.log is intentionally left un-stubbed', () => {
        // raw console.log is forbidden in this codebase, so production code never
        // emits it; the setup file deliberately does not touch console.log. This
        // assertion locks in that intent so a future change that blanket-stubs
        // console.log is caught and re-justified.
        expect(jest.isMockFunction(console.log)).toBe(false);
    });

    test('stubs are re-applied per test so restoreMocks does not unsilence them', () => {
        // The setup file installs a beforeEach hook to re-stub after the
        // project-wide `restoreMocks: true` per-test restore. Without that hook,
        // restored console methods would print again from the second test onward.
        // By this fifth describe-block test the hook has fired four times; the
        // methods must still be mocks.
        for (const method of SILENCED_METHODS) {
            expect(jest.isMockFunction(console[method])).toBe(true);
        }
    });
});
