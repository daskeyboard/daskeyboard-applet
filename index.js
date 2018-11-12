const request = require('request-promise');
const Storage = require('node-storage');
const logger = require('./lib/logger');
const utility = require('./lib/utility');
const oAuth2ProxyUri = process.env.oAuth2ProxyUri ||
  applicationConfig.oAuth2ProxyUriDefault;

const {
  QDesktopSignal,
  QPoint,
  Effects
} = require('./lib/q-signal.js');

const applicationConfig = require('./application.json');

const signalHeaders = {
  "Content-Type": "application/json"
}

const defaultPollingInterval = 60000; // millisec.
const backendUrl = applicationConfig.desktopBackendUrl;
const signalEndpoint = backendUrl + '/api/2.0/signals';


/**
 * The base class for apps that run on the Q Desktop
 */
class QDesktopApp {
  constructor() {
    this.paused = false;
    this.configured = false;
    
    this.oAuth2ProxyUri = oAuth2ProxyUri;

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

    if (this.devMode) {
      logger.info("Starting in dev mode...");
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
    this.devMode = this.rootConfig.devMode;
    if (this.devMode) {
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
      logger.error("Error while running applyConfig() against instance" + error);
      throw error;
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
      case 'POLL':
        {
          logger.info("Got POLL");
          this.poll(true);
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
      const message = "Geometry is not properly defined:" + this.geometry;
      logger.error(message);
      throw new Error(message);
    } else {
      const height = this.getHeight();
      const width = this.getWidth();
      const originX = this.getOriginX();
      const originY = this.getOriginY();

      const actionValue = [];

      //logger.info("Signal is: " + JSON.stringify(signal));

      const rows = signal.points;
      for (let y = 0; y < rows.length && y < height; y++) {
        const columns = rows[y];
        for (let x = 0; x < columns.length && x < width; x++) {
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
        clientName: this.extensionId,
        errors: signal.errors,
      }

      logger.info("Posting to local service:" + JSON.stringify(body));

      return request.post({
        uri: signalEndpoint,
        headers: signalHeaders,
        body: body,
        json: true,
        resolveWithFullResponse: true
      }).then(function (response) {
        logger.info('Signal service responded with status: ' +
          response.statusCode);
        return response;
      }).catch(function (err) {
        const error = err.error;
        if (error.code === 'ECONNREFUSED') {
          logger.error(`Error: failed to connect to ${signalEndpoint}, make sure` +
            ` the Das Keyboard Q software  is running`);
        } else {
          logger.error('Error sending signal ', error);
        }

        throw error;
      });
    }
  }

  /**
   * Send error signal to the desktop
   * @param {Array<string>} messages 
   */
  async signalError(messages) {
    if (!Array.isArray(messages)) {
      messages = [messages];
    }

    return this.signal(new QDesktopSignal({
      points: [
        []
      ],
      errors: messages,
      action: 'ERROR',
    }));
  }

  /**
   * Schedules the run() function at regular intervals. Currently set to a 
   * constant value, but may become dynamic in the future.
   * @param {boolean} force Forces a poll even if paused or busy
   */
  poll(force) {
    if (!force && this.paused) {
      // no-op, we are paused
    } else if (!force && this.pollingBusy) {
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
          "Applet encountered an uncaught error in its main loop" + error);
        this.pollingBusy = false;
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
   * This method is called once each polling interval. This is where most
   * of the work should be done.
   */
  async run() {
    // Implement this method and do some work here.
    return null;
  }


  /**
   * The extension point for any activities that should
   * take place before shutting down.
   */
  shutdown() {
    return null;
  }

  /**
   * Given an (optional) fieldName, return the valid options for that field
   * name. This is used to generate a UI to allow the user to configure the
   * applet. If the applet only has one option, you can ignore the fieldName.
   * @param {string} fieldName 
   * @returns {Object} an array of [{id, value} objects]
   */
  async options(fieldName) {
    return null;
  }

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


  /**
   * Send a request through an OAuth2 Proxy to protect client key and secret
   * @param {*} proxyRequest 
   */
  async oauth2ProxyRequest(proxyRequest) {
    const options = {
      method: 'POST',
      uri: oAuth2ProxyUri,
      body: proxyRequest,
      json: true
    };

    logger.info("Proxying OAuth2 request with options: "
      + JSON.stringify(options));

    return request(options).catch((error) => {
      logger.error("Error while sending proxy request: " + error);
      throw new Error("Error retrieving email.");
    });
  }
}

/**
 * A request to be proxied via an Oauth2 Proxy
 */
class Oauth2ProxyRequest {
  constructor({
    apiKey,
    uri,
    method = 'GET',
    contentType = 'application/json',
    body = null
  }) {
    this.apiKey = apiKey;
    this.uri = uri;
    this.method = method;
    this.contentType = contentType
    this.body = body;
  }
}


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
      if (arg3.toUpperCase() === 'DEV') {
        logger.info("Configuring in dev mode...");
        if (process.argv.length > 3 && process.argv[3].startsWith('{')) {
          config = JSON.parse(process.argv[3]);
          logger.info("Parsed dev config as: " + JSON.stringify(config));
        } else {
          logger.info("Generating minimal dev config.");
          config = {};
        }
        logger.info("Generated dev configuration: ", config);
        config.devMode = true;
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
  hostConfig: applicationConfig,
  logger: logger,
  DesktopApp: QDesktopApp,
  Oauth2ProxyRequest: Oauth2ProxyRequest,
  Point: QPoint,
  Signal: QDesktopSignal,
  Effects: Effects
}