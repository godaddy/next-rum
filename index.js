import purrformance, { timeOrigin, entries, find } from './purrformance';
import React, { Component } from 'react';
import PropTypes from 'prop-types';

/**
 * Measure RUM timing for Next.js based applications.
 *
 * @class
 * @public
 */
export default class Measure extends Component {
  constructor() {
    super(...arguments);

    this.timeOrigin = timeOrigin();   // Start of the original navigation.
    this.emitter = null;              // Reference to next.emitter.
    this.router = null;               // Reference to next.router.
    this.timings = {};                // Store timing data.
    this.timer = null;                // Reference to a timer.

    //
    // Pre-bind all the methods that are passed around.
    //
    ['before', 'after', 'start', 'complete', 'payload', 'flush'].forEach(
      (name) => (this[name] = this[name].bind(this))
    );

    //
    // Check if we need to increase the timing buffer, for most browsers there
    // is already a decent size of 150~ set as buffer but for some more extreme
    // cases you might want to track more.
    //
    const size = this.props.setResourceTimingBufferSize;
    if (typeof size === 'number') {
      purrformance('setResourceTimingBufferSize', size);
    }
  }

  /**
   * When the component is mounted, we know that the `next` library has been
   * loaded and we can hook into.
   *
   * @private
   */
  componentDidMount() {
    const { emitter, router } = global.next;

    //
    // The render flow of a Next based application based on the sequence of
    // events found in the `client/*` folder of the next repository.
    //
    // 1. `routeChangeStart` router event is emitted.
    // 2. Route information is requested, if this is not cached or cacheable:
    //   - Fetch the component from the server using `document.createElement(script)`
    //     if not previously cached.
    //   - Execute `getInitialProps` on the component to fetch props/data for render.
    // 3. `beforeHistoryChange` router event is emitted.
    // 4. Browser `window.history` is updated.
    // 5. Router properties such as `asPath` are updated.
    // 6. Notify all router subscription of the change which triggers `next.render`
    //   - `before-reactdom-render` next event is emitted.
    //   - `after-reactdom-render` next event is emitted.
    // 7. `routeChangeComplete` router event is emitted.
    //
    router.events.on('routeChangeStart', this.start);
    emitter.on('before-reactdom-render', this.before);
    emitter.on('after-reactdom-render', this.after);
    router.events.on('routeChangeComplete', this.complete);

    if (this.props.delay && global.addEventListener) {
      global.addEventListener('beforeunload', this.flush);
    }

    this.emitter = emitter;
    this.router = router;
  }

  /**
   * Component is about to unmount, remove all the hooks we've placed on the
   * Next.js internals.
   *
   * @private
   */
  componentWillUnmount() {
    const { emitter, router, props } = this;

    //
    // Before we completely destroy our references, check if we have a current
    // buffer that should be flushed.
    //
    this.flush();

    router.events.off('routeChangeStart', this.start);
    emitter.off('before-reactdom-render', this.before);
    emitter.off('after-reactdom-render', this.after);
    router.events.off('routeChangeComplete', this.complete);

    if (props.delay && global.removeEventListener) {
      global.removeEventListener('beforeunload', this.flush);
    }

    this.emitter = this.router = null;
  }

  /**
   * Set new timing information.
   *
   * @param {String} name Name of the timing event.
   * @param {Object} data Additional information.
   * @public
   */
  set(name, data) {
    this.timings[name] = {
      ...data,
      now: Date.now()
    };
  }

  /**
   * Find a stat for a given name.
   *
   * @param {String} name Name of the metrict we want to read.
   * @returns {Object|Undefined} The value.
   * @public
   */
  get(name) {
    return this.timings[name];
  }

  /**
   * Forcefully flush any gathered metrics that we've gathered. Even if we
   * are asked to delay the gathering. This will be done incase of unloading
   * of the page, so metrics can still be send if needed.
   *
   * @private
   */
  flush() {
    if (!this.timer) return this.reset();

    this.payload();
  }

  /**
   * Reset out `timings` tracking object to nothing.
   *
   * @public
   */
  reset() {
    clearTimeout(this.timer);
    this.timings = {};
  }

  /**
   * Responds to the `before-reactdom-render` call as DOM loading as this call
   * will unmount any previous components, clearing up the DOM, ready for
   * rendering.
   *
   * appProps.err will indicate if there was error previously during rendering
   * so there might be multiple before calls.
   *
   * @private
   */
  before(/* { Component, ErrorComponent, appProps } */) {
    //
    // It's possible that we get an error while rendering the application.
    //
    // - Error is thrown during rendering
    // - Error triggers, ErrorBoundry of Next
    // - ErrorBoundry triggers RenderError
    // - Sets ErrorComponent as Component
    // - Calls render again, here we are with appProps.err set and another
    //   `before-reactdom-render` attempt.
    //
    // So we don't want to override an existing `domLoading` event that
    // we already set, because then we will have the time of when the error
    // is rendered, not when we first started to render.
    //
    if (this.get('domLoading')) return;

    this.set('domLoading');
  }

  /**
   * Responds to the `after-reactdom-render` call, the component has been
   * mounted in the DOM.
   *
   * @private
   */
  after(/* { Component, ErrorComponent, appProps } */) {
    //
    // It is worth noting, that we do not case how many times this called
    // unliked the `before` method, as we **want** to override the timing
    // information with the latest call.
    //
    this.set('domContentLoaded');
  }

  /**
   * The `routeChangeStart` event is called, so we are about to fetch and
   * navigate to a different URL.
   *
   * @param {String} url The URL we're about to load.
   * @private
   */
  start(url) {
    //
    // Check if we already have data queued, if that is the case we want to
    // make sure that we flush it, and reset our metrics.
    //
    this.flush();

    //
    // Clearning the resourceTimings does a couple of useful things for us:
    //
    // 1. It ensures that we do not overflow our resource buffer. Browsers have
    //    a fixed limit of the amount of resources they can track. By clearning
    //    it on the start we reduce free up memory, and allow all requests that
    //    are made during the navigation phase being captured.
    // 2. We have to track and check less performance entries once we are done
    //    so we can safely assume that the first request that is in the entries
    //    will be the start of our request.
    //
    if (this.props.clearResourceTimings) {
      purrformance('clearResourceTimings');
    }

    this.set('navigationStart', { url });
  }

  /**
   * The `routeChangeComplete` event is called.
   *
   * @param {String} url The URL we've just loaded.
   * @private
   */
  complete(url) {
    const delay = this.props.delay;

    this.set('loadEventEnd', { url });

    //
    // The performance ResourceAPI only contains files that are fully loaded,
    // items that are in flight are not included. So when a page loads images
    // after the page is rendered, we want to capture those as well as last
    //
    if (delay) {
      clearTimeout(this.timer);
      this.timer = setTimeout(this.payload, delay);
    } else {
      this.payload();
    }
  }

  /**
   * Grab all ResourceAPI entries and see if we can extract relevant data
   * from it so make the timing information more accurate.
   *
   * @param {Object} range Start and end time in which the requests could start.
   * @param {Object} rum The RUM timing object that we can improve.
   * @param {Array} resources The items that are loaded during the navigation.
   * @public
   */
  resourceTiming(range, rum) {
    const resources = entries(range);
    const page = find(resources, /\/_next\/-\/page\/(.*)\.js$/g);

    //
    // We can use the request that fetches the JavaScript bundle that contains
    // the page component as starting/end time of the request. It's still
    // missing the time it took to fetch `getInitialProps` on the component,
    // but still an improvement over the normal metrics
    //
    if (page) {
      if (page.responseStart) rum.responseStart = page.responseStart;
      if (page.responseEnd) rum.responseEnd = page.responseEnd;
    }

    //
    // The `loadEventStart` should be the same as the `domComplete` time as
    // that is when the resources can start with loading. To more accurately
    // estimate the `loadEventEnd` we can see it the last resource that is
    // loaded on the page end later our basic rum timing and use that instead.
    //
    const last = resources[resources.length - 1];
    if (last && last.responseEnd > rum.loadEventEnd) {
      rum.loadEventEnd = last.responseEnd;
    }

    return resources;
  }

  /**
   * Create the payload that is send to the callback.
   *
   * @private
   */
  // eslint-disable-next-line complexity
  payload() {
    const routeChangeToRenderMetrics = Measure.webVitals;
    const rendered = this.get('domContentLoaded') && this.get('domContentLoaded').now ?
      this.get('domContentLoaded').now : routeChangeToRenderMetrics.loadEventStart;
    const start = this.get('navigationStart') && this.get('navigationStart').now ?
      this.get('navigationStart').now : routeChangeToRenderMetrics.navigationStart;
    const unmount = this.get('domLoading');
    const end = this.get('loadEventEnd') && this.get('loadEventEnd').now ?
      this.get('loadEventEnd').now : routeChangeToRenderMetrics.loadEventEnd;
    const rum = {};

    if (!start || !end || !rendered) return this.reset();

    //
    // Start of the route loading.
    //
    [
      'navigationStart',      // `routeChangeStart` event.
      'fetchStart',           //
      'domainLookupStart',    // These are all not trackable with Next
      'domainLookupEnd',      // because we cannot hook into their component
      'connectStart',         // download and getInitialProps.
      'connectEnd',           //
      'requestStart',         // So we are going to default all of these
      'responseStart',        // to the start timing for now until we
      'responseEnd'           // made a PR to add events for these.
    ].forEach(name => (rum[name] = start));

    //
    // Components and data are fetched.
    //
    rum.domLoading = unmount && unmount.now ? unmount.now : null;

    [
      'domInteractive',       // Unable to measure, SPA's are always interactive
      'domContentLoaded',     // Once the React app is rendered, it is loaded
      'domComplete',          // and also complete, so use the same timing.
      'loadEventStart'        // loadEventStart should be the same as domComplete
    ].forEach(name => (rum[name] = rendered));

    rum.loadEventEnd = end;

    //
    // Check if we can use the ResourceAPI to improvement some our data.
    //
    const entries = this.resourceTiming({ start: start, end: end }, rum);
    this.props.navigated(this.router.asPath, rum, entries);

    this.reset();
  }

  /**
   * Wraps all the components, so we're just going to return the
   * children.
   *
   * @returns {Children} The child components.
   * @private
   */
  render() {
    return this.props.children || null;
  }
}

/**
 * Default props.
 *
 * @type {Object}
 * @private
 */
Measure.defaultProps = {
  clearResourceTimings: true,
  unload: true,
  delay: 2000
};

/**
 * Ensure that we've received the correct props.
 *
 * @type {Object}
 * @private
 */
Measure.propTypes = {
  setResourceTimingBufferSize: PropTypes.number,
  navigated: PropTypes.func.isRequired,
  clearResourceTimings: PropTypes.bool,
  children: PropTypes.node,
  delay: PropTypes.number,
  unload: PropTypes.bool
};

Measure.webVitals = {
  navigationStart: null,
  loadEventStart: null,
  loadEventEnd: null,
  renderDuration: null
};
