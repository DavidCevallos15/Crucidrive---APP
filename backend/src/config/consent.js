/**
 * Versión vigente del texto de consentimiento LOPDP (specs/002-identidad/consentimiento-lopdp.md).
 * La fija el servidor, no el cliente: así queda registrado el texto exacto que se aceptó.
 * Súbela cada vez que cambie el texto de fondo y se vuelva a pedir el consentimiento.
 */
const CONSENT_VERSION = '0.2';

module.exports = { CONSENT_VERSION };
