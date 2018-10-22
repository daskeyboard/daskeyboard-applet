const request = require('request-promise');
const Storage = require('node-storage');
const utility = require('./lib/utility');

const signalHeaders = {
  "Content-Type": "application/json"
}

const defaultPortInterval = 2000;
var rootConfig;
var extensionId;


/**
 * The base class for apps that run on the Q Desktop
 */
class QDesktopApp {
  constructor() {
    this.paused = false;
    this.applyConfig();

    process.on('SIGINT', (message) => {
      this.shutdown();
      process.exit();
    })

    this.pollingInterval = defaultPortInterval;
    this.pollingBusy = false;
    this.errorState = null;

    process.on('message', (m) => this.handleMessage(m));
    console.log("Constructor finished.");
  }


  applyConfig(config) {
    rootConfig = Object.freeze(config ? config : readConfig());
    console.log("Constructing app with ROOT config: ", rootConfig);

    this.extensionId = extensionId = rootConfig.extensionId;
    this.config = Object.freeze(utility.mergeDeep({}, rootConfig.applet.defaults || {}, rootConfig.applet.user || {}));
    this.authorization = Object.freeze(rootConfig.authorization || {});
    this.geometry = Object.freeze(rootConfig.geometry || {});
    
    let storageLocation = rootConfig.storageLocation;
    this.store = storageLocation ? new Storage(storageLocation) : null;
  }

  async handleMessage(m) {
    if (m.startsWith('{')) {
      const message = JSON.parse(m);
      console.log("CHILD Received JSON message: ", message);

      const type = message.type;
      const data = message.data;
      switch (type) {
        case 'CONFIGURE':
          {
            console.log("Reconfiguring: " + JSON.stringify(data));
            applyConfig(Object.freeze(data));
            this.reconfigure();
            break;
          }
        case 'SELECTIONS':
          {
            console.log("CHILD Handling " + type);
            this.selections(data.fieldName).then(selections => {
              console.log("CHILD returned selections.");
              const response = {
                type: 'SELECTIONS',
                data: selections
              }
              process.send(JSON.stringify(response));
            });
            break;
          }
        default:
          {
            console.error("Don't know how to handle JSON message of type: '" + type + "'");
          }
      }
    } else {
      switch (m) {
        case 'FLASH':
          {
            console.log("Got FLASH");
            this.handleFlash();
            break;
          }

        case 'PAUSE':
          {
            console.log("Got PAUSE");
            this.paused = true;
            break;
          }

        case 'START':
          {
            console.log("Got START");
            if (this.paused) {
              this.paused = false;
              this.poll();
            } else {
              this.start();
            }
            break;
          }

        default:
          {
            console.error("Don't know what to do with message: '" + m + "'");
          }
      }
    }
  }



  /**
   * The entry point for the app. Currently only launches the polling function,
   * but may do other setup items later.
   */
  start() {
    this.paused = false;
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
    if (this.paused) {
      // no-op, we are paused
    } else if (this.pollingBusy) {
      console.log("Skipping run because we are still busy.");
    } else {
      this.pollingBusy = true;
      this.run().then((signal) => {
        this.errorState = null;
        this.pollingBusy = false;

        if (signal) {
          sendLocal(signal);
        }
      }).catch((error) => {
        this.errorState = error;
        console.error(
          "Applet encountered an uncaught error in its main loop", error);
        this.pollingBusy = false;
      });
    }
  }

  /**
   * Implement this function if you need to reconfigure the instance or other variables
   * based on a new applet configuration
   */
  reconfigure() {}

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

  /**
   * Given an (optional) fieldName, return the valid selections for that field
   * name. This is used to generate a UI to allow the user to configure the
   * applet.
   * @param {string} fieldName 
   * @returns {Object} an array of [key, value] pairs
   */
  async selections(fieldName) {

  }

  async handleFlash() {
    const width = geometry.width || 1;
    const height = geometry.height || 1;

    const row = [];
    for (let i = 0; i < width; i += 1) {
      row.push(new QPoint('#000000'));
    }
    const points = [];
    for (let i = 0; i < height; i += 1) {
      points.push(row);
    }

    const signal = new QDesktopSignal({
      points: points,
      action: 'FLASH',
      isMuted: false,
    });

    console.log("Flashing with signal: " + JSON.stringify(signal));
    return sendLocal(signal);
  }
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
   * @param {*} options A JSON list of options
   */
  constructor({
    points = [
      []
    ],
    name = 'Q Desktop Signal',
    message = '',
    isMuted = true,
    action = 'DRAW'
  }) {
    this.points = points;
    this.action = action;
    this.name = name;
    this.message = message;
    this.isMuted = isMuted;
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
  if (!geometry || !geometry.origin) {
    console.error("Geometry is not properly defined:", geometry);
  } else {
    const originX = geometry.origin.x || 0;
    const originY = geometry.origin.y || 0;

    const actionValue = [];

    //console.log("Signal is: " + JSON.stringify(signal));

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
      action: signal.action,
      actionValue: JSON.stringify(actionValue),
      pid: "Q_MATRIX",
      message: signal.message,
      name: signal.name,
      isMuted: signal.isMuted,
      clientName: extensionId
    }

    // console.log("Posting to local service:", JSON.stringify(body));

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
    return Object.freeze({
      applet: {},
      defaults: {}
    });
  }
}



module.exports = {
  DesktopApp: QDesktopApp,
  Point: QPoint,
  Send: sendLocal,
  Signal: QDesktopSignal,
  Effects: Effects
}