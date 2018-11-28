const moment = require('moment');
const winston = require('winston');
const loggingOptions = process.env.loggingOptions ? JSON.parse(process.env.loggingOptions) : 
{
  winston: {
    handleExceptions: true,
    json: true,
    tailable: true,
  },
  level: 'info'
};

const logger = winston.createLogger(loggingOptions.winston);

if (loggingOptions.filename) {
  logger.add(new winston.transports.File({
    filename: loggingOptions.filename,
    level: loggingOptions.level || 'info',
  }));
} else {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
    level: loggingOptions.level || 'info',
  }));
}

function debug(message) {
  message = moment().format('YYYY-MM-DD hh:mm:ss.ms') + ' ' + message;
  logger.debug(message);
}

function info(message) {
  message = moment().format('YYYY-MM-DD hh:mm:ss.ms') + ' ' + message;
  logger.info(message);
}

function error(message) {
  message = moment().format('YYYY-MM-DD hh:mm:ss.ms') + ' ' + message;
  logger.error(message);
}

function warn(message) {
  message = moment().format('YYYY-MM-DD hh:mm:ss.ms') + ' ' + message;
  logger.warn(message);
}

module.exports = {
  debug: debug,
  error: error,
  info: info,
  warn: warn,
  options: loggingOptions,
}