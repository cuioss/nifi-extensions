'use strict';

/**
 * Gateway route configuration CRUD editor component.
 * Reads route configuration from processor properties ({@code restapi.*})
 * and provides a list-first UX: summary table with inline edit/add/remove.
 *
 * @module js/rest-endpoint-config
 */

import { getComponentId } from './api.js';
import * as api from './api.js';
import {
    sanitizeHtml, displayUiError, displayUiSuccess, confirmRemoveRoute, t
} from './utils.js';

// Counter for unique form field IDs
let formCounter = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the route configuration CRUD editor inside the given element.
 * @param {HTMLElement} element  the #endpoint-config pane
 */
export const init = async (element) => {
    if (!element || element.querySelector('.route-config-editor')) return;

    const componentId = getComponentIdFromUrl();
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
    addBtn.innerHTML = '<i class="fa fa-plus"></i> Add Route';
    addBtn.addEventListener('click', () => {
        openInlineEditor(routesContainer, '', {}, componentId, null);
    });
    container.appendChild(addBtn);

    // Property export panel
    const exportSection = document.createElement('details');
    exportSection.className = 'property-export';
    exportSection.innerHTML = `
        <summary><i class="fa fa-code"></i> Export Properties</summary>
        <div class="property-export-content">
            <textarea class="property-export-textarea" readonly rows="10"></textarea>
            <button class="copy-properties-button" type="button">
                <i class="fa fa-clipboard"></i> Copy to Clipboard
            </button>
        </div>`;
    container.appendChild(exportSection);

    // Wire copy button
    exportSection.querySelector('.copy-properties-button').addEventListener('click', () => {
        const textarea = exportSection.querySelector('.property-export-textarea');
        const text = textarea.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showCopyFeedback(exportSection);
            });
        } else {
            textarea.select();
            document.execCommand('copy');
            showCopyFeedback(exportSection);
        }
    });

    // Refresh export content when panel is expanded
    exportSection.addEventListener('toggle', () => {
        if (exportSection.open) {
            refreshExportPanel(routesContainer);
        }
    });

    // Load existing config
    await loadExistingConfig(container, routesContainer, componentId);
};

export const cleanup = () => { /* no persistent resources */ };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getComponentIdFromUrl = () => getComponentId();

const ROUTE_PREFIX = 'restapi.';

/**
 * Detect whether a schema value is a file path or inline JSON.
 * @param {string} schemaValue  the raw schema string
 * @returns {'file'|'inline'} detected mode
 */
const detectSchemaMode = (schemaValue) => {
    const trimmed = (schemaValue || '').trim();
    return trimmed.startsWith('{') ? 'inline' : 'file';
};

/**
 * Read the schema value from whichever mode input is currently active.
 * @param {HTMLElement} form  the inline editor form
 * @returns {string} the active schema value (trimmed)
 */
const getActiveSchemaValue = (form) => {
    const fileRadio = form.querySelector('.schema-mode-file');
    if (fileRadio && fileRadio.checked) {
        return form.querySelector('.field-schema-file')?.value?.trim() || '';
    }
    return form.querySelector('.field-schema-inline')?.value?.trim() || '';
};

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
        renderRouteSummaryTable(routesContainer, {}, componentId);
        return;
    }
    try {
        const res = await api.getComponentProperties(componentId);
        const props = res.properties || {};
        renderGlobalSettings(container, props);
        const routes = parseRouteProperties(props);
        renderRouteSummaryTable(routesContainer, routes, componentId);
    } catch {
        renderRouteSummaryTable(routesContainer, {}, componentId);
    }
};

// ---------------------------------------------------------------------------
// Summary table
// ---------------------------------------------------------------------------

/**
 * Render the route summary table from parsed route data.
 * @param {HTMLElement} container  the .routes-container element
 * @param {Object} routes  parsed route map {name: {path, methods, enabled, ...}}
 * @param {string} componentId  NiFi processor component ID
 */
const renderRouteSummaryTable = (container, routes, componentId) => {
    // Remove any existing table
    const existing = container.querySelector('.route-summary-table');
    if (existing) existing.remove();

    const table = document.createElement('table');
    table.className = 'route-summary-table config-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Name</th>
                <th>Path</th>
                <th>Methods</th>
                <th>Enabled</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    const tbody = table.querySelector('tbody');

    const routeNames = Object.keys(routes);
    if (routeNames.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="5" class="empty-state">No routes configured. Click "Add Route" to create one.</td>';
        tbody.appendChild(emptyRow);
    } else {
        for (const name of routeNames) {
            const row = createTableRow(name, routes[name], componentId, container);
            tbody.appendChild(row);
        }
    }

    container.prepend(table);
};

/**
 * Build an origin badge HTML snippet for a route row.
 * @param {'persisted'|'modified'|'new'} origin  the route origin state
 * @returns {string} HTML string for the badge
 */
const buildOriginBadge = (origin) => {
    if (origin === 'new') {
        return ` <span class="origin-badge origin-new" title="${sanitizeHtml(t('origin.badge.new.title'))}">${sanitizeHtml(t('origin.badge.new'))}</span>`;
    }
    if (origin === 'modified') {
        return ` <span class="origin-badge origin-modified" title="${sanitizeHtml(t('origin.badge.modified.title'))}">${sanitizeHtml(t('origin.badge.modified'))}</span>`;
    }
    return ` <span class="origin-badge origin-persisted" title="${sanitizeHtml(t('origin.badge.persisted.title'))}"><i class="fa fa-lock"></i></span>`;
};

/**
 * Create a single summary table row for a route.
 * @param {string} name  route name
 * @param {Object} props  route properties
 * @param {string} componentId  NiFi processor component ID
 * @param {HTMLElement} routesContainer  the .routes-container element
 * @param {'persisted'|'modified'|'new'} origin  the route origin state
 * @returns {HTMLTableRowElement}
 */
const createTableRow = (name, props, componentId, routesContainer, origin = 'persisted') => {
    const row = document.createElement('tr');
    row.dataset.routeName = name;
    row.dataset.origin = origin;

    const enabledVal = props?.enabled !== 'false';
    const methods = props?.methods || '';
    const methodBadges = methods.split(',')
        .filter((m) => m.trim())
        .map((m) => `<span class="method-badge">${sanitizeHtml(m.trim())}</span>`)
        .join(' ');

    const statusClass = enabledVal ? 'status-enabled' : 'status-disabled';
    const statusText = enabledVal ? 'Enabled' : 'Disabled';

    const schemaBadge = (props?.schema?.trim())
        ? ' <span class="schema-badge">Schema</span>' : '';

    const originBadge = buildOriginBadge(origin);

    row.innerHTML = `
        <td>${sanitizeHtml(name)}${originBadge}</td>
        <td>${sanitizeHtml(props?.path || '')}${schemaBadge}</td>
        <td>${methodBadges || '<span class="empty-state">—</span>'}</td>
        <td><span class="${statusClass}">${statusText}</span></td>
        <td>
            <button class="edit-route-button" title="Edit route"><i class="fa fa-pencil"></i> Edit</button>
            <button class="remove-route-button" title="Delete route"><i class="fa fa-trash"></i> Remove</button>
        </td>`;

    row.querySelector('.edit-route-button').addEventListener('click', () => {
        // Close any currently open editor first
        closeActiveEditor(routesContainer);
        row.classList.add('hidden');
        openInlineEditor(routesContainer, name, props, componentId, row);
    });

    row.querySelector('.remove-route-button').addEventListener('click', async () => {
        await confirmRemoveRoute(name, () => removeRoute(row, name, routesContainer, componentId));
    });

    return row;
};

/**
 * Update a table row's cells after a successful save.
 * @param {HTMLTableRowElement} row  the table row to update
 * @param {Object} formData  extracted form data
 */
const updateTableRow = (row, formData) => {
    // Mark persisted routes as modified after edit
    if (row.dataset.origin === 'persisted') {
        row.dataset.origin = 'modified';
    }
    const origin = row.dataset.origin || 'persisted';
    const originBadge = buildOriginBadge(origin);

    const cells = row.querySelectorAll('td');
    cells[0].innerHTML = `${sanitizeHtml(formData.routeName)}${originBadge}`;
    const schemaBadge = formData.schema?.trim()
        ? ' <span class="schema-badge">Schema</span>' : '';
    cells[1].innerHTML = `${sanitizeHtml(formData.path)}${schemaBadge}`;

    const methodBadges = (formData.methods || '').split(',')
        .filter((m) => m.trim())
        .map((m) => `<span class="method-badge">${sanitizeHtml(m.trim())}</span>`)
        .join(' ');
    cells[2].innerHTML = methodBadges || '<span class="empty-state">—</span>';

    const statusClass = formData.enabled ? 'status-enabled' : 'status-disabled';
    const statusText = formData.enabled ? 'Enabled' : 'Disabled';
    cells[3].innerHTML = `<span class="${statusClass}">${statusText}</span>`;

    row.dataset.routeName = formData.routeName;
};

/**
 * Close any currently open inline editor in the routes container.
 * @param {HTMLElement} routesContainer
 */
const closeActiveEditor = (routesContainer) => {
    const openForm = routesContainer.querySelector('.route-form');
    if (openForm) {
        // Restore hidden table row if editing an existing route
        const hiddenRow = routesContainer.querySelector('tr.hidden[data-route-name]');
        if (hiddenRow) hiddenRow.classList.remove('hidden');
        openForm.remove();
    }
};

// ---------------------------------------------------------------------------
// Inline editor
// ---------------------------------------------------------------------------

/**
 * Open an inline editor form below the table (or replacing a table row).
 * @param {HTMLElement} routesContainer  the .routes-container element
 * @param {string} routeName  existing route name, or '' for new route
 * @param {Object} properties  existing route properties, or {} for new route
 * @param {string} componentId  NiFi processor component ID
 * @param {HTMLTableRowElement|null} tableRow  the table row being edited, or null for new route
 */
const openInlineEditor = (routesContainer, routeName, properties, componentId, tableRow) => {
    // Close any existing editor first
    closeActiveEditor(routesContainer);
    // Re-hide the current row if editing an existing route
    if (tableRow) tableRow.classList.add('hidden');

    const idx = formCounter++;
    const form = document.createElement('div');
    form.className = 'route-form inline-edit';
    form.dataset.originalName = routeName || '';

    const enabledVal = properties?.enabled !== 'false';
    const hasSchema = !!(properties?.schema && properties.schema.trim());

    // ---- header (name + enabled) ----
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
        </label>`;
    form.appendChild(header);

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

    // ---- schema validation toggle ----
    const schemaToggle = document.createElement('div');
    schemaToggle.className = 'form-field field-container-schema-toggle';
    schemaToggle.innerHTML = `
        <label class="schema-toggle-label" for="schema-check-${idx}">
            <input type="checkbox" id="schema-check-${idx}"
                   class="schema-validation-checkbox"
                   ${hasSchema ? 'checked' : ''}
                   aria-label="Enable Schema Validation">
            Schema Validation
        </label>`;
    form.appendChild(schemaToggle);

    // ---- schema mode toggle + inputs (hidden by default unless route has schema) ----
    const schemaContainer = document.createElement('div');
    schemaContainer.className = `form-field field-container-schema${hasSchema ? '' : ' hidden'}`;

    const schemaVal = properties?.schema || '';
    const mode = detectSchemaMode(schemaVal);
    const fileVal = mode === 'file' ? schemaVal : '';
    const inlineVal = mode === 'inline' ? schemaVal : '';

    schemaContainer.innerHTML = `
        <div class="schema-mode-toggle">
            <label class="schema-mode-label">
                <input type="radio" name="schema-mode-${idx}" class="schema-mode-file"
                       ${mode === 'file' ? 'checked' : ''}>
                File path
            </label>
            <label class="schema-mode-label">
                <input type="radio" name="schema-mode-${idx}" class="schema-mode-inline"
                       ${mode === 'inline' ? 'checked' : ''}>
                Inline JSON
            </label>
        </div>
        <div class="schema-file-input${mode === 'file' ? '' : ' hidden'}">
            <input type="text" id="field-schema-file-${idx}" name="schema-file"
                   class="field-schema-file form-input route-config-field"
                   placeholder="./conf/schemas/my-schema.json"
                   value="${sanitizeHtml(fileVal)}"
                   aria-label="Schema file path">
        </div>
        <div class="schema-inline-input${mode === 'inline' ? '' : ' hidden'}">
            <textarea id="field-schema-inline-${idx}" name="schema-inline"
                      class="field-schema-inline form-input route-config-field"
                      placeholder='{"type":"object","properties":{}}'
                      rows="5" aria-label="Inline JSON Schema"
            >${sanitizeHtml(inlineVal)}</textarea>
        </div>`;
    form.appendChild(schemaContainer);

    // Wire radio toggle
    const fileRadio = schemaContainer.querySelector('.schema-mode-file');
    const inlineRadio = schemaContainer.querySelector('.schema-mode-inline');
    const fileDiv = schemaContainer.querySelector('.schema-file-input');
    const inlineDiv = schemaContainer.querySelector('.schema-inline-input');

    fileRadio.addEventListener('change', () => {
        fileDiv.classList.remove('hidden');
        inlineDiv.classList.add('hidden');
    });
    inlineRadio.addEventListener('change', () => {
        inlineDiv.classList.remove('hidden');
        fileDiv.classList.add('hidden');
    });

    // Wire schema checkbox toggle
    const schemaCheckbox = schemaToggle.querySelector('.schema-validation-checkbox');
    schemaCheckbox.addEventListener('change', () => {
        if (schemaCheckbox.checked) {
            schemaContainer.classList.remove('hidden');
        } else {
            schemaContainer.classList.add('hidden');
        }
    });

    // ---- error messages ----
    const errorContainer = document.createElement('div');
    errorContainer.className = 'route-form-error-messages';
    errorContainer.setAttribute('role', 'alert');
    errorContainer.setAttribute('aria-live', 'assertive');
    form.appendChild(errorContainer);

    // ---- action buttons: Save + Cancel ----
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'route-form-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-route-button';
    saveBtn.innerHTML = '<i class="fa fa-check"></i> Save Route';
    saveBtn.addEventListener('click', () => {
        errorContainer.innerHTML = '';
        saveRoute(form, errorContainer, componentId, tableRow, routesContainer);
    });
    actionsDiv.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-route-button';
    cancelBtn.innerHTML = '<i class="fa fa-times"></i> Cancel';
    cancelBtn.addEventListener('click', () => {
        if (tableRow) {
            tableRow.classList.remove('hidden');
        }
        form.remove();
    });
    actionsDiv.appendChild(cancelBtn);

    form.appendChild(actionsDiv);

    // Insert form after the table
    routesContainer.appendChild(form);
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

// ---------------------------------------------------------------------------
// Save / Remove
// ---------------------------------------------------------------------------

const extractFormFields = (form) => {
    const q = (sel) => form.querySelector(sel)?.value?.trim() || '';
    const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
    const schemaEnabled = schemaCheckbox ? schemaCheckbox.checked : false;
    return {
        routeName: q('.route-name'),
        path: q('.field-path'),
        methods: q('.field-methods'),
        enabled: form.querySelector('.route-enabled')?.checked !== false,
        'required-roles': q('.field-required-roles'),
        'required-scopes': q('.field-required-scopes'),
        schema: schemaEnabled ? getActiveSchemaValue(form) : ''
    };
};

const validateFormData = (f, routesContainer, originalName) => {
    if (!f.routeName) return { isValid: false, error: new Error('Route name is required.') };
    if (!/^[a-zA-Z0-9_-]+$/.test(f.routeName)) {
        return { isValid: false, error: new Error('Route name can only contain alphanumeric characters, hyphens, and underscores.') };
    }
    // Check for duplicate route names (exclude the route being edited)
    if (routesContainer && f.routeName !== originalName) {
        const existing = routesContainer.querySelector(`tr[data-route-name="${CSS.escape(f.routeName)}"]`);
        if (existing) {
            return { isValid: false, error: new Error(`A route named "${f.routeName}" already exists.`) };
        }
    }
    if (!f.path) return { isValid: false, error: new Error('Path is required.') };
    return { isValid: true };
};

const buildPropertyUpdates = (name, f) => {
    const u = {};
    u[`${ROUTE_PREFIX}${name}.path`] = f.path;
    u[`${ROUTE_PREFIX}${name}.enabled`] = String(f.enabled);
    u[`${ROUTE_PREFIX}${name}.methods`] = f.methods || null;
    u[`${ROUTE_PREFIX}${name}.required-roles`] = f['required-roles'] || null;
    u[`${ROUTE_PREFIX}${name}.required-scopes`] = f['required-scopes'] || null;
    u[`${ROUTE_PREFIX}${name}.schema`] = f.schema || null;
    return u;
};

// ---------------------------------------------------------------------------
// Property export
// ---------------------------------------------------------------------------

/**
 * Build property export text from current route table state.
 * @param {HTMLElement} routesContainer  the .routes-container element
 * @returns {string} property lines
 */
const buildExportText = (routesContainer) => {
    const rows = routesContainer.querySelectorAll('tr[data-route-name]');
    const lines = [];
    for (const row of rows) {
        const name = row.dataset.routeName;
        const origin = row.dataset.origin || 'persisted';
        const prefix = (origin === 'new' || origin === 'modified') ? '# [session-only] ' : '';
        const cells = row.querySelectorAll('td');
        // cells: 0=name, 1=path(+badge), 2=methods, 3=enabled, 4=actions
        const pathText = cells[1]?.textContent?.trim() || '';
        const methodBadges = cells[2]?.querySelectorAll('.method-badge') || [];
        const methods = Array.from(methodBadges).map((b) => b.textContent.trim()).join(',');
        const enabled = cells[3]?.textContent?.trim() === 'Enabled';
        const hasSchemaBadge = !!cells[1]?.querySelector('.schema-badge');

        lines.push(`${prefix}${ROUTE_PREFIX}${name}.path = ${pathText}`);
        if (methods) lines.push(`${prefix}${ROUTE_PREFIX}${name}.methods = ${methods}`);
        if (!enabled) lines.push(`${prefix}${ROUTE_PREFIX}${name}.enabled = false`);
        if (hasSchemaBadge) {
            // Schema value is not stored in the table; it was saved to properties
            lines.push(`${prefix}${ROUTE_PREFIX}${name}.schema = <see processor properties>`);
        }
    }
    return lines.join('\n');
};

/**
 * Refresh the export panel textarea content.
 * @param {HTMLElement} routesContainer  the .routes-container element
 */
const refreshExportPanel = (routesContainer) => {
    const editor = routesContainer.closest('.route-config-editor');
    if (!editor) return;
    const textarea = editor.querySelector('.property-export-textarea');
    if (textarea) {
        textarea.value = buildExportText(routesContainer);
    }
};

/**
 * Show brief "Copied!" feedback on the copy button.
 * @param {HTMLElement} exportSection  the .property-export element
 */
const showCopyFeedback = (exportSection) => {
    const btn = exportSection.querySelector('.copy-properties-button');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa fa-check"></i> Copied!';
    setTimeout(() => { btn.innerHTML = original; }, 2000);
};

/**
 * Show an info banner warning that changes are session-only.
 * @param {HTMLElement} routesContainer  the .routes-container element
 */
const showInfoBanner = (routesContainer) => {
    // Remove any existing banner to avoid duplicates
    const editor = routesContainer.closest('.route-config-editor');
    if (!editor) return;
    const existing = editor.querySelector('.info-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'info-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
        'Changes are applied to the current session only. ' +
        'To make them permanent, export the properties below and add them to your processor configuration.';
    // Insert before the routes container
    routesContainer.parentNode.insertBefore(banner, routesContainer);
};

/**
 * Save route: validate, persist, update table row, close editor.
 * @param {HTMLElement} form  the inline editor form
 * @param {HTMLElement} errEl  error display element
 * @param {string} componentId  NiFi processor component ID
 * @param {HTMLTableRowElement|null} tableRow  the table row being edited (null for new)
 * @param {HTMLElement} routesContainer  the .routes-container element
 */
const saveRoute = async (form, errEl, componentId, tableRow, routesContainer) => {
    const f = extractFormFields(form);
    const originalName = form.dataset.originalName || '';
    const v = validateFormData(f, routesContainer, originalName);
    if (!v.isValid) { displayUiError(errEl, v.error, {}, 'routeConfigEditor.error.title'); return; }

    const nameChanged = originalName && originalName !== f.routeName;

    const updates = buildPropertyUpdates(f.routeName, f);

    // If the route was renamed, clear old properties first
    if (nameChanged) {
        const prefix = `${ROUTE_PREFIX}${originalName}.`;
        try {
            const res = await api.getComponentProperties(componentId);
            const props = res.properties || {};
            for (const key of Object.keys(props)) {
                if (key.startsWith(prefix)) updates[key] = null;
            }
        } catch { /* ignore — old props will remain as orphans */ }
    }

    if (componentId) {
        try {
            await api.updateComponentProperties(componentId, updates);
            form.dataset.originalName = f.routeName;

            if (tableRow) {
                // Update the existing table row and show it
                updateTableRow(tableRow, f);
                tableRow.classList.remove('hidden');
            } else {
                // New route — add a row to the table
                addRowToTable(routesContainer, f, componentId);
            }
            form.remove();

            showInfoBanner(routesContainer);
            refreshExportPanel(routesContainer);
        } catch (error) {
            displayUiError(errEl, error, {}, 'routeConfigEditor.error.saveFailedTitle');
        }
    } else {
        form.dataset.originalName = f.routeName;
        if (tableRow) {
            updateTableRow(tableRow, f);
            tableRow.classList.remove('hidden');
        } else {
            addRowToTable(routesContainer, f, componentId);
        }
        form.remove();

        showInfoBanner(routesContainer);
        refreshExportPanel(routesContainer);
    }
};

/**
 * Add a new row to the summary table after saving a new route.
 * @param {HTMLElement} routesContainer
 * @param {Object} formData
 * @param {string} componentId
 */
const addRowToTable = (routesContainer, formData, componentId) => {
    const table = routesContainer.querySelector('.route-summary-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');

    // Remove empty-state row if present
    const emptyRow = tbody.querySelector('.empty-state');
    if (emptyRow) emptyRow.closest('tr').remove();

    const props = {
        path: formData.path,
        methods: formData.methods,
        enabled: String(formData.enabled),
        'required-roles': formData['required-roles'],
        'required-scopes': formData['required-scopes'],
        schema: formData.schema
    };
    const row = createTableRow(formData.routeName, props, componentId, routesContainer, 'new');
    tbody.appendChild(row);
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

/**
 * Remove a route: delete the table row and clear properties.
 * @param {HTMLTableRowElement} row  the table row
 * @param {string} routeName  route name
 * @param {HTMLElement} routesContainer  the .routes-container
 * @param {string} componentId  NiFi processor component ID
 */
const removeRoute = async (row, routeName, routesContainer, componentId) => {
    row.remove();

    // Also close any open editor for this route
    const openForm = routesContainer.querySelector('.route-form');
    if (openForm && openForm.dataset.originalName === routeName) {
        openForm.remove();
    }

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

    refreshExportPanel(routesContainer);
};
