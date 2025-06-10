/**
 * Jest configuration to handle duplicate module resolution issues
 */
module.exports = {
  // Exclude the target directories where duplicate modules are found
  modulePathIgnorePatterns: [
    '<rootDir>/target/'
  ],
  // Keep other Jest settings that might already be in use
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^jquery$': '<rootDir>/src/test/js/mocks/jquery-extended.js'
  }
};
