// Silence Jest's captured console passthrough for the test run.
//
// The `log` utility (src/main/webapp/js/utils.js) delegates to console.debug/
// console.info/console.warn/console.error. Passing tests that exercise the real
// utility cause Jest to re-print this captured output, which the
// frontend-maven-plugin then surfaces under Maven's [INFO] prefix — noise that
// reads like a build failure. Stub the four methods the `log` utility uses with
// no-op jest.fn() stubs so the captured output is not re-printed. A test that
// needs to assert on console output can still install its own local
// jest.spyOn(console, …), which this global stub does not prevent.
//
// console.log is intentionally NOT stubbed — raw console.log is forbidden in this
// codebase, so it is never emitted by production code.

const stubConsole = () => {
    console.debug = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
};

// Install once for setup-time emissions, then re-apply before every test so the
// stubs survive the project's `restoreMocks: true` per-test restore.
stubConsole();

beforeEach(() => {
    stubConsole();
});
