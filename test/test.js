const assert = require('assert');
const q = require('../index.js');

class TestApplet extends q.DesktopApp {
  constructor() {
    super();
    this.foo = 'bar';
  }

  async run() {
    return true;
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
      test.run().then((result) => {
        assert.ok(result);
      });
    })
  })
})
