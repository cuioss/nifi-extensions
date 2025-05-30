const myModule = require('../myModule');

describe('myModule', () => {
  it('should greet by name', () => {
    expect(myModule.greet('World')).toBe('Hello, World!');
  });

  it('should greet stranger if no name provided', () => {
    expect(myModule.greet()).toBe('Hello, stranger!');
  });
});
