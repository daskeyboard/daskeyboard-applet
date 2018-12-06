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
  }
}

QDesktopSignal.error = function (messages) {
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

module.exports = {
  QDesktopSignal: QDesktopSignal,
  QPoint: QPoint,
  Effects: Effects
}