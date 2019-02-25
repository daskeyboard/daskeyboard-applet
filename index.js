const request = require('request-promise');
const {
  Storage
} = require('./lib/storage');
const logger = require('./lib/logger');
const utility = require('./lib/utility');
const applicationConfig = require('./application.json');

const oAuth2ProxyBaseUrlDefault = process.env.oAuth2ProxyBaseUrlDefault ||
  applicationConfig.oAuth2ProxyBaseUrlDefault;

const {
  QDesktopSignal,
  QPoint,
  Effects
} = require('./lib/q-signal.js');

const defaultPollingInterval = 60000 * 5; // millisec.
const maxSignalLogSize = 100;

/**
 * The base class for apps that run on the Q Desktop
 */
class QDesktopApp {
  constructor() {
    this.paused = false;
    this.configured = false;

    this.oAuth2ProxyBaseUrlDefault = oAuth2ProxyBaseUrlDefault;
    this.signalLog = [];

    process.on('SIGINT', async (message) => {
      logger.info("Got SIGINT, handling shutdown...");
      await this.shutdown();
      process.exit();
    })

    process.on('disconnect', async (message) => {
      logger.info("Got DISCONNECT, handling shutdown...");
      await this.shutdown();
      process.exit();
    })

    process.on('exit', async (message) => {
      logger.info("Got EXIT, handling shutdown...");
      await this.shutdown();
      process.exit();
    })

    this.pollingInterval = defaultPollingInterval;
    this.pollingBusy = false;
    this.errorState = null;

    process.on('message', (m) => this.handleMessage(JSON.parse(m)));

    try {
      this.processConfig();
    } catch (error) {
      logger.error(`Error while processing config: ${error}`)
      throw error;
    }
    logger.debug("Constructor finished.");

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
    logger.debug("Constructing app with ROOT config: " + JSON.stringify(this.rootConfig));

    this.devMode = this.rootConfig.devMode;

    this.extensionId = this.rootConfig.extensionId;
    const applet = this.rootConfig.applet || {};
    this.config = Object.freeze(utility.mergeDeep({}, applet.defaults || {}, applet.user || {}));

    this.authorization = Object.freeze(this.rootConfig.authorization || {});
    const geometry = this.rootConfig.geometry || {
      height: 1,
      width: 1,
      origin: {
        x: 1,
        y: 0,
      }
    };
    this.geometry = Object.freeze(geometry);


    let storageLocation = this.rootConfig.storageLocation || 'local-storage';
    this.store = new Storage(storageLocation);

    try {
      await this.applyConfig();
      this.configured = true;
      return true;
    } catch (error) {
      logger.error(`Error while running applyConfig() against instance ${error}`);
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
          this.options(data.fieldName, data.search).then(options => {
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
      signal.origin = this.geometry.origin;
      const height = this.getHeight();
      const width = this.getWidth();

      // trim the points so it can't exceed the geometry
      signal.points = signal.points.slice(0, height);
      const rows = signal.points;
      for (let i = 0; i < rows.length; i += 1) {
        rows[i] = rows[i].slice(0, width);
      }

      /*
       * If the signal is an error, populate the applet with RED points
       */
      if (signal.action === 'ERROR') {
        signal.points = [];
        for (let i = 0; i < height; i++) {
          const t = [];
          for (let j = 0; j < width; j++) {
            t.push(new QPoint('#FF0000'));
          }
          signal.points.push(t);
        }
      }

      return QDesktopSignal.send(signal).then(result => {
        signal.id = result.body.id;

        // add the new signal to the begining of the signal log array
        this.signalLog.unshift({
          signal: signal,
          result: result,
        });

        // remove the oldest signal logs
        while (this.signalLog.length > maxSignalLogSize) {
          this.signalLog.pop();
        }

        return result;
      });
    }
  }

  /**
   * Send error signal to the desktop
   * @param {Array<string>} messages 
   */
  async signalError(messages) {
    return this.signal(QDesktopSignal.error(messages));
  }

  /**
   * Schedules the run() function at regular intervals. Currently set to a 
   * constant value, but may become dynamic in the future.
   * @param {boolean} force Forces a poll even if paused or busy
   */
  async poll(force) {
    if (!force && this.paused) {
      // no-op, we are paused
    } else if (!force && this.pollingBusy) {
      logger.info("Skipping run because we are still busy.");
    } else {
      this.pollingBusy = true;
      return this.run().then((signal) => {
        this.errorState = null;
        this.pollingBusy = false;

        if (signal) {
          return this.signal(signal);
        }
      }).catch((error) => {
        this.errorState = error;
        logger.error(
          "Applet encountered an uncaught error in its main loop" + error);
        this.signalError(`${error}`);
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
  async shutdown() {
    return null;
  }

  /**
   * Given an (optional) fieldName, return the valid options for that field
   * name. This is used to generate a UI to allow the user to configure the
   * applet. If the applet only has one option, you can ignore the fieldName.
   * @param {string} fieldName the field for which options are being requested
   * @param {string} search search terms, if any 
   * @returns {Object} an array of [{id, value} objects]
   */
  async options(fieldName, search) {
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

    const flash = new QDesktopSignal({
      points: points,
      action: 'FLASH',
      isMuted: false,
      origin: {
        x: this.getOriginX(),
        y: this.getOriginY(),
      },
    });

    logger.info("Flashing with signal: " + JSON.stringify(flash));
    return QDesktopSignal.send(flash).then(() => {
      // send the latest signal
      const latestSignalLog = this.signalLog[0];
      if (latestSignalLog) {
        return QDesktopSignal.send(latestSignalLog.signal);
      }
    });
  }


  /**
   * Send a request through an OAuth2 Proxy to protect client key and secret
   * @param {*} proxyRequest 
   * @deprecated will be removed in July 2019, user Oauth2ProxyRequest class method
   * instead : `performOauth2ProxyRequest`
   */
  async oauth2ProxyRequest(proxyRequest) {
    const options = {
      method: 'POST',
      uri: oAuth2ProxyBaseUrlDefault + `/proxy`,
      body: proxyRequest,
      json: true
    };

    logger.info("Proxying OAuth2 request with options: " +
      JSON.stringify(options));

    return request(options).catch((error) => {
      logger.error(`Error while sending proxy request: ${error}`);
      throw error;
    });
  }

  /**
   * Clears all the signals for an applet
   */
  async clearSignals() {
    logger.info(`Clearing signals`);
    while (this.signalLog && this.signalLog.length) {
      const signal = this.signalLog.pop().signal;
      logger.info(`Deleting previous signal: ${signal.id}`)
      await QDesktopSignal.delete(signal).catch((err) => {
      });
      logger.info(`Deleted the signal: ${signal.id}`);
    }
    logger.info(`Cleared signals`);
  }


}

/**
 * A request to be proxied via an Oauth2 Proxy
 */
class Oauth2ProxyRequest {
  constructor({
    apiKey,
    uri,
    qs,
    method = 'GET',
    contentType = 'application/json',
    body = null
  }) {
    this.apiKey = apiKey;
    this.uri = uri;
    this.qs = qs;
    this.method = method;
    this.contentType = contentType
    this.body = body;
  }

  /**
   * Send a request through an OAuth2 Proxy to protect client key and secret
   */
  async performOauth2ProxyRequest() {
    const options = {
      method: 'POST',
      uri: oAuth2ProxyBaseUrlDefault + `/proxy`,
      body: this,
      json: true
    };

    logger.info("Proxying OAuth2 request with options: " +
      JSON.stringify(options));

    return request(options).catch((error) => {
      logger.error(`Error while sending proxy request: ${error}`);
      throw error;
    });
  }

  /**
   * Get an Oauth2 access token from the proxy
   */
  async getOauth2ProxyToken() {
    const options = {
      method: 'GET',
      uri: oAuth2ProxyBaseUrlDefault + `/token`,
      qs: {
        apiKey: this.apiKey
      },
      json: true
    }
    logger.info(`Getting OAuth2 access token from proxy with options: ${JSON.stringify(options)}`);

    return request(options).catch((error) => {
      logger.error(`Error while getting access token from proxy: ${error}`);
      throw error;
    });
  }

  /**
   * Refresh an Oauth2 access token from the proxy
   */
  async refreshOauth2AccessToken() {
    const options = {
      method: 'GET',
      uri: oAuth2ProxyBaseUrlDefault + `/refresh_my_access_token`,
      qs: {
        apiKey: this.apiKey
      },
      json: true
    }
    logger.info(`Refreshing OAuth2 access token from proxy with options: ${JSON.stringify(options)}`);

    return request(options).catch((error) => {
      logger.error(`Error while refresshingaccess token from proxy: ${error}`);
      throw error;
    });
  }

  /**
   * Get the applet Oauth2 Client payload from the proxy
   */
  async getOauth2ProxyClientPayload() {
    const options = {
      method: 'GET',
      uri: oAuth2ProxyBaseUrlDefault + `/applet_payload`,
      qs: {
        apiKey: this.apiKey
      },
      json: true
    }
    logger.info(`Getting OAuth client payload from proxy with options: ${JSON.stringify(options)}`);

    return request(options).then(body => body.payload).catch((error) => {
      logger.error(`Error while getting OAuth client payload from proxy: ${error}`);
      throw error;
    });
  }
}



/**
 * Read the configuration from command line arguments. The first command line 
 * argument should be a JSON string.
 */
function readConfig() {
  logger.debug(`I have ${process.argv.length} arguments: ` + JSON.stringify(process.argv));
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
          config = minimalConfig();
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