const assert = require('assert');
const q = require('../index.js');

class TestApplet extends q.DesktopApp {
  constructor() {
    super();
    this.foo = 'bar';
  }

  async run() {
    return (new q.Signal({points: [
      [new q.Point('#FF0000', q.Effects.BLINK)]
    ]}));
  }
}


describe('QDesktopSignal', function () {
  describe('#constructor()', function () {
    it('should return a valid instance', function () {
      let signal = new q.Signal([
        [new q.Point('#FFFFFF')]
      ]);
      assert.equal(signal.points.length, 1);
    })
  })
});

describe('QDesktopApplet', function () {
  let test = new TestApplet();
  describe('#constructor()', function () {
    it('should return a valid instance', function () {
      assert.equal(test.foo, 'bar');
    })
  });
  describe('#run()', function () {
    it('should be able to run', function () {
      test.run().then((signal) => {
        console.log("Got signal: " + JSON.stringify(signal));
        assert.ok(signal, 'Did not return a truthy signal.');
        assert(signal.points.length === 1, 'Signal did not return the correct number of points.');
      });
    })
  })
})
