const cds = require('@sap/cds')
const DEBUG = cds.debug('adapters')
const XMLAdapter = require('./lib/XMLAdapter')

let services
const collectServicesAndMountAdapter = (srv, options) => {
  if (!services) {
    services = {}
    cds.on('served', () => {
      options.services = services
      cds.app.use (options.path, cds.middlewares.before, XMLAdapter(options), cds.middlewares.after)
      DEBUG?.('app.use(', options.path, ', ... )')
    })
  }
  services[srv.name] = srv
}

module.exports = collectServicesAndMountAdapter