# next-rum

The `next-rum` component extracts RUM data when Next.js router based navigation
is taking place in your application. This ensures that all previews and load
times are correctly tracked when the `/pages` are used dynamically loaded by
`next` instead of a full server refresh / reload.

## Installation

```
npm install --save next-rum
```

## Usage

The library is designed as React component. The reason for this is because
we know that if we get rendered by the Next client that all the required
globals that we need to hook into are available in the global scope.

The component will not produce any output, and will return the children
during `render` so you can use it as either a wrapper around your application
or as standalone component that you just include in the bottom of your
application:

```js
import React, { Fragment } from 'react';
import App from './application';
import RUM from 'next-rum';

/**
 * Implement your custom tracker/analytics here to receive the RUM data.
 *
 * @param {String} url The URL that we navigated to.
 * @param {Object} rum The measured navigation data.
 * @private
 */
function navigated(url, rum) {
  console.log('the page has navigated to', url, rum);
}

//
// Example where it wraps your application code.
//
export default function WrappingApplication(props) {
  return (
    <RUM navigated={ navigated }>
      <App { ...props } />
    </RUM>
  );
}

//
// Example where it's used a normal standalone component.
//
export function Standalone(props) {
  return (
    <Fragment>
      <App { ...props } />
      <RUM navigated={ navigated } />
    </Fragment>
  );
}
```

The `<RUM>` component accepts the following properties:

### navigated

The component is written to be library agnostic as possible, so we expose a
completion callback for when the page is navigated that will receive all
relevant timing information. You can use this callback to transfer RUM
information to the backend / service of your choosing.

**This property is required**

- `path` **string**, The path of the site that we've navigated to.
- `rum` **object**, The [navigation timing][timing] that we've extracted.

```js
/**
 * Example to send data to Google Analytics
 *
 * @param {String} path Path of the new page.
 * @param {Object} rum Navigation timing.
 * @private
 */
function navigated(path, rum) {
  for (let metricName in rum) {
    ga('send', 'event', {
      eventCategory: 'Performance Metrics',
      eventValue: rum[metricName],
      eventAction: metricName,
      nonInteraction: true,
    });
  }
}

export default function Example() => {
  return (
    <RUM navigated={ navigated }>
      <Application />
    </RUM>
  );
}
```

## Navigation Timing

The following timing information is gathered:

```js
{
  navigationStart: <epoch>,   // `routeChangeStart`
  fetchStart: <epoch>,
  domainLookupStart: <epoch>,
  domainLookupEnd: <epoch>,
  connectStart: <epoch>,
  connectEnd: <epoch>,
  requestStart: <epoch>,
  responseStart: <epoch>,
  responseEnd: <epoch>,
  domLoading: <epoch>,        // before-reactdom-render
  domInteractive: <epoch>,    // after-reactdom-render
  domContentLoaded: <epoch>,
  domComplete: <epoch>,
  loadEventStart: <epoch>,    // `routeChangeComplete`
  loadEventEnd: <epoch>
}
```

## License

[MIT](/LICENSE)

[timing]: #navigation-timing
