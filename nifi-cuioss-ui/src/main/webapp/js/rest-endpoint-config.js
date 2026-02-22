'use strict';

/**
 * Gateway route configuration CRUD editor component.
 * Reads route configuration from processor properties ({@code restapi.*})
 * and provides add/edit/remove operations following the issuer-config.js pattern.
 *
 * @module js/rest-endpoint-config
 */

import * as api from './api.js';
import {
    sanitizeHtml, displayUiError, displayUiSuccess, confirmRemoveRoute,
    validateProcessorIdFromUrl
} from './utils.js';

// Counter for unique form field IDs
let formCounter = 0;

const SAMPLE = {
    name: 'sample-route',
    props: {
        path: '/api/sample',
        methods: 'GET,POST',
        enabled: 'true',
        'required-roles': '',
        'required-scopes': '',
        schema: ''
    }
};

const SCHEMA_PLACEHOLDER = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "value": { "type": "number" }
  },
  "required": ["name"]
}`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the route configuration CRUD editor inside the given element.
 * @param {HTMLElement} element  the #endpoint-config pane
 */
export const init = async (element) => {
    if (!element || element.querySelector('.route-config-editor')) return;

    const componentId = getComponentIdFromUrl(globalThis.location.href);
    const container = document.createElement('div');
    container.className = 'route-config-editor';
    element.appendChild(container);

    container.innerHTML = `
        <h2>Gateway Route Configuration</h2>
        <div class="global-settings-display"></div>
        <div class="global-error-messages route-form-error-messages hidden"
             role="alert" aria-live="assertive"></div>
        <div class="routes-container"></div>`;

    const routesContainer = container.querySelector('.routes-container');

    // "Add Route" button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-route-button';
    addBtn.textContent = 'Add Route';
    addBtn.addEventListener('click', () => {
        addRouteForm(routesContainer, `${SAMPLE.name}-${Date.now()}`,
            SAMPLE.props, componentId);
    });
    container.appendChild(addBtn);

    // Load existing config
    await loadExistingConfig(container, routesContainer, componentId);
};

export const cleanup = () => { /* no persistent resources */ };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getComponentIdFromUrl = (url) => {
    const r = validateProcessorIdFromUrl(url);
    return r.isValid ? r.sanitizedValue : '';
};

const ROUTE_PREFIX = 'restapi.';

const parseRouteProperties = (properties) => {
    const out = {};
    for (const [key, value] of Object.entries(properties)) {
        if (!key.startsWith(ROUTE_PREFIX)) continue;
        const remainder = key.slice(ROUTE_PREFIX.length);
        const dot = remainder.indexOf('.');
        if (dot > 0) {
            const routeName = remainder.slice(0, dot);
            const prop = remainder.slice(dot + 1);
            if (!out[routeName]) out[routeName] = {};
            out[routeName][prop] = value;
        }
    }
    return out;
};

const GLOBAL_SETTINGS_KEYS = {
    'rest.gateway.listening.port': 'Listening Port',
    'rest.gateway.max.request.size': 'Max Request Body Size',
    'rest.gateway.request.queue.size': 'Queue Size',
    'rest.gateway.ssl.context.service': 'SSL Enabled',
    'rest.gateway.cors.allowed.origins': 'CORS Allowed Origins',
    'rest.gateway.listening.host': 'Listening Host'
};

const renderGlobalSettings = (container, properties) => {
    const settingsEl = container.querySelector('.global-settings-display');
    const rows = [];
    for (const [key, label] of Object.entries(GLOBAL_SETTINGS_KEYS)) {
        const value = properties[key];
        let display;
        if (key === 'rest.gateway.ssl.context.service') {
            display = (value && value.trim()) ? 'Yes' : 'No';
        } else if (key === 'rest.gateway.max.request.size') {
            display = formatBytes(value ? parseInt(value, 10) : null);
        } else {
            display = value || 'N/A';
        }
        rows.push(`<tr><td>${sanitizeHtml(label)}</td><td>${sanitizeHtml(display)}</td></tr>`);
    }
    settingsEl.innerHTML = `
        <h3>Global Settings</h3>
        <table class="config-table">
            <tbody>${rows.join('')}</tbody>
        </table>`;
};

const formatBytes = (bytes) => {
    if (bytes == null || isNaN(bytes)) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
};

const loadExistingConfig = async (container, routesContainer, componentId) => {
    if (!componentId) {
        addRouteForm(routesContainer, SAMPLE.name, SAMPLE.props, componentId);
        return;
    }
    try {
        const res = await api.getComponentProperties(componentId);
        const props = res.properties || {};
        renderGlobalSettings(container, props);
        const routes = parseRouteProperties(props);
        for (const name of Object.keys(routes)) {
            addRouteForm(routesContainer, name, routes[name], componentId);
        }
    } catch {
        addRouteForm(routesContainer, SAMPLE.name, SAMPLE.props, componentId);
    }
};

// ---------------------------------------------------------------------------
// Form creation
// ---------------------------------------------------------------------------

const addRouteForm = (container, routeName, properties, componentId) => {
    const idx = formCounter++;
    const form = document.createElement('div');
    form.className = 'route-form';

    const enabledVal = properties?.enabled !== 'false';

    // ---- header (name + enabled + remove) ----
    const header = document.createElement('div');
    header.className = 'form-header';
    header.innerHTML = `
        <label for="route-name-${idx}">Route Name:</label>
        <input type="text" id="route-name-${idx}" class="route-name"
               placeholder="e.g., health-check"
               title="Unique identifier for this route configuration."
               aria-label="Route Name"
               value="${sanitizeHtml(routeName || '')}">
        <label class="route-enabled-label" for="route-enabled-${idx}">
            <input type="checkbox" id="route-enabled-${idx}" class="route-enabled"
                   ${enabledVal ? 'checked' : ''}
                   aria-label="Route Enabled">
            Enabled
        </label>
        <button class="remove-route-button"
                title="Delete this route configuration">Remove</button>`;
    form.appendChild(header);

    header.querySelector('.remove-route-button').addEventListener('click', async () => {
        const name = header.querySelector('.route-name').value || 'Unnamed Route';
        await confirmRemoveRoute(name, () => removeRoute(form, name));
    });

    // ---- form fields ----
    const fields = document.createElement('div');
    fields.className = 'form-fields';
    form.appendChild(fields);

    addField({ container: fields, idx, name: 'path', label: 'Path',
        placeholder: '/api/resource (required)',
        value: properties?.path });
    addField({ container: fields, idx, name: 'methods', label: 'Methods',
        placeholder: 'GET,POST,PUT,DELETE (comma-separated)',
        value: properties?.methods });
    addField({ container: fields, idx, name: 'required-roles', label: 'Required Roles',
        placeholder: 'admin,user (comma-separated, optional)',
        value: properties?.['required-roles'] });
    addField({ container: fields, idx, name: 'required-scopes', label: 'Required Scopes',
        placeholder: 'read,write (comma-separated, optional)',
        value: properties?.['required-scopes'] });
    addTextArea({ container: fields, idx, name: 'schema', label: 'JSON Schema',
        placeholder: SCHEMA_PLACEHOLDER,
        value: properties?.schema });

    // ---- error + save ----
    const errorContainer = document.createElement('div');
    errorContainer.className = 'route-form-error-messages';
    errorContainer.setAttribute('role', 'alert');
    errorContainer.setAttribute('aria-live', 'assertive');
    form.appendChild(errorContainer);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-route-button';
    saveBtn.textContent = 'Save Route';
    saveBtn.addEventListener('click', () => {
        errorContainer.innerHTML = '';
        saveRoute(form, errorContainer, componentId);
    });
    form.appendChild(saveBtn);

    container.appendChild(form);
};

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

const addField = ({ container, idx, name, label, placeholder, value }) => {
    const div = document.createElement('div');
    div.className = `form-field field-container-${name}`;
    div.innerHTML = `
        <label for="field-${name}-${idx}">${sanitizeHtml(label)}:</label>
        <input type="text" id="field-${name}-${idx}" name="${name}"
               class="field-${name} form-input route-config-field"
               placeholder="${sanitizeHtml(placeholder)}"
               value="${sanitizeHtml(value || '')}"
               aria-label="${sanitizeHtml(label)}">`;
    container.appendChild(div);
};

const addTextArea = ({ container, idx, name, label, placeholder, value }) => {
    const div = document.createElement('div');
    div.className = `form-field field-container-${name}`;
    div.innerHTML = `
        <label for="field-${name}-${idx}">${sanitizeHtml(label)}:</label>
        <textarea id="field-${name}-${idx}" name="${name}"
                  class="field-${name} form-input route-config-field"
                  placeholder="${sanitizeHtml(placeholder)}"
                  rows="5" aria-label="${sanitizeHtml(label)}"
        >${sanitizeHtml(value || '')}</textarea>`;
    container.appendChild(div);
};

// ---------------------------------------------------------------------------
// Save / Remove
// ---------------------------------------------------------------------------

const extractFormFields = (form) => {
    const q = (sel) => form.querySelector(sel)?.value?.trim() || '';
    return {
        routeName: q('.route-name'),
        path: q('.field-path'),
        methods: q('.field-methods'),
        enabled: form.querySelector('.route-enabled')?.checked !== false,
        'required-roles': q('.field-required-roles'),
        'required-scopes': q('.field-required-scopes'),
        schema: q('.field-schema')
    };
};

const validateFormData = (f) => {
    if (!f.routeName) return { isValid: false, error: new Error('Route name is required.') };
    if (!f.path) return { isValid: false, error: new Error('Path is required.') };
    return { isValid: true };
};

const buildPropertyUpdates = (name, f) => {
    const u = {};
    u[`${ROUTE_PREFIX}${name}.path`] = f.path;
    u[`${ROUTE_PREFIX}${name}.enabled`] = String(f.enabled);
    if (f.methods) u[`${ROUTE_PREFIX}${name}.methods`] = f.methods;
    if (f['required-roles']) u[`${ROUTE_PREFIX}${name}.required-roles`] = f['required-roles'];
    if (f['required-scopes']) u[`${ROUTE_PREFIX}${name}.required-scopes`] = f['required-scopes'];
    if (f.schema) u[`${ROUTE_PREFIX}${name}.schema`] = f.schema;
    return u;
};

const saveRoute = async (form, errEl, componentId) => {
    const f = extractFormFields(form);
    const v = validateFormData(f);
    if (!v.isValid) { displayUiError(errEl, v.error, {}, 'routeConfigEditor.error.title'); return; }
    const updates = buildPropertyUpdates(f.routeName, f);
    if (componentId) {
        try {
            await api.updateComponentProperties(componentId, updates);
            displayUiSuccess(errEl, 'Route configuration saved successfully.');
        } catch (error) {
            displayUiError(errEl, error, {}, 'routeConfigEditor.error.saveFailedTitle');
        }
    } else {
        displayUiSuccess(errEl, 'Route configuration saved successfully (standalone mode).');
    }
};

const clearRouteProperties = async (componentId, routeName) => {
    const res = await api.getComponentProperties(componentId);
    const props = res.properties || {};
    const updates = {};
    const prefix = `${ROUTE_PREFIX}${routeName}.`;
    for (const key of Object.keys(props)) {
        if (key.startsWith(prefix)) updates[key] = null;
    }
    if (Object.keys(updates).length > 0) {
        await api.updateComponentProperties(componentId, updates);
    }
};

const removeRoute = async (form, routeName) => {
    form.remove();
    const componentId = getComponentIdFromUrl(globalThis.location.href);
    const globalErr = document.querySelector('.global-error-messages');

    if (routeName && componentId) {
        try {
            await clearRouteProperties(componentId, routeName);
            if (globalErr) {
                displayUiSuccess(globalErr, `Route "${routeName}" removed successfully.`);
                globalErr.classList.remove('hidden');
            }
        } catch (error) {
            if (globalErr) {
                displayUiError(globalErr, error, {}, 'routeConfigEditor.error.removeFailedTitle');
                globalErr.classList.remove('hidden');
            }
        }
    } else if (routeName && globalErr) {
        displayUiSuccess(globalErr, `Route "${routeName}" removed (standalone mode).`);
        globalErr.classList.remove('hidden');
    }
};
