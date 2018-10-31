const assert = require('assert');
const q = require('../index.js');

class TestApplet extends q.DesktopApp {
  constructor() {
    super();
    this.foo = 'bar';
  }

  async run() {
    return (new q.Signal({
      points: [
        [new q.Point('#FF0000', q.Effects.BLINK)]
      ]
    }));
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
  test.processConfig({
    testMode: true
  });

  let geometryTest = new TestApplet();
  geometryTest.geometry = {
    width: 5,
    height: 6,
    origin: {
      x: 6,
      y: 7
    }
  };

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
  });
  describe('#flash()', function () {
    it('should flash', function () {
      assert.ok(test.handleFlash());
    })
  });
  describe('#getWidth()', function () {
    it('should know its width', function () {
      assert.ok(test.getWidth());
      assert(5 == geometryTest.getWidth());
    })
  });
  describe('#getHeight()', function () {
    it('should know its height', function () {
      assert.ok(test.getHeight());
      assert(6 == geometryTest.getHeight());
    })
  });
  describe('#getOriginX()', function () {
    it('should know its X origin', function () {
      assert(0 == test.getOriginX() || test.getOriginX());
      assert(6 == geometryTest.getOriginX());
    })
  });
  describe('#getOriginY()', function () {
    it('should know its Y origin', function () {
      assert.ok(0 == test.getOriginY() || test.getOriginY());
      assert(7 == geometryTest.getOriginY());
    })
  });
});