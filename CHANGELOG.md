# CHANGELOG

### 1.1.1

- Next.js made a breaking change in `next@9.4.3` where it removed the listeners
  we used to generate the RUM data. We added a small fix to prevent this library
  from throwing an error while we work on upgrading to a different performance
  API.

### 1.1.0

- Use ResourceTiming when available to increase the accuracy of the gathered
  metrics.

### 1.0.0

- Initial release.
