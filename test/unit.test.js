/* eslint-disable max-statements */
import { shallow, mount } from 'enzyme';
import { it, describe } from 'mocha';
import EventEmitter from 'events';
import polyfill from './polyfill';
import RUM from '../index.js';
import assume from 'assume';
import React from 'react';

describe('RUM Component', function () {
  const events = new EventEmitter();
  const timers = {};
  let result;
  let rum;

  //
  // Fake the global.next
  //
  global.next = {
    emitter: new EventEmitter(),
    router: {
      asPath: '/',
      events: new EventEmitter()
    }
  };

  //
  // The Next event mitter isn't really an event emitter. So we have to confirm
  // their weird API.
  //
  global.next.emitter.off = global.next.emitter.removeListener;
  global.next.router.events.off = global.next.emitter.removeListener;

  /**
   * Simple proxy function, it will just emit the callback as events
   * so our test suite can just listen to the event emitter instead of
   * having to create new instances every single time.
   *
   * @private
   */
  function navigated() {
    events.emit('navigated', ...arguments);
  }

  /**
   * Emulate a request cycle.
   *
   * @param {String} path The path we navigate to
   * @param {Error} err Optional error that happend.
   * @private
   */
  function emulate(path, err) {
    const { emitter, router } = global.next;

    router.events.emit('routeChangeStart', path);

    /**
     * Completion callback.
     *
     * @private
     */
    function done() {
      timers.second = setTimeout(function () {
        router.asPath = path;
        router.events.emit('routeChangeComplete', path);
      }, 5);
    }

    timers.first = setTimeout(function () {
      const args = {
        Component: {},
        ErrorComponent: {},
        appProps: {
          Component: {},
          hash: '',
          router
        }
      };

      emitter.emit('before-reactdom-render', args);
      emitter.emit('after-reactdom-render', args);

      if (err) return setTimeout(function () {
        emitter.emit('before-reactdom-render', { err, ...args });
        emitter.emit('after-reactdom-render', { err, ...args });

        done();
      }, 10);

      done();
    }, 5);
  }

  function on() {
    result = mount(<RUM navigated={ navigated } delay={ 100 } />);
    rum = result.instance();
  }

  function off() {
    result.unmount();

    Object.keys(timers).forEach((key) => {
      clearTimeout(timers[key]);
    });
  }

  function reportWebVitals() {
    const loadEventEndMinusNavStart = 9600.97;
    RUM.webVitals.loadEventEnd = Date.now() + loadEventEndMinusNavStart;
    RUM.webVitals.renderDuration = 17.36;
    RUM.webVitals.navigationStart = Date.now() + RUM.webVitals.renderDuration;
    RUM.webVitals.loadEventStart = Date.now() + RUM.webVitals.renderDuration;
  }

  it('adds eventlisteners to the next internals', function () {
    on();

    const emitter = global.next.emitter.eventNames();
    const router = global.next.router.events.eventNames();

    assume(emitter).includes('before-reactdom-render');
    assume(emitter).includes('after-reactdom-render');
    assume(router).includes('routeChangeStart');
    assume(router).includes('routeChangeComplete');

    assume(global.next.emitter.listeners('before-reactdom-render')[0]).equals(rum.before);
    assume(global.next.emitter.listeners('after-reactdom-render')[0]).equals(rum.after);
    assume(global.next.router.events.listeners('routeChangeStart')[0]).equals(rum.start);
    assume(global.next.router.events.listeners('routeChangeComplete')[0]).equals(rum.complete);

    off();
  });

  it('removes the listeners on unmount', function () {
    assume(global.next.emitter.listeners('before-reactdom-render')).is.length(0);
    assume(global.next.emitter.listeners('before-reactdom-render')).is.length(0);
    assume(global.next.emitter.listeners('after-reactdom-render')).is.length(0);
    assume(global.next.router.events.listeners('routeChangeStart')).is.length(0);
    assume(global.next.router.events.listeners('routeChangeComplete')).is.length(0);

    const enzyme = mount(<RUM navigated={ navigated } />);
    // eslint-disable-next-line no-unused-vars
    const instance = enzyme.instance();

    assume(global.next.emitter.listeners('before-reactdom-render')).is.length(1);
    assume(global.next.emitter.listeners('before-reactdom-render')).is.length(1);
    assume(global.next.emitter.listeners('after-reactdom-render')).is.length(1);
    assume(global.next.router.events.listeners('routeChangeStart')).is.length(1);
    assume(global.next.router.events.listeners('routeChangeComplete')).is.length(1);

    enzyme.unmount();

    assume(global.next.emitter.listeners('before-reactdom-render')).is.length(0);
    assume(global.next.emitter.listeners('before-reactdom-render')).is.length(0);
    assume(global.next.emitter.listeners('after-reactdom-render')).is.length(0);
    assume(global.next.router.events.listeners('routeChangeStart')).is.length(0);
    assume(global.next.router.events.listeners('routeChangeComplete')).is.length(0);
  });

  describe('Metric storage', function () {
    beforeEach(on);
    afterEach(off);

    it('it has a `timings` object', function () {
      assume(rum.timings).is.a('object');
      assume(rum.timings).is.length(0);
    });

    describe('#set', function () {
      it('stores the data in the `timings` object', function () {
        rum.set('foo');

        assume(rum.timings.foo).is.a('object');
        assume(rum.timings.foo.now).is.a('number');
        assume(rum.timings.foo.now).is.atmost(Date.now());
      });
    });

    describe('#get', function () {
      it('returns the data that was stored for a given event', function () {
        rum.set('example');
        rum.set('more-data', { extra: 'data', merged: 'with the object' });

        assume(rum.get('i do not exist')).is.a('undefined');
        assume(rum.get('example')).is.a('object');
        assume(rum.get('example')).equals(rum.timings.example);

        const data = rum.get('more-data');

        assume(data.now).is.a('number');
        assume(data.extra).equals('data');
        assume(data.merged).equals('with the object');
      });
    });

    describe('#reset', function () {
      it('resets the object', function () {
        rum.set('example');

        assume(rum.timings).is.above(0);
        rum.reset();

        assume(rum.timings).is.a('object');
        assume(rum.timings).is.length(0);
      });
    });
  });

  describe('render', function () {
    it('renders no output when used as standalone Component', function () {
      const result = shallow(
        <div>
          <h1>Hello world</h1>
          <RUM navigated={ navigated } />
        </div>
      );

      assume(result.html()).equals('<div><h1>Hello world</h1></div>');
    });

    it('returns children when wrapping a component', function () {
      const result = shallow(
        <RUM navigated={ navigated }>
          <h1>Hello world</h1>
        </RUM>
      );

      assume(result.html()).equals('<h1>Hello world</h1>');
    });
  });

  describe('#navigated', function () {
    beforeEach(on);
    afterEach(off);

    it('calls the callback when the page is navigated', function (next) {
      reportWebVitals();
      emulate('/callback-test');

      events.once('navigated', function (url, payload) {
        assume(url).equals('/callback-test');
        assume(payload).is.a('object');

        next();
      });
    });

    it('generates timing information', function (next) {
      const start = Date.now();

      reportWebVitals();
      emulate('/timing-data');

      events.once('navigated', function (url, payload) {
        const end = Date.now();

        assume(url).equals('/timing-data');
        assume(payload).is.a('object');

        Object.keys(payload).forEach(
          prop => assume(payload[prop]).is.a('number')
        );

        assume(payload.domLoading).is.within((start + 1), (end - 1));
        assume(payload.domInteractive).is.within((start + 1), (end - 1));
        assume(payload.domContentLoaded).is.within((start + 1), (end - 1));
        assume(payload.domComplete).is.within((start + 1), (end - 1));

        assume(payload.navigationStart).is.atleast(start);
        assume(payload.navigationStart).is.below(end);
        assume(payload.loadEventEnd).is.above(payload.navigationStart);

        next();
      });
    });
  });

  it('does not reset timing data on renderError', function (next) {
    on();

    events.once('navigated', function (url, payload) {
      assume(url).equals('/render-error');
      assume(payload).is.a('object');

      assume(payload.domComplete).is.above(payload.domLoading + 1);
      assume(payload.domInteractive).is.above(payload.domLoading + 1);
      assume(payload.domContentLoaded).is.above(payload.domLoading + 1);

      off();
      next();
    });

    reportWebVitals();
    emulate('/render-error', new Error('Shits on fire yo'));
  });

  it('registers an `beforeunload` listener', function (next) {
    global.addEventListener = function (name, fn) {
      delete global.addEventListener;

      assume(name).equals('beforeunload');
      assume(fn.toString()).equals(rum.flush.toString());

      //
      // addEventListener is called during will mount, so we don't want to
      // instantly unmount the node, but give react some time to complete the
      // mount process.
      //
      setTimeout(function () {
        off();
        next();
      }, 0);
    };

    on();
  });

  it('removes an `beforeunload` listener', function (next) {
    global.removeEventListener = function (name, fn) {
      delete global.removeEventListener;

      assume(name).equals('beforeunload');
      assume(fn.toString()).equals(rum.flush.toString());

      next();
    };

    on();
    off();
  });

  describe('performance', function () {
    beforeEach(polyfill);

    it('sets the setResourceTimingBufferSize', function (next) {
      global.performance.emitter.once('setResourceTimingBufferSize', (value) => {
        assume(value).equals(300);
        next();
      });

      shallow(<RUM navigated={ navigated } setResourceTimingBufferSize={ 300 } />);
    });

    it('clears the resource timing buffer', function (next) {
      global.performance.emitter.once('clearResourceTimings', () => {
        off();
        next();
      });

      on();
      emulate('/timing-data');
    });
  });
});
