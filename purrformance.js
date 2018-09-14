/**
 * Checks if a method needs to be vendor prefixed.
 *
 * @param {Object} where Object where we check if prop exists.
 * @param {String} prop Name of the property to check.
 * @returns {String|Undefined} Correct name of the property to use.
 * @private
 */
export function prefix(where = {}, prop) {
  if (prop in where) return prop;

  const prefixes = ['webkit', 'ms', 'moz'];

  for (let i = 0; i < prefixes.length; i++) {
    const vendor = prefixes[i];
    const prefixed = vendor + prop.slice(0, 1).toUpperCase() + prop.slice(1);

    if (prefixed in where) return prefixed;
  }
}

/**
 * In order to correctly calculate the when a resource in the ResourceAPI
 * was made we need to know when the high resolution timer started at 0.
 * New browsers support the `timeOrigin` property that contains the EPOCH
 * of when the timer started. For older browsers we default to the first
 * known timing event, `navigationStart`.
 *
 * @returns {Number} Epoch of when the high resolution timers were inititlized
 * @public
 */
export function timeOrigin() {
  const origin = purrformance('timeOrigin');

  return origin || (purrformance('timing') || {}).navigationStart;
}

/**
 * Find an resource entry that matches a given Regular Expression for the entry
 * name.
 *
 * @param {Array} resources All resources.
 * @param {RegExp} regexp The regexp that needs to match.
 * @returns {Object|Undefined} The entry that is found.
 */
export function find(resources = [], regexp) {
  for (let i = 0; i < resources.length; i++) {
    const entry = resources[i];

    if (entry && entry.name && regexp.test(entry.name)) {
      return entry;
    }
  }
}

/**
* Get all entries that happend during the navigation cycle.
*
* @param {Object} between Start and end range where the request is made.
* @returns {Resources} Resources that were gathered.
* @public
*/
export function entries({ start, end }, resources = purrformance('getEntriesByType', 'resource')) {
  const origin = timeOrigin();
  const contains = [
    'Start',      // transform keys like: responseStart, redirectStart etc
    'Time',       // transform the startTime
    'End'         // and all responseEnd
  ];

  return (resources || []).sort((a, b) => {
    if (a.fetchStart !== b.fetchStart) return a.fetchStart - b.fetchStart;

    return (a.responseStart || a.responseEnd) - (b.responseStart || b.responseEnd);
  }).map(entry => {
    const data = {};

    for (let key in entry) {
      data[key] = entry[key];

      //
      // Normalize the high precision timers to EPOCH values as that is what
      // the navigation timing is using.
      //
      if (contains.some(check => !!~key.indexOf(check))) {
        data[key] = origin + data[key];
      }
    }

    return data;
  }).filter(({ startTime }) => {
    return startTime >= start && startTime <= end;
  });
}

/**
 * Small helper function that allows us to safely interact with the
 * performance API that is exposed in browsers.
 *
 * @param {String} method Name of the method we want to invoke.
 * @param {Arguments} args Rest of the arguments that should be applied.
 * @returns {Mixed} What ever the API returns.
 * @private
 */
export default function purrformance(method, ...args) {
  const perf = global[prefix(global, 'performance')];

  if (perf) {
    const name = prefix(perf, method);

    if (typeof perf[name] === 'function') {
      return perf[name](...args);
    } else {
      return perf[name];
    }
  }
}

//
// Expose all methods on the purrformance method as well for easier exports.
//
purrformance.find = find;
purrformance.prefix = prefix;
purrformance.entries = entries;
purrformance.timeOrigin = timeOrigin;
