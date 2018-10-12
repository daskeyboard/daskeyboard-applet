const request = require('request-promise');
const utility = require('./lib/utility');

const signalHeaders = {
  "Content-Type": "application/json"
}

const defaultPortInterval = 2000;
const rootConfig = Object.freeze(readConfig());

const extensionId = rootConfig.extensionId;

const appletConfig = Object.freeze(utility.mergeDeep({}, rootConfig.applet.defaults || {}, rootConfig.applet.user || {}));

const authorization = rootConfig.authorization || {};

const geometry = rootConfig.geometry;

/**
 * The base class for apps that run on the Q Desktop
 */
class QDesktopApp {
  constructor() {
    this.authorization = authorization;
    this.config = appletConfig;
    this.extensionId = extensionId;

    process.on('SIGINT', (message) => {
      this.shutdown();
      process.exit();
    })

    this.pollingInterval = defaultPortInterval;
    this.pollingBusy = false;
    this.errorState = null;
  }

  /**
   * The entry point for the app. Currently only launches the polling function,
   * but may do other setup items later.
   */
  start() {
    this.poll();

    setInterval(() => {
      this.poll();

    }, this.pollingInterval);
  }


  /**
   * Schedules the run() function at regular intervals. Currently set to a 
   * constant value, but may become dynamic in the future.
   */
  poll() {
    if (this.pollingBusy) {
      console.log("Skipping run because we are still busy.");
    } else {
      this.pollingBusy = true;
      try {
        this.run().then((signal) => {
          this.errorState = null;
          this.pollingBusy = false;

          if (signal) {
            sendLocal(signal);
          }
        });
      } catch (error) {
        this.errorState = error;
        console.error(
          "Applet encountered an uncaught error in its main loop", error);
        this.pollingBusy = false;
      }
    }
  }

  /**
   * This method is called once each polling interval. This is where most
   * of the work should be done.
   */
  async run() {
    // Implement this method and do some work here.
  }


  /**
   * The extension point for any activities that should
   * take place before shutting down.
   */
  shutdown() {}
}


/**
 * Class representing a single point to be sent to the device
 * @param {string} color - The hexadecimal RGB color to activate, e.g. '#FFCCDD'
 * @param {string} effect - The effect to activate. Enumerated in Effects. 
 *   Default is empty.
 */
class QPoint {
  constructor(color, effect = Effects.SET_COLOR) {
    this.color = color;
    this.effect = effect;
  }
}

class QDesktopSignal {
  /**
   * 
   * @param {QPoint[][]} points A 2D array of QPoints expressing the signal
   */
  constructor(points) {
    this.points = points;
    this.extensionId = extensionId;
  }
}


/**
 * An enumeration of effects
 */
const Effects = Object.freeze({
  'SET_COLOR': 'SET_COLOR',
  'BLINK': 'BLINK',
  'BREATHE': 'BREATHE',
  'COLOR_CYCLE': 'COLOR_CYCLE',
  'RIPPLE': 'RIPPLE',
  'INWARD_RIPPLE': 'INWARD_RIPPLE',
  'BOUNCING_LIGHT': 'BOUNCING_LIGHT',
  'LASER': 'LASER',
  'WAVE': 'WAVE'
});

const backendUrl = 'http://localhost:27301';
const signalEndpoint = backendUrl + '/api/2.0/signals';

/**
 * Send a signal to the local Das Keyboard Q Service.
 * @param {Signal} signal 
 */
async function sendLocal(signal) {
  const originX = geometry.origin.x;
  const originY = geometry.origin.y;

  const actionValue = [];

  const rows = signal.points;
  for (let y = 0; y < rows.length; y++) {
    const columns = rows[y];
    for (let x = 0; x < columns.length; x++) {
      const point = columns[x];
      actionValue.push({
        zoneId: (originX + x) + ',' + (originY + y),
        effect: point.effect,
        color: point.color
      });
    }
  }

  const body = {
    action: "DRAW",
    actionValue: JSON.stringify(actionValue),
    pid: "Q_MATRIX",
    message: "",
    name: "CPU Usage",
    isMuted: true
  }

  return request.post({
    uri: signalEndpoint,
    headers: signalHeaders,
    body: body,
    json: true
  }).then(function (json) {
    // no-op on successful completion
  }).catch(function (err) {
    const error = err.error;
    if (error.code === 'ECONNREFUSED') {
      console.error(`Error: failed to connect to ${signalEndpoint}, make sure` +
        ` the Das Keyboard Q software  is running`);
    } else {
      console.error('Error sending signal ', error);
    }
  });
}


/**
 * Read the configuration from command line arguments. The first command line 
 * argument should be a JSON string.
 */
function readConfig() {
  if (process.argv.length > 2) {
    try {
      let config = JSON.parse(process.argv[2]);
      Object.freeze(config);
      return config;
    } catch (error) {
      console.error("Could not parse config as JSON: " + process.argv[2]);
      process.exit(1);
    }
  } else {
    return Object.freeze({});
  }
}



module.exports = {
  DesktopApp: QDesktopApp,
  Point: QPoint,
  Send: sendLocal,
  Signal: QDesktopSignal,
  Effects: Effects
}