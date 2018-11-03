# Das Keyboard Applet API
The API for creating Applets that will run inside the Das Keyboard Q Desktop
environment.

## Installation
This module is installed via npm.

```
npm install --save daskeyboard-applet
```

## Getting Started
Require the Q Applet API with:
```
const q = require('daskeyboard-applet');
```

Your app should extend `DesktopApp`, as in:

```
class QExample extends q.DesktopApp {
  /** just send a signal without thinking about it  */
  async run() {
    // do some work, then return a signal
    return new q.Signal({ points: [[new q.Point('#FF0000')]] });
  }
}

const myExample = new QExample();

```
- Always instantiate your Applet instance in your main body to begin processing 
  and sending signals.

# DesktopApp functions
## Constructor
- If you need to create a `constructor()` method, please be sure to invoke 
  `super()` to initialize some important variables and signal handlers.
- Do not use the constructor for any functionality or state that is related to 
  the applet's configuration. The configuration may change as the applet is 
  running. To update the applet's state based on configuration, extend the 
  `applyConfig()` method.

## run()
- The `run()` method is your primary extension point. This method will be
  invoked at regular intervals. This method should do some work, and then
  return a Signal object.

- If you need to perform any work before the Applet is ready to run, then 
  it can be included in the main body of your script.

- If you need to perform any work before the Applet is closed, implement the
  `shutdown()` function. This function is invoked by a signal handler.

## applyConfig()
- The applet will process any configuration, at launch and whenever a 
  configuration change is sent, with a method `processConfig({*})`. If your 
  applet's state needs to change based on the new configuration, implement 
  `applyConfig()`. The applet's `this.config` object will have been updated to 
  reflect the new configuration.


# Creating Signals
Your applet communicates with the Das Keyboard Signal Center by returning
`Signal` objects. A `Signal` object includes a 2-D array of `Point` objects,
along with an optional `name` and `description`.

For example, the simplest `Signal` object would be:

```
  return new q.Signal({ points: [[new q.Point('#FF0000)]] });
```

To light up a row of keys, send a single row of Points, e.g.:
```
  return new q.Signal({
    points: [[
      new q.Point('#FF0000),
      new q.Point('#00FF00),
      new q.Point('#0000FF),
      ]],
    name: 'My Applet Name',
    description: 'Some description of the signal'  
    });
```

To light up a rectangular region, send multiple rows of points, e.g: 
```
  return new q.Signal({
    points: [
      [new q.Point('#FF0000), new q.Point('#00FF00), new q.Point('#0000FF)],
      [new q.Point('#FF0000), new q.Point('#00FF00), new q.Point('#0000FF)],
      [new q.Point('#FF0000), new q.Point('#00FF00), new q.Point('#0000FF)],
      ]});
```

## Creating a signal within a callback function
There are cases when your `run()` function may have to use a callback, and so
cannot directly pass a `Signal` object as its return. In this case, you can
either return a promise, or you can use the `this.signal()` function, e.g.:

```
  this.signal(new q.Signal({ points: [[new q.Point('#FF0000)]] }));
```

## The Point Class
Each `Point` should specify, at a minimum, the RGB color that the key should
be illuminated to:

```
  let point = new q.Point('#FF0000');
```

You can also specify an effect if you wish:
```
  let point = new q.Point('#FF0000', q.Effects.BLINK);
```

# Applet Configuration
The applet is configured with the following member variables:

## this.geometry
The geometry configuration is stored in an object with the following format:
```
{
  width: <number>
  height: <number>
  origin: {
    x: <number>,
    y: <number>
  }
}
```
You can also inspect the applet's geometry with the functions:
- `this.getWidth()`
- `this.getHeight()`
- `this.getOriginX()`
- `this.getOriginY()`

## this.authorization
Currently we support authorization by API Key or Basic Authentication. The 
authorization object looks like:

```
{
  apiKey: <string>,
  username: <string>,
  password: <string>
}
```

## this.config
The config object is for any values that are specific to the application. This 
object is built by merging the default configuration values that are supplied 
in `package.json` with any user-supplied values that were input during applet 
installation.

## this.store
The `store` object is an instance of 
[node-storage](https://www.npmjs.com/package/node-storage). When running within 
the Q Desktop App, the storage file is located in the `~/.quio` directory. When
running from a command line, a file `local-storage.json` will be created. You 
should not commit a `local-storage.json` file to the repo, because it will be 
ignored unless running from a command line.

# Logging
Applets use the [winston](https://github.com/winstonjs/winston) logging system.
Log files can be found in `~/.quio/v2/applet.log.json`. When running from a 
command line, logging will output to the console.

To access the logger, you can invoke:
```
const q = require('daskeyboard-applet');
const logger = q.logger;

logger.info('This is an info');
logger.warn('This is a warn');
logger.error('This is an error.');
```

# Running an Applet in dev mode
You can run an applet in `dev mode` by invoking it via node, using the following
syntax:

`node <script name> dev '{ <config> }'`

The config object is a combination of all of the configuration variables 
described in Applet Configuration. The format of the config object is:

```
{
  "geometry": { 
    "width": <number>
    "height": <number>
    "origin": {
      "x": <number>,
      "y": <number>
    }    
  },
  "authorization": {
    "apiKey": <string>,
    "username": <string>,
    "password": <string>
  },
  "applet": {
    "user": {
      <any properties that need to be available in this.config >
    }
  }
}
```
- Remember that this is a command-line parameter, so you need to either ensure 
  the entire config is entered on one line, or use line separators `\`.
- If you don't specify the geometry, the default is a 1x1 applet on the `Esc` 
  key.
- You must have the Q Desktop application running in order for the keyboard to
  respond to any signals.

## Basic example:
`node index.js dev '{"applet":{"user": {"symbol": "AAPL"}}}'`

This will invoke the script at `index.js` , and the value of 
`this.config.symbol` will be `"AAPL"`.

## Specifying a geometry:
`node index.js dev '{"applet":{"user": {"zoneId": "TXZ211"}}, "geometry": {"width": 4, "height": 1, "origin": {"x": 1, "y": 1}}}'`

This example configures a `config.zoneId` of `"TXZ211"` and a geometry with 
`width: 4`, `height: 1`, origin of `(1,1)`.

## Specifying authorization:
`node index.js dev '{"authorization": { "apiKey": "8f652e62a922ca351521ea0b89199de1067d3204" }}'`

This example configures the applet such that `this.authorization.apiKey` has a 
valid value.

# Factory Reset
You can remove all applets and associated files using one of two ways:
## Reset via the command line
- Quit the Q Desktop App
- Run the following commands: 
  ```
  rm -rf ~/.quio/v2/q_extensions
  rm -rf ~/.quio/v2/q_storage
  ```
- Restart the Q Desktop App

## Reset using a POST
Using `curl` you can remove all applets with the command:
```
curl -X POST \
  http://localhost:27302/reset \
  -H 'Cache-Control: no-cache' \
  -H 'Postman-Token: 0a88b369-1c86-4374-a111-f6ac99344ea9'
```
  
