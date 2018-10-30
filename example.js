const q = require('./index');

class QExample extends q.DesktopApp {
  /** just send a signal without thinking about it  */
  async run() {
    // we always return a 2D array of points, but we only need
    // one row in this case.
    let points = [
      [
        // blinking red light
        new q.Point('#FF0000', q.Effects.BLINK),
        // solid green light
        new q.Point('#00FF00'),
        // blue light with 'breathe' effect
        new q.Point('#0000FF', q.Effects.BREATHE)
      ]
    ];

    // config.extensionId identifies what extension is providing
    // the signal
    return new q.Signal([points]);
  }
}


const example = new QExample();
example.start();