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

    this.emitter = null;  // Reference to next.emitter.
    this.router = null;   // Reference to next.router.
    this.timings = {};    // Store timing data.

    //
    // Pre-bind all the methods that are passed into EventEmitters.
    //
    ['before', 'after', 'start', 'complete'].forEach(
      (name) => (this[name] = this[name].bind(this))
    );
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
    const { emitter, router } = this;

    router.events.on('routeChangeStart', this.start);
    emitter.off('before-reactdom-render', this.before);
    emitter.off('after-reactdom-render', this.after);
    router.events.on('routeChangeComplete', this.complete);

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
   * Reset out `timings` tracking object to nothing.
   *
   * @public
   */
  reset() {
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
    this.set('navigationStart', { url });
  }

  /**
   * The `routeChangeComplete` event is called.
   *
   * @param {String} url The URL we've just loaded.
   * @private
   */
  complete(url) {
    this.set('loadEventEnd', { url });
    this.payload();
  }

  /**
   * Create the payload that is send to the callback.
   *
   * @private
   */
  payload() {
    const rendered = this.get('domContentLoaded');
    const start = this.get('navigationStart');
    const unmount = this.get('domLoading');
    const end = this.get('loadEventEnd');
    const rum = {};

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
    ].forEach(name => (rum[name] = start.now));

    //
    // Components and data are fetched
    //
    rum.domLoading = unmount.now;

    [
      'domInteractive',       // Unable to measure, SPA's are always interactive
      'domContentLoaded',     // Once the React app is rendered, it is loaded
      'domComplete'           // and also complete, so use the same timing.
    ].forEach(name => (rum[name] = rendered.now));

    [
      'loadEventStart',       // Load events don't exist, use the routeChangeComplete
      'loadEventEnd'          // timing for both.
    ].forEach(name => (rum[name] = end.now));

    this.props.navigated(this.router.asPath, rum);
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
 * Ensure that we've received the correct props.
 *
 * @type {Object}
 * @private
 */
Measure.propTypes = {
  navigated: PropTypes.func.isRequired,
  children: PropTypes.node
};
