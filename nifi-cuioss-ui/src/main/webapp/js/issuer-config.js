'use strict';

/**
 * Issuer Configuration editor component — CRUD for JWT issuer configs.
 *
 * @module js/issuer-config
 */

import * as api from './api.js';
import {
    sanitizeHtml, displayUiError, displayUiSuccess, confirmRemoveIssuer,
    validateIssuerConfig, validateProcessorIdFromUrl, log, t
} from './utils.js';

// Note: validateProcessorIdFromUrl is kept for backward compatibility —
// NiFi passes the component ID via ?id= regardless of component type.

// Counter for unique form field IDs
let formCounter = 0;

const SAMPLE = {
    name: 'sample-issuer',
    props: {
        issuer: 'https://sample-issuer.example.com',
        'jwks-url': 'https://sample-issuer.example.com/.well-known/jwks.json',
        audience: 'sample-audience',
        'client-id': 'sample-client'
    }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the Issuer Configuration editor inside the given element.
 *
 * @param {HTMLElement} element  the container pane
 * @param {Object} [options={}]  optional configuration
 * @param {string} [options.targetComponentId]  CS UUID to read/write properties (gateway context)
 * @param {boolean} [options.useControllerService]  if true, use direct CS API accessors
 * @param {boolean} [options.isGatewayContext]  if true, render list-first UX with origin badges
 */
export const init = async (element, options = {}) => {
    if (!element || element.querySelector('.issuer-config-editor')) return;

    const componentId = options.targetComponentId
        || getComponentIdFromUrl(globalThis.location.href);
    const isGateway = options.isGatewayContext || false;
    const useCS = options.useControllerService || false;

    const container = document.createElement('div');
    container.className = 'issuer-config-editor';
    element.appendChild(container);

    container.innerHTML = `
        <h2>Issuer Configurations</h2>
        <p>Configure JWT issuers for token validation. Each issuer requires
           a name and properties like jwks-url and issuer URI.</p>
        <div class="global-error-messages issuer-form-error-messages hidden"
             role="alert" aria-live="assertive"></div>
        <div class="issuers-container"></div>`;

    const issuersContainer = container.querySelector('.issuers-container');

    // Context object passed through to load/save/remove operations
    const ctx = { componentId, isGateway, useCS };

    // "Add Issuer" button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-issuer-button';
    addBtn.innerHTML = '<i class="fa fa-plus"></i> Add Issuer';
    addBtn.addEventListener('click', () => {
        if (isGateway) {
            openInlineIssuerEditor(issuersContainer, '', SAMPLE.props, ctx, null);
        } else {
            addIssuerForm(issuersContainer, `${SAMPLE.name}-${Date.now()}`,
                SAMPLE.props, componentId);
        }
    });
    container.appendChild(addBtn);

    // Load existing issuers
    if (isGateway) {
        await loadExistingIssuersGateway(issuersContainer, ctx);
    } else {
        await loadExistingIssuers(issuersContainer, componentId);
    }
};

export const cleanup = () => { /* no persistent resources */ };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getComponentIdFromUrl = (url) => {
    const r = validateProcessorIdFromUrl(url);
    return r.isValid ? r.sanitizedValue : '';
};

const parseIssuerProperties = (properties) => {
    const out = {};
    for (const [key, value] of Object.entries(properties)) {
        if (!key.startsWith('issuer.')) continue;
        const parts = key.slice(7).split('.');
        if (parts.length === 2) {
            const [name, prop] = parts;
            if (!out[name]) out[name] = {};
            out[name][prop] = value;
        }
    }
    return out;
};

const loadExistingIssuers = async (container, componentId) => {
    if (!componentId) {
        addIssuerForm(container, SAMPLE.name, SAMPLE.props, componentId);
        return;
    }
    try {
        const res = await api.getComponentProperties(componentId);
        const props = res.properties || {};
        const issuers = parseIssuerProperties(props);
        for (const name of Object.keys(issuers)) {
            addIssuerForm(container, name, issuers[name], componentId);
        }
    } catch {
        addIssuerForm(container, SAMPLE.name, SAMPLE.props, componentId);
    }
};

// ---------------------------------------------------------------------------
// Form creation
// ---------------------------------------------------------------------------

const addIssuerForm = (container, issuerName, properties, componentId) => {
    const idx = formCounter++;
    const form = document.createElement('div');
    form.className = 'issuer-form';

    // ---- header (name + remove) ----
    const header = document.createElement('div');
    header.className = 'form-header';
    header.innerHTML = `
        <label for="issuer-name-${idx}">Issuer Name:</label>
        <input type="text" id="issuer-name-${idx}" class="issuer-name"
               placeholder="e.g., keycloak"
               title="Unique identifier for this issuer configuration."
               aria-label="Issuer Name"
               value="${sanitizeHtml(issuerName || '')}">
        <button class="remove-issuer-button"
                title="Delete this issuer configuration"><i class="fa fa-trash"></i> Remove</button>`;
    form.appendChild(header);

    header.querySelector('.remove-issuer-button').addEventListener('click', async () => {
        const name = header.querySelector('.issuer-name').value || 'Unnamed Issuer';
        await confirmRemoveIssuer(name, () => removeIssuer(form, name));
    });

    // ---- form fields ----
    const fields = document.createElement('div');
    fields.className = 'form-fields';
    form.appendChild(fields);

    // JWKS type selector
    const jwksType = properties?.['jwks-type'] || 'url';
    fields.innerHTML = `
        <div class="form-field field-container-jwks-type">
            <label for="field-jwks-type-${idx}">JWKS Source Type:</label>
            <select id="field-jwks-type-${idx}" name="jwks-type"
                    class="field-jwks-type form-input issuer-config-field"
                    aria-label="JWKS Source Type"
                    title="Select how JWKS keys should be retrieved for this issuer">
                <option value="url"${jwksType === 'url' ? ' selected' : ''}>URL (Remote JWKS endpoint)</option>
                <option value="file"${jwksType === 'file' ? ' selected' : ''}>File (Local JWKS file)</option>
                <option value="memory"${jwksType === 'memory' ? ' selected' : ''}>Memory (Inline JWKS content)</option>
            </select>
        </div>`;

    // Standard text fields
    addField({ container: fields, idx, name: 'issuer', label: 'Issuer URI',
        placeholder: 'The URI of the token issuer (must match the iss claim)',
        value: properties?.issuer });
    addField({ container: fields, idx, name: 'jwks-url', label: 'JWKS URL',
        placeholder: 'The URL of the JWKS endpoint',
        value: properties?.['jwks-url'], extraClass: 'jwks-type-url' });
    addField({ container: fields, idx, name: 'jwks-file', label: 'JWKS File Path',
        placeholder: 'Path to local JWKS JSON file',
        value: properties?.['jwks-file'], extraClass: 'jwks-type-file',
        hidden: jwksType !== 'file' });
    addTextArea({ container: fields, idx, name: 'jwks-content', label: 'JWKS Content',
        placeholder: 'Inline JWKS JSON content',
        value: properties?.['jwks-content'], extraClass: 'jwks-type-memory',
        hidden: jwksType !== 'memory' });

    // Toggle field visibility on type change
    fields.querySelector('.field-jwks-type').addEventListener('change', (e) => {
        const t = e.target.value;
        for (const f of form.querySelectorAll('.jwks-type-url, .jwks-type-file, .jwks-type-memory')) {
            f.classList.add('hidden');
        }
        for (const f of form.querySelectorAll(`.jwks-type-${t}`)) {
            f.classList.remove('hidden');
        }
    });

    // "Test Connection" button
    const testWrapper = document.createElement('div');
    testWrapper.className = 'jwks-button-wrapper';
    testWrapper.innerHTML = `
        <button type="button" class="verify-jwks-button"
                title="Test connectivity to the JWKS endpoint">
            <i class="fa fa-plug"></i> Test Connection</button>
        <div class="verification-result" aria-live="polite"
             role="status">
            <em>Click the button to validate JWKS</em></div>`;

    // Position after jwks-url field
    const jwksUrlField = fields.querySelector('.jwks-type-url');
    if (jwksUrlField) jwksUrlField.after(testWrapper);
    else fields.appendChild(testWrapper);

    testWrapper.querySelector('.verify-jwks-button').addEventListener('click', () => {
        const rc = testWrapper.querySelector('.verification-result');
        rc.innerHTML = 'Testing...';
        const sel = fields.querySelector('.field-jwks-type');
        const type = sel ? sel.value : 'url';
        let value = '';
        if (type === 'url') value = fields.querySelector('.field-jwks-url')?.value || '';
        else if (type === 'file') value = fields.querySelector('.field-jwks-file')?.value || '';
        else value = fields.querySelector('.field-jwks-content')?.value || '';

        performJwksValidation(type, value, rc);
    });

    // Optional fields
    addField({ container: fields, idx, name: 'audience', label: 'Audience',
        placeholder: 'The expected audience claim value',
        value: properties?.audience });
    addField({ container: fields, idx, name: 'client-id', label: 'Client ID',
        placeholder: 'The client ID for token validation',
        value: properties?.['client-id'] });

    // ---- save button ----
    const errorContainer = document.createElement('div');
    errorContainer.className = 'issuer-form-error-messages';
    errorContainer.setAttribute('role', 'alert');
    errorContainer.setAttribute('aria-live', 'assertive');
    form.appendChild(errorContainer);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-issuer-button';
    saveBtn.innerHTML = '<i class="fa fa-check"></i> Save Issuer';
    saveBtn.addEventListener('click', () => {
        errorContainer.innerHTML = '';
        saveIssuer(form, errorContainer, componentId);
    });
    form.appendChild(saveBtn);

    container.appendChild(form);
};

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

const addField = ({ container, idx, name, label, placeholder, value, extraClass, hidden }) => {
    const div = document.createElement('div');
    div.className = `form-field field-container-${name}`;
    if (extraClass) div.classList.add(extraClass);
    if (hidden) div.classList.add('hidden');
    div.innerHTML = `
        <label for="field-${name}-${idx}">${sanitizeHtml(label)}:</label>
        <input type="text" id="field-${name}-${idx}" name="${name}"
               class="field-${name} form-input issuer-config-field"
               placeholder="${sanitizeHtml(placeholder)}"
               value="${sanitizeHtml(value || '')}"
               aria-label="${sanitizeHtml(label)}">`;
    container.appendChild(div);
    return div;
};

const addTextArea = ({ container, idx, name, label, placeholder, value, extraClass, hidden }) => {
    const div = document.createElement('div');
    div.className = `form-field field-container-${name}`;
    if (extraClass) div.classList.add(extraClass);
    if (hidden) div.classList.add('hidden');
    div.innerHTML = `
        <label for="field-${name}-${idx}">${sanitizeHtml(label)}:</label>
        <textarea id="field-${name}-${idx}" name="${name}"
                  class="field-${name} form-input issuer-config-field"
                  placeholder="${sanitizeHtml(placeholder)}"
                  rows="5" aria-label="${sanitizeHtml(label)}"
        >${sanitizeHtml(value || '')}</textarea>`;
    container.appendChild(div);
    return div;
};

// ---------------------------------------------------------------------------
// JWKS validation
// ---------------------------------------------------------------------------

const performJwksValidation = async (type, value, resultEl) => {
    let data;
    try {
        switch (type) {
            case 'url':
                data = await api.validateJwksUrl(value);
                break;
            case 'file':
                data = await api.validateJwksFile(value);
                break;
            case 'memory':
                data = await api.validateJwksContent(value);
                break;
            default:
                throw new Error(`Unknown JWKS type: ${type}`);
        }

        if (data.valid) {
            const count = data.keyCount || 0;
            resultEl.innerHTML =
                `<span class="success-message">OK</span> Valid JWKS (${count} keys found)`;
        } else {
            displayUiError(resultEl, { responseJSON: data }, {}, 'processor.jwt.invalidJwks');
        }
    } catch (error) {
        displayUiError(resultEl, error, {}, 'processor.jwt.validationError');
    }
};

// ---------------------------------------------------------------------------
// Save / Remove
// ---------------------------------------------------------------------------

const extractFormFields = (form) => {
    const q = (sel) => form.querySelector(sel)?.value?.trim() || '';
    return {
        issuerName: q('.issuer-name'),
        issuer: q('.field-issuer'),
        'jwks-type': q('.field-jwks-type'),
        'jwks-url': q('.field-jwks-url'),
        'jwks-file': q('.field-jwks-file'),
        'jwks-content': q('.field-jwks-content'),
        audience: q('.field-audience'),
        'client-id': q('.field-client-id')
    };
};

const validateFormData = (f) => {
    if (!f.issuerName) return { isValid: false, error: new Error('Issuer name is required.') };
    if (!f.issuer) return { isValid: false, error: new Error('Issuer URI is required.') };
    const jt = f['jwks-type'] || 'url';
    if (jt === 'url' && !f['jwks-url']) return { isValid: false, error: new Error('JWKS URL is required when using URL source type.') };
    if (jt === 'file' && !f['jwks-file']) return { isValid: false, error: new Error('JWKS file path is required when using file source type.') };
    if (jt === 'memory' && !f['jwks-content']) return { isValid: false, error: new Error('JWKS content is required when using memory source type.') };
    // Enhanced validation (non-blocking)
    const enhanced = validateIssuerConfig(f);
    if (!enhanced.isValid) log.debug('Enhanced validation warnings:', enhanced.error);
    return { isValid: true };
};

const buildPropertyUpdates = (name, f) => {
    const jt = f['jwks-type'] || 'url';
    const u = { [`issuer.${name}.jwks-type`]: jt };
    if (f.issuer) u[`issuer.${name}.issuer`] = f.issuer;
    if (jt === 'url' && f['jwks-url']) u[`issuer.${name}.jwks-url`] = f['jwks-url'];
    if (jt === 'file' && f['jwks-file']) u[`issuer.${name}.jwks-file`] = f['jwks-file'];
    if (jt === 'memory' && f['jwks-content']) u[`issuer.${name}.jwks-content`] = f['jwks-content'];
    if (f.audience) u[`issuer.${name}.audience`] = f.audience;
    if (f['client-id']) u[`issuer.${name}.client-id`] = f['client-id'];
    return u;
};

const saveIssuer = async (form, errEl, componentId) => {
    const f = extractFormFields(form);
    const v = validateFormData(f);
    if (!v.isValid) { displayUiError(errEl, v.error, {}, 'issuerConfigEditor.error.title'); return; }
    const updates = buildPropertyUpdates(f.issuerName, f);
    if (componentId) {
        try {
            await api.updateComponentProperties(componentId, updates);
            displayUiSuccess(errEl, 'Issuer configuration saved successfully.');
        } catch (error) {
            displayUiError(errEl, error, {}, 'issuerConfigEditor.error.saveFailedTitle');
        }
    } else {
        displayUiSuccess(errEl, 'Issuer configuration saved successfully (standalone mode).');
    }
};

const clearIssuerProperties = async (componentId, issuerName) => {
    const res = await api.getComponentProperties(componentId);
    const props = res.properties || {};
    const updates = {};
    for (const key of Object.keys(props)) {
        if (key.startsWith(`issuer.${issuerName}.`)) updates[key] = null;
    }
    if (Object.keys(updates).length > 0) {
        await api.updateComponentProperties(componentId, updates);
    }
};

const removeIssuer = async (form, issuerName) => {
    form.remove();
    const componentId = getComponentIdFromUrl(globalThis.location.href);
    const globalErr = document.querySelector('.global-error-messages');

    if (issuerName && componentId) {
        try {
            await clearIssuerProperties(componentId, issuerName);
            if (globalErr) {
                displayUiSuccess(globalErr, `Issuer "${issuerName}" removed successfully.`);
                globalErr.classList.remove('hidden');
            }
        } catch (error) {
            if (globalErr) {
                displayUiError(globalErr, error, {}, 'issuerConfigEditor.error.removeFailedTitle');
                globalErr.classList.remove('hidden');
            }
        }
    } else if (issuerName && globalErr) {
        displayUiSuccess(globalErr, `Issuer "${issuerName}" removed (standalone mode).`);
        globalErr.classList.remove('hidden');
    }
};

// ---------------------------------------------------------------------------
// Gateway context: list-first UX with summary table + inline editor
// ---------------------------------------------------------------------------

/**
 * Get properties using the correct accessor for the context.
 * @param {Object} ctx  context: { componentId, isGateway, useCS }
 * @returns {Promise<{properties: Object, revision: Object}>}
 */
const getProps = (ctx) =>
    ctx.useCS
        ? api.getControllerServiceProperties(ctx.componentId)
        : api.getComponentProperties(ctx.componentId);

/**
 * Update properties using the correct accessor for the context.
 * @param {Object} ctx  context
 * @param {Object} properties  property updates
 * @returns {Promise<Object>}
 */
const updateProps = (ctx, properties) =>
    ctx.useCS
        ? api.updateControllerServiceProperties(ctx.componentId, properties)
        : api.updateComponentProperties(ctx.componentId, properties);

const loadExistingIssuersGateway = async (container, ctx) => {
    if (!ctx.componentId) {
        renderIssuerSummaryTable(container, {}, ctx);
        return;
    }
    try {
        const res = await getProps(ctx);
        const props = res.properties || {};
        const issuers = parseIssuerProperties(props);
        renderIssuerSummaryTable(container, issuers, ctx);
    } catch {
        renderIssuerSummaryTable(container, {}, ctx);
    }
};

// ---------------------------------------------------------------------------
// Gateway summary table
// ---------------------------------------------------------------------------

const buildOriginBadge = (origin) => {
    if (origin === 'new') {
        return ` <span class="origin-badge origin-new" title="${sanitizeHtml(t('origin.badge.new.title'))}">${sanitizeHtml(t('origin.badge.new'))}</span>`;
    }
    if (origin === 'modified') {
        return ` <span class="origin-badge origin-modified" title="${sanitizeHtml(t('origin.badge.modified.title'))}">${sanitizeHtml(t('origin.badge.modified'))}</span>`;
    }
    return ` <span class="origin-badge origin-persisted" title="${sanitizeHtml(t('origin.badge.persisted.title'))}"><i class="fa fa-lock"></i></span>`;
};

const renderIssuerSummaryTable = (container, issuers, ctx) => {
    const existing = container.querySelector('.issuer-summary-table');
    if (existing) existing.remove();

    const table = document.createElement('table');
    table.className = 'issuer-summary-table config-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Name</th>
                <th>JWKS Source</th>
                <th>Type</th>
                <th>Issuer URI</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    const tbody = table.querySelector('tbody');

    const names = Object.keys(issuers);
    if (names.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="5" class="empty-state">No issuers configured. Click "Add Issuer" to create one.</td>';
        tbody.appendChild(emptyRow);
    } else {
        for (const name of names) {
            const row = createIssuerTableRow(name, issuers[name], ctx, container);
            tbody.appendChild(row);
        }
    }

    container.prepend(table);
};

const createIssuerTableRow = (name, props, ctx, issuersContainer, origin = 'persisted') => {
    const row = document.createElement('tr');
    row.dataset.issuerName = name;
    row.dataset.origin = origin;

    const jwksType = props?.['jwks-type'] || 'url';
    const jwksSource = props?.['jwks-url']
        || props?.['jwks-file'] || '(inline)';
    const issuerUri = props?.issuer || '';
    const originBadge = buildOriginBadge(origin);
    const typeBadgeHtml = sanitizeHtml(jwksType.toUpperCase());

    row.innerHTML = `
        <td>${sanitizeHtml(name)}${originBadge}</td>
        <td class="issuer-source">${sanitizeHtml(jwksSource)}</td>
        <td><span class="method-badge">${typeBadgeHtml}</span></td>
        <td>${sanitizeHtml(issuerUri)}</td>
        <td>
            <button class="edit-issuer-button" title="Edit issuer">
                <i class="fa fa-pencil"></i> Edit</button>
            <button class="remove-issuer-gw-button"
                    title="Delete issuer">
                <i class="fa fa-trash"></i> Remove</button>
        </td>`;

    row.querySelector('.edit-issuer-button').addEventListener('click', () => {
        closeActiveIssuerEditor(issuersContainer);
        row.classList.add('hidden');
        openInlineIssuerEditor(issuersContainer, name, props, ctx, row);
    });

    row.querySelector('.remove-issuer-gw-button')
        .addEventListener('click', async () => {
            await confirmRemoveIssuer(name, () =>
                removeIssuerGateway(row, name, issuersContainer, ctx));
        });

    return row;
};

const closeActiveIssuerEditor = (issuersContainer) => {
    const openForm = issuersContainer.querySelector('.issuer-inline-form');
    if (openForm) {
        const hiddenRow = issuersContainer.querySelector('tr.hidden[data-issuer-name]');
        if (hiddenRow) hiddenRow.classList.remove('hidden');
        openForm.remove();
    }
};

// ---------------------------------------------------------------------------
// Gateway inline editor
// ---------------------------------------------------------------------------

const openInlineIssuerEditor = (issuersContainer, issuerName, properties, ctx, tableRow) => {
    closeActiveIssuerEditor(issuersContainer);
    if (tableRow) tableRow.classList.add('hidden');

    const idx = formCounter++;
    const form = document.createElement('div');
    form.className = 'issuer-inline-form route-form inline-edit';
    form.dataset.originalName = issuerName || '';

    // Header
    const header = document.createElement('div');
    header.className = 'form-header';
    header.innerHTML = `
        <label for="issuer-name-gw-${idx}">Issuer Name:</label>
        <input type="text" id="issuer-name-gw-${idx}" class="issuer-name"
               placeholder="e.g., keycloak"
               title="Unique identifier for this issuer configuration."
               aria-label="Issuer Name"
               value="${sanitizeHtml(issuerName || '')}">`;
    form.appendChild(header);

    // Fields
    const fields = document.createElement('div');
    fields.className = 'form-fields';
    form.appendChild(fields);

    const jwksType = properties?.['jwks-type'] || 'url';
    fields.innerHTML = `
        <div class="form-field field-container-jwks-type">
            <label for="field-jwks-type-gw-${idx}">JWKS Source Type:</label>
            <select id="field-jwks-type-gw-${idx}" name="jwks-type"
                    class="field-jwks-type form-input issuer-config-field"
                    aria-label="JWKS Source Type"
                    title="Select how JWKS keys should be retrieved for this issuer">
                <option value="url"${jwksType === 'url' ? ' selected' : ''}>URL (Remote JWKS endpoint)</option>
                <option value="file"${jwksType === 'file' ? ' selected' : ''}>File (Local JWKS file)</option>
                <option value="memory"${jwksType === 'memory' ? ' selected' : ''}>Memory (Inline JWKS content)</option>
            </select>
        </div>`;

    addField({ container: fields, idx, name: 'issuer', label: 'Issuer URI',
        placeholder: 'The URI of the token issuer (must match the iss claim)',
        value: properties?.issuer });
    addField({ container: fields, idx, name: 'jwks-url', label: 'JWKS URL',
        placeholder: 'The URL of the JWKS endpoint',
        value: properties?.['jwks-url'], extraClass: 'jwks-type-url' });
    addField({ container: fields, idx, name: 'jwks-file', label: 'JWKS File Path',
        placeholder: 'Path to local JWKS JSON file',
        value: properties?.['jwks-file'], extraClass: 'jwks-type-file',
        hidden: jwksType !== 'file' });
    addTextArea({ container: fields, idx, name: 'jwks-content', label: 'JWKS Content',
        placeholder: 'Inline JWKS JSON content',
        value: properties?.['jwks-content'], extraClass: 'jwks-type-memory',
        hidden: jwksType !== 'memory' });

    fields.querySelector('.field-jwks-type').addEventListener('change', (e) => {
        const selectedType = e.target.value;
        for (const f of form.querySelectorAll('.jwks-type-url, .jwks-type-file, .jwks-type-memory')) {
            f.classList.add('hidden');
        }
        for (const f of form.querySelectorAll(`.jwks-type-${selectedType}`)) {
            f.classList.remove('hidden');
        }
    });

    // Test Connection button
    const testWrapper = document.createElement('div');
    testWrapper.className = 'jwks-button-wrapper';
    testWrapper.innerHTML = `
        <button type="button" class="verify-jwks-button"
                title="Test connectivity to the JWKS endpoint">
            <i class="fa fa-plug"></i> Test Connection</button>
        <div class="verification-result" aria-live="polite"
             role="status">
            <em>Click the button to validate JWKS</em></div>`;

    const jwksUrlField = fields.querySelector('.jwks-type-url');
    if (jwksUrlField) jwksUrlField.after(testWrapper);
    else fields.appendChild(testWrapper);

    testWrapper.querySelector('.verify-jwks-button').addEventListener('click', () => {
        const rc = testWrapper.querySelector('.verification-result');
        rc.innerHTML = 'Testing...';
        const sel = fields.querySelector('.field-jwks-type');
        const type = sel ? sel.value : 'url';
        let value = '';
        if (type === 'url') value = fields.querySelector('.field-jwks-url')?.value || '';
        else if (type === 'file') value = fields.querySelector('.field-jwks-file')?.value || '';
        else value = fields.querySelector('.field-jwks-content')?.value || '';
        performJwksValidation(type, value, rc);
    });

    addField({ container: fields, idx, name: 'audience', label: 'Audience',
        placeholder: 'The expected audience claim value',
        value: properties?.audience });
    addField({ container: fields, idx, name: 'client-id', label: 'Client ID',
        placeholder: 'The client ID for token validation',
        value: properties?.['client-id'] });

    // Error container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'issuer-form-error-messages';
    errorContainer.setAttribute('role', 'alert');
    errorContainer.setAttribute('aria-live', 'assertive');
    form.appendChild(errorContainer);

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'route-form-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-issuer-button';
    saveBtn.innerHTML = '<i class="fa fa-check"></i> Save Issuer';
    saveBtn.addEventListener('click', () => {
        errorContainer.innerHTML = '';
        saveIssuerGateway(form, errorContainer, ctx, tableRow, issuersContainer);
    });
    actionsDiv.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-issuer-button cancel-route-button';
    cancelBtn.innerHTML = '<i class="fa fa-times"></i> Cancel';
    cancelBtn.addEventListener('click', () => {
        if (tableRow) tableRow.classList.remove('hidden');
        form.remove();
    });
    actionsDiv.appendChild(cancelBtn);

    form.appendChild(actionsDiv);
    issuersContainer.appendChild(form);
};

// ---------------------------------------------------------------------------
// Gateway save / remove
// ---------------------------------------------------------------------------

const saveIssuerGateway = async (form, errEl, ctx, tableRow, issuersContainer) => {
    const f = extractFormFields(form);
    const originalName = form.dataset.originalName || '';
    const v = validateFormData(f);
    if (!v.isValid) { displayUiError(errEl, v.error, {}, 'issuerConfigEditor.error.title'); return; }

    const nameChanged = originalName && originalName !== f.issuerName;
    const updates = buildPropertyUpdates(f.issuerName, f);

    // If renamed, clear old properties
    if (nameChanged && ctx.componentId) {
        try {
            const res = await getProps(ctx);
            const props = res.properties || {};
            for (const key of Object.keys(props)) {
                if (key.startsWith(`issuer.${originalName}.`)) updates[key] = null;
            }
        } catch { /* ignore — old props will remain as orphans */ }
    }

    if (ctx.componentId) {
        try {
            await updateProps(ctx, updates);
            form.dataset.originalName = f.issuerName;

            if (tableRow) {
                updateIssuerTableRow(tableRow, f);
                tableRow.classList.remove('hidden');
            } else {
                addIssuerRowToTable(issuersContainer, f, ctx);
            }
            form.remove();
        } catch (error) {
            displayUiError(errEl, error, {}, 'issuerConfigEditor.error.saveFailedTitle');
        }
    } else {
        form.dataset.originalName = f.issuerName;
        if (tableRow) {
            updateIssuerTableRow(tableRow, f);
            tableRow.classList.remove('hidden');
        } else {
            addIssuerRowToTable(issuersContainer, f, ctx);
        }
        form.remove();
    }
};

const updateIssuerTableRow = (row, formData) => {
    if (row.dataset.origin === 'persisted') {
        row.dataset.origin = 'modified';
    }
    const origin = row.dataset.origin || 'persisted';
    const originBadge = buildOriginBadge(origin);

    const jwksType = formData['jwks-type'] || 'url';
    const jwksSource = formData['jwks-url'] || formData['jwks-file'] || '(inline)';

    const cells = row.querySelectorAll('td');
    cells[0].innerHTML = `${sanitizeHtml(formData.issuerName)}${originBadge}`;
    cells[1].innerHTML = sanitizeHtml(jwksSource);
    const typeBadge = sanitizeHtml(jwksType.toUpperCase());
    cells[2].innerHTML = `<span class="method-badge">${typeBadge}</span>`;
    cells[3].innerHTML = sanitizeHtml(formData.issuer);

    row.dataset.issuerName = formData.issuerName;
};

const addIssuerRowToTable = (issuersContainer, formData, ctx) => {
    const table = issuersContainer.querySelector('.issuer-summary-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');

    const emptyRow = tbody.querySelector('.empty-state');
    if (emptyRow) emptyRow.closest('tr').remove();

    const props = {
        issuer: formData.issuer,
        'jwks-type': formData['jwks-type'],
        'jwks-url': formData['jwks-url'],
        'jwks-file': formData['jwks-file'],
        'jwks-content': formData['jwks-content'],
        audience: formData.audience,
        'client-id': formData['client-id']
    };
    const row = createIssuerTableRow(formData.issuerName, props, ctx, issuersContainer, 'new');
    tbody.appendChild(row);
};

const removeIssuerGateway = async (row, issuerName, issuersContainer, ctx) => {
    row.remove();

    const openForm = issuersContainer.querySelector('.issuer-inline-form');
    if (openForm && openForm.dataset.originalName === issuerName) {
        openForm.remove();
    }

    const globalErr = document.querySelector('.global-error-messages');

    if (issuerName && ctx.componentId) {
        try {
            const res = await getProps(ctx);
            const props = res.properties || {};
            const updates = {};
            for (const key of Object.keys(props)) {
                if (key.startsWith(`issuer.${issuerName}.`)) updates[key] = null;
            }
            if (Object.keys(updates).length > 0) {
                await updateProps(ctx, updates);
            }
            if (globalErr) {
                displayUiSuccess(globalErr, `Issuer "${issuerName}" removed successfully.`);
                globalErr.classList.remove('hidden');
            }
        } catch (error) {
            if (globalErr) {
                displayUiError(globalErr, error, {}, 'issuerConfigEditor.error.removeFailedTitle');
                globalErr.classList.remove('hidden');
            }
        }
    } else if (issuerName && globalErr) {
        displayUiSuccess(globalErr, `Issuer "${issuerName}" removed (standalone mode).`);
        globalErr.classList.remove('hidden');
    }
};
