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
    return new q.Signal([[new q.Point('#FF0000')]]);
  }
}

const myExample = new QExample();

```
- Always instantiate your Applet instance in your main body to begin processing 
  and sending signals.

## DesktopApp functions
### Constructor
- If you need to create a `constructor()` method, please be sure to invoke 
  `super()` to initialize some important variables and signal handlers.
- Do not use the constructor for any functionality or state that is related to the applet's configuration. The configuration may change as the applet is running. To update the applet's state based on configuration, extend the `applyConfig()` method.

### run()
- The `run()` method is your primary extension point. This method will be
  invoked at regular intervals. This method should do some work, and then
  return a Signal object.

- If you need to perform any work before the Applet is ready to run, then 
  it can be included in the main body of your script.

- If you need to perform any work before the Applet is closed, implement the
  `shutdown()` function. This function is invoked by a signal handler.

### applyConfig()
- The applet will process any configuration, at launch and whenever a configuration change is sent, with a method `processConfig({*})`. If your applet's state needs to change based on the new configuration, implement `applyConfig()`. The applet's `this.config` object will have been updated to reflect the new configuration.


## Signal
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

### Creating a signal within a callback function
There are cases when your `run()` function may have to use a callback, and so
cannot directly pass a `Signal` object as its return. In this case, you can
either return a promise, or you can use the `sendLocal()` function, e.g.:

```
  this.signal(new q.Signal([[new q.Point('#FF0000)]]));
```

## Point
Each `Point` should specify, at a minimum, the RGB color that the key should
be illuminated to:

```
  let point = new q.Point('#FF0000');
```

You can also specify an effect if you wish:
```
  let point = new q.Point('#FF0000', q.Effects.BLINK);
```

## Applet Configuration
The applet is configured with the following member variables:

### this.geometry
The geometry configuration

## Testing an Applet
### 