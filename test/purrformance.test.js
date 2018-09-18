import purrformance, { entries, find, timeOrigin, prefix } from '../purrformance';
import polyfill from './polyfill';
import assume from 'assume';

beforeEach(polyfill);

describe('purrformance', function () {
  it('exposes all methods on the function as well', function () {
    assume(purrformance.timeOrigin).equals(timeOrigin);
    assume(purrformance.entries).equals(entries);
    assume(purrformance.prefix).equals(prefix);
    assume(purrformance.find).equals(find);
  });

  describe('#timeOrigin', function () {
    it('returns the `performance.timeOrigin` if defined', function () {
      const time = timeOrigin();

      assume(time).equals(global.performance.timeOrigin);
    });

    it('returns `navigationStart` if `timeOrigin` is not supported', function () {
      delete global.performance.timeOrigin;

      const time = timeOrigin();

      assume(time).equals(global.performance.timing.navigationStart);
      assume(time).does.not.equal(global.performance.timeOrigin);
    });
  });

  describe('#prefix', function () {
    it('prefers a non prefixed api name above prefixed', function () {
      const where = {
        clearResourceTimings: 'foo',
        mozClearResourceTimings: 'bar'
      };

      const name = prefix(where, 'clearResourceTimings');

      assume(name).equals('clearResourceTimings');
    });

    [
      { prefix: 'moz', name: 'mozClearResourceTimings' },
      { prefix: 'ms', name: 'msClearResourceTimings' },
      { prefix: 'webkit', name: 'webkitClearResourceTimings' },
    ].forEach(function generate(item) {
      it(`finds the ${item.prefix} prefixed api's`, function () {
        const where = {
          [item.name]: 'bar'
        };

        const name = prefix(where, 'clearResourceTimings');

        assume(name).equals(item.name);
      });
    });
  });

  describe('#purrformance', function () {
    it('fails silently for unknown APIs', function () {
      const value = purrformance('whatisup');

      assume(value).is.a('undefined');
    });

    it('it calls the API with the given name', function () {
      const value = purrformance('faked');

      assume(value).is.a('object');
      assume(value.faked).is.true();
    });

    it('passes all other arguments to the function', function () {
      const value = purrformance('faked', 'foo', 'bar');

      assume(value).is.a('object');
      assume(value.faked).is.true();
      assume(value.args).deep.equals(['foo', 'bar']);
    });

    it('returns the value if its not a function', function () {
      assume(purrformance('timeOrigin')).is.a('number');
      assume(purrformance('timeOrigin')).equals(global.performance.timeOrigin);
    });
  });

  describe('#entries', function () {
    let data;

    beforeEach(function () {
      const start = Date.now();
      const end = Date.now() + 20;

      data = entries({ start, end });
    });

    it('it returns entries for a given range', function () {
      assume(data).is.a('array');
      assume(data.length).is.above(1);
    });

    it('transforms the high resolution timer to EPOCH', function () {
      const item = data[0];

      assume(item.startTime.toString().length).equals(Date.now().toString().length);
      assume(item.responseEnd.toString().length).equals(Date.now().toString().length);
      assume(item.responseStart.toString().length).equals(Date.now().toString().length);
    });

    it('only returns entries that matches the given range', function () {
      const start = Date.now() + 100;
      const end = start + 20;

      const nothing = entries({ start, end });
      assume(nothing).is.length(0);
    });
  });

  describe('#find', function () {
    it('finds a resource based on a given regexp', function () {
      const start = Date.now();
      const end = Date.now() + 20;
      const item = find(entries({ start, end }), /_next/g);

      assume(item.name).equals('http://example.com/_next/-/page/_error.js');
    });
  });
});
