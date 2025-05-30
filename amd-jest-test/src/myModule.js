define([], function() {
  function greet(name) {
    if (!name) {
      return "Hello, stranger!";
    }
    return "Hello, " + name + "!";
  }

  return {
    greet: greet
  };
});
