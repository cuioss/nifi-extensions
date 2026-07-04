// Provide a global fetch mock for Jest (jsdom does not include fetch).
// No default implementation — `resetMocks: true` would strip it before every
// test anyway; tests set up their own responses.
globalThis.fetch = jest.fn();
