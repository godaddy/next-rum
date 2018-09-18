import EventEmitter from 'events';

/**
 * Creates a polyfill for our test environment so we can test against the
 * `performance` object inside Node.js
 *
 * @public
 */
export default function polyfill() {
  const emitter = new EventEmitter();

  //
  // As we are in a JSDom enhanced environment, we already have certain values
  // available, so we can just copy those over to get a more complete polyfill
  // for the test suite.
  //
  const performance = global.performance;
  const now = Date.now();

  Object.defineProperty(global, 'performance', {
    value: {
      ...performance,
      emitter,

      timeOrigin: now,
      timing: {
        //
        // Ensure that there is a difference between timeOrigin and navigationStart
        // so we can assert that different values are used in our test suite.
        //
        navigationStart: now + 1
      },

      faked: (...args) => {
        return {
          args: args,
          faked: true
        };
      },

      setResourceTimingBufferSize: (value) => {
        emitter.emit('setResourceTimingBufferSize', value);
      },

      clearResourceTimings: () => {
        emitter.emit('clearResourceTimings');
      },

      getEntriesByType: (type) => {
        function item(name, offset = 0) {
          const now = (Date.now() + offset) - global.performance.timeOrigin;

          return {
            fetchStart: now,
            responseStart: now + 2,
            responseEnd: now + 10,
            redirectStart: now,
            redirectEnd: now,
            startTime: now,
            name
          }
        }

        return [
          item('http://example.com/_next/-/page/_error.js', 0),
          item('http://example.com/assets/image.jpg', 10),
          item('http://example.com/foo', -10),
          item('http://example.com/next/page/lolz.js', 0)
        ]
      }
    }
  });
}
