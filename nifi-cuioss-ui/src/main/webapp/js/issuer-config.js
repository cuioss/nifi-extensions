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
import { createContextHelp, createFormField } from './context-help.js';

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
        <h2>${t('issuer.heading')}</h2>
        <p>${t('issuer.description')}</p>
        <div class="global-error-messages issuer-form-error-messages hidden"
             role="alert" aria-live="assertive"></div>
        <div class="issuers-container"></div>`;

    const issuersContainer = container.querySelector('.issuers-container');

    // Context object passed through to load/save/remove operations
    const ctx = { componentId, isGateway, useCS };

    // "Add Issuer" button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-issuer-button';
    addBtn.innerHTML = `<i class="fa fa-plus"></i> ${t('issuer.btn.add')}`;
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
// Shared form field builders (used by both standard and gateway forms)
// ---------------------------------------------------------------------------

/** Build JWKS type selector, standard fields, type toggle, test button. */
const buildIssuerFields = (form, fields, idx, properties, issuerName) => {
    const jwksType = properties?.['jwks-type'] || 'url';
    const idPrefix = `field-jwks-type-${idx}`;
    const iName = issuerName || '*';

    // JWKS type selector (with context help)
    const jwksTypeDiv = document.createElement('div');
    jwksTypeDiv.className = 'form-field field-container-jwks-type';

    const jwksTypeLabel = document.createElement('label');
    jwksTypeLabel.setAttribute('for', idPrefix);
    jwksTypeLabel.textContent = `${t('issuer.form.jwks.type.label')}:`;

    const jwksTypeHelp = createContextHelp({
        helpKey: 'contexthelp.issuer.jwks.type',
        propertyKey: `issuer.${iName}.jwks-type`,
        currentValue: jwksType
    });
    jwksTypeLabel.appendChild(jwksTypeHelp.button);
    jwksTypeDiv.appendChild(jwksTypeLabel);
    jwksTypeDiv.appendChild(jwksTypeHelp.panel);

    const select = document.createElement('select');
    select.id = idPrefix;
    select.name = 'jwks-type';
    select.className = 'field-jwks-type form-input issuer-config-field';
    select.setAttribute('aria-label', t('issuer.form.jwks.type.label'));
    select.title = t('issuer.form.jwks.type.title');
    for (const [val, text] of [['url', t('issuer.form.jwks.type.url')], ['file', t('issuer.form.jwks.type.file')], ['memory', t('issuer.form.jwks.type.memory')]]) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        if (val === jwksType) opt.selected = true;
        select.appendChild(opt);
    }
    jwksTypeDiv.appendChild(select);
    fields.appendChild(jwksTypeDiv);

    addField({ container: fields, idx, name: 'issuer', label: t('issuer.form.issuer.uri.label'),
        placeholder: t('issuer.form.issuer.uri.placeholder'),
        value: properties?.issuer,
        helpKey: 'contexthelp.issuer.uri', propertyKey: `issuer.${iName}.issuer`,
        currentValue: properties?.issuer });
    addField({ container: fields, idx, name: 'jwks-url', label: t('issuer.form.jwks.url.label'),
        placeholder: t('issuer.form.jwks.url.placeholder'),
        value: properties?.['jwks-url'], extraClass: 'jwks-type-url',
        helpKey: 'contexthelp.issuer.jwks.url', propertyKey: `issuer.${iName}.jwks-url`,
        currentValue: properties?.['jwks-url'] });
    addField({ container: fields, idx, name: 'jwks-file', label: t('issuer.form.jwks.file.label'),
        placeholder: t('issuer.form.jwks.file.placeholder'),
        value: properties?.['jwks-file'], extraClass: 'jwks-type-file',
        hidden: jwksType !== 'file',
        helpKey: 'contexthelp.issuer.jwks.file', propertyKey: `issuer.${iName}.jwks-file`,
        currentValue: properties?.['jwks-file'] });
    addTextArea({ container: fields, idx, name: 'jwks-content',
        label: t('issuer.form.jwks.content.label'),
        placeholder: t('issuer.form.jwks.content.placeholder'),
        value: properties?.['jwks-content'], extraClass: 'jwks-type-memory',
        hidden: jwksType !== 'memory',
        helpKey: 'contexthelp.issuer.jwks.content', propertyKey: `issuer.${iName}.jwks-content`,
        currentValue: properties?.['jwks-content'] });

    // Toggle field visibility on type change
    fields.querySelector('.field-jwks-type').addEventListener('change', (e) => {
        const sel = e.target.value;
        for (const f of form.querySelectorAll(
            '.jwks-type-url, .jwks-type-file, .jwks-type-memory'
        )) f.classList.add('hidden');
        for (const f of form.querySelectorAll(`.jwks-type-${sel}`)) {
            f.classList.remove('hidden');
        }
    });

    // Test Connection button
    const tw = document.createElement('div');
    tw.className = 'jwks-button-wrapper';
    tw.innerHTML = `
        <button type="button" class="verify-jwks-button"
                title="${t('issuer.jwks.test.title')}">
            <i class="fa fa-plug"></i> ${t('issuer.jwks.test.btn')}</button>
        <div class="verification-result" aria-live="polite"
             role="status">
            <em>${t('issuer.jwks.test.hint')}</em></div>`;
    const urlField = fields.querySelector('.jwks-type-url');
    if (urlField) urlField.after(tw);
    else fields.appendChild(tw);
    tw.querySelector('.verify-jwks-button').addEventListener('click', () => {
        const rc = tw.querySelector('.verification-result');
        rc.innerHTML = t('issuer.jwks.test.testing');
        const typeSel = fields.querySelector('.field-jwks-type');
        const type = typeSel ? typeSel.value : 'url';
        let value = '';
        if (type === 'url') {
            value = fields.querySelector('.field-jwks-url')?.value || '';
        } else if (type === 'file') {
            value = fields.querySelector('.field-jwks-file')?.value || '';
        } else {
            value = fields.querySelector('.field-jwks-content')?.value || '';
        }
        performJwksValidation(type, value, rc);
    });

    addField({ container: fields, idx, name: 'audience', label: t('issuer.form.audience.label'),
        placeholder: t('issuer.form.audience.placeholder'),
        value: properties?.audience,
        helpKey: 'contexthelp.issuer.audience', propertyKey: `issuer.${iName}.audience`,
        currentValue: properties?.audience });
    addField({ container: fields, idx, name: 'client-id', label: t('issuer.form.client.id.label'),
        placeholder: t('issuer.form.client.id.placeholder'),
        value: properties?.['client-id'],
        helpKey: 'contexthelp.issuer.client.id', propertyKey: `issuer.${iName}.client-id`,
        currentValue: properties?.['client-id'] });
};

// ---------------------------------------------------------------------------
// Shared header builder
// ---------------------------------------------------------------------------

const createIssuerNameHeader = (idx, idSuffix, issuerName) => {
    const header = document.createElement('div');
    header.className = 'form-header';

    const label = document.createElement('label');
    label.setAttribute('for', `issuer-name-${idSuffix}-${idx}`);
    label.textContent = `${t('issuer.form.name.label')}:`;
    const help = createContextHelp({
        helpKey: 'contexthelp.issuer.name',
        propertyKey: `issuer.${issuerName || '*'}.*`,
        currentValue: issuerName
    });
    label.appendChild(help.button);
    header.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `issuer-name-${idSuffix}-${idx}`;
    input.className = 'issuer-name';
    input.placeholder = t('issuer.form.name.placeholder');
    input.title = t('issuer.form.name.title');
    input.setAttribute('aria-label', t('issuer.form.name.label'));
    input.value = issuerName || '';
    header.appendChild(input);

    header.appendChild(help.panel);
    return header;
};

// ---------------------------------------------------------------------------
// Form creation
// ---------------------------------------------------------------------------

const addIssuerForm = (container, issuerName, properties, componentId) => {
    const idx = formCounter++;
    const form = document.createElement('div');
    form.className = 'issuer-form';

    // ---- header (name + remove) ----
    const header = createIssuerNameHeader(idx, 'std', issuerName);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-issuer-button';
    removeBtn.title = 'Delete this issuer configuration';
    removeBtn.innerHTML = `<i class="fa fa-trash"></i> ${t('common.btn.remove')}`;
    header.appendChild(removeBtn);

    form.appendChild(header);

    removeBtn.addEventListener('click', async () => {
        const name = header.querySelector('.issuer-name').value || 'Unnamed Issuer';
        await confirmRemoveIssuer(name, () => removeIssuer(form, name));
    });

    // ---- form fields ----
    const fields = document.createElement('div');
    fields.className = 'form-fields';
    form.appendChild(fields);

    buildIssuerFields(form, fields, idx, properties, issuerName);

    // ---- save button ----
    const errorContainer = document.createElement('div');
    errorContainer.className = 'issuer-form-error-messages';
    errorContainer.setAttribute('role', 'alert');
    errorContainer.setAttribute('aria-live', 'assertive');
    form.appendChild(errorContainer);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-issuer-button';
    saveBtn.innerHTML = `<i class="fa fa-check"></i> ${t('issuer.btn.save')}`;
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

const addField = (opts) => createFormField({ ...opts, inputClass: 'issuer-config-field' });

const addTextArea = (opts) => createFormField({ ...opts, inputClass: 'issuer-config-field', isTextArea: true });

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
                `<span class="success-message">OK</span> ${t('issuer.jwks.valid', count)}`;
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
    if (!f.issuerName) return { isValid: false, error: new Error(t('issuer.validate.name.required')) };
    if (!f.issuer) return { isValid: false, error: new Error(t('issuer.validate.uri.required')) };
    const jt = f['jwks-type'] || 'url';
    if (jt === 'url' && !f['jwks-url']) return { isValid: false, error: new Error(t('issuer.validate.jwks.url.required')) };
    if (jt === 'file' && !f['jwks-file']) return { isValid: false, error: new Error(t('issuer.validate.jwks.file.required')) };
    if (jt === 'memory' && !f['jwks-content']) return { isValid: false, error: new Error(t('issuer.validate.jwks.content.required')) };
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
            displayUiSuccess(errEl, t('issuer.save.success'));
        } catch (error) {
            displayUiError(errEl, error, {}, 'issuerConfigEditor.error.saveFailedTitle');
        }
    } else {
        displayUiSuccess(errEl, t('issuer.save.success.standalone'));
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
                displayUiSuccess(globalErr, t('issuer.remove.success', issuerName));
                globalErr.classList.remove('hidden');
            }
        } catch (error) {
            if (globalErr) {
                displayUiError(globalErr, error, {}, 'issuerConfigEditor.error.removeFailedTitle');
                globalErr.classList.remove('hidden');
            }
        }
    } else if (issuerName && globalErr) {
        displayUiSuccess(globalErr, t('issuer.remove.success.standalone', issuerName));
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
    } catch (err) {
        log.error('Failed to load existing gateway issuers:', err);
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
                <th>${t('issuer.table.name')}</th>
                <th>${t('issuer.table.jwks.source')}</th>
                <th>${t('issuer.table.type')}</th>
                <th>${t('issuer.table.issuer.uri')}</th>
                <th>${t('issuer.table.actions')}</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    const tbody = table.querySelector('tbody');

    const names = Object.keys(issuers);
    if (names.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="5" class="empty-state">${t('issuer.table.empty')}</td>`;
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
                <i class="fa fa-pencil"></i> ${t('common.btn.edit')}</button>
            <button class="remove-issuer-gw-button"
                    title="Delete issuer">
                <i class="fa fa-trash"></i> ${t('common.btn.remove')}</button>
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
    const header = createIssuerNameHeader(idx, 'gw', issuerName);
    form.appendChild(header);

    // Fields (reuse shared builder)
    const fields = document.createElement('div');
    fields.className = 'form-fields';
    form.appendChild(fields);

    buildIssuerFields(form, fields, idx, properties, issuerName);

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
    saveBtn.innerHTML = `<i class="fa fa-check"></i> ${t('issuer.btn.save')}`;
    saveBtn.addEventListener('click', () => {
        errorContainer.innerHTML = '';
        saveIssuerGateway(form, errorContainer, ctx, tableRow, issuersContainer);
    });
    actionsDiv.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-issuer-button cancel-route-button';
    cancelBtn.innerHTML = `<i class="fa fa-times"></i> ${t('common.btn.cancel')}`;
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
        } catch (err) {
            log.warn('Failed to clean up old properties after rename:', err);
        }
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
                displayUiSuccess(globalErr, t('issuer.remove.success', issuerName));
                globalErr.classList.remove('hidden');
            }
        } catch (error) {
            if (globalErr) {
                displayUiError(globalErr, error, {}, 'issuerConfigEditor.error.removeFailedTitle');
                globalErr.classList.remove('hidden');
            }
        }
    } else if (issuerName && globalErr) {
        displayUiSuccess(globalErr, t('issuer.remove.success.standalone', issuerName));
        globalErr.classList.remove('hidden');
    }
};
