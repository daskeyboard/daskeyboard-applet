const request = require('request-promise');

const logger = require('./logger');
const applicationConfig = require('../application.json');
const backendUrl = applicationConfig.desktopBackendUrl;
const signalEndpoint = backendUrl + '/api/2.0/signals';

const signalHeaders = {
  "Content-Type": "application/json"
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

/**
 * A signal to be sent to the Q-Desktop
 */
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
    data,
    link,
    isMuted = true,
    action = 'DRAW',
    errors = [],
    origin,
    extensionId,
  }) {
    this.points = points;
    this.action = action;
    this.name = name;
    this.message = message;
    this.data = data;
    this.link = link;
    this.isMuted = isMuted;
    this.extensionId = null;
    this.errors = errors;
    this.origin = origin;
    this.extensionid = extensionId;
  }
}

QDesktopSignal.error = function (messages) {
  /* For background compatibility with the version 2.10.12
  * This version was taking an object in param: {
    applet: ..,
    messages: ..
  }
  */
  if(messages.messages){
    messages = messages;
  }
  if (!Array.isArray(messages)) {
    messages = [messages];
  }

  return new QDesktopSignal({
    points: [
      []
    ],
    errors: messages,
    action: 'ERROR',
  });
}

QDesktopSignal.send = async function (signal) {
  const actionValue = [];
  const rows = signal.points;
  for (let y = 0; y < rows.length; y += 1) {
    const columns = rows[y];
    for (let x = 0; x < columns.length; x += 1) {
      const point = columns[x];
      actionValue.push({
        zoneId: (signal.origin.x + x) + ',' + (signal.origin.y + y),
        effect: point.effect,
        color: point.color
      });
    }
  }

  const body = {
    action: signal.action,
    actionValue: JSON.stringify(actionValue),
    clientName: signal.extensionId,
    data: signal.data,
    link: signal.link,
    errors: signal.errors,
    isMuted: signal.isMuted,
    message: signal.message,
    name: signal.name,
    pid: "Q_MATRIX",
  }

  logger.debug("Posting to local service:" + JSON.stringify(body));

  return request.post({
    uri: signalEndpoint,
    headers: signalHeaders,
    body: body,
    json: true,
    resolveWithFullResponse: true
  }).then(function (response) {
    logger.debug('Signal service responded with status: ' +
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
  });
}

QDesktopSignal.delete = async function (signal) {
  const signalId = (signal instanceof QDesktopSignal ? signal.id : signal);
  return request.delete(`${signalEndpoint}/${signalId}`);
}

module.exports = {
  QDesktopSignal: QDesktopSignal,
  QPoint: QPoint,
  Effects: Effects
}