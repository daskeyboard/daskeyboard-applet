const assert = require('assert');
const q = require('../index.js');
const authProxyBaseUri = require('./auth.json').oAuth2ProxyBaseUrl;
const apiKey = require('./auth.json').apiKey;
process.env = {
  ...process.env,
  oAuth2ProxyBaseUrlDefault: authProxyBaseUri
}

class TestApplet extends q.DesktopApp {
  constructor() {
    super();
    this.foo = 'bar';
    this.extensionId = Math.random() * 1000000 + '';
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
      const signal = new q.Signal({
        points: [
          [new q.Point('#FFFFFF')]
        ]
      });
      assert.equal(signal.points.length, 1);
    });

    it('should hold a data attribute', function () {
      const signal = new q.Signal({
        points: [
          [new q.Point('#FFFFFF')]
        ],
        data: {
          action: {
            url: 'http://foo.bar',
            label: 'Adjust your things'
          }
        }
      });
      assert.ok(signal.data.action.url);
      assert.ok(signal.data.action.label);
    })
  });

  it('should produce an error signal', function () {
    const signal = new q.Signal.error({
      messages: 'foo'
    });
    assert.ok(signal);
    assert.equal('ERROR', signal.action);
  });

  it('should delete a signal', async function () {
    this.timeout(5000);
    const signal = new q.Signal({
      origin: {
        x: 5,
        y: 5
      },
      points: [
        [new q.Point('#FF0000')]
      ],
    });

    return q.Signal.send(signal).then(result => {
      console.log("##### Sent signal, got response: ");
      console.log(JSON.stringify(result));
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          return q.Signal.delete(result.body.id).then(result => {
            resolve(true);
          }).catch(error => {
            reject(error);
          })
        }, 2000);
      })
    })
  });
});

describe('QDesktopApplet', async function () {
  let mainTest = await buildApp();

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
      assert.equal(mainTest.foo, 'bar');
    });

    it('should have a oAuth2ProxyBaseUrlDefault', function () {
      assert.ok(mainTest.oAuth2ProxyBaseUrlDefault);
    })
  });
  describe('#run()', function () {
    it('should be able to run', function () {
      return mainTest.run().then((signal) => {
        console.log("Got signal: " + JSON.stringify(signal));
        assert.ok(signal, 'Did not return a truthy signal.');
        assert(signal.points.length === 1, 'Signal did not return the correct number of points.');
      }).catch(error => assert.fail(error));
    })
  });
  describe('#flash()', function () {
    it('should flash', function () {
      return mainTest.handleFlash().then(() => {
      }).catch(error => assert.fail(error));
    })
  });
  describe('#getWidth()', function () {
    it('should know its width', function () {
      assert.ok(mainTest.getWidth());
      assert(5 == geometryTest.getWidth());
    })
  });
  describe('#getHeight()', function () {
    it('should know its height', function () {
      assert.ok(mainTest.getHeight());
      assert(6 == geometryTest.getHeight());
    })
  });
  describe('#getOriginX()', function () {
    it('should know its X origin', function () {
      assert(0 == mainTest.getOriginX() || mainTest.getOriginX());
      assert(6 == geometryTest.getOriginX());
    })
  });
  describe('#getOriginY()', function () {
    it('should know its Y origin', function () {
      assert.ok(0 == mainTest.getOriginY() || mainTest.getOriginY());
      assert(7 == geometryTest.getOriginY());
    })
  });
  describe('#signal()', function () {
    it('should signal', async function () {
      const test = await buildApp();
      const signal = new q.Signal({
        points: [
          [new q.Point('#00FF00')]
        ],
        link: {
          url: 'http://foo.bar',
          label: 'Click here.',
        }
      });
      return test.signal(signal).then(result => {
        assert.ok(result);
        assert.ok(signal.id);
        assert(test.signalLog.length);
        assert(test.signalLog[0].result);
        assert.equal(200, test.signalLog[0].result.statusCode);

        assert(test.signalLog[0].signal);
        assert.equal(signal.id, test.signalLog[0].signal.id);
      }).catch(error => assert.fail(error));
    })
  });
  describe('#clearSignals', () => {
    it('should clear signals', async function () {
      const test = await buildApp();
      const signal1 = new q.Signal({
        points: [
          [new q.Point('#00FF00'), new q.Point('#FF0000')]
        ]
      })
      const signal2 = new q.Signal({
        points: [
          [new q.Point('#00FF00'), new q.Point('#FF0000')]
        ]
      })
      return Promise.all([test.signal(signal1), test.signal(signal2)]).then(result => {
        return test.clearSignals().then(() => {
          assert.equal(test.signalLog.length, 0);
        }).catch(err => assert.fail(err));

      }).catch(err => assert.fail(err));
    });
  });
  describe('#signalError()', function () {
    it('should signalError', function () {
      return mainTest.signalError(['foo', 'bar']).then(result => {
        assert.ok(result);
      }).catch(error => assert.fail(error));
    })
  });
  describe('#processConfig()', function () {
    it('should gracefully handle an empty config', async function () {
      let test = new TestApplet();
      return test.processConfig({}).then(() => {
        assert.ok(test);
        assert.ok(test.config);
        assert.ok(test.geometry);
        assert.ok(test.geometry.height);
        assert.ok(test.geometry.width);
        assert.notEqual(null, test.geometry.origin.x);
        assert.notEqual(null, test.geometry.origin.y);
        assert.ok(test.authorization);
      });
    });

    it('should gracefully handle null config', async function () {
      let test = new TestApplet();
      return test.processConfig(null).then(() => {
        assert.ok(test);
        assert.ok(test.config);
        assert.ok(test.geometry);
        assert.ok(test.authorization);
      });
    })

    it('should gracefully handle no config', async function () {
      let test = new TestApplet();
      return test.processConfig().then(() => {
        assert.ok(test);
        assert.ok(test.config);
        assert.ok(test.geometry);
        assert.ok(test.authorization);
      });
    });
  })
});

// describe('Oauth2ProxyRequest', function () {
//   beforeEach(function () {
//     this.proxy = new q.Oauth2ProxyRequest({
//       apiKey: apiKey
//     });
//   })
//   it('should getOauth2ProxyToken', async function () {

//     return this.proxy.getOauth2ProxyToken().then(result => {
//       assert.ok(result.access_token);
//       assert.ok(result);
//     }).catch(err => assert.fail(err));
//   });

//   it('should getOauth2ProxyClientPayload', async function () {
//     return this.proxy.getOauth2ProxyClientPayload().then(result => {
//       assert.ok(result);
//     }).catch(err => assert.fail(err));
//   });
// });

async function buildApp() {
  const test = new TestApplet();
  await test.processConfig({
    devMode: true
  });

  return test;
}