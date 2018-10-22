const q = require('./index.js');

function testInstantiateSignal() {
  let signal = new q.Signal([
    [new q.Point('#FFFFFF')]
  ]);
  return console.log("Passed.");
}

class TestApplet extends q.DesktopApp {
  constructor() {
    super();
    this.foo = 'bar';
  }

  async run() {
    return true;
  }
}

function testInstantiateApplet() {
  let test = new TestApplet();
  if (test.foo === 'bar') {
    return console.log("Passed.");
  } else {
    return console.log("Failed.");
  }
}

function testRunApplet() {
  let test = new TestApplet();
  test.run().then((result) => {
    if (result) {
      return console.log("Passed.");
    } else {
      return console.log("Failed.");
    }
  });
}

testInstantiateSignal();
testInstantiateApplet();
testRunApplet();