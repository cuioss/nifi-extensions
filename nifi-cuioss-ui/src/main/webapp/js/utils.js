'use strict';

/**
 * Consolidated utilities: validation, i18n, error display, sanitization, logging.
 *
 * @module js/utils
 */

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[JWT-UI]';

/* eslint-disable no-console */
export const log = {
    debug: (...args) => console.debug(LOG_PREFIX, ...args),
    info: (...args) => console.info(LOG_PREFIX, ...args),
    warn: (...args) => console.warn(LOG_PREFIX, ...args),
    error: (...args) => console.error(LOG_PREFIX, ...args)
};
/* eslint-enable no-console */

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

export const TRANSLATIONS = {
    en: {
        // -- common --
        'common.btn.delete': 'Delete',
        'common.btn.cancel': 'Cancel',
        'common.btn.remove': 'Remove',
        'common.btn.clear': 'Clear',
        'common.btn.edit': 'Edit',
        'common.error.prefix': 'Error',
        'common.error.unknown': 'Unknown error',
        'common.error.server': 'Server error (HTTP {0})',
        'common.status.enabled': 'Enabled',
        'common.status.disabled': 'Disabled',
        'common.status.yes': 'Yes',
        'common.status.no': 'No',
        'common.na': 'N/A',
        'common.loading': 'Loading...',

        // -- origin badges --
        'origin.badge.persisted.title': 'Loaded from processor properties (persisted)',
        'origin.badge.modified.title': 'Modified in this session (not yet persisted)',
        'origin.badge.new.title': 'Created in this session (not yet persisted)',
        'origin.badge.modified': 'Modified',
        'origin.badge.new': 'New',

        // -- validation --
        'validation.required': 'This field is required.',
        'validation.url.required': 'URL is required.',
        'validation.url.too.long': 'URL is too long (maximum {0} characters).',
        'validation.url.invalid': 'Invalid URL format. Must be a valid {0} URL.',
        'validation.token.required': 'Token is required.',
        'validation.token.too.short': 'Token is too short (minimum 10 characters).',
        'validation.token.too.long': 'Token is too long (maximum 10000 characters).',
        'validation.token.invalid.format': 'Invalid token format. Expected at least 2 parts separated by dots.',
        'validation.issuer.name.required': 'Issuer name is required.',
        'validation.issuer.name.too.short': 'Issuer name must be at least 2 characters long.',
        'validation.issuer.name.too.long': 'Issuer name is too long (maximum 100 characters).',
        'validation.issuer.name.invalid.chars': 'Issuer name can only contain letters, numbers, hyphens, underscores, and dots.',
        'validation.processor.url.required': 'URL is required for processor ID extraction.',
        'validation.processor.id.not.found': 'URL does not contain a valid processor ID.',
        'validation.field.issuer.name': 'Issuer Name',
        'validation.field.issuer.uri': 'Issuer URI',
        'validation.field.jwks.url': 'JWKS URL',

        // -- confirmation dialogs --
        'confirm.remove.issuer.title': 'Remove Issuer Configuration',
        'confirm.remove.issuer.message': 'Are you sure you want to remove the issuer "{0}"? This action cannot be undone.',
        'confirm.remove.route.title': 'Remove Route Configuration',
        'confirm.remove.route.message': 'Are you sure you want to remove the route "{0}"? This action cannot be undone.',
        'confirm.clear.title': 'Clear Form Data',
        'confirm.clear.message': 'Are you sure you want to clear all form data? Any unsaved changes will be lost.',

        // -- issuer config --
        'issuer.heading': 'Issuer Configurations',
        'issuer.description': 'Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.',
        'issuer.btn.add': 'Add Issuer',
        'issuer.btn.save': 'Save Issuer',
        'issuer.form.name.label': 'Issuer Name',
        'issuer.form.name.placeholder': 'e.g., keycloak',
        'issuer.form.name.title': 'Unique identifier for this issuer configuration.',
        'issuer.form.jwks.type.label': 'JWKS Source Type',
        'issuer.form.jwks.type.title': 'Select how JWKS keys should be retrieved',
        'issuer.form.jwks.type.url': 'URL (Remote JWKS endpoint)',
        'issuer.form.jwks.type.file': 'File (Local JWKS file)',
        'issuer.form.jwks.type.memory': 'Memory (Inline JWKS content)',
        'issuer.form.issuer.uri.label': 'Issuer URI',
        'issuer.form.issuer.uri.placeholder': 'The URI of the token issuer (must match the iss claim)',
        'issuer.form.jwks.url.label': 'JWKS URL',
        'issuer.form.jwks.url.placeholder': 'The URL of the JWKS endpoint',
        'issuer.form.jwks.file.label': 'JWKS File Path',
        'issuer.form.jwks.file.placeholder': 'Path to local JWKS JSON file',
        'issuer.form.jwks.content.label': 'JWKS Content',
        'issuer.form.jwks.content.placeholder': 'Inline JWKS JSON content',
        'issuer.form.audience.label': 'Audience',
        'issuer.form.audience.placeholder': 'The expected audience claim value',
        'issuer.form.client.id.label': 'Client ID',
        'issuer.form.client.id.placeholder': 'The client ID for token validation',
        'issuer.jwks.test.btn': 'Test Connection',
        'issuer.jwks.test.title': 'Test connectivity to the JWKS endpoint',
        'issuer.jwks.test.hint': 'Click the button to validate JWKS',
        'issuer.jwks.test.testing': 'Testing...',
        'issuer.jwks.valid': 'Valid JWKS ({0} keys found)',
        'issuer.save.success': 'Issuer configuration saved successfully.',
        'issuer.save.success.standalone': 'Issuer configuration saved successfully (standalone mode).',
        'issuer.remove.success': 'Issuer "{0}" removed successfully.',
        'issuer.remove.success.standalone': 'Issuer "{0}" removed (standalone mode).',
        'issuer.validate.name.required': 'Issuer name is required.',
        'issuer.validate.uri.required': 'Issuer URI is required.',
        'issuer.validate.jwks.url.required': 'JWKS URL is required when using URL source type.',
        'issuer.validate.jwks.file.required': 'JWKS file path is required when using file source type.',
        'issuer.validate.jwks.content.required': 'JWKS content is required when using memory source type.',
        'issuer.table.name': 'Name',
        'issuer.table.jwks.source': 'JWKS Source',
        'issuer.table.type': 'Type',
        'issuer.table.issuer.uri': 'Issuer URI',
        'issuer.table.actions': 'Actions',
        'issuer.table.empty': 'No issuers configured. Click "Add Issuer" to create one.',

        // -- token verifier --
        'token.input.label': 'Enter Token',
        'token.input.placeholder': 'Paste token here...',
        'token.btn.verify': 'Verify Token',
        'token.btn.clear': 'Clear',
        'token.results.heading': 'Verification Results',
        'token.status.verifying': 'Verifying token...',
        'token.status.valid': 'Token is valid',
        'token.status.invalid': 'Token is invalid',
        'token.status.expired': 'Token has expired',
        'token.section.header': 'Header',
        'token.section.payload': 'Payload',
        'token.error.prefix': 'Error',
        'token.claim.expiration': 'Expiration',
        'token.claim.expired': '(Expired)',
        'token.claim.issuer': 'Issuer',
        'token.claim.subject': 'Subject',

        // -- route config --
        'route.heading': 'Gateway Route Configuration',
        'route.btn.add': 'Add Route',
        'route.btn.save': 'Save Route',
        'route.export.heading': 'Export Properties',
        'route.export.copy': 'Copy to Clipboard',
        'route.export.copied': 'Copied!',
        'route.table.name': 'Name',
        'route.table.connection': 'Connection',
        'route.table.path': 'Path',
        'route.table.methods': 'Methods',
        'route.table.enabled': 'Enabled',
        'route.table.actions': 'Actions',
        'route.table.empty': 'No routes configured. Click "Add Route" to create one.',
        'route.form.name.label': 'Route Name',
        'route.form.name.placeholder': 'e.g., health-check',
        'route.form.name.title': 'Unique identifier for this route configuration.',
        'route.form.enabled': 'Enabled',
        'route.form.path.label': 'Path',
        'route.form.path.placeholder': '/api/resource (required)',
        'route.form.roles.label': 'Required Roles',
        'route.form.roles.placeholder': 'admin,user (comma-separated, optional)',
        'route.form.scopes.label': 'Required Scopes',
        'route.form.scopes.placeholder': 'read,write (comma-separated, optional)',
        'route.form.create.flowfile': 'Create FlowFile',
        'route.form.connection.label': 'NiFi Connection Name',
        'route.form.connection.placeholder': 'Connection label on NiFi canvas',
        'route.form.schema.toggle': 'Schema Validation',
        'route.form.schema.file': 'File path',
        'route.form.schema.inline': 'Inline JSON',
        'route.form.schema.file.placeholder': './conf/schemas/my-schema.json',
        'route.form.schema.inline.placeholder': '{"type":"object","properties":{}}',
        'route.validate.name.required': 'Route name is required.',
        'route.validate.name.invalid': 'Route name can only contain alphanumeric characters, hyphens, and underscores.',
        'route.validate.name.duplicate': 'A route named "{0}" already exists.',
        'route.validate.path.required': 'Path is required.',
        'route.remove.success': 'Route "{0}" removed successfully.',
        'route.remove.success.standalone': 'Route "{0}" removed (standalone mode).',
        'route.info.banner': 'Changes are applied to the current session only. To make them permanent, export the properties below and add them to your processor configuration.',
        'route.connection.map.heading': 'NiFi Connections ({0} relationships)',
        'route.connection.map.name': 'Connection Name',
        'route.connection.map.routes': 'Routes',
        'route.connection.map.failure': '(always present)',
        'route.global.heading': 'Global Settings',
        'route.global.listening.port': 'Listening Port',
        'route.global.max.request.size': 'Max Request Body Size',
        'route.global.queue.size': 'Queue Size',
        'route.global.ssl.enabled': 'SSL Enabled',
        'route.global.cors.origins': 'CORS Allowed Origins',
        'route.global.listening.host': 'Listening Host',

        // -- endpoint tester --
        'tester.heading': 'Endpoint Tester',
        'tester.form.route': 'Route',
        'tester.form.method': 'Method',
        'tester.form.token': 'Authorization Token',
        'tester.form.token.placeholder': 'Bearer eyJ...',
        'tester.form.body': 'Request Body',
        'tester.form.body.placeholder': '{"key": "value"}',
        'tester.btn.send': 'Send Request',
        'tester.btn.sending': 'Sending...',
        'tester.routes.loading': 'Loading routes...',
        'tester.routes.none': 'No routes available',
        'tester.routes.failed': 'Failed to load routes',
        'tester.response.heading': 'Response',
        'tester.response.status': 'Status: {0}',
        'tester.response.error': 'Error',
        'tester.response.no.headers': 'No headers',
        'tester.error.no.route': 'Please select a route',
        'tester.error.request.failed': 'Request failed: {0}',

        // -- metrics --
        'metrics.btn.refresh': 'Refresh',
        'metrics.btn.export': 'Export',
        'metrics.last.updated': 'Last updated: {0}',
        'metrics.last.updated.never': 'Last updated: Never',
        'metrics.refreshing': 'Refreshing...',
        'metrics.export.heading': 'Export Format:',
        'metrics.gateway.heading': 'Gateway Metrics',
        'metrics.section.token.validation': 'Token Validation',
        'metrics.section.http.security': 'HTTP Security',
        'metrics.section.gateway.events': 'Gateway Events',
        'metrics.no.data': 'No data available',
        'metrics.section.total': 'Total: {0}',
        'metrics.error.load': 'Unable to load metrics.',
        'metrics.error.not.available.title': 'Metrics Not Available',
        'metrics.error.not.available': 'Metrics are available for REST API Gateway processors only.',

        // -- chip input --
        'chip.methods.label': 'Methods',
        'chip.methods.placeholder': 'Type to add method\u2026',
        'chip.methods.aria': 'Add HTTP method',
        'chip.methods.remove.aria': 'Remove {0}',

        // -- tabs --
        'tab.configuration': 'Configuration',
        'tab.token.verification': 'Token Verification',
        'tab.endpoint.config': 'Endpoint Configuration',
        'tab.endpoint.tester': 'Endpoint Tester',
        'tab.issuer.config': 'Issuer Configuration',
        'tab.metrics': 'Metrics',
        'tab.help': 'Help',

        // -- app --
        'app.loading': 'Loading Component UI...',
        'app.gateway.no.issuer.service': 'No JWT Issuer Config Service is linked to this gateway processor. Configure the <strong>JWT Issuer Config Service</strong> property in the processor settings to enable issuer management here.',
        'app.gateway.no.token.service': 'Token verification requires a linked JWT Issuer Config Service. Configure the service reference in the processor settings first.',

        // -- help --
        'help.heading': 'Component Help',
        'help.jwt.getting.started.title': 'Getting Started',
        'help.jwt.getting.started.intro': 'The MultiIssuerJWTTokenAuthenticator processor validates JWT tokens from multiple issuers. Follow these steps to configure:',
        'help.jwt.getting.started.step1': 'Add at least one issuer configuration',
        'help.jwt.getting.started.step2': 'Configure the JWKS URL or file path for each issuer',
        'help.jwt.getting.started.step3': 'Set up authorization rules (optional)',
        'help.jwt.getting.started.step4': 'Test your configuration using the Token Verification tab',
        'help.jwt.issuer.config.title': 'Issuer Configuration',
        'help.jwt.issuer.config.dynamic.title': 'Dynamic Properties',
        'help.jwt.issuer.config.dynamic.desc': 'Each issuer is configured using dynamic properties with the pattern:',
        'help.jwt.issuer.config.examples.title': 'Example Configurations',
        'help.jwt.auth.rules.title': 'Authorization Rules',
        'help.jwt.auth.rules.intro': 'Control access based on JWT claims using these properties:',
        'help.jwt.auth.scopes.title': 'Required Scopes',
        'help.jwt.auth.scopes.desc': 'Specify scopes that must be present in the token:',
        'help.jwt.auth.roles.title': 'Required Roles',
        'help.jwt.auth.roles.desc': 'Specify roles that must be present in the token:',
        'help.jwt.auth.flowfile.title': 'Flow File Attributes',
        'help.jwt.auth.flowfile.desc': 'The processor adds these attributes to flow files:',
        'help.jwt.auth.flowfile.subject': 'Token subject (user)',
        'help.jwt.auth.flowfile.issuer': 'Token issuer',
        'help.jwt.auth.flowfile.scopes': 'Space-separated scopes',
        'help.jwt.auth.flowfile.roles': 'Space-separated roles',
        'help.jwt.auth.flowfile.authorized': 'true/false based on rules',
        'help.jwt.token.verification.title': 'Token Verification',
        'help.jwt.token.verification.intro': 'Use the Token Verification tab to test JWT tokens:',
        'help.jwt.token.verification.step1': 'Paste a JWT token in the input field',
        'help.jwt.token.verification.step2': 'Click "Verify Token"',
        'help.jwt.token.verification.step3': 'Review the validation results',
        'help.jwt.token.verification.issues.title': 'Common Issues',
        'help.jwt.token.verification.issue.signature': 'Check that the JWKS URL is correct',
        'help.jwt.token.verification.issue.expired': 'Generate a new token',
        'help.jwt.token.verification.issue.unknown': 'Add the issuer configuration',
        'help.jwt.token.verification.issue.scopes': 'Ensure token contains required scopes',
        'help.gateway.title': 'REST API Gateway',
        'help.gateway.intro': 'The RestApiGatewayProcessor provides a secure REST API gateway with JWT authentication and route-based access control.',
        'help.gateway.features.title': 'Key Features',
        'help.gateway.features.https': 'Embedded HTTPS/HTTP server with configurable port',
        'help.gateway.features.routing': 'Route-based request matching with path patterns',
        'help.gateway.features.auth': 'Per-route role and scope requirements',
        'help.gateway.features.cors': 'CORS support with configurable allowed origins',
        'help.gateway.features.limits': 'Request body size limits and queue management',
        'help.gateway.tabs.title': 'Tabs',
        'help.gateway.tabs.endpoint': 'View active routes, global settings, and security configuration',
        'help.gateway.tabs.tester': 'Send test requests to verify route access and authentication',
        'help.gateway.tabs.issuer': 'Manage JWT issuer settings from the linked Controller Service',
        'help.gateway.tabs.token': 'Paste and verify JWT tokens against configured issuers',
        'help.gateway.tabs.metrics': 'Monitor token validation, HTTP security events, and gateway activity',
        'help.troubleshooting.title': 'Troubleshooting',
        'help.troubleshooting.jwks.title': 'JWKS Loading Issues',
        'help.troubleshooting.jwks.network': 'Verify network connectivity to JWKS endpoints',
        'help.troubleshooting.jwks.ssl': 'Check SSL/TLS certificates for HTTPS endpoints',
        'help.troubleshooting.jwks.paths': 'Ensure file paths are absolute for local JWKS files',
        'help.troubleshooting.jwks.test': 'Use the JWKS Validation button to test endpoints',
        'help.troubleshooting.performance.title': 'Performance Tips',
        'help.troubleshooting.performance.cache': 'JWKS are cached for 5 minutes by default',
        'help.troubleshooting.performance.local': 'Use local JWKS files for better performance',
        'help.troubleshooting.performance.monitor': 'Monitor the Metrics tab for performance data',
        'help.troubleshooting.security.title': 'Security Best Practices',
        'help.troubleshooting.security.https': 'Always use HTTPS for JWKS endpoints',
        'help.troubleshooting.security.rotate': 'Rotate signing keys regularly',
        'help.troubleshooting.security.rules': 'Implement proper authorization rules',
        'help.troubleshooting.security.monitor': 'Monitor failed validations in the Metrics tab',
        'help.resources.title': 'Additional Resources',
        'help.resources.jwt': 'JWT Introduction',
        'help.resources.jwk': 'JWK Specification',
        'help.resources.nifi': 'Apache NiFi Docs',
        'help.footer.version': 'Version:',
        'help.footer.support': 'Support:',

        // -- context help --
        'contexthelp.toggle.aria': 'Show field help',
        'contexthelp.global.listening.port': 'TCP port the embedded HTTP/HTTPS server listens on. Changing this requires a processor restart.',
        'contexthelp.global.max.request.size': 'Maximum allowed request body size in bytes. Requests exceeding this limit are rejected with HTTP 413.',
        'contexthelp.global.queue.size': 'Maximum number of queued requests before the server starts rejecting new connections.',
        'contexthelp.global.ssl.enabled': 'Whether SSL/TLS is enabled via an SSLContextService. When set, the gateway serves HTTPS instead of HTTP.',
        'contexthelp.global.cors.origins': 'Comma-separated list of allowed CORS origins. Use * to allow all origins (not recommended for production).',
        'contexthelp.global.listening.host': 'Network interface to bind the server to. Use 0.0.0.0 for all interfaces or 127.0.0.1 for loopback only.',
        'contexthelp.route.name': 'Unique identifier for this route. Used as prefix in NiFi dynamic properties (restapi.<name>.*).',
        'contexthelp.route.enabled': 'Whether this route is active. Disabled routes are ignored during request matching.',
        'contexthelp.route.path': 'URL path pattern this route matches. Incoming requests with this path prefix are routed here.',
        'contexthelp.route.methods': 'Comma-separated HTTP methods accepted by this route (e.g. GET,POST). Empty means all methods.',
        'contexthelp.route.roles': 'Comma-separated roles required in the JWT token. The request is rejected if the token lacks any listed role.',
        'contexthelp.route.scopes': 'Comma-separated scopes required in the JWT token. The request is rejected if the token lacks any listed scope.',
        'contexthelp.route.create.flowfile': 'Whether to create a NiFi FlowFile for matched requests. When disabled, the route responds directly without passing to downstream processors.',
        'contexthelp.route.connection': 'NiFi relationship name for routing FlowFiles to the correct downstream connection on the NiFi canvas.',
        'contexthelp.route.schema': 'JSON Schema for request body validation. Requests that fail schema validation are rejected with HTTP 400.',
        'contexthelp.issuer.name': 'Unique identifier for this JWT issuer. Used as prefix in NiFi dynamic properties (issuer.<name>.*).',
        'contexthelp.issuer.jwks.type': 'How JWKS signing keys are loaded: from a remote URL, a local file, or inline content.',
        'contexthelp.issuer.uri': 'Expected value of the "iss" claim in JWT tokens. Tokens with a different issuer are rejected.',
        'contexthelp.issuer.jwks.url': 'Remote URL serving the JWKS JSON document. Keys are cached and refreshed periodically.',
        'contexthelp.issuer.jwks.file': 'Absolute file path to a local JWKS JSON file. Useful for air-gapped environments.',
        'contexthelp.issuer.jwks.content': 'Inline JWKS JSON content pasted directly. Useful for testing or single-key setups.',
        'contexthelp.issuer.audience': 'Expected "aud" claim value. When set, tokens without a matching audience are rejected.',
        'contexthelp.issuer.client.id': 'OAuth2 client ID used for token validation. Compared against the "azp" or "client_id" claim.',

        // -- legacy keys (kept for compatibility) --
        'jwt.validator.help.title': 'JWT Authenticator Help',
        'jwt.validator.metrics.title': 'JWT Validation Metrics',
        'jwt.validator.help.tab.name': 'Help'
    },
    de: {
        // -- common --
        'common.btn.delete': 'L\u00f6schen',
        'common.btn.cancel': 'Abbrechen',
        'common.btn.remove': 'Entfernen',
        'common.btn.clear': 'Leeren',
        'common.btn.edit': 'Bearbeiten',
        'common.error.prefix': 'Fehler',
        'common.error.unknown': 'Unbekannter Fehler',
        'common.error.server': 'Serverfehler (HTTP {0})',
        'common.status.enabled': 'Aktiviert',
        'common.status.disabled': 'Deaktiviert',
        'common.status.yes': 'Ja',
        'common.status.no': 'Nein',
        'common.na': 'N/V',
        'common.loading': 'Laden\u2026',

        // -- origin badges --
        'origin.badge.persisted.title': 'Aus Prozessor-Eigenschaften geladen (persistent)',
        'origin.badge.modified.title': 'In dieser Sitzung ge\u00e4ndert (noch nicht persistent)',
        'origin.badge.new.title': 'In dieser Sitzung erstellt (noch nicht persistent)',
        'origin.badge.modified': 'Ge\u00e4ndert',
        'origin.badge.new': 'Neu',

        // -- validation --
        'validation.required': 'Dieses Feld ist erforderlich.',
        'validation.url.required': 'URL ist erforderlich.',
        'validation.url.too.long': 'URL ist zu lang (maximal {0} Zeichen).',
        'validation.url.invalid': 'Ung\u00fcltiges URL-Format. Muss eine g\u00fcltige {0}-URL sein.',
        'validation.token.required': 'Token ist erforderlich.',
        'validation.token.too.short': 'Token ist zu kurz (mindestens 10 Zeichen).',
        'validation.token.too.long': 'Token ist zu lang (maximal 10000 Zeichen).',
        'validation.token.invalid.format': 'Ung\u00fcltiges Token-Format. Mindestens 2 durch Punkte getrennte Teile erwartet.',
        'validation.issuer.name.required': 'Issuer Name ist erforderlich.',
        'validation.issuer.name.too.short': 'Issuer Name muss mindestens 2 Zeichen lang sein.',
        'validation.issuer.name.too.long': 'Issuer Name ist zu lang (maximal 100 Zeichen).',
        'validation.issuer.name.invalid.chars': 'Issuer Name darf nur Buchstaben, Zahlen, Bindestriche, Unterstriche und Punkte enthalten.',
        'validation.processor.url.required': 'URL ist f\u00fcr die Prozessor-ID-Extraktion erforderlich.',
        'validation.processor.id.not.found': 'URL enth\u00e4lt keine g\u00fcltige Prozessor-ID.',
        'validation.field.issuer.name': 'Issuer Name',
        'validation.field.issuer.uri': 'Issuer URI',
        'validation.field.jwks.url': 'JWKS URL',

        // -- confirmation dialogs --
        'confirm.remove.issuer.title': 'Issuer-Konfiguration entfernen',
        'confirm.remove.issuer.message': 'Sind Sie sicher, dass Sie den Issuer \u201e{0}\u201c entfernen m\u00f6chten? Diese Aktion kann nicht r\u00fcckg\u00e4ngig gemacht werden.',
        'confirm.remove.route.title': 'Routen-Konfiguration entfernen',
        'confirm.remove.route.message': 'Sind Sie sicher, dass Sie die Route \u201e{0}\u201c entfernen m\u00f6chten? Diese Aktion kann nicht r\u00fcckg\u00e4ngig gemacht werden.',
        'confirm.clear.title': 'Formulardaten leeren',
        'confirm.clear.message': 'Sind Sie sicher, dass Sie alle Formulardaten leeren m\u00f6chten? Alle nicht gespeicherten \u00c4nderungen gehen verloren.',

        // -- issuer config --
        'issuer.heading': 'Issuer-Konfigurationen',
        'issuer.description': 'JWT Issuer f\u00fcr die Token-Validierung konfigurieren. Jeder Issuer ben\u00f6tigt einen Namen und Eigenschaften wie JWKS URL und Issuer URI.',
        'issuer.btn.add': 'Issuer hinzuf\u00fcgen',
        'issuer.btn.save': 'Issuer speichern',
        'issuer.form.name.label': 'Issuer Name',
        'issuer.form.name.placeholder': 'z.B. keycloak',
        'issuer.form.name.title': 'Eindeutiger Bezeichner f\u00fcr diese Issuer-Konfiguration.',
        'issuer.form.jwks.type.label': 'JWKS Source Type',
        'issuer.form.jwks.type.title': 'W\u00e4hlen Sie, wie JWKS Keys abgerufen werden sollen',
        'issuer.form.jwks.type.url': 'URL (Remote JWKS Endpoint)',
        'issuer.form.jwks.type.file': 'File (Lokale JWKS-Datei)',
        'issuer.form.jwks.type.memory': 'Memory (Inline JWKS Content)',
        'issuer.form.issuer.uri.label': 'Issuer URI',
        'issuer.form.issuer.uri.placeholder': 'URI des Token Issuers (muss mit dem iss-Claim \u00fcbereinstimmen)',
        'issuer.form.jwks.url.label': 'JWKS URL',
        'issuer.form.jwks.url.placeholder': 'URL des JWKS Endpoints',
        'issuer.form.jwks.file.label': 'JWKS File Path',
        'issuer.form.jwks.file.placeholder': 'Pfad zur lokalen JWKS-JSON-Datei',
        'issuer.form.jwks.content.label': 'JWKS Content',
        'issuer.form.jwks.content.placeholder': 'Inline JWKS-JSON-Inhalt',
        'issuer.form.audience.label': 'Audience',
        'issuer.form.audience.placeholder': 'Erwarteter Audience-Claim-Wert',
        'issuer.form.client.id.label': 'Client ID',
        'issuer.form.client.id.placeholder': 'Client ID f\u00fcr die Token-Validierung',
        'issuer.jwks.test.btn': 'Connection testen',
        'issuer.jwks.test.title': 'Verbindung zum JWKS Endpoint testen',
        'issuer.jwks.test.hint': 'Klicken Sie auf die Schaltfl\u00e4che, um JWKS zu validieren',
        'issuer.jwks.test.testing': 'Teste\u2026',
        'issuer.jwks.valid': 'G\u00fcltiges JWKS ({0} Keys gefunden)',
        'issuer.save.success': 'Issuer-Konfiguration erfolgreich gespeichert.',
        'issuer.save.success.standalone': 'Issuer-Konfiguration erfolgreich gespeichert (Standalone-Modus).',
        'issuer.remove.success': 'Issuer \u201e{0}\u201c erfolgreich entfernt.',
        'issuer.remove.success.standalone': 'Issuer \u201e{0}\u201c entfernt (Standalone-Modus).',
        'issuer.validate.name.required': 'Issuer Name ist erforderlich.',
        'issuer.validate.uri.required': 'Issuer URI ist erforderlich.',
        'issuer.validate.jwks.url.required': 'JWKS URL ist erforderlich bei Verwendung des URL Source Type.',
        'issuer.validate.jwks.file.required': 'JWKS File Path ist erforderlich bei Verwendung des File Source Type.',
        'issuer.validate.jwks.content.required': 'JWKS Content ist erforderlich bei Verwendung des Memory Source Type.',
        'issuer.table.name': 'Name',
        'issuer.table.jwks.source': 'JWKS Source',
        'issuer.table.type': 'Type',
        'issuer.table.issuer.uri': 'Issuer URI',
        'issuer.table.actions': 'Aktionen',
        'issuer.table.empty': 'Keine Issuer konfiguriert. Klicken Sie auf \u201eIssuer hinzuf\u00fcgen\u201c, um einen zu erstellen.',

        // -- token verifier --
        'token.input.label': 'Token eingeben',
        'token.input.placeholder': 'Token hier einf\u00fcgen\u2026',
        'token.btn.verify': 'Token \u00fcberpr\u00fcfen',
        'token.btn.clear': 'Leeren',
        'token.results.heading': '\u00dcberpr\u00fcfungsergebnisse',
        'token.status.verifying': 'Token wird \u00fcberpr\u00fcft\u2026',
        'token.status.valid': 'Token ist g\u00fcltig',
        'token.status.invalid': 'Token ist ung\u00fcltig',
        'token.status.expired': 'Token ist abgelaufen',
        'token.section.header': 'Header',
        'token.section.payload': 'Payload',
        'token.error.prefix': 'Fehler',
        'token.claim.expiration': 'Ablaufzeit',
        'token.claim.expired': '(Abgelaufen)',
        'token.claim.issuer': 'Issuer',
        'token.claim.subject': 'Betreff',

        // -- route config --
        'route.heading': 'Gateway-Routen-Konfiguration',
        'route.btn.add': 'Route hinzuf\u00fcgen',
        'route.btn.save': 'Route speichern',
        'route.export.heading': 'Eigenschaften exportieren',
        'route.export.copy': 'In Zwischenablage kopieren',
        'route.export.copied': 'Kopiert!',
        'route.table.name': 'Name',
        'route.table.connection': 'Verbindung',
        'route.table.path': 'Pfad',
        'route.table.methods': 'Methoden',
        'route.table.enabled': 'Aktiviert',
        'route.table.actions': 'Aktionen',
        'route.table.empty': 'Keine Routen konfiguriert. Klicken Sie auf \u201eRoute hinzuf\u00fcgen\u201c, um eine zu erstellen.',
        'route.form.name.label': 'Route Name',
        'route.form.name.placeholder': 'z.B. health-check',
        'route.form.name.title': 'Eindeutiger Bezeichner f\u00fcr diese Route-Konfiguration.',
        'route.form.enabled': 'Aktiviert',
        'route.form.path.label': 'Pfad',
        'route.form.path.placeholder': '/api/resource (erforderlich)',
        'route.form.roles.label': 'Erforderliche Rollen',
        'route.form.roles.placeholder': 'admin,user (kommagetrennt, optional)',
        'route.form.scopes.label': 'Erforderliche Scopes',
        'route.form.scopes.placeholder': 'read,write (kommagetrennt, optional)',
        'route.form.create.flowfile': 'FlowFile erstellen',
        'route.form.connection.label': 'NiFi Connection Name',
        'route.form.connection.placeholder': 'Connection Label auf dem NiFi Canvas',
        'route.form.schema.toggle': 'Schema Validation',
        'route.form.schema.file': 'Dateipfad',
        'route.form.schema.inline': 'Inline-JSON',
        'route.form.schema.file.placeholder': './conf/schemas/my-schema.json',
        'route.form.schema.inline.placeholder': '{"type":"object","properties":{}}',
        'route.validate.name.required': 'Routenname ist erforderlich.',
        'route.validate.name.invalid': 'Routenname darf nur alphanumerische Zeichen, Bindestriche und Unterstriche enthalten.',
        'route.validate.name.duplicate': 'Eine Route mit dem Namen \u201e{0}\u201c existiert bereits.',
        'route.validate.path.required': 'Pfad ist erforderlich.',
        'route.remove.success': 'Route \u201e{0}\u201c erfolgreich entfernt.',
        'route.remove.success.standalone': 'Route \u201e{0}\u201c entfernt (Standalone-Modus).',
        'route.info.banner': '\u00c4nderungen gelten nur f\u00fcr die aktuelle Sitzung. Um sie dauerhaft zu speichern, exportieren Sie die Eigenschaften unten und f\u00fcgen Sie sie Ihrer Prozessor-Konfiguration hinzu.',
        'route.connection.map.heading': 'NiFi-Verbindungen ({0} Beziehungen)',
        'route.connection.map.name': 'Verbindungsname',
        'route.connection.map.routes': 'Routen',
        'route.connection.map.failure': '(immer vorhanden)',
        'route.global.heading': 'Globale Einstellungen',
        'route.global.listening.port': 'Listening Port',
        'route.global.max.request.size': 'Max Request Body Size',
        'route.global.queue.size': 'Queue Size',
        'route.global.ssl.enabled': 'SSL Enabled',
        'route.global.cors.origins': 'CORS Allowed Origins',
        'route.global.listening.host': 'Listening Host',

        // -- endpoint tester --
        'tester.heading': 'Endpunkt-Tester',
        'tester.form.route': 'Route',
        'tester.form.method': 'Methode',
        'tester.form.token': 'Autorisierungs-Token',
        'tester.form.token.placeholder': 'Bearer eyJ\u2026',
        'tester.form.body': 'Anfragek\u00f6rper',
        'tester.form.body.placeholder': '{"key": "value"}',
        'tester.btn.send': 'Anfrage senden',
        'tester.btn.sending': 'Sende\u2026',
        'tester.routes.loading': 'Lade Routen\u2026',
        'tester.routes.none': 'Keine Routen verf\u00fcgbar',
        'tester.routes.failed': 'Routen konnten nicht geladen werden',
        'tester.response.heading': 'Antwort',
        'tester.response.status': 'Status: {0}',
        'tester.response.error': 'Fehler',
        'tester.response.no.headers': 'Keine Header',
        'tester.error.no.route': 'Bitte w\u00e4hlen Sie eine Route',
        'tester.error.request.failed': 'Anfrage fehlgeschlagen: {0}',

        // -- metrics --
        'metrics.btn.refresh': 'Aktualisieren',
        'metrics.btn.export': 'Exportieren',
        'metrics.last.updated': 'Zuletzt aktualisiert: {0}',
        'metrics.last.updated.never': 'Zuletzt aktualisiert: Nie',
        'metrics.refreshing': 'Aktualisiere\u2026',
        'metrics.export.heading': 'Exportformat:',
        'metrics.gateway.heading': 'Gateway-Metriken',
        'metrics.section.token.validation': 'Token-Validierung',
        'metrics.section.http.security': 'HTTP-Sicherheit',
        'metrics.section.gateway.events': 'Gateway-Ereignisse',
        'metrics.no.data': 'Keine Daten verf\u00fcgbar',
        'metrics.section.total': 'Gesamt: {0}',
        'metrics.error.load': 'Metriken konnten nicht geladen werden.',
        'metrics.error.not.available.title': 'Metriken nicht verf\u00fcgbar',
        'metrics.error.not.available': 'Metriken sind nur f\u00fcr REST-API-Gateway-Prozessoren verf\u00fcgbar.',

        // -- chip input --
        'chip.methods.label': 'Methoden',
        'chip.methods.placeholder': 'Tippen, um Methode hinzuzuf\u00fcgen\u2026',
        'chip.methods.aria': 'HTTP-Methode hinzuf\u00fcgen',
        'chip.methods.remove.aria': '{0} entfernen',

        // -- tabs --
        'tab.configuration': 'Konfiguration',
        'tab.token.verification': 'Token-\u00dcberpr\u00fcfung',
        'tab.endpoint.config': 'Endpunkt-Konfiguration',
        'tab.endpoint.tester': 'Endpunkt-Tester',
        'tab.issuer.config': 'Issuer-Konfiguration',
        'tab.metrics': 'Metriken',
        'tab.help': 'Hilfe',

        // -- app --
        'app.loading': 'Lade Komponenten-UI\u2026',
        'app.gateway.no.issuer.service': 'Kein JWT Issuer Config Service ist mit diesem Gateway-Prozessor verkn\u00fcpft. Konfigurieren Sie die <strong>JWT Issuer Config Service</strong>-Eigenschaft in den Prozessor-Einstellungen, um die Issuer-Verwaltung hier zu aktivieren.',
        'app.gateway.no.token.service': 'Die Token-Verification erfordert einen verkn\u00fcpften JWT Issuer Config Service. Konfigurieren Sie zuerst die Service-Referenz in den Prozessor-Einstellungen.',

        // -- help --
        'help.heading': 'Komponenten-Hilfe',
        'help.jwt.getting.started.title': 'Erste Schritte',
        'help.jwt.getting.started.intro': 'Der MultiIssuerJWTTokenAuthenticator-Prozessor validiert JWT Tokens von mehreren Issuern. Befolgen Sie diese Schritte zur Konfiguration:',
        'help.jwt.getting.started.step1': 'Mindestens eine Issuer-Konfiguration hinzuf\u00fcgen',
        'help.jwt.getting.started.step2': 'JWKS URL oder File Path f\u00fcr jeden Issuer konfigurieren',
        'help.jwt.getting.started.step3': 'Autorisierungsregeln einrichten (optional)',
        'help.jwt.getting.started.step4': 'Konfiguration \u00fcber den Token Verification Tab testen',
        'help.jwt.issuer.config.title': 'Issuer-Konfiguration',
        'help.jwt.issuer.config.dynamic.title': 'Dynamische Eigenschaften',
        'help.jwt.issuer.config.dynamic.desc': 'Jeder Issuer wird \u00fcber dynamische Properties mit folgendem Muster konfiguriert:',
        'help.jwt.issuer.config.examples.title': 'Beispielkonfigurationen',
        'help.jwt.auth.rules.title': 'Autorisierungsregeln',
        'help.jwt.auth.rules.intro': 'Zugriff basierend auf JWT-Claims mit diesen Eigenschaften steuern:',
        'help.jwt.auth.scopes.title': 'Erforderliche Scopes',
        'help.jwt.auth.scopes.desc': 'Scopes angeben, die im Token vorhanden sein m\u00fcssen:',
        'help.jwt.auth.roles.title': 'Erforderliche Rollen',
        'help.jwt.auth.roles.desc': 'Rollen angeben, die im Token vorhanden sein m\u00fcssen:',
        'help.jwt.auth.flowfile.title': 'FlowFile-Attribute',
        'help.jwt.auth.flowfile.desc': 'Der Prozessor f\u00fcgt FlowFiles diese Attribute hinzu:',
        'help.jwt.auth.flowfile.subject': 'Token Subject (User)',
        'help.jwt.auth.flowfile.issuer': 'Token Issuer',
        'help.jwt.auth.flowfile.scopes': 'Leerzeichen-getrennte Scopes',
        'help.jwt.auth.flowfile.roles': 'Leerzeichen-getrennte Rollen',
        'help.jwt.auth.flowfile.authorized': 'true/false basierend auf Regeln',
        'help.jwt.token.verification.title': 'Token-\u00dcberpr\u00fcfung',
        'help.jwt.token.verification.intro': 'Verwenden Sie den Token-\u00dcberpr\u00fcfung-Tab, um JWT-Token zu testen:',
        'help.jwt.token.verification.step1': 'JWT-Token in das Eingabefeld einf\u00fcgen',
        'help.jwt.token.verification.step2': 'Auf \u201eToken \u00fcberpr\u00fcfen\u201c klicken',
        'help.jwt.token.verification.step3': 'Validierungsergebnisse \u00fcberpr\u00fcfen',
        'help.jwt.token.verification.issues.title': 'H\u00e4ufige Probleme',
        'help.jwt.token.verification.issue.signature': '\u00dcberpr\u00fcfen Sie, ob die JWKS-URL korrekt ist',
        'help.jwt.token.verification.issue.expired': 'Neues Token generieren',
        'help.jwt.token.verification.issue.unknown': 'Issuer-Konfiguration hinzuf\u00fcgen',
        'help.jwt.token.verification.issue.scopes': 'Stellen Sie sicher, dass das Token die erforderlichen Scopes enth\u00e4lt',
        'help.gateway.title': 'REST-API-Gateway',
        'help.gateway.intro': 'Der RestApiGatewayProcessor bietet ein sicheres REST-API-Gateway mit JWT-Authentifizierung und routenbasierter Zugriffskontrolle.',
        'help.gateway.features.title': 'Hauptfunktionen',
        'help.gateway.features.https': 'Eingebetteter HTTPS/HTTP-Server mit konfigurierbarem Port',
        'help.gateway.features.routing': 'Routenbasiertes Request-Matching mit Pfadmustern',
        'help.gateway.features.auth': 'Rollen- und Scope-Anforderungen pro Route',
        'help.gateway.features.cors': 'CORS-Unterst\u00fctzung mit konfigurierbaren Allowed Origins',
        'help.gateway.features.limits': 'Request Body Size Limits und Queue Management',
        'help.gateway.tabs.title': 'Tabs',
        'help.gateway.tabs.endpoint': 'Aktive Routen, globale Einstellungen und Sicherheitskonfiguration anzeigen',
        'help.gateway.tabs.tester': 'Testanfragen senden, um Routenzugriff und Authentifizierung zu \u00fcberpr\u00fcfen',
        'help.gateway.tabs.issuer': 'JWT Issuer-Einstellungen des verkn\u00fcpften Controller Service verwalten',
        'help.gateway.tabs.token': 'JWT Tokens einf\u00fcgen und gegen konfigurierte Issuer verifizieren',
        'help.gateway.tabs.metrics': 'Token-Validierung, HTTP-Sicherheitsereignisse und Gateway-Aktivit\u00e4t \u00fcberwachen',
        'help.troubleshooting.title': 'Fehlerbehebung',
        'help.troubleshooting.jwks.title': 'JWKS-Ladeprobleme',
        'help.troubleshooting.jwks.network': 'Network Connectivity zu JWKS Endpoints \u00fcberpr\u00fcfen',
        'help.troubleshooting.jwks.ssl': 'SSL/TLS-Zertifikate f\u00fcr HTTPS Endpoints pr\u00fcfen',
        'help.troubleshooting.jwks.paths': 'Absolute File Paths f\u00fcr lokale JWKS-Dateien sicherstellen',
        'help.troubleshooting.jwks.test': 'Den JWKS Validation Button zum Testen von Endpoints verwenden',
        'help.troubleshooting.performance.title': 'Leistungstipps',
        'help.troubleshooting.performance.cache': 'JWKS werden standardm\u00e4\u00dfig 5 Minuten zwischengespeichert',
        'help.troubleshooting.performance.local': 'Lokale JWKS-Dateien f\u00fcr bessere Leistung verwenden',
        'help.troubleshooting.performance.monitor': 'Den Metriken-Tab f\u00fcr Leistungsdaten \u00fcberwachen',
        'help.troubleshooting.security.title': 'Sicherheits-Best-Practices',
        'help.troubleshooting.security.https': 'Immer HTTPS f\u00fcr JWKS-Endpunkte verwenden',
        'help.troubleshooting.security.rotate': 'Signing Keys regelm\u00e4\u00dfig rotieren',
        'help.troubleshooting.security.rules': 'Ordnungsgem\u00e4\u00dfe Autorisierungsregeln implementieren',
        'help.troubleshooting.security.monitor': 'Fehlgeschlagene Validierungen im Metriken-Tab \u00fcberwachen',
        'help.resources.title': 'Zus\u00e4tzliche Ressourcen',
        'help.resources.jwt': 'JWT-Einf\u00fchrung',
        'help.resources.jwk': 'JWK-Spezifikation',
        'help.resources.nifi': 'Apache NiFi-Dokumentation',
        'help.footer.version': 'Version:',
        'help.footer.support': 'Support:',

        // -- context help --
        'contexthelp.toggle.aria': 'Feldhilfe anzeigen',
        'contexthelp.global.listening.port': 'TCP Port, auf dem der eingebettete HTTP/HTTPS Server lauscht. Eine \u00c4nderung erfordert einen Prozessor-Neustart.',
        'contexthelp.global.max.request.size': 'Maximale Request Body Size in Bytes. Requests, die dieses Limit \u00fcberschreiten, werden mit HTTP 413 abgelehnt.',
        'contexthelp.global.queue.size': 'Maximale Anzahl wartender Requests, bevor der Server neue Connections ablehnt.',
        'contexthelp.global.ssl.enabled': 'Ob SSL/TLS \u00fcber einen SSLContextService aktiviert ist. Wenn gesetzt, liefert das Gateway HTTPS statt HTTP.',
        'contexthelp.global.cors.origins': 'Kommagetrennte Liste erlaubter CORS Origins. Verwenden Sie * f\u00fcr alle Origins (nicht empfohlen f\u00fcr Produktion).',
        'contexthelp.global.listening.host': 'Netzwerk-Interface f\u00fcr die Server-Bindung. 0.0.0.0 f\u00fcr alle Interfaces oder 127.0.0.1 nur f\u00fcr Loopback.',
        'contexthelp.route.name': 'Eindeutiger Bezeichner f\u00fcr diese Route. Wird als Pr\u00e4fix in NiFi Dynamic Properties verwendet (restapi.<name>.*).',
        'contexthelp.route.enabled': 'Ob diese Route aktiv ist. Deaktivierte Routen werden beim Request Matching ignoriert.',
        'contexthelp.route.path': 'URL Path Pattern, das diese Route matcht. Eingehende Requests mit diesem Path Prefix werden hierher geleitet.',
        'contexthelp.route.methods': 'Kommagetrennte HTTP Methods, die von dieser Route akzeptiert werden (z.B. GET,POST). Leer bedeutet alle Methods.',
        'contexthelp.route.roles': 'Kommagetrennte Roles, die im JWT Token erforderlich sind. Der Request wird abgelehnt, wenn dem Token eine aufgef\u00fchrte Role fehlt.',
        'contexthelp.route.scopes': 'Kommagetrennte Scopes, die im JWT Token erforderlich sind. Der Request wird abgelehnt, wenn dem Token ein aufgef\u00fchrter Scope fehlt.',
        'contexthelp.route.create.flowfile': 'Ob ein NiFi FlowFile f\u00fcr matchende Requests erstellt wird. Wenn deaktiviert, antwortet die Route direkt ohne Weiterleitung.',
        'contexthelp.route.connection': 'NiFi Relationship Name f\u00fcr die Weiterleitung von FlowFiles an die korrekte Downstream Connection.',
        'contexthelp.route.schema': 'JSON Schema f\u00fcr Request Body Validation. Requests, die die Schema Validation nicht bestehen, werden mit HTTP 400 abgelehnt.',
        'contexthelp.issuer.name': 'Eindeutiger Bezeichner f\u00fcr diesen JWT Issuer. Wird als Pr\u00e4fix in NiFi Dynamic Properties verwendet (issuer.<name>.*).',
        'contexthelp.issuer.jwks.type': 'Wie JWKS Signing Keys geladen werden: von einer Remote URL, einer lokalen Datei oder als Inline Content.',
        'contexthelp.issuer.uri': 'Erwarteter Wert des "iss" Claims in JWT Tokens. Tokens mit einem anderen Issuer werden abgelehnt.',
        'contexthelp.issuer.jwks.url': 'Remote URL, die das JWKS JSON-Dokument bereitstellt. Keys werden gecacht und periodisch aktualisiert.',
        'contexthelp.issuer.jwks.file': 'Absoluter File Path zu einer lokalen JWKS JSON-Datei. N\u00fctzlich f\u00fcr Air-Gapped Environments.',
        'contexthelp.issuer.jwks.content': 'Inline JWKS JSON Content direkt eingef\u00fcgt. N\u00fctzlich f\u00fcr Tests oder Single-Key Setups.',
        'contexthelp.issuer.audience': 'Erwarteter "aud" Claim-Wert. Wenn gesetzt, werden Tokens ohne passende Audience abgelehnt.',
        'contexthelp.issuer.client.id': 'OAuth2 Client ID f\u00fcr die Token Validation. Wird mit dem "azp"- oder "client_id"-Claim verglichen.',

        // -- legacy keys --
        'jwt.validator.help.title': 'JWT Authenticator-Hilfe',
        'jwt.validator.metrics.title': 'JWT Validation Metrics',
        'jwt.validator.help.tab.name': 'Hilfe'
    }
};

const browserLang = typeof navigator === 'undefined' ? 'en' : (navigator.language || 'en');
export const lang = browserLang.startsWith('de') ? 'de' : 'en';

/**
 * Translate a key to the current browser language.
 * Supports `{0}`, `{1}` parameter substitution.
 * @param {string} key  i18n key
 * @param {...*} params  substitution values
 * @returns {string}
 */
export const t = (key, ...params) => {
    let text = TRANSLATIONS[lang]?.[key]
        ?? TRANSLATIONS.en[key]
        ?? key;
    for (let i = 0; i < params.length; i++) {
        text = text.replace(new RegExp(`\\{${i}\\}`, 'g'), params[i]);
    }
    return text;
};

// ---------------------------------------------------------------------------
// HTML sanitisation
// ---------------------------------------------------------------------------

/**
 * Escapes HTML entities to prevent XSS.
 * @param {string} html  raw string
 * @returns {string}  safe string
 */
export const sanitizeHtml = (html) => {
    if (!html) return '';
    const d = document.createElement('div');
    d.textContent = html;
    return d.innerHTML;
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Format a number with locale-aware thousands separator.
 * @param {number|null|undefined} n
 * @returns {string}
 */
export const formatNumber = (n) => {
    if (n == null) return '';
    return new Intl.NumberFormat('en-US').format(n);
};

/**
 * Format a Date (or date-string) to a locale string.
 * @param {Date|string|null|undefined} d
 * @returns {string}
 */
export const formatDate = (d) => {
    if (!d) return '';
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return String(d);
        return date.toLocaleString();
    } catch {
        return String(d);
    }
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-useless-escape, max-len
const RE_URL = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([\/?#].*)?$/;
const RE_SAFE_NAME = /^[a-zA-Z0-9._-]+$/;
const RE_PROCESSOR_ID = /\/processors\/([a-f0-9-]+)/i;

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid
 * @property {string}  [error]
 * @property {string}  [sanitizedValue]
 */

/**
 * Validate that a value is present and non-empty.
 * @param {*} value
 * @param {boolean} [required=true]
 * @returns {ValidationResult}
 */
export const validateRequired = (value, required = true) => {
    const s = value == null ? '' : String(value).trim();
    const empty = s === '' || s.toLowerCase() === 'null'
        || s.toLowerCase() === 'undefined';
    if (required && empty) {
        return { isValid: false, error: t('validation.required'), sanitizedValue: '' };
    }
    return { isValid: true, sanitizedValue: s };
};

/**
 * Validate a URL string.
 * @param {string} url
 * @param {Object} [opts]
 * @param {boolean} [opts.httpsOnly=false]
 * @param {number}  [opts.maxLength=2048]
 * @returns {ValidationResult}
 */
export const validateUrl = (url, opts = {}) => {
    const { httpsOnly = false, maxLength = 2048 } = opts;
    const req = validateRequired(url);
    if (!req.isValid) return { isValid: false, error: t('validation.url.required'), sanitizedValue: '' };
    const s = req.sanitizedValue;
    if (s.length > maxLength) {
        return { isValid: false, error: t('validation.url.too.long', maxLength), sanitizedValue: s };
    }
    // eslint-disable-next-line no-useless-escape, max-len
    const httpsPattern = /^https:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*([\/?#].*)?$/;
    const pattern = httpsOnly ? httpsPattern : RE_URL;
    if (!pattern.test(s)) {
        const proto = httpsOnly ? 'HTTPS' : 'HTTP/HTTPS';
        return { isValid: false, error: t('validation.url.invalid', proto), sanitizedValue: s };
    }
    return { isValid: true, sanitizedValue: s };
};

/**
 * Validate JWT token format.
 * @param {string} token
 * @returns {ValidationResult}
 */
export const validateJwtToken = (token) => {
    const req = validateRequired(token);
    if (!req.isValid) return { isValid: false, error: t('validation.token.required'), sanitizedValue: '' };
    const s = req.sanitizedValue;
    if (s.length < 10) return { isValid: false, error: t('validation.token.too.short'), sanitizedValue: s };
    if (s.length > 10000) return { isValid: false, error: t('validation.token.too.long'), sanitizedValue: s };
    if (s.split('.').length < 2) {
        return { isValid: false, error: t('validation.token.invalid.format'), sanitizedValue: s };
    }
    return { isValid: true, sanitizedValue: s };
};

/**
 * Validate issuer name.
 * @param {string} name
 * @returns {ValidationResult}
 */
export const validateIssuerName = (name) => {
    const req = validateRequired(name);
    if (!req.isValid) return { isValid: false, error: t('validation.issuer.name.required'), sanitizedValue: '' };
    const s = req.sanitizedValue;
    if (s.length < 2) return { isValid: false, error: t('validation.issuer.name.too.short'), sanitizedValue: s };
    if (s.length > 100) return { isValid: false, error: t('validation.issuer.name.too.long'), sanitizedValue: s };
    if (!RE_SAFE_NAME.test(s)) {
        return { isValid: false, error: t('validation.issuer.name.invalid.chars'), sanitizedValue: s };
    }
    return { isValid: true, sanitizedValue: s };
};

/**
 * Extract a NiFi processor UUID from a URL.
 * @param {string} url
 * @returns {ValidationResult}
 */
export const validateProcessorIdFromUrl = (url) => {
    const req = validateRequired(url);
    if (!req.isValid) return { isValid: false, error: t('validation.processor.url.required'), sanitizedValue: '' };
    const match = RE_PROCESSOR_ID.exec(req.sanitizedValue);
    if (!match) return { isValid: false, error: t('validation.processor.id.not.found'), sanitizedValue: '' };
    return { isValid: true, sanitizedValue: match[1].toLowerCase() };
};

/**
 * Validate complete issuer config form data.
 * @param {Object} fd  form data
 * @returns {ValidationResult}
 */
export const validateIssuerConfig = (fd) => {
    const errors = [];
    const r1 = validateIssuerName(fd.issuerName);
    if (!r1.isValid) errors.push(`${t('validation.field.issuer.name')}: ${r1.error}`);
    const r2 = validateUrl(fd.issuer, { httpsOnly: false });
    if (!r2.isValid) errors.push(`${t('validation.field.issuer.uri')}: ${r2.error}`);
    const r3 = validateUrl(fd['jwks-url'], { httpsOnly: false });
    if (!r3.isValid) errors.push(`${t('validation.field.jwks.url')}: ${r3.error}`);
    if (errors.length > 0) return { isValid: false, error: errors.join(' ') };
    return { isValid: true };
};

// ---------------------------------------------------------------------------
// UI error / success display
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable error message from various error shapes.
 * @param {Object|Error|null} error
 * @returns {string}
 */
const extractErrorMessage = (error) => {
    if (!error) return t('common.error.unknown');
    if (error.responseJSON?.message) return error.responseJSON.message;
    if (error.responseJSON?.error) return error.responseJSON.error;
    if (error.responseText) {
        try {
            const parsed = JSON.parse(error.responseText);
            if (parsed.message) return parsed.message;
            if (parsed.error) return parsed.error;
        } catch { /* not JSON */ }
        // HTML responses (e.g., Jetty error pages) — show status instead of raw markup
        if (error.responseText.trimStart().startsWith('<')) {
            return t('common.error.server', error.status || 'unknown');
        }
        return error.responseText;
    }
    return error.statusText || error.message || t('common.error.unknown');
};

/**
 * Show an error message inside a container element.
 * @param {HTMLElement} el  target container
 * @param {Object|Error|null} error
 * @param {Object} [i18n]  optional i18n map (unused keys kept for compat)
 * @param {string} [prefixKey]
 */
export const displayUiError = (el, error, i18n = {}, prefixKey = 'processor.jwt.validationError') => {
    const msg = extractErrorMessage(error);
    const prefix = i18n[prefixKey] || t('common.error.prefix');
    const target = el?.[0] || el;
    if (!target) return;
    target.innerHTML = `
        <div class="error-message" role="alert" aria-live="assertive">
            <div class="error-content">
                <strong>${sanitizeHtml(prefix)}:</strong> ${sanitizeHtml(msg)}
            </div>
        </div>`;
};

/**
 * Show a success message inside a container element.
 * @param {HTMLElement} el  target container
 * @param {string} message
 */
export const displayUiSuccess = (el, message) => {
    const target = el?.[0] || el;
    if (!target) return;
    target.innerHTML = `
        <div class="success-message" role="status" aria-live="polite">
            <div class="success-content">${sanitizeHtml(message)}</div>
        </div>`;
    setTimeout(() => {
        const msg = target.querySelector('.success-message');
        if (msg) msg.remove();
    }, 5000);
};

/**
 * Create an XHR-like error object for API error handling.
 * @param {Object|null} xhr
 * @returns {{status: number, statusText: string, responseText: string}}
 */
export const createXhrErrorObject = (xhr) => {
    if (!xhr) return { status: 0, statusText: t('common.error.unknown'), responseText: '' };
    return {
        status: xhr.status,
        statusText: xhr.statusText || t('common.error.unknown'),
        responseText: xhr.responseText || ''
    };
};

// ---------------------------------------------------------------------------
// Confirmation dialog (native <dialog>)
// ---------------------------------------------------------------------------

/**
 * Show a confirmation dialog.  Returns a Promise<boolean>.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.confirmText]
 * @param {string} [opts.cancelText]
 * @param {Function} [opts.onConfirm]
 * @returns {Promise<boolean>}
 */
export const showConfirmationDialog = ({
    title,
    message,
    confirmText = t('common.btn.delete'),
    cancelText = t('common.btn.cancel'),
    onConfirm
}) => new Promise((resolve) => {
    // Remove existing dialogs
    for (const d of document.querySelectorAll('.confirmation-dialog')) d.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'confirmation-dialog dialog-danger show';
    wrapper.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
            <div class="dialog-header"><h3 class="dialog-title">${sanitizeHtml(title)}</h3></div>
            <div class="dialog-body"><p class="dialog-message">${sanitizeHtml(message)}</p></div>
            <div class="dialog-footer">
                <button class="cancel-button">${sanitizeHtml(cancelText)}</button>
                <button class="confirm-button danger-button">${sanitizeHtml(confirmText)}</button>
            </div>
        </div>`;
    document.body.appendChild(wrapper);

    const close = (confirmed) => {
        wrapper.remove();
        if (confirmed && onConfirm) onConfirm();
        resolve(confirmed);
    };

    wrapper.querySelector('.confirm-button').addEventListener('click', () => close(true));
    wrapper.querySelector('.cancel-button').addEventListener('click', () => close(false));
    wrapper.querySelector('.dialog-overlay').addEventListener('click', () => close(false));
    wrapper.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
    });
    wrapper.querySelector('.cancel-button').focus();
});

/**
 * Show a Remove Issuer confirmation dialog.
 * @param {string} issuerName
 * @param {Function} onConfirm
 * @returns {Promise<boolean>}
 */
export const confirmRemoveIssuer = (issuerName, onConfirm) => showConfirmationDialog({
    title: t('confirm.remove.issuer.title'),
    message: t('confirm.remove.issuer.message', issuerName),
    confirmText: t('common.btn.remove'),
    cancelText: t('common.btn.cancel'),
    onConfirm
});

/**
 * Show a Remove Route confirmation dialog.
 * @param {string} routeName
 * @param {Function} onConfirm
 * @returns {Promise<boolean>}
 */
export const confirmRemoveRoute = (routeName, onConfirm) => showConfirmationDialog({
    title: t('confirm.remove.route.title'),
    message: t('confirm.remove.route.message', routeName),
    confirmText: t('common.btn.remove'),
    cancelText: t('common.btn.cancel'),
    onConfirm
});

/**
 * Show a Clear Form confirmation dialog.
 * @param {Function} onConfirm
 * @returns {Promise<boolean>}
 */
export const confirmClearForm = (onConfirm) => showConfirmationDialog({
    title: t('confirm.clear.title'),
    message: t('confirm.clear.message'),
    confirmText: t('common.btn.clear'),
    cancelText: t('common.btn.cancel'),
    onConfirm
});
