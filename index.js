const request = require('request');

const signalHeaders = {
  "Content-Type": "application/json"
}

/**
 * Class representing a signal to be sent to the device.
 */
class Signal {
  /**
   * Create a signal.
   * @param {string} clientName - The name of the client registering the signal.
   * @param {string} zoneId - The zone to activate. Enumerated in ZoneCodes.
   * @param {string} color - The hexadecimal RGB color to activate, e.g. '#FFCCDD'
   * @param {string} effect - The effect to activate. Enumerated in Effects. Default is empty.
   * @param {string} action - The action. Default is empty.
   * @param {string} name - The name of the signal. Default is empty.
   * @param {string} pid - The product ID. Default is 'DK5QPID'.
   * @param {boolean} isMuted - If false, the Signal Center will not create a notification.
   *   Default is true.
   * @pram {string} message - The message to display, if any. Default is empty.
   * 
   */
  constructor({clientName, zoneId, color, effect = Effects.SET_COLOR, 
      action = '', name = '', pid = 'DK5QPID', isMuted = true, message = ''} = {}) {
    this.clientName = clientName;
    this.zoneId = zoneId;
    this.color = color;
    this.effect = effect;
    this.name = name;
    this.action = action;
    this.pid = pid;
    this.isMuted = isMuted.toString();
    this.message = message;    
  }
}

/**
 * Class representing a device zone
 */
class Zone {
  /**
   * Create a zone
   * @param {string} code - The device's code for the zone. Enumerated in ZoneCodes.
   * @param {number} x - The x position of the zone
   * @param {number} y - The y position of the zone
   */
  constructor(code, x, y) {
    this.code = code;
    this.x = x;
    this.y = y;
  }
}

/**
 * An enumeration of preconfigured signals (pending)
 */
const Signals = Object.freeze({});

/**
 * An enumeration of zone codes
 */
const ZoneCodes = Object.freeze({'KEY_BACKSPACE': 'KEY_BACKSPACE', 'KEY_TAB': 'KEY_TAB', 'KEY_ENTER': 'KEY_ENTER', 'KEY_SHIFT_LEFT': 'KEY_SHIFT_LEFT', 'KEY_SHIFT_RIGHT': 'KEY_SHIFT_RIGHT', 'KEY_CONTROL_RIGHT': 'KEY_CONTROL_RIGHT', 'KEY_CONTROL_LEFT': 'KEY_CONTROL_LEFT', 'KEY_ALT_LEFT': 'KEY_ALT_LEFT', 'KEY_ALT_RIGHT': 'KEY_ALT_RIGHT', 'KEY_PAUSE_BREAK': 'KEY_PAUSE_BREAK', 'KEY_CAPS_LOCK': 'KEY_CAPS_LOCK', 'KEY_ESCAPE': 'KEY_ESCAPE', 'KEY_SPACE': 'KEY_SPACE', 'KEY_PAGE_UP': 'KEY_PAGE_UP', 'KEY_PAGE_DOWN': 'KEY_PAGE_DOWN', 'KEY_END': 'KEY_END', 'KEY_HOME': 'KEY_HOME', 'KEY_ARROW_LEFT': 'KEY_ARROW_LEFT', 'KEY_ARROW_UP': 'KEY_ARROW_UP', 'KEY_ARROW_RIGHT': 'KEY_ARROW_RIGHT', 'KEY_ARROW_DOWN': 'KEY_ARROW_DOWN', 'KEY_INSERT': 'KEY_INSERT', 'KEY_DELETE': 'KEY_DELETE', 'KEY_0': 'KEY_0', 'KEY_1': 'KEY_1', 'KEY_2': 'KEY_2', 'KEY_3': 'KEY_3', 'KEY_4': 'KEY_4', 'KEY_5': 'KEY_5', 'KEY_6': 'KEY_6', 'KEY_7': 'KEY_7', 'KEY_8': 'KEY_8', 'KEY_9': 'KEY_9', 'KEY_A': 'KEY_A', 'KEY_B': 'KEY_B', 'KEY_C': 'KEY_C', 'KEY_D': 'KEY_D', 'KEY_E': 'KEY_E', 'KEY_F': 'KEY_F', 'KEY_G': 'KEY_G', 'KEY_H': 'KEY_H', 'KEY_I': 'KEY_I', 'KEY_J': 'KEY_J', 'KEY_K': 'KEY_K', 'KEY_L': 'KEY_L', 'KEY_M': 'KEY_M', 'KEY_N': 'KEY_N', 'KEY_O': 'KEY_O', 'KEY_P': 'KEY_P', 'KEY_Q': 'KEY_Q', 'KEY_R': 'KEY_R', 'KEY_S': 'KEY_S', 'KEY_T': 'KEY_T', 'KEY_U': 'KEY_U', 'KEY_V': 'KEY_V', 'KEY_W': 'KEY_W', 'KEY_X': 'KEY_X', 'KEY_Y': 'KEY_Y', 'KEY_Z': 'KEY_Z', 'KEY_LESS_THAN': 'KEY_LESS_THAN', 'KEY_GREATER_THAN': 'KEY_GREATER_THAN', 'KEY_META': 'KEY_META', 'KEY_CONTEXT_MENU': 'KEY_CONTEXT_MENU', 'KEY_F1': 'KEY_F1', 'KEY_F2': 'KEY_F2', 'KEY_F3': 'KEY_F3', 'KEY_F4': 'KEY_F4', 'KEY_F5': 'KEY_F5', 'KEY_F6': 'KEY_F6', 'KEY_F7': 'KEY_F7', 'KEY_F8': 'KEY_F8', 'KEY_F9': 'KEY_F9', 'KEY_F10': 'KEY_F10', 'KEY_F11': 'KEY_F11', 'KEY_F12': 'KEY_F12', 'KEY_F13': 'KEY_F13', 'KEY_F14': 'KEY_F14', 'KEY_F15': 'KEY_F15', 'KEY_F16': 'KEY_F16', 'KEY_F17': 'KEY_F17', 'KEY_F18': 'KEY_F18', 'KEY_F19': 'KEY_F19', 'KEY_NUMLOCK': 'KEY_NUMLOCK', 'KEY_SCROLL_LOCK': 'KEY_SCROLL_LOCK', 'KEY_PRINT_SCREEN': 'KEY_PRINT_SCREEN', 'KEY_EXCLAMATION_MARK': 'KEY_EXCLAMATION_MARK', 'KEY_SEMICOLON': 'KEY_SEMICOLON', 'KEY_EQUAL': 'KEY_EQUAL', 'KEY_COMMA': 'KEY_COMMA', 'KEY_SUBTRACT': 'KEY_SUBTRACT', 'KEY_DOT': 'KEY_DOT', 'KEY_SLASH': 'KEY_SLASH', 'KEY_BACKTICK': 'KEY_BACKTICK', 'KEY_OPEN_SQUARE_BRACKET': 'KEY_OPEN_SQUARE_BRACKET', 'KEY_BACKSLASH': 'KEY_BACKSLASH', 'KEY_CLOSE_SQUARE_BRACKET': 'KEY_CLOSE_SQUARE_BRACKET', 'KEY_QUOTE': 'KEY_QUOTE', 'KEY_OEM_8': 'KEY_OEM_8', 'KEY_OEM_102': 'KEY_OEM_102', 'KEY_NUMPAD_0': 'KEY_NUMPAD_0', 'KEY_NUMPAD_1': 'KEY_NUMPAD_1', 'KEY_NUMPAD_2': 'KEY_NUMPAD_2', 'KEY_NUMPAD_3': 'KEY_NUMPAD_3', 'KEY_NUMPAD_4': 'KEY_NUMPAD_4', 'KEY_NUMPAD_5': 'KEY_NUMPAD_5', 'KEY_NUMPAD_6': 'KEY_NUMPAD_6', 'KEY_NUMPAD_7': 'KEY_NUMPAD_7', 'KEY_NUMPAD_8': 'KEY_NUMPAD_8', 'KEY_NUMPAD_9': 'KEY_NUMPAD_9', 'KEY_NUMPAD_ADD': 'KEY_NUMPAD_ADD', 'KEY_NUMPAD_SEPARATOR': 'KEY_NUMPAD_SEPARATOR', 'KEY_NUMPAD_SUBTRACT': 'KEY_NUMPAD_SUBTRACT', 'KEY_NUMPAD_DECIMAL': 'KEY_NUMPAD_DECIMAL', 'KEY_NUMPAD_DIVIDE': 'KEY_NUMPAD_DIVIDE', 'KEY_NUMPAD_ENTER': 'KEY_NUMPAD_ENTER', 'KEY_DOLLAR_SIGN': 'KEY_DOLLAR_SIGN', 'KEY_PERCENT': 'KEY_PERCENT', 'KEY_MICRO': 'KEY_MICRO', 'KEY_MACRO_1': 'KEY_MACRO_1', 'KEY_MACRO_2': 'KEY_MACRO_2', 'KEY_MACRO_3': 'KEY_MACRO_3', 'KEY_MACRO_4': 'KEY_MACRO_4', 'KEY_MACRO_5': 'KEY_MACRO_5', 'KEY_MACRO_6': 'KEY_MACRO_6', 'KEY_MACRO_7': 'KEY_MACRO_7', 'KEY_MACRO_8': 'KEY_MACRO_8', 'KEY_MACRO_9': 'KEY_MACRO_9', 'KEY_MACRO_10': 'KEY_MACRO_10', 'KEY_MACRO_11': 'KEY_MACRO_11', 'KEY_MACRO_12': 'KEY_MACRO_12', 'KEY_VOLUME_Q_BUTTON': 'KEY_VOLUME_Q_BUTTON', 'KEY_VOLUME_KNOB': 'KEY_VOLUME_KNOB', 'KEY_LIGHT_PIPE_RIGHT': 'KEY_LIGHT_PIPE_RIGHT', 'KEY_LIGHT_PIPE_LEFT': 'KEY_LIGHT_PIPE_LEFT', 'KEY_FN_KEY': 'KEY_FN_KEY', 'KEY_META_LEFT': 'KEY_META_LEFT', 'KEY_META_RIGHT': 'KEY_META_RIGHT', 'KEY_LIGHT_INDICATOR_GAMING_MODE': 'KEY_LIGHT_INDICATOR_GAMING_MODE', 'KEY_LIGHT_INDICATOR_CAPSLOCK': 'KEY_LIGHT_INDICATOR_CAPSLOCK', 'KEY_LIGHT_INDICATOR_NUMLOCK': 'KEY_LIGHT_INDICATOR_NUMLOCK', 'KEY_LIGHT_INDICATOR_SCROLLOCK': 'KEY_LIGHT_INDICATOR_SCROLLOCK', 'KEY_LIGHT_INDICATOR_DPI': 'KEY_LIGHT_INDICATOR_DPI', 'KEY_WHEEL': 'KEY_WHEEL', 'KEY_LIGHT_SHOE': 'KEY_LIGHT_SHOE', 'KEY_LIGHT_LOGO': 'KEY_LIGHT_LOGO', 'KEY_ACUTE_ACCENT': 'KEY_ACUTE_ACCENT', 'KEY_CEDILLA': 'KEY_CEDILLA', 'KEY_SPANISH_N': 'KEY_SPANISH_N', 'KEY_UBERMUT': 'KEY_UBERMUT', 'KEY_ADD': 'KEY_ADD', 'KEY_OKONOM': 'KEY_OKONOM', 'KEY_ARGER': 'KEY_ARGER', 'KEY_HASH': 'KEY_HASH', 'KEY_PIPE': 'KEY_PIPE', 'KEY_ROOFTOP': 'KEY_ROOFTOP', 'KEY_EXP_2': 'KEY_EXP_2'});

/**
 * An enumeration of effects
 */
const Effects = Object.freeze({'SET_COLOR': 'SET_COLOR', 'BLINK': 'BLINK', 'BREATHE': 'BREATHE', 'COLOR_CYCLE': 'COLOR_CYCLE', 'RIPPLE': 'RIPPLE', 'INWARD_RIPPLE': 'INWARD_RIPPLE', 'BOUNCING_LIGHT': 'BOUNCING_LIGHT', 'LASER': 'LASER', 'WAVE': 'WAVE'});

var backendUrl = 'http://localhost:27301';

/**
 * Send a signal.
 * @param {Signal} signal 
 */
function sendLocal(signal) {
  request.post({
    url: backendUrl + '/api/1.0/signals',
    headers: signalHeaders,
    body: signal,
    json: true
  }, (err) => {
    if (err && err.code === 'ECONNREFUSED') {
      console.error(`Error: failed to connect to ${config.qUrl}, make sure the Das Keyboard Q software` +
        ' is running');
    }
  });
}


/**
 * Read the configuration from command line arguments. The first command line argument should be a JSON string.
 */
function readConfig() {
  if (process.argv.length > 2) {
    try {
      let config = JSON.parse(process.argv[2]);
      Object.freeze(config);
      console.log("Configuration:\n", JSON.stringify(config));
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
  backendUrl : backendUrl,
  Config : readConfig,
  Send : sendLocal,
  Signal : Signal,
  Signals : Signals,
  Zone : Zone,
  ZoneCodes : ZoneCodes,
  Effects : Effects
}