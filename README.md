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

### clearResourceTimings

This will clear all the resource timing information that the browser has stored
right before we are about to navigate to a new page. This ensures that there's
enough room in the resource buffer, as well as makes it easier to find the start
and end resources that your page might have loaded.

**This is on by default**, but you can turn it off if needed, it not, no touchy.

```js
<RUM navigated={ navigated } clearResourceTimings={ false } />
```

### setResourceTimingBufferSize

Allows you to bump the resource limit of the `performance` browser API through
the component. In most, if not all cases you do **not** need to bump this value
as it default to ~150 resources, which is more than enough for most applications.

```js
<RUM navigated={ navigated } setResourceTimingBufferSize={ 200 } />
```

### delay

The `next-rum` component leverages the ResourceTiming API to more accurately
generate the correct loading times of your component so it can include images
and other assets that are loaded when the component is rendered. Unfortunately
the ResourceTiming API only contains item that are fully loaded. As this component
has no idea what you will be loading in the component, we will wait an x amount
of milliseconds before we gather the data, and call the `navigated` callback.
This gives assets some time to complete loading, so they can be included in the
metrics.

**This is on by default, with a value of 2000**

```js
<RUM navigated={ navigated } delay={ 5000 } />
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
