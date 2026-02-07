'use strict';

/**
 * Issuer Configuration editor component — CRUD for JWT issuer configs.
 *
 * @module js/issuer-config
 */

import * as api from './api.js';
import {
    sanitizeHtml, displayUiError, displayUiSuccess, confirmRemoveIssuer,
    validateIssuerConfig, validateProcessorIdFromUrl, log
} from './utils.js';

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
 * @param {HTMLElement} element  the #issuer-config pane
 */
export const init = async (element) => {
    if (!element || element.querySelector('.issuer-config-editor')) return;

    const processorId = getProcessorIdFromUrl(globalThis.location.href);
    const container = document.createElement('div');
    container.className = 'issuer-config-editor';
    element.appendChild(container);

    container.innerHTML = `
        <h2>Issuer Configurations</h2>
        <p>Configure JWT issuers for token validation. Each issuer requires
           a name and properties like jwks-url and issuer URI.</p>
        <div class="global-error-messages issuer-form-error-messages"
             style="display:none;"></div>
        <div class="issuers-container"></div>`;

    const issuersContainer = container.querySelector('.issuers-container');

    // "Add Issuer" button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-issuer-button';
    addBtn.textContent = 'Add Issuer';
    addBtn.addEventListener('click', () => {
        addIssuerForm(issuersContainer, `${SAMPLE.name}-${Date.now()}`,
            SAMPLE.props, processorId);
    });
    container.appendChild(addBtn);

    // Load existing issuers
    await loadExistingIssuers(issuersContainer, processorId);
};

export const cleanup = () => { /* no persistent resources */ };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getProcessorIdFromUrl = (url) => {
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

const loadExistingIssuers = async (container, processorId) => {
    if (!processorId) {
        addIssuerForm(container, SAMPLE.name, SAMPLE.props, processorId);
        return;
    }
    try {
        const res = await api.getProcessorProperties(processorId);
        const props = res.properties || {};
        const issuers = parseIssuerProperties(props);
        for (const name of Object.keys(issuers)) {
            addIssuerForm(container, name, issuers[name], processorId);
        }
    } catch {
        addIssuerForm(container, SAMPLE.name, SAMPLE.props, processorId);
    }
};

// ---------------------------------------------------------------------------
// Form creation
// ---------------------------------------------------------------------------

const addIssuerForm = (container, issuerName, properties, processorId) => {
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
                title="Delete this issuer configuration">Remove</button>`;
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
    addField(fields, idx, 'issuer', 'Issuer URI',
        'The URI of the token issuer (must match the iss claim)',
        properties?.issuer);
    addField(fields, idx, 'jwks-url', 'JWKS URL',
        'The URL of the JWKS endpoint',
        properties?.['jwks-url'], 'jwks-type-url');
    addField(fields, idx, 'jwks-file', 'JWKS File Path',
        'Path to local JWKS JSON file',
        properties?.['jwks-file'], 'jwks-type-file',
        jwksType !== 'file');
    addTextArea(fields, idx, 'jwks-content', 'JWKS Content',
        'Inline JWKS JSON content',
        properties?.['jwks-content'], 'jwks-type-memory',
        jwksType !== 'memory');

    // Toggle field visibility on type change
    fields.querySelector('.field-jwks-type').addEventListener('change', (e) => {
        const t = e.target.value;
        for (const f of form.querySelectorAll('.jwks-type-url, .jwks-type-file, .jwks-type-memory')) {
            f.style.display = 'none';
        }
        for (const f of form.querySelectorAll(`.jwks-type-${t}`)) {
            f.style.display = '';
        }
    });

    // "Test Connection" button
    const testWrapper = document.createElement('div');
    testWrapper.className = 'jwks-button-wrapper';
    testWrapper.innerHTML = `
        <button type="button" class="verify-jwks-button"
                title="Test connectivity to the JWKS endpoint">Test Connection</button>
        <div class="verification-result"><em>Click the button to validate JWKS</em></div>`;

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
    addField(fields, idx, 'audience', 'Audience',
        'The expected audience claim value',
        properties?.audience);
    addField(fields, idx, 'client-id', 'Client ID',
        'The client ID for token validation',
        properties?.['client-id']);

    // ---- save button ----
    const errorContainer = document.createElement('div');
    errorContainer.className = 'issuer-form-error-messages';
    form.appendChild(errorContainer);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-issuer-button';
    saveBtn.textContent = 'Save Issuer';
    saveBtn.addEventListener('click', () => {
        errorContainer.innerHTML = '';
        saveIssuer(form, errorContainer, processorId);
    });
    form.appendChild(saveBtn);

    container.appendChild(form);
};

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

const addField = (container, idx, name, label, placeholder, value, extraClass, hidden) => {
    const div = document.createElement('div');
    div.className = `form-field field-container-${name}`;
    if (extraClass) div.classList.add(extraClass);
    if (hidden) div.style.display = 'none';
    div.innerHTML = `
        <label for="field-${name}-${idx}">${sanitizeHtml(label)}:</label>
        <input type="text" id="field-${name}-${idx}"
               class="field-${name} form-input issuer-config-field"
               placeholder="${sanitizeHtml(placeholder)}"
               value="${sanitizeHtml(value || '')}"
               aria-label="${sanitizeHtml(label)}">`;
    container.appendChild(div);
    return div;
};

const addTextArea = (container, idx, name, label, placeholder, value, extraClass, hidden) => {
    const div = document.createElement('div');
    div.className = `form-field field-container-${name}`;
    if (extraClass) div.classList.add(extraClass);
    if (hidden) div.style.display = 'none';
    div.innerHTML = `
        <label for="field-${name}-${idx}">${sanitizeHtml(label)}:</label>
        <textarea id="field-${name}-${idx}"
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
            resultEl.innerHTML =
                `<span class="success-message">OK</span> Valid JWKS (${data.keyCount || 0} keys found)`;
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

const saveIssuer = async (form, errEl, processorId) => {
    const f = extractFormFields(form);
    const v = validateFormData(f);
    if (!v.isValid) { displayUiError(errEl, v.error, {}, 'issuerConfigEditor.error.title'); return; }
    const updates = buildPropertyUpdates(f.issuerName, f);
    if (processorId) {
        try {
            await api.updateProcessorProperties(processorId, updates);
            displayUiSuccess(errEl, 'Issuer configuration saved successfully.');
        } catch (error) {
            displayUiError(errEl, error, {}, 'issuerConfigEditor.error.saveFailedTitle');
        }
    } else {
        displayUiSuccess(errEl, 'Issuer configuration saved successfully (standalone mode).');
    }
};

const removeIssuer = async (form, issuerName) => {
    form.remove();
    const processorId = getProcessorIdFromUrl(globalThis.location.href);
    const globalErr = document.querySelector('.global-error-messages');

    if (issuerName && processorId) {
        try {
            const res = await api.getProcessorProperties(processorId);
            const props = res.properties || {};
            const updates = {};
            for (const key of Object.keys(props)) {
                if (key.startsWith(`issuer.${issuerName}.`)) updates[key] = null;
            }
            if (Object.keys(updates).length > 0) {
                await api.updateProcessorProperties(processorId, updates);
            }
            if (globalErr) {
                displayUiSuccess(globalErr, `Issuer "${issuerName}" removed successfully.`);
                globalErr.style.display = 'block';
            }
        } catch (error) {
            if (globalErr) {
                displayUiError(globalErr, error, {}, 'issuerConfigEditor.error.removeFailedTitle');
                globalErr.style.display = 'block';
            }
        }
    } else if (issuerName && globalErr) {
        displayUiSuccess(globalErr, `Issuer "${issuerName}" removed (standalone mode).`);
        globalErr.style.display = 'block';
    }
};
