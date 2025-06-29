// Add only warnings that cannot be fixed
const allowedWarnings = [
  'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
  'DevTools failed to load source map',
  'Content Security Policy violation for inline script',
];

export default allowedWarnings;
