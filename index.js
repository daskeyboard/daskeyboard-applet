const request = require('request-promise');
const Storage = require('node-storage');
const logger = require('./lib/logger');
const utility = require('./lib/utility');
const signalHeaders = {
  "Content-Type": "application/json"
}

const defaultPollingInterval = 60000;

/**
 * The base class for apps that run on the Q Desktop
 */
class QDesktopApp {
  constructor() {
    this.paused = false;
    this.configured = false;    

    process.on('SIGINT', (message) => {
      logger.info("Got SIGINT, handling shutdown...");
      this.shutdown();
      logger.info("Exiting the process.");
      process.exit();
    })

    this.pollingInterval = defaultPollingInterval;
    this.pollingBusy = false;
    this.errorState = null;

    process.on('message', (m) => this.handleMessage(JSON.parse(m)));

    try {
      this.processConfig();
    } catch (error) {
      throw new Error("Error while processing config.", error);
    }
    logger.info("Constructor finished.");

    if (this.testMode) {
      logger.info("Starting in test mode...");
      this.start();
    }
  }


  /**
   * Process the config JSON, placing the relevant parts where they belong
   * @param {*} config 
   */
  async processConfig(config) {
    this.configured = false;
    this.rootConfig = Object.freeze(minimalConfig(config ? config : readConfig()));
    logger.info("Constructing app with ROOT config: " + JSON.stringify(this.rootConfig));

    this.extensionId = this.rootConfig.extensionId;
    this.config = Object.freeze(utility.mergeDeep({}, this.rootConfig.applet.defaults || {}, this.rootConfig.applet.user || {}));

    this.authorization = Object.freeze(this.rootConfig.authorization || {});
    const geometry = this.rootConfig.geometry || {};
    this.testMode = this.rootConfig.testMode;
    if (this.testMode) {
      // set up default geometries
      geometry.height = geometry.height || 1;
      geometry.width = geometry.width || 1;
      geometry.origin = geometry.origin || {
        x: 1,
        y: 0
      };

    }
    this.geometry = Object.freeze(geometry);


    let storageLocation = this.rootConfig.storageLocation || 'local-storage.json';
    this.store = new Storage(storageLocation);

    try {
      await this.applyConfig();
      this.configured = true;
      return true;
    } catch (error) {
      throw new Error("Error while running applyConfig() against instance", error);
    }
  }

  /**
   * Postprocess the configuration for internal needs of the app. This must
   * return a truthy value or throw an error.
   */
  async applyConfig() {
    return true;
  }


  async handleMessage(message) {
    logger.info("CHILD Received JSON message: " + JSON.stringify(message));
    const data = message.data || {};
    const type = data.type;
    logger.info("Message type: " + type);
    switch (type) {
      case 'CONFIGURE':
        {
          let result = null;
          logger.info("Reconfiguring: " + JSON.stringify(data.configuration));
          this.processConfig(Object.freeze(data.configuration)).then((result) => {
            logger.info("Configuration was successful: " + result);
            result = JSON.stringify({
              status: 'success',
              data: {
                type: 'CONFIGURATION_RESULT',
                result: result + ''
              }
            });
            logger.info("Sending result: " + result);
            process.send(result);
          }).catch((error) => {
            logger.error("Configuration had error: ", error);
            result = JSON.stringify({
              status: 'error',
              data: {
                type: 'CONFIGURATION_RESULT',
              },
              message: error + ''
            });
            logger.info("Sending result: " + result);
            process.send(result)
          });
          break;
        }
      case 'FLASH':
        {
          logger.info("Got FLASH");
          this.handleFlash();
          break;
        }
      case 'OPTIONS':
        {
          logger.info("CHILD Handling " + type);
          this.options(data.fieldName).then(options => {
            logger.info("CHILD returned options.");
            const response = {
              status: 'success',
              data: {
                type: 'OPTIONS',
                options: options
              }
            }
            process.send(JSON.stringify(response));
          });
          break;
        }
      case 'PAUSE':
        {
          logger.info("Got PAUSE");
          this.paused = true;
          break;
        }
      case 'START':
        {
          logger.info("Got START");
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
          logger.error("Don't know how to handle JSON message of type: '" + type + "'");
        }
    }
  }


  /**
   * Send a signal to the local Das Keyboard Q Service.
   * @param {Signal} signal 
   */
  async signal(signal) {
    signal.extensionId = this.extensionId;
    if (!this.geometry || !this.geometry.origin) {
      logger.error("Geometry is not properly defined:", this.geometry);
    } else {
      const originX = this.getOriginX();
      const originY = this.getOriginY();

      const actionValue = [];

      //logger.info("Signal is: " + JSON.stringify(signal));

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
        clientName: this.extensionId
      }

      // logger.info("Posting to local service:", JSON.stringify(body));

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
          logger.error(`Error: failed to connect to ${signalEndpoint}, make sure` +
            ` the Das Keyboard Q software  is running`);
        } else {
          logger.error('Error sending signal ', error);
        }
      });
    }
  }


  /**
   * The entry point for the app. Currently only launches the polling function,
   * but may do other setup items later.
   */
  start() {
    this.paused = false;
    if (!this.configured) {
      logger.info("Waiting for configuration to complete.");
      setTimeout(() => {
        this.start();
      }, 1000);
    } else {
      this.poll();

      setInterval(() => {
        this.poll();
      }, this.pollingInterval);
    }
  }

  /**
   * Schedules the run() function at regular intervals. Currently set to a 
   * constant value, but may become dynamic in the future.
   */
  poll() {
    if (this.paused) {
      // no-op, we are paused
    } else if (this.pollingBusy) {
      logger.info("Skipping run because we are still busy.");
    } else {
      this.pollingBusy = true;
      this.run().then((signal) => {
        this.errorState = null;
        this.pollingBusy = false;

        if (signal) {
          this.signal(signal);
        }
      }).catch((error) => {
        this.errorState = error;
        logger.error(
          "Applet encountered an uncaught error in its main loop", error);
        this.pollingBusy = false;
      });
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

  /**
   * Given an (optional) fieldName, return the valid options for that field
   * name. This is used to generate a UI to allow the user to configure the
   * applet. If the applet only has one option, you can ignore the fieldName.
   * @param {string} fieldName 
   * @returns {Object} an array of [{id, value} objects]
   */
  async options(fieldName) {}

  /**
   * Get the applet's configured width.
   * @returns the width
   */
  getWidth() {
    return this.geometry.width;
  }

  /**
   * Get the applet's configured height.
   * @returns the height
   */
  getHeight() {
    return this.geometry.height;
  }

  /**
   * Get the applet's configured X origin.
   * @returns the X origin
   */
  getOriginX() {
    return this.geometry.origin.x;
  }
  
  /**
   * Get the applet's configured Y origin.
   * @returns the Y origin
   */
  getOriginY() {
    return this.geometry.origin.y;
  }

  async handleFlash() {
    const width = this.getWidth();
    const height = this.getHeight();

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

    logger.info("Flashing with signal: " + JSON.stringify(signal));
    return this.signal(signal);
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
    this.extensionId = null;
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
 * Read the configuration from command line arguments. The first command line 
 * argument should be a JSON string.
 */
function readConfig() {
  logger.info(`I have ${process.argv.length} arguments: ` + JSON.stringify(process.argv));
  if (process.argv.length > 2) {
    try {
      const arg3 = process.argv[2];
      let config;
      if (arg3.toUpperCase() === 'TEST') {
        logger.info("Configuring in test mode...");
        if (process.argv.length > 3 && process.argv[3].startsWith('{')) {
          config = JSON.parse(process.argv[3]);
          logger.info("Parsed test config as: " + JSON.stringify(config));
        } else {
          logger.info("Generating minimal test config.");
          config = {};
        }
        logger.info("Generated test configuration: ", config);
        config.testMode = true;
      } else {
        config = JSON.parse(arg3);
      }
      return config;
    } catch (error) {
      logger.error("Could not parse config as JSON: " + process.argv[2]);
      process.exit(1);
    }
  } else {
    return minimalConfig();
  }
}

/**
 * Ensure a config object has the minimum requirements
 * @param {*} config 
 */
function minimalConfig(config = {}) {
  config.applet = config.applet || {};
  config.defaults = config.defaults || {};

  return config;
}



module.exports = {
  logger: logger,
  DesktopApp: QDesktopApp,
  Point: QPoint,
  Signal: QDesktopSignal,
  Effects: Effects
}