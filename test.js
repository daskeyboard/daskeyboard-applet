const q = require('./index.js');

function testInstantiateSignal() {
  let signal = new q.Signal("Hello from Q", q.ZoneCodes.KEY_SPACE, q.Effects.BREATHE, '#FF0000');
  return console.log("Passed.");
}

testInstantiateSignal();