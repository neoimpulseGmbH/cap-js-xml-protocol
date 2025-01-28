const cds = require('@sap/cds')
const defaults = { path: '/xml', impl: '@neoimpulse/cap-js-xml-protocol' }
const protocols = cds.env.protocols ??= {}
protocols.xml ??= {}
protocols.xml = { ...defaults, ...protocols.xml}