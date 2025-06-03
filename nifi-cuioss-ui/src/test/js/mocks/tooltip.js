/**
 * Mock for the tooltip.js utility module.
 */
export const initTooltips = jest.fn();

// If you need to mock other exports from tooltip.js in the future, add them here.
// For now, only initTooltips is mocked as it's the primary function used.

// You can also provide a default mock implementation if needed, for example:
// initTooltips.mockImplementation(() => {
//   console.log('Mocked initTooltips called');
//   return {
//     destroy: jest.fn() // Mock a basic tippy instance API if your tests depend on it
//   };
// });
