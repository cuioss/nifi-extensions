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
    sanitizeHtml, displayUiError, displayUiSuccess, confirmRemoveRoute, t,
    buildOriginBadge
} from './utils.js';
import { createMethodChipInput } from './method-chip-input.js';
import { createAuthModeChipInput } from './auth-mode-chip-input.js';
import { createContextHelp, createFormField } from './context-help.js';

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
        <h2>${t('route.heading')}</h2>
        <div class="global-settings-display"></div>
        <div class="management-endpoints-display"></div>
        <div class="global-error-messages route-form-error-messages hidden"
             role="alert" aria-live="assertive"></div>
        <h3 class="api-routes-heading">${t('route.api.heading')}</h3>
        <div class="routes-container"></div>`;

    const routesContainer = container.querySelector('.routes-container');

    // "Add Route" button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-route-button';
    addBtn.innerHTML = `<i class="fa fa-plus"></i> ${t('route.btn.add')}`;
    addBtn.addEventListener('click', () => {
        openInlineEditor(routesContainer, '', {}, componentId, null);
    });
    container.appendChild(addBtn);

    // Connection map panel
    const connectionMapContainer = document.createElement('div');
    connectionMapContainer.className = 'connection-map-container';
    container.appendChild(connectionMapContainer);

    // Property export panel
    const exportSection = document.createElement('details');
    exportSection.className = 'property-export';
    exportSection.innerHTML = `
        <summary><i class="fa fa-code"></i> ${t('route.export.heading')}</summary>
        <div class="property-export-content">
            <textarea class="property-export-textarea" readonly rows="10"></textarea>
            <button class="copy-properties-button" type="button">
                <i class="fa fa-clipboard"></i> ${t('route.export.copy')}
            </button>
        </div>`;
    container.appendChild(exportSection);

    // Wire copy button
    exportSection.querySelector('.copy-properties-button').addEventListener('click', () => {
        const textarea = exportSection.querySelector('.property-export-textarea');
        const text = textarea.value;
        navigator.clipboard.writeText(text).then(() => {
            showCopyFeedback(exportSection);
        });
    });

    // Refresh export content when panel is expanded
    exportSection.addEventListener('toggle', () => {
        if (exportSection.open) {
            refreshExportPanel(routesContainer);
        }
    });

    // Load existing config
    await loadExistingConfig(container, routesContainer, componentId);
    refreshConnectionMap(routesContainer);
};

export const cleanup = () => { /* no persistent resources */ };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getComponentIdFromUrl = () => getComponentId();

const ROUTE_PREFIX = 'restapi.';
const BODY_METHODS = ['POST', 'PUT', 'PATCH'];
const DEFAULT_ATTACHMENTS_HARD_LIMIT = 20;
let attachmentsHardLimit = DEFAULT_ATTACHMENTS_HARD_LIMIT;

/**
 * Build the tracking badge HTML for a route, showing tracking mode and attachment bounds.
 * @param {string} trackingMode  'none', 'simple', or 'attachments'
 * @param {string} methods  comma-separated method list (empty = all methods)
 * @param {number} [minCount]  minimum attachment count (only for attachments mode)
 * @param {number} [maxCount]  maximum attachment count (only for attachments mode)
 * @returns {string} HTML string or empty
 */
const buildTrackingBadge = (trackingMode, methods, minCount, maxCount) => {
    const mode = (trackingMode || 'none').toLowerCase();
    if (mode === 'none') return '';
    const parsed = (methods || '').split(',').map((m) => m.trim().toUpperCase()).filter(Boolean);
    const tracked = parsed.length === 0
        ? BODY_METHODS
        : parsed.filter((m) => BODY_METHODS.includes(m));
    if (tracked.length === 0) return '';
    const methodSuffix = parsed.length > 0 ? ` (${tracked.join(', ')})` : '';
    if (mode === 'attachments') {
        const min = Number.parseInt(minCount, 10) || 0;
        const max = Number.parseInt(maxCount, 10) || 0;
        const bounds = max > 0 ? `${min}-${max}` : `${min}+`;
        return ` <span class="tracking-badge" title="${t('route.table.tracking.title')}"><i class="fa fa-clock"></i> ${t('route.table.tracking')} + ${t('route.form.tracking.attachments')} (${bounds})${methodSuffix}</span>`;
    }
    return ` <span class="tracking-badge" title="${t('route.table.tracking.title')}"><i class="fa fa-clock"></i> ${t('route.table.tracking')}${methodSuffix}</span>`;
};
const MGMT_PREFIX = 'rest.gateway.management.';

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
    if (fileRadio?.checked) {
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

const getGlobalSettingsKeys = () => ({
    'rest.gateway.listening.port': t('route.global.listening.port'),
    'rest.gateway.max.request.size': t('route.global.max.request.size'),
    'rest.gateway.request.queue.size': t('route.global.queue.size'),
    'rest.gateway.ssl.context.service': t('route.global.ssl.enabled'),
    'rest.gateway.listening.host': t('route.global.listening.host')
});

const GLOBAL_HELP_KEYS = {
    'rest.gateway.listening.port': 'contexthelp.global.listening.port',
    'rest.gateway.max.request.size': 'contexthelp.global.max.request.size',
    'rest.gateway.request.queue.size': 'contexthelp.global.queue.size',
    'rest.gateway.ssl.context.service': 'contexthelp.global.ssl.enabled',
    'rest.gateway.listening.host': 'contexthelp.global.listening.host'
};

const renderGlobalSettings = (container, properties) => {
    const settingsEl = container.querySelector('.global-settings-display');
    settingsEl.innerHTML = `<h3>${t('route.global.heading')}</h3>`;

    const table = document.createElement('table');
    table.className = 'config-table';
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    for (const [key, label] of Object.entries(getGlobalSettingsKeys())) {
        const value = properties[key];
        let display;
        if (key === 'rest.gateway.ssl.context.service') {
            display = value?.trim() ? t('common.status.yes') : t('common.status.no');
        } else if (key === 'rest.gateway.max.request.size') {
            display = formatBytes(value ? Number.parseInt(value, 10) : null);
        } else {
            display = value || t('common.na');
        }

        // Data row with label, value, and help button
        const row = document.createElement('tr');
        const labelCell = document.createElement('td');
        labelCell.textContent = label;
        row.appendChild(labelCell);

        const valueCell = document.createElement('td');
        valueCell.textContent = display;
        row.appendChild(valueCell);

        const helpCell = document.createElement('td');
        const helpKey = GLOBAL_HELP_KEYS[key];
        if (helpKey) {
            const { button, panel } = createContextHelp({
                helpKey, propertyKey: key, currentValue: display
            });
            helpCell.appendChild(button);

            // Hidden row for the disclosure panel
            const panelRow = document.createElement('tr');
            panelRow.className = 'context-help-row';
            const panelCell = document.createElement('td');
            panelCell.setAttribute('colspan', '3');
            panelCell.appendChild(panel);
            panelRow.appendChild(panelCell);

            row.appendChild(helpCell);
            tbody.appendChild(row);
            tbody.appendChild(panelRow);
        } else {
            row.appendChild(helpCell);
            tbody.appendChild(row);
        }
    }

    settingsEl.appendChild(table);
};

const formatBytes = (bytes) => {
    if (bytes == null || Number.isNaN(bytes)) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
};

const AUTH_MODE_LABELS = {
    'bearer': () => t('route.authmode.bearer'),
    'none': () => t('route.authmode.none'),
    'local-only': () => t('route.authmode.local-only')
};

const formatAuthMode = (mode) => {
    const fn = AUTH_MODE_LABELS[mode];
    return fn ? fn() : mode || t('route.authmode.bearer');
};

/**
 * Format a comma-separated auth-mode string into combined badge HTML.
 * E.g. "local-only,bearer" -> "Local Only, Bearer"
 * @param {string} authModeValue  comma-separated auth modes
 * @returns {string} HTML string with badge(s)
 */
const formatAuthModeBadges = (authModeValue) => {
    const modes = (authModeValue || 'bearer').split(',').map((m) => m.trim()).filter(Boolean);
    const labels = modes.map((m) => formatAuthMode(m));
    const combined = labels.join(', ');
    const classes = modes.map((m) => `authmode-${sanitizeHtml(m)}`).join(' ');
    return `<span class="authmode-badge ${classes}">${sanitizeHtml(combined)}</span>`;
};

const renderManagementEndpoints = (container, managementEndpoints, componentId) => {
    const mgmtEl = container.querySelector('.management-endpoints-display');
    if (!mgmtEl || !managementEndpoints || managementEndpoints.length === 0) return;

    mgmtEl.innerHTML = `<h3>${t('route.management.heading')}</h3>`;
    const table = document.createElement('table');
    table.className = 'config-table management-endpoints-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>${t('route.management.table.name')}</th>
                <th>${t('route.management.table.path')}</th>
                <th>${t('route.table.methods')}</th>
                <th>${t('route.management.table.enabled')}</th>
                <th>${t('route.management.table.authmode')}</th>
                <th>${t('route.management.table.actions')}</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    const tbody = table.querySelector('tbody');
    for (const ep of managementEndpoints) {
        const row = document.createElement('tr');
        row.dataset.mgmtName = ep.name;
        row.dataset.mgmtEnabled = String(ep.enabled);
        row.dataset.mgmtAuthMode = ep.authMode || 'local-only,bearer';
        row.dataset.mgmtRoles = ep.requiredRoles || '';
        row.dataset.mgmtScopes = ep.requiredScopes || '';
        const enabledClass = ep.enabled ? 'status-enabled' : 'status-disabled';
        const enabledText = ep.enabled ? t('common.status.enabled') : t('common.status.disabled');
        const methodsList = Array.isArray(ep.methods) ? ep.methods : ['GET'];
        const methodBadgesHtml = methodsList.map((m) => `<span class="method-badge">${sanitizeHtml(m)}</span>`).join(' ');
        row.innerHTML = `
            <td>${sanitizeHtml(ep.name)}</td>
            <td>${sanitizeHtml(ep.path)}</td>
            <td>${methodBadgesHtml}</td>
            <td><span class="${enabledClass}">${enabledText}</span></td>
            <td>${formatAuthModeBadges(ep.authMode)}</td>
            <td>
                <button class="edit-route-button btn-edit" title="${t('route.management.edit.title')}">
                    <i class="fa fa-pencil"></i> ${t('mgmt.edit')}
                </button>
            </td>`;

        row.querySelector('.btn-edit').addEventListener('click', () => {
            openManagementEditor(mgmtEl, ep, componentId, row);
        });

        tbody.appendChild(row);
    }
    mgmtEl.appendChild(table);
};

// ---------------------------------------------------------------------------
// Management endpoint inline editor
// ---------------------------------------------------------------------------

/**
 * Close any active management endpoint editor and restore hidden table rows.
 *
 * @param {HTMLElement} mgmtEl  the .management-endpoints-display element
 */
const closeActiveManagementEditor = (mgmtEl) => {
    const existingForm = mgmtEl.querySelector('.mgmt-edit-form');
    if (existingForm) {
        const prevRow = mgmtEl.querySelector('tr.hidden[data-mgmt-name]');
        if (prevRow) prevRow.classList.remove('hidden');
        existingForm.remove();
    }
};

/**
 * Open a simplified inline editor for a management endpoint (replaces the table row).
 * Read-only: endpoint name, path, methods (GET). Editable: enabled, auth-mode.
 *
 * @param {HTMLElement} mgmtEl  the .management-endpoints-display element
 * @param {Object} ep  management endpoint data { name, path, enabled, authMode, methods }
 * @param {string} componentId  NiFi processor component ID
 * @param {HTMLTableRowElement} tableRow  the table row being edited
 */
const openManagementEditor = (mgmtEl, ep, componentId, tableRow) => {
    closeActiveManagementEditor(mgmtEl);

    tableRow.classList.add('hidden');

    // Read current values from data attributes (updated after each save)
    // rather than the original ep object (captured at render time).
    const currentEnabled = tableRow.dataset.mgmtEnabled !== 'false';
    const currentAuthMode = tableRow.dataset.mgmtAuthMode || ep.authMode || 'bearer';
    const currentRoles = tableRow.dataset.mgmtRoles || '';
    const currentScopes = tableRow.dataset.mgmtScopes || '';

    const idx = formCounter++;
    const form = document.createElement('div');
    form.className = 'mgmt-edit-form route-form inline-edit';
    form.dataset.mgmtName = ep.name;

    // Read-only header
    const header = document.createElement('div');
    header.className = 'form-header';
    header.innerHTML = `<strong>${sanitizeHtml(ep.name)}</strong>
        <span class="empty-state">${sanitizeHtml(ep.path)}</span>
        <span class="method-badge">GET</span>`;
    form.appendChild(header);

    // Editable fields
    const fields = document.createElement('div');
    fields.className = 'form-fields';

    // Enabled checkbox
    const enabledContainer = document.createElement('div');
    enabledContainer.className = 'form-field';
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'route-enabled-label';
    enabledLabel.setAttribute('for', `mgmt-enabled-${idx}`);
    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.id = `mgmt-enabled-${idx}`;
    enabledCheckbox.className = 'mgmt-enabled route-enabled';
    if (currentEnabled) enabledCheckbox.checked = true;
    enabledCheckbox.setAttribute('aria-label', t('mgmt.enabled'));
    enabledLabel.appendChild(enabledCheckbox);
    enabledLabel.append(` ${t('mgmt.enabled')}`);
    enabledContainer.appendChild(enabledLabel);
    fields.appendChild(enabledContainer);

    // Auth-mode chip input
    const authModeChip = createAuthModeChipInput({
        container: fields,
        idx,
        value: currentAuthMode
    });

    // Required Roles field
    addField({
        container: fields, idx, name: 'required-roles',
        label: t('mgmt.roles.label'),
        placeholder: t('mgmt.roles.placeholder'),
        value: currentRoles,
        helpKey: 'contexthelp.route.roles',
        propertyKey: `rest.gateway.management.${ep.name}.required-roles`,
        currentValue: currentRoles
    });

    // Required Scopes field
    addField({
        container: fields, idx, name: 'required-scopes',
        label: t('mgmt.scopes.label'),
        placeholder: t('mgmt.scopes.placeholder'),
        value: currentScopes,
        helpKey: 'contexthelp.route.scopes',
        propertyKey: `rest.gateway.management.${ep.name}.required-scopes`,
        currentValue: currentScopes
    });

    // Hide roles/scopes when bearer is not among selected auth modes
    const mgmtRolesContainer = fields.querySelector('.field-container-required-roles');
    const mgmtScopesContainer = fields.querySelector('.field-container-required-scopes');
    const toggleMgmtRolesScopes = () => {
        const modes = (authModeChip.getValue() || '').split(',').map((m) => m.trim());
        const hasBearer = modes.includes('bearer');
        if (mgmtRolesContainer) mgmtRolesContainer.classList.toggle('hidden', !hasBearer);
        if (mgmtScopesContainer) mgmtScopesContainer.classList.toggle('hidden', !hasBearer);
    };
    const mgmtAuthModeHidden = fields.querySelector('.field-auth-mode');
    if (mgmtAuthModeHidden) mgmtAuthModeHidden.addEventListener('change', toggleMgmtRolesScopes);
    toggleMgmtRolesScopes();

    form.appendChild(fields);

    // Error messages
    const errorContainer = document.createElement('div');
    errorContainer.className = 'route-form-error-messages';
    errorContainer.setAttribute('role', 'alert');
    errorContainer.setAttribute('aria-live', 'assertive');
    form.appendChild(errorContainer);

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'route-form-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-route-button';
    saveBtn.innerHTML = `<i class="fa fa-check"></i> ${t('mgmt.save')}`;
    saveBtn.addEventListener('click', () => {
        errorContainer.innerHTML = '';
        const authModeValue = authModeChip.getValue();
        if (!authModeValue) {
            errorContainer.textContent = t('mgmt.authMode.required');
            return;
        }
        const rolesInput = fields.querySelector('.field-required-roles');
        const scopesInput = fields.querySelector('.field-required-scopes');
        const rolesValue = rolesInput ? rolesInput.value.trim() : '';
        const scopesValue = scopesInput ? scopesInput.value.trim() : '';
        saveManagementEndpoint({
            ep, componentId, enabled: enabledCheckbox.checked, authModeValue,
            rolesValue, scopesValue,
            form, tableRow, errEl: errorContainer
        });
    });
    actionsDiv.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-route-button';
    cancelBtn.innerHTML = `<i class="fa fa-times"></i> ${t('mgmt.cancel')}`;
    cancelBtn.addEventListener('click', () => {
        authModeChip.destroy();
        tableRow.classList.remove('hidden');
        form.remove();
    });
    actionsDiv.appendChild(cancelBtn);

    form.appendChild(actionsDiv);

    // Insert form after the table
    const table = mgmtEl.querySelector('.management-endpoints-table');
    if (table?.nextSibling) {
        mgmtEl.insertBefore(form, table.nextSibling);
    } else {
        mgmtEl.appendChild(form);
    }
};

/**
 * Save management endpoint changes via API.
 *
 * @param {Object} ep  original endpoint data
 * @param {string} componentId  NiFi processor component ID
 * @param {boolean} enabled  new enabled state
 * @param {string} authModeValue  comma-separated auth modes
 * @param {string} rolesValue  comma-separated required roles
 * @param {string} scopesValue  comma-separated required scopes
 * @param {HTMLElement} form  the editor form element
 * @param {HTMLTableRowElement} tableRow  the table row to update
 * @param {HTMLElement} errEl  error container element
 */
/**
 * Apply management endpoint save result to the UI (update row, close form, refresh export).
 * @param {HTMLTableRowElement} tableRow  the table row to update
 * @param {boolean} enabled  new enabled state
 * @param {string} authModeValue  comma-separated auth modes
 * @param {string} rolesValue  comma-separated required roles
 * @param {string} scopesValue  comma-separated required scopes
 * @param {HTMLElement} form  the editor form element
 */
const applyManagementSave = (tableRow, enabled, authModeValue, rolesValue, scopesValue, form) => {
    updateManagementTableRow(tableRow, enabled, authModeValue, rolesValue, scopesValue);
    tableRow.classList.remove('hidden');
    form.remove();
    const rc = tableRow.closest('.route-config-editor')?.querySelector('.routes-container');
    if (rc) refreshExportPanel(rc);
};

/**
 * Save management endpoint changes via API.
 *
 * @param {Object} opts  save options
 * @param {Object} opts.ep  original endpoint data
 * @param {string} opts.componentId  NiFi processor component ID
 * @param {boolean} opts.enabled  new enabled state
 * @param {string} opts.authModeValue  comma-separated auth modes
 * @param {string} opts.rolesValue  comma-separated required roles
 * @param {string} opts.scopesValue  comma-separated required scopes
 * @param {HTMLElement} opts.form  the editor form element
 * @param {HTMLTableRowElement} opts.tableRow  the table row to update
 * @param {HTMLElement} opts.errEl  error container element
 */
const saveManagementEndpoint = async ({
    ep, componentId, enabled, authModeValue,
    rolesValue, scopesValue, form, tableRow, errEl
}) => {
    const updates = {
        [`rest.gateway.management.${ep.name}.enabled`]: String(enabled),
        [`rest.gateway.management.${ep.name}.auth-mode`]: authModeValue,
        [`rest.gateway.management.${ep.name}.required-roles`]: rolesValue,
        [`rest.gateway.management.${ep.name}.required-scopes`]: scopesValue
    };

    if (!componentId) {
        applyManagementSave(tableRow, enabled, authModeValue, rolesValue, scopesValue, form);
        return;
    }

    try {
        await api.updateComponentProperties(componentId, updates);
        applyManagementSave(tableRow, enabled, authModeValue, rolesValue, scopesValue, form);
    } catch (error) {
        displayUiError(errEl, error, {}, 'routeConfigEditor.error.saveFailedTitle');
    }
};

/**
 * Update a management endpoint table row's cells after a successful save.
 * @param {HTMLTableRowElement} row  the table row to update
 * @param {boolean} enabled  new enabled state
 * @param {string} authModeValue  comma-separated auth modes
 * @param {string} rolesValue  comma-separated required roles
 * @param {string} scopesValue  comma-separated required scopes
 */
const updateManagementTableRow = (row, enabled, authModeValue, rolesValue, scopesValue) => {
    const cells = row.querySelectorAll('td');
    // cells: 0=name, 1=path, 2=enabled, 3=authmode, 4=actions
    const enabledClass = enabled ? 'status-enabled' : 'status-disabled';
    const enabledText = enabled ? t('common.status.enabled') : t('common.status.disabled');
    cells[2].innerHTML = `<span class="${enabledClass}">${enabledText}</span>`;
    cells[3].innerHTML = formatAuthModeBadges(authModeValue);
    row.dataset.mgmtEnabled = String(enabled);
    row.dataset.mgmtAuthMode = authModeValue;
    row.dataset.mgmtRoles = rolesValue;
    row.dataset.mgmtScopes = scopesValue;
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

        let gwRoutes = null;

        // Fetch gateway config for management endpoints and merged routes (retry once after delay)
        const loadGatewayConfig = async (retries = 1) => {
            try {
                const gwConfig = await api.fetchGatewayApi('/config');
                if (gwConfig?.managementEndpoints) {
                    renderManagementEndpoints(container, gwConfig.managementEndpoints, componentId);
                }
                // Use /config routes as authoritative source (includes external + NiFi routes)
                if (gwConfig?.routes) {
                    gwRoutes = gwConfig.routes;
                }
                if (gwConfig?.attachmentsHardLimit > 0) {
                    attachmentsHardLimit = gwConfig.attachmentsHardLimit;
                }
            } catch {
                if (retries > 0) {
                    await new Promise((r) => setTimeout(r, 2000));
                    return loadGatewayConfig(retries - 1);
                }
                /* gateway may not be running yet — fall back to NiFi properties only */
            }
        };
        await loadGatewayConfig();

        const connectedRels = await api.getConnectedRelationships(componentId);

        if (gwRoutes) {
            // Convert /config route array to route map with source info
            const routes = convertGatewayRoutesToMap(gwRoutes);
            renderRouteSummaryTable(routesContainer, routes, componentId, connectedRels);
        } else {
            // Fallback: parse routes from NiFi processor properties only
            const routes = parseRouteProperties(props);
            renderRouteSummaryTable(routesContainer, routes, componentId, connectedRels);
        }
    } catch {
        renderRouteSummaryTable(routesContainer, {}, componentId);
    }
};

/**
 * Convert a value that may be an array or string to a comma-separated string.
 * @param {*} value  the value to normalize
 * @param {string} [fallback='']  default if value is falsy
 * @returns {string}
 */
const toCommaSeparated = (value, fallback = '') =>
    Array.isArray(value) ? value.join(',') : (value || fallback);

/**
 * Convert gateway /config route array to the route map format used by the UI.
 * Each route includes a _source field indicating its origin.
 * @param {Array} gwRoutes  routes array from /config response
 * @returns {Object} route map {name: {path, methods, enabled, ..., _source}}
 */
const convertGatewayRoutesToMap = (gwRoutes) => {
    const routes = {};
    for (const route of gwRoutes) {
        if (!route.name || !route.enabled) continue;
        const name = route.name;
        routes[name] = {
            path: route.path || '',
            methods: toCommaSeparated(route.methods),
            enabled: route.enabled === false ? 'false' : 'true',
            'required-roles': toCommaSeparated(route.requiredRoles),
            'required-scopes': toCommaSeparated(route.requiredScopes),
            'auth-mode': route.authMode || 'bearer',
            'create-flowfile': route.createFlowFile === false ? 'false' : 'true',
            'tracking-mode': route.trackingMode || 'none',
            'attachments-min-count': route.attachmentsMinCount == null ? '' : String(route.attachmentsMinCount),
            'attachments-max-count': route.attachmentsMaxCount == null ? '' : String(route.attachmentsMaxCount),
            'attachments-timeout': route.attachmentsTimeout || '',
            _source: route.source || 'nifi'
        };
        if (route.schema) {
            routes[name].schema = route.schema;
        }
        if (route.successOutcome) {
            routes[name]['success-outcome'] = route.successOutcome;
        }
        if (route.maxRequestSize != null) {
            routes[name]['max-request-size'] = String(route.maxRequestSize);
        }
    }
    return routes;
};

// ---------------------------------------------------------------------------
// Summary table
// ---------------------------------------------------------------------------

/**
 * Render the route summary table from parsed route data.
 * @param {HTMLElement} container  the .routes-container element
 * @param {Object} routes  parsed route map {name: {path, methods, enabled, ...}}
 * @param {string} componentId  NiFi processor component ID
 * @param {Set<string>} [connectedRels]  set of relationship names wired on the NiFi canvas
 */
const renderRouteSummaryTable = (container, routes, componentId, connectedRels) => {
    // Remove any existing table
    const existing = container.querySelector('.route-summary-table');
    if (existing) existing.remove();

    const table = document.createElement('table');
    table.className = 'route-summary-table config-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>${t('route.table.name')}</th>
                <th>${t('route.table.connection')}</th>
                <th>${t('route.table.path')}</th>
                <th>${t('route.table.methods')}</th>
                <th>${t('route.table.authmode')}</th>
                <th>${t('route.table.enabled')}</th>
                <th>${t('route.table.actions')}</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    const tbody = table.querySelector('tbody');

    const routeNames = Object.keys(routes);
    if (routeNames.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="7" class="empty-state">${t('route.table.empty')}</td>`;
        tbody.appendChild(emptyRow);
    } else {
        for (const name of routeNames) {
            const routeProps = routes[name];
            const outcome = routeProps?.['success-outcome']?.trim() || name;
            const connected = !connectedRels || connectedRels.has(outcome);
            const source = routeProps?._source;
            const origin = (source === 'external' || source === 'both') ? 'external' : 'persisted';
            const row = createTableRow(name, routeProps, componentId, container, origin, connected);
            tbody.appendChild(row);
        }
    }

    container.prepend(table);
};

// buildOriginBadge imported from utils.js

/**
 * Create a single summary table row for a route.
 * @param {string} name  route name
 * @param {Object} props  route properties
 * @param {string} componentId  NiFi processor component ID
 * @param {HTMLElement} routesContainer  the .routes-container element
 * @param {'persisted'|'modified'|'new'|'external'} origin  the route origin state
 * @param {boolean} [connected=true]  whether the route's relationship is wired on the NiFi canvas
 * @returns {HTMLTableRowElement}
 */
const createTableRow = (name, props, componentId, routesContainer, origin = 'persisted', connected = false) => {
    const row = document.createElement('tr');
    row.dataset.routeName = name;
    row.dataset.origin = origin;

    const enabledVal = props?.enabled !== 'false';
    const createFlowFileVal = props?.['create-flowfile'] !== 'false';
    const methods = props?.methods || '';
    const methodBadges = methods.split(',')
        .filter((m) => m.trim())
        .map((m) => `<span class="method-badge">${sanitizeHtml(m.trim())}</span>`)
        .join(' ');

    const statusClass = enabledVal ? 'status-enabled' : 'status-disabled';
    const statusText = enabledVal ? t('common.status.enabled') : t('common.status.disabled');

    const schemaBadge = (props?.schema?.trim())
        ? ` <span class="schema-badge" title="${t('route.table.schema.title')}"><i class="fa fa-check-circle"></i> Schema</span>` : '';
    const trackingBadge = buildTrackingBadge(props?.['tracking-mode'], methods,
        props?.['attachments-min-count'], props?.['attachments-max-count']);

    const originBadge = buildOriginBadge(origin);

    // Connection column: show "—" when create-flowfile=false, custom badge when differs from name
    let outcomeCell;
    if (createFlowFileVal) {
        const outcome = (props?.['success-outcome']?.trim()) || name;
        outcomeCell = sanitizeHtml(outcome);
    } else {
        outcomeCell = '<span class="empty-state">\u2014</span>';
    }

    const authMode = props?.['auth-mode'] || 'bearer';
    row.dataset.authMode = authMode;
    const authModeBadge = formatAuthModeBadges(authMode);

    const isExternalOnly = origin === 'external';
    // External routes can be edited (saves as NiFi override) but not deleted (config file owns them)
    const actionsHtml = isExternalOnly
        ? `<button class="edit-route-button" title="${sanitizeHtml(t('route.source.external.edit.tooltip'))}"><i class="fa fa-pencil"></i> ${t('common.btn.edit')}</button>`
        : `<button class="edit-route-button" title="Edit route"><i class="fa fa-pencil"></i> ${t('common.btn.edit')}</button>
            <button class="remove-route-button" title="Delete route"><i class="fa fa-trash"></i> ${t('common.btn.remove')}</button>`;

    row.innerHTML = `
        <td>${sanitizeHtml(name)}${originBadge}</td>
        <td>${outcomeCell}</td>
        <td>${sanitizeHtml(props?.path || '')}${schemaBadge}${trackingBadge}</td>
        <td>${methodBadges || '<span class="empty-state">—</span>'}</td>
        <td>${authModeBadge}</td>
        <td><span class="${statusClass}">${statusText}</span></td>
        <td>${actionsHtml}</td>`;

    // Store props reference on the row so it can be updated after save
    row._routeProps = props;

    row.querySelector('.edit-route-button').addEventListener('click', () => {
        // Close any currently open editor first
        closeActiveEditor(routesContainer);
        row.classList.add('hidden');
        openInlineEditor(routesContainer, row.dataset.routeName, row._routeProps, componentId, row);
    });

    if (!isExternalOnly) {
        row.querySelector('.remove-route-button').addEventListener('click', async () => {
            await confirmRemoveRoute(name, () => removeRoute(row, name, routesContainer, componentId));
        });
    }

    return row;
};

/**
 * Update a table row's cells after a successful save.
 * @param {HTMLTableRowElement} row  the table row to update
 * @param {Object} formData  extracted form data
 */
const updateTableRow = (row, formData) => {
    const origin = row.dataset.origin || 'persisted';
    const originBadge = buildOriginBadge(origin);

    const cells = row.querySelectorAll('td');
    // cells: 0=name, 1=connection, 2=path, 3=methods, 4=authmode, 5=enabled, 6=actions
    cells[0].innerHTML = `${sanitizeHtml(formData.routeName)}${originBadge}`;

    // Connection column
    const createFlowFileVal = formData['create-flowfile'] !== false && formData['create-flowfile'] !== 'false';
    if (createFlowFileVal) {
        const outcome = formData['success-outcome']?.trim() || formData.routeName;
        cells[1].innerHTML = sanitizeHtml(outcome);
    } else {
        cells[1].innerHTML = '<span class="empty-state">\u2014</span>';
    }

    const schemaBadge = formData.schema?.trim()
        ? ` <span class="schema-badge" title="${t('route.table.schema.title')}"><i class="fa fa-check-circle"></i> Schema</span>` : '';
    const trackingBadge = buildTrackingBadge(formData['tracking-mode'], formData.methods,
        formData['attachments-min-count'], formData['attachments-max-count']);
    cells[2].innerHTML = `${sanitizeHtml(formData.path)}${schemaBadge}${trackingBadge}`;

    const methodBadges = (formData.methods || '').split(',')
        .filter((m) => m.trim())
        .map((m) => `<span class="method-badge">${sanitizeHtml(m.trim())}</span>`)
        .join(' ');
    cells[3].innerHTML = methodBadges || '<span class="empty-state">—</span>';

    const authModeVal = formData['auth-mode'] || 'bearer';
    row.dataset.authMode = authModeVal;
    cells[4].innerHTML = formatAuthModeBadges(authModeVal);

    const statusClass = formData.enabled ? 'status-enabled' : 'status-disabled';
    const statusText = formData.enabled ? t('common.status.enabled') : t('common.status.disabled');
    cells[5].innerHTML = `<span class="${statusClass}">${statusText}</span>`;

    row.dataset.routeName = formData.routeName;

    // Keep the stored props in sync so re-editing shows current values
    if (row._routeProps) {
        row._routeProps.path = formData.path;
        row._routeProps.methods = formData.methods;
        row._routeProps.enabled = String(formData.enabled);
        row._routeProps['required-roles'] = formData['required-roles'] || '';
        row._routeProps['required-scopes'] = formData['required-scopes'] || '';
        row._routeProps['auth-mode'] = formData['auth-mode'] || 'bearer';
        row._routeProps['max-request-size'] = formData['max-request-size'] || '';
        row._routeProps.schema = formData.schema || '';
        row._routeProps['success-outcome'] = formData['success-outcome'] || '';
        row._routeProps['create-flowfile'] = formData['create-flowfile'] === false ? 'false' : 'true';
        row._routeProps['tracking-mode'] = formData['tracking-mode'] || 'none';
        row._routeProps['attachments-min-count'] = formData['attachments-min-count'] || '';
        row._routeProps['attachments-max-count'] = formData['attachments-max-count'] || '';
        row._routeProps['attachments-timeout'] = formData['attachments-timeout'] || '';
    }
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
// Section helper
// ---------------------------------------------------------------------------

const createSection = (titleKey) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'route-form-section';
    const legend = document.createElement('legend');
    legend.className = 'route-form-section-title';
    legend.textContent = t(titleKey);
    fieldset.appendChild(legend);
    return fieldset;
};

// ---------------------------------------------------------------------------
// Inline editor — section builders
// ---------------------------------------------------------------------------

/** Build the header section (name + enabled checkbox) for the inline editor. */
const buildEditorHeader = (idx, rn, routeName, enabledVal) => {
    const header = document.createElement('div');
    header.className = 'form-header';

    const nameLabel = document.createElement('label');
    nameLabel.setAttribute('for', `route-name-${idx}`);
    nameLabel.textContent = `${t('route.form.name.label')}:`;
    const nameHelp = createContextHelp({
        helpKey: 'contexthelp.route.name',
        propertyKey: `restapi.${rn}.*`,
        currentValue: routeName
    });
    nameLabel.appendChild(nameHelp.button);
    header.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `route-name-${idx}`;
    nameInput.className = 'route-name';
    nameInput.placeholder = t('route.form.name.placeholder');
    nameInput.title = t('route.form.name.title');
    nameInput.setAttribute('aria-label', t('route.form.name.label'));
    nameInput.value = routeName || '';
    header.appendChild(nameInput);

    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'route-enabled-label';
    enabledLabel.setAttribute('for', `route-enabled-${idx}`);
    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.id = `route-enabled-${idx}`;
    enabledCheckbox.className = 'route-enabled';
    if (enabledVal) enabledCheckbox.checked = true;
    enabledCheckbox.setAttribute('aria-label', 'Route Enabled');
    enabledLabel.appendChild(enabledCheckbox);
    enabledLabel.append(` ${t('route.form.enabled')}`);
    const enabledHelp = createContextHelp({
        helpKey: 'contexthelp.route.enabled',
        propertyKey: `restapi.${rn}.enabled`,
        currentValue: String(enabledVal)
    });
    enabledLabel.appendChild(enabledHelp.button);
    header.appendChild(enabledLabel);

    header.appendChild(nameHelp.panel);
    header.appendChild(enabledHelp.panel);
    return header;
};

/** Build the Basic section (path + methods). */
const buildBasicSection = (idx, rn, properties) => {
    const section = createSection('route.form.section.basic');
    const fields = document.createElement('div');
    fields.className = 'form-fields';
    section.appendChild(fields);
    addField({
        container: fields, idx, name: 'path',
        label: t('route.form.path.label'),
        placeholder: t('route.form.path.placeholder'),
        value: properties?.path,
        helpKey: 'contexthelp.route.path',
        propertyKey: `restapi.${rn}.path`,
        currentValue: properties?.path
    });
    createMethodChipInput({
        container: fields, idx, value: properties?.methods
    });
    return section;
};

/** Build the Authentication section (auth-mode + roles/scopes). */
const buildAuthSection = (idx, rn, properties) => {
    const section = createSection('route.form.section.auth');
    const authFields = document.createElement('div');
    authFields.className = 'form-fields';
    section.appendChild(authFields);

    const currentAuthMode = properties?.['auth-mode'] || 'bearer';
    const authModeChip = createAuthModeChipInput({
        container: authFields, idx, value: currentAuthMode,
        helpKey: 'contexthelp.route.authmode',
        propertyKey: `restapi.${rn}.auth-mode`,
        currentValue: currentAuthMode
    });

    addField({
        container: authFields, idx,
        name: 'required-roles',
        label: t('route.form.roles.label'),
        placeholder: t('route.form.roles.placeholder'),
        value: properties?.['required-roles'],
        helpKey: 'contexthelp.route.roles',
        propertyKey: `restapi.${rn}.required-roles`,
        currentValue: properties?.['required-roles']
    });
    addField({
        container: authFields, idx,
        name: 'required-scopes',
        label: t('route.form.scopes.label'),
        placeholder: t('route.form.scopes.placeholder'),
        value: properties?.['required-scopes'],
        helpKey: 'contexthelp.route.scopes',
        propertyKey: `restapi.${rn}.required-scopes`,
        currentValue: properties?.['required-scopes']
    });

    const rolesContainer = authFields.querySelector(
        '.field-container-required-roles');
    const scopesContainer = authFields.querySelector(
        '.field-container-required-scopes');
    const toggleRolesScopes = () => {
        const modes = (authModeChip.getValue() || '')
            .split(',').map((m) => m.trim());
        const hasBearer = modes.includes('bearer');
        if (rolesContainer) {
            rolesContainer.classList.toggle('hidden', !hasBearer);
        }
        if (scopesContainer) {
            scopesContainer.classList.toggle('hidden', !hasBearer);
        }
    };
    const authModeHidden = authFields.querySelector('.field-auth-mode');
    if (authModeHidden) {
        authModeHidden.addEventListener('change', toggleRolesScopes);
    }
    toggleRolesScopes();
    return section;
};

/** Build the attachment bounds sub-fields (min, max, timeout). */
const buildAttachmentBoundsFields = (properties) => {
    const container = document.createElement('div');
    container.className = 'attachment-bounds-fields';

    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.className = 'field-attachments-min-count';
    minInput.min = '0';
    minInput.value = properties?.['attachments-min-count'] || '0';
    minInput.placeholder = '0';
    minInput.setAttribute('aria-label', t('route.form.attachments.min'));
    const minLabel = document.createElement('label');
    minLabel.textContent = `${t('route.form.attachments.min')} `;
    minLabel.appendChild(minInput);

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.className = 'field-attachments-max-count';
    maxInput.min = '0';
    maxInput.max = String(attachmentsHardLimit);
    maxInput.value = properties?.['attachments-max-count'] || '0';
    maxInput.placeholder = '0';
    maxInput.setAttribute('aria-label', t('route.form.attachments.max'));
    const maxLabel = document.createElement('label');
    maxLabel.textContent = `${t('route.form.attachments.max')} `;
    maxLabel.appendChild(maxInput);

    const timeoutRaw = properties?.['attachments-timeout'] || '30 sec';
    const timeoutMatch = timeoutRaw.match(
        /^(\d+)\s*(ms|sec|min|hr|day)$/i);
    const timeoutNum = timeoutMatch ? timeoutMatch[1] : '30';
    const timeoutUnit = timeoutMatch
        ? timeoutMatch[2].toLowerCase() : 'sec';

    const timeoutInput = document.createElement('input');
    timeoutInput.type = 'number';
    timeoutInput.className = 'field-attachments-timeout-value';
    timeoutInput.min = '1';
    timeoutInput.value = timeoutNum;
    timeoutInput.setAttribute('aria-label',
        t('route.form.attachments.timeout'));

    const timeoutUnitSelect = document.createElement('select');
    timeoutUnitSelect.className = 'field-attachments-timeout-unit';
    timeoutUnitSelect.setAttribute('aria-label',
        t('route.form.attachments.timeout') + ' unit');
    for (const tu of [
        { value: 'sec', label: 'sec' },
        { value: 'min', label: 'min' },
        { value: 'hr', label: 'hr' },
        { value: 'day', label: 'day' }
    ]) {
        const opt = document.createElement('option');
        opt.value = tu.value;
        opt.textContent = tu.label;
        if (tu.value === timeoutUnit) opt.selected = true;
        timeoutUnitSelect.appendChild(opt);
    }

    const timeoutLabel = document.createElement('label');
    timeoutLabel.className = 'timeout-input-group';
    timeoutLabel.textContent = `${t('route.form.attachments.timeout')} `;
    timeoutLabel.appendChild(timeoutInput);
    timeoutLabel.appendChild(timeoutUnitSelect);

    container.appendChild(minLabel);
    container.appendChild(maxLabel);
    container.appendChild(timeoutLabel);
    return container;
};

/** Build the Tracking section (tracking-mode + attachment bounds). */
const buildTrackingSection = (idx, rn, properties) => {
    const section = createSection('route.form.section.tracking');
    const trackingModeVal = properties?.['tracking-mode'] || 'none';

    const trackingToggle = document.createElement('div');
    trackingToggle.className = 'form-field field-container-tracking-mode';
    const trackingLabel = document.createElement('label');
    trackingLabel.className = 'tracking-mode-label';
    trackingLabel.setAttribute('for', `tracking-mode-${idx}`);
    trackingLabel.textContent = `${t('route.form.tracking.mode')} `;

    const trackingSelect = document.createElement('select');
    trackingSelect.id = `tracking-mode-${idx}`;
    trackingSelect.className = 'tracking-mode-select';
    trackingSelect.setAttribute('aria-label', t('route.form.tracking.mode'));
    for (const opt of [
        { value: 'none', label: t('route.form.tracking.none') },
        { value: 'simple', label: t('route.form.tracking.simple') },
        { value: 'attachments', label: t('route.form.tracking.attachments') }
    ]) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === trackingModeVal.toLowerCase()) {
            option.selected = true;
        }
        trackingSelect.appendChild(option);
    }
    trackingLabel.appendChild(trackingSelect);

    const trackingHelp = createContextHelp({
        helpKey: 'contexthelp.route.tracking',
        propertyKey: `restapi.${rn}.tracking-mode`,
        currentValue: trackingModeVal
    });
    trackingLabel.appendChild(trackingHelp.button);
    trackingToggle.appendChild(trackingLabel);
    trackingToggle.appendChild(trackingHelp.panel);

    const attachmentFields = buildAttachmentBoundsFields(properties);
    trackingToggle.appendChild(attachmentFields);

    const toggleAttachmentFields = () => {
        attachmentFields.classList.toggle('hidden',
            trackingSelect.value !== 'attachments');
    };
    trackingSelect.addEventListener('change', toggleAttachmentFields);
    toggleAttachmentFields();

    section.appendChild(trackingToggle);
    return section;
};

/** Collect connection names from route table rows (excluding one). */
const collectExistingConnectionNames = (routesContainer, excludeRoute) => {
    const names = [];
    for (const r of routesContainer.querySelectorAll(
        'tr[data-route-name]')) {
        if (r.dataset.routeName === excludeRoute) continue;
        const cell = r.querySelectorAll('td')[1];
        if (!cell || cell.querySelector('.empty-state')) continue;
        const textNode = Array.from(cell.childNodes)
            .find((node) => node.nodeType === Node.TEXT_NODE);
        const text = (textNode?.textContent || '').trim();
        if (text && !names.includes(text)) names.push(text);
    }
    return names;
};

/** Build the flowfile toggle + success-outcome field. */
const buildFlowFileFields = (section, idx, rn, properties,
    routesContainer, routeName) => {
    const createFlowFileVal = properties?.['create-flowfile'] !== 'false';
    const flowFileToggle = document.createElement('div');
    flowFileToggle.className = 'form-field field-container-create-flowfile';
    const flowfileLabel = document.createElement('label');
    flowfileLabel.className = 'create-flowfile-label';
    flowfileLabel.setAttribute('for', `create-flowfile-${idx}`);

    const flowfileCheckbox = document.createElement('input');
    flowfileCheckbox.type = 'checkbox';
    flowfileCheckbox.id = `create-flowfile-${idx}`;
    flowfileCheckbox.className = 'create-flowfile-checkbox';
    if (createFlowFileVal) flowfileCheckbox.checked = true;
    flowfileCheckbox.setAttribute('aria-label', 'Create FlowFile');
    flowfileLabel.appendChild(flowfileCheckbox);
    flowfileLabel.append(` ${t('route.form.create.flowfile')}`);

    const flowfileHelp = createContextHelp({
        helpKey: 'contexthelp.route.create.flowfile',
        propertyKey: `restapi.${rn}.create-flowfile`,
        currentValue: String(createFlowFileVal)
    });
    flowfileLabel.appendChild(flowfileHelp.button);
    flowFileToggle.appendChild(flowfileLabel);
    flowFileToggle.appendChild(flowfileHelp.panel);
    section.appendChild(flowFileToggle);

    const existingNames = collectExistingConnectionNames(
        routesContainer, routeName);
    const datalistOptions = existingNames
        .map((n) => `<option value="${sanitizeHtml(n)}">`).join('');

    const outcomeContainer = document.createElement('div');
    outcomeContainer.className =
        `form-field field-container-success-outcome${createFlowFileVal ? '' : ' hidden'}`;
    const outcomeLabel = document.createElement('label');
    outcomeLabel.setAttribute('for', `field-success-outcome-${idx}`);
    outcomeLabel.textContent = `${t('route.form.connection.label')}:`;
    const connectionHelp = createContextHelp({
        helpKey: 'contexthelp.route.connection',
        propertyKey: `restapi.${rn}.success-outcome`,
        currentValue: properties?.['success-outcome'] || routeName
    });
    outcomeLabel.appendChild(connectionHelp.button);
    outcomeContainer.appendChild(outcomeLabel);
    outcomeContainer.appendChild(connectionHelp.panel);

    const outcomeInput = document.createElement('input');
    outcomeInput.type = 'text';
    outcomeInput.id = `field-success-outcome-${idx}`;
    outcomeInput.name = 'success-outcome';
    outcomeInput.className =
        'field-success-outcome form-input route-config-field';
    outcomeInput.placeholder = t('route.form.connection.placeholder');
    outcomeInput.value = properties?.['success-outcome'] || routeName;
    outcomeInput.setAttribute('aria-label',
        t('route.form.connection.label'));
    outcomeInput.setAttribute('list', `connection-names-${idx}`);
    outcomeContainer.appendChild(outcomeInput);

    const datalist = document.createElement('datalist');
    datalist.id = `connection-names-${idx}`;
    datalist.innerHTML = datalistOptions;
    outcomeContainer.appendChild(datalist);
    section.appendChild(outcomeContainer);

    flowfileCheckbox.addEventListener('change', () => {
        outcomeContainer.classList.toggle('hidden',
            !flowfileCheckbox.checked);
    });
};

/** Build the schema validation toggle + inputs. */
const buildSchemaFields = (section, idx, rn, properties, hasSchema) => {
    const schemaToggle = document.createElement('div');
    schemaToggle.className = 'form-field field-container-schema-toggle';
    const schemaLabel = document.createElement('label');
    schemaLabel.className = 'schema-toggle-label';
    schemaLabel.setAttribute('for', `schema-check-${idx}`);

    const schemaCheckboxEl = document.createElement('input');
    schemaCheckboxEl.type = 'checkbox';
    schemaCheckboxEl.id = `schema-check-${idx}`;
    schemaCheckboxEl.className = 'schema-validation-checkbox';
    if (hasSchema) schemaCheckboxEl.checked = true;
    schemaCheckboxEl.setAttribute('aria-label',
        'Enable Schema Validation');
    schemaLabel.appendChild(schemaCheckboxEl);
    schemaLabel.append(` ${t('route.form.schema.toggle')}`);

    const schemaHelp = createContextHelp({
        helpKey: 'contexthelp.route.schema',
        propertyKey: `restapi.${rn}.schema`,
        currentValue: properties?.schema
    });
    schemaLabel.appendChild(schemaHelp.button);
    schemaToggle.appendChild(schemaLabel);
    schemaToggle.appendChild(schemaHelp.panel);
    section.appendChild(schemaToggle);

    const schemaContainer = document.createElement('div');
    schemaContainer.className =
        `form-field field-container-schema${hasSchema ? '' : ' hidden'}`;
    const schemaVal = properties?.schema || '';
    const mode = detectSchemaMode(schemaVal);
    const fileVal = mode === 'file' ? schemaVal : '';
    const inlineVal = mode === 'inline' ? schemaVal : '';

    schemaContainer.innerHTML = `
        <div class="schema-mode-toggle">
            <label class="schema-mode-label">
                <input type="radio" name="schema-mode-${idx}" class="schema-mode-file"
                       ${mode === 'file' ? 'checked' : ''}>
                ${t('route.form.schema.file')}
            </label>
            <label class="schema-mode-label">
                <input type="radio" name="schema-mode-${idx}" class="schema-mode-inline"
                       ${mode === 'inline' ? 'checked' : ''}>
                ${t('route.form.schema.inline')}
            </label>
        </div>
        <div class="schema-file-input${mode === 'file' ? '' : ' hidden'}">
            <input type="text" id="field-schema-file-${idx}" name="schema-file"
                   class="field-schema-file form-input route-config-field"
                   placeholder="${t('route.form.schema.file.placeholder')}"
                   value="${sanitizeHtml(fileVal)}"
                   aria-label="Schema file path">
        </div>
        <div class="schema-inline-input${mode === 'inline' ? '' : ' hidden'}">
            <textarea id="field-schema-inline-${idx}" name="schema-inline"
                      class="field-schema-inline form-input route-config-field"
                      placeholder="${t('route.form.schema.inline.placeholder')}"
                      rows="5" aria-label="Inline JSON Schema"
            >${sanitizeHtml(inlineVal)}</textarea>
        </div>`;
    section.appendChild(schemaContainer);

    const fileRadio = schemaContainer.querySelector('.schema-mode-file');
    const inlineRadio = schemaContainer.querySelector(
        '.schema-mode-inline');
    const fileDiv = schemaContainer.querySelector('.schema-file-input');
    const inlineDiv = schemaContainer.querySelector(
        '.schema-inline-input');
    fileRadio.addEventListener('change', () => {
        fileDiv.classList.remove('hidden');
        inlineDiv.classList.add('hidden');
    });
    inlineRadio.addEventListener('change', () => {
        inlineDiv.classList.remove('hidden');
        fileDiv.classList.add('hidden');
    });
    schemaCheckboxEl.addEventListener('change', () => {
        schemaContainer.classList.toggle('hidden',
            !schemaCheckboxEl.checked);
    });
};

/** Build the Advanced section (max-request-size, flowfile, schema). */
const buildAdvancedSection = (idx, rn, properties,
    routesContainer, routeName) => {
    const section = createSection('route.form.section.advanced');
    const advancedFields = document.createElement('div');
    advancedFields.className = 'form-fields';
    section.appendChild(advancedFields);

    addField({
        container: advancedFields, idx,
        name: 'max-request-size',
        label: t('route.form.max.request.size.label'),
        placeholder: t('route.form.max.request.size.placeholder'),
        value: properties?.['max-request-size'] || ''
    });

    buildFlowFileFields(section, idx, rn, properties,
        routesContainer, routeName);
    buildSchemaFields(section, idx, rn, properties,
        !!properties?.schema?.trim());
    return section;
};

/** Build error container and action buttons (Save + Cancel). */
const buildEditorActions = (form, componentId, tableRow,
    routesContainer) => {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'route-form-error-messages';
    errorContainer.setAttribute('role', 'alert');
    errorContainer.setAttribute('aria-live', 'assertive');
    form.appendChild(errorContainer);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'route-form-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-route-button';
    saveBtn.innerHTML =
        `<i class="fa fa-check"></i> ${t('route.btn.save')}`;
    saveBtn.addEventListener('click', () => {
        errorContainer.innerHTML = '';
        saveRoute(form, errorContainer, componentId,
            tableRow, routesContainer);
    });
    actionsDiv.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-route-button';
    cancelBtn.innerHTML =
        `<i class="fa fa-times"></i> ${t('common.btn.cancel')}`;
    cancelBtn.addEventListener('click', () => {
        if (tableRow) tableRow.classList.remove('hidden');
        form.remove();
    });
    actionsDiv.appendChild(cancelBtn);
    form.appendChild(actionsDiv);
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
    closeActiveEditor(routesContainer);
    if (tableRow) tableRow.classList.add('hidden');

    const idx = formCounter++;
    const form = document.createElement('div');
    form.className = 'route-form inline-edit';
    form.dataset.originalName = routeName || '';

    const enabledVal = properties?.enabled !== 'false';
    const rn = routeName || '*';

    form.appendChild(buildEditorHeader(idx, rn, routeName, enabledVal));
    form.appendChild(buildBasicSection(idx, rn, properties));
    form.appendChild(buildAuthSection(idx, rn, properties));
    form.appendChild(buildTrackingSection(idx, rn, properties));
    form.appendChild(buildAdvancedSection(idx, rn, properties,
        routesContainer, routeName));
    buildEditorActions(form, componentId, tableRow, routesContainer);

    routesContainer.appendChild(form);
};

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

const addField = (opts) => createFormField({ ...opts, inputClass: 'route-config-field' });

// ---------------------------------------------------------------------------
// Save / Remove
// ---------------------------------------------------------------------------

const extractFormFields = (form) => {
    const q = (sel) => form.querySelector(sel)?.value?.trim() || '';
    const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
    const schemaEnabled = schemaCheckbox ? schemaCheckbox.checked : false;
    const createFlowFile = form.querySelector('.create-flowfile-checkbox')?.checked !== false;
    return {
        routeName: q('.route-name'),
        path: q('.field-path'),
        methods: q('.field-methods'),
        enabled: form.querySelector('.route-enabled')?.checked !== false,
        'required-roles': q('.field-required-roles'),
        'required-scopes': q('.field-required-scopes'),
        'auth-mode': form.querySelector('.field-auth-mode')?.value || 'bearer',
        'max-request-size': q('.field-max-request-size'),
        schema: schemaEnabled ? getActiveSchemaValue(form) : '',
        'success-outcome': createFlowFile ? q('.field-success-outcome') : '',
        'create-flowfile': createFlowFile,
        'tracking-mode': form.querySelector('.tracking-mode-select')?.value || 'none',
        'attachments-min-count': form.querySelector('.field-attachments-min-count')?.value || '0',
        'attachments-max-count': form.querySelector('.field-attachments-max-count')?.value || '0',
        'attachments-timeout': `${form.querySelector('.field-attachments-timeout-value')?.value || '30'} ${form.querySelector('.field-attachments-timeout-unit')?.value || 'sec'}`
    };
};

/**
 * Validate attachment-specific form fields.
 * @param {Object} f  form data
 * @returns {{isValid: boolean, error?: Error}|null} validation result or null if valid
 */
const validateAttachments = (f) => {
    const min = Number.parseInt(f['attachments-min-count'], 10) || 0;
    const max = Number.parseInt(f['attachments-max-count'], 10) || 0;
    if (min < 0) return { isValid: false, error: new Error(t('route.validate.attachments.min.negative')) };
    if (max < 0) return { isValid: false, error: new Error(t('route.validate.attachments.max.negative')) };
    if (min > 0 && max > 0 && min > max) return { isValid: false, error: new Error(t('route.validate.attachments.min.exceeds.max')) };
    if (max > attachmentsHardLimit) return { isValid: false, error: new Error(t('route.validate.attachments.max.exceeds.limit', String(attachmentsHardLimit))) };
    const timeoutValue = Number.parseInt(f['attachments-timeout'], 10);
    if (Number.isNaN(timeoutValue) || timeoutValue < 1) {
        return { isValid: false, error: new Error(t('route.validate.attachments.timeout.invalid')) };
    }
    return null;
};

const validateFormData = (f, routesContainer, originalName) => {
    if (!f.routeName) return { isValid: false, error: new Error(t('route.validate.name.required')) };
    if (!/^[a-zA-Z0-9_-]+$/.test(f.routeName)) {
        return { isValid: false, error: new Error(t('route.validate.name.invalid')) };
    }
    // Check for duplicate route names (exclude the route being edited)
    if (routesContainer && f.routeName !== originalName) {
        const sel = `tr[data-route-name="${CSS.escape(f.routeName)}"]`;
        const existing = routesContainer.querySelector(sel);
        if (existing) {
            const msg = t('route.validate.name.duplicate', f.routeName);
            return { isValid: false, error: new Error(msg) };
        }
    }
    if (!f.path) return { isValid: false, error: new Error(t('route.validate.path.required')) };
    const trackingMode = (f['tracking-mode'] || 'none').toLowerCase();
    if (trackingMode !== 'none') {
        const methods = (f.methods || '').split(',').map((m) => m.trim().toUpperCase()).filter(Boolean);
        const hasBodyMethod = methods.length === 0 || methods.some((m) => BODY_METHODS.includes(m));
        if (!hasBodyMethod) {
            return { isValid: false, error: new Error(t('route.validate.tracking.methods')) };
        }
    }
    if (trackingMode === 'attachments') {
        const result = validateAttachments(f);
        if (result) return result;
    }
    return { isValid: true };
};

const buildPropertyUpdates = (name, f) => {
    const u = {};
    u[`${ROUTE_PREFIX}${name}.path`] = f.path;
    u[`${ROUTE_PREFIX}${name}.enabled`] = String(f.enabled);
    u[`${ROUTE_PREFIX}${name}.methods`] = f.methods || null;
    u[`${ROUTE_PREFIX}${name}.required-roles`] = f['required-roles'] || null;
    u[`${ROUTE_PREFIX}${name}.required-scopes`] = f['required-scopes'] || null;
    u[`${ROUTE_PREFIX}${name}.auth-mode`] = f['auth-mode'] && f['auth-mode'] !== 'bearer' ? f['auth-mode'] : null;
    u[`${ROUTE_PREFIX}${name}.max-request-size`] = f['max-request-size'] || null;
    u[`${ROUTE_PREFIX}${name}.schema`] = f.schema || null;
    u[`${ROUTE_PREFIX}${name}.success-outcome`] = f['create-flowfile'] ? (f['success-outcome'] || name) : null;
    u[`${ROUTE_PREFIX}${name}.create-flowfile`] = f['create-flowfile'] === false ? 'false' : null;
    const trackingMode = (f['tracking-mode'] || 'none').toLowerCase();
    u[`${ROUTE_PREFIX}${name}.tracking-mode`] = trackingMode === 'none' ? null : trackingMode;
    u[`${ROUTE_PREFIX}${name}.attachments-min-count`] = trackingMode === 'attachments' && Number.parseInt(f['attachments-min-count'], 10) > 0
        ? f['attachments-min-count'] : null;
    u[`${ROUTE_PREFIX}${name}.attachments-max-count`] = trackingMode === 'attachments' && Number.parseInt(f['attachments-max-count'], 10) > 0
        ? f['attachments-max-count'] : null;
    u[`${ROUTE_PREFIX}${name}.attachments-timeout`] = trackingMode === 'attachments' && f['attachments-timeout']
        && f['attachments-timeout'] !== '30 sec' ? f['attachments-timeout'] : null;
    return u;
};

// ---------------------------------------------------------------------------
// Property export
// ---------------------------------------------------------------------------

/**
 * Extract route data from a summary table row's DOM cells.
 * @param {HTMLTableRowElement} row
 * @returns {{name: string, prefix: string, pathText: string, methods: string,
 *            authModeValue: string, enabled: boolean, hasSchemaBadge: boolean,
 *            outcomeDash: boolean, outcomeText: string}}
 */
const extractRowData = (row) => {
    const name = row.dataset.routeName;
    const origin = row.dataset.origin || 'persisted';
    const prefix = (origin === 'new' || origin === 'modified') ? '# [session-only] ' : '';
    const cells = row.querySelectorAll('td');
    // cells: 0=name, 1=connection, 2=path(+badge), 3=methods, 4=authmode, 5=enabled, 6=actions
    const pathCell = cells[2];
    const pathText = pathCell
        ? Array.from(pathCell.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent.trim())
            .filter(Boolean)
            .join('') || ''
        : '';
    const methodBadges = cells[3]?.querySelectorAll('.method-badge') || [];
    const methods = Array.from(methodBadges).map((b) => b.textContent.trim()).join(',');
    const rawAuthMode = row.dataset.authMode || 'bearer';
    return {
        name,
        prefix,
        pathText,
        methods,
        authModeValue: rawAuthMode === 'bearer' ? '' : rawAuthMode,
        enabled: cells[5]?.textContent?.trim() === t('common.status.enabled'),
        hasSchemaBadge: !!cells[2]?.querySelector('.schema-badge'),
        outcomeDash: !!cells[1]?.querySelector('.empty-state'),
        outcomeText: cells[1]?.textContent?.trim() || ''
    };
};

/**
 * Build export lines for a single route.
 * @param {{name: string, prefix: string, pathText: string, methods: string,
 *          authModeValue: string, enabled: boolean, hasSchemaBadge: boolean,
 *          outcomeDash: boolean, outcomeText: string}} data
 * @param {Object|undefined} props  row._routeProps
 * @returns {string[]}
 */
const buildRouteExportLines = (data, props) => {
    const { name, prefix, pathText, methods, authModeValue, enabled,
        hasSchemaBadge, outcomeDash, outcomeText } = data;
    const lines = [];
    const p = `${prefix}${ROUTE_PREFIX}${name}`;

    lines.push(`${p}.path = ${pathText}`);
    if (methods) lines.push(`${p}.methods = ${methods}`);
    if (authModeValue) lines.push(`${p}.auth-mode = ${authModeValue}`);
    if (!enabled) lines.push(`${p}.enabled = false`);

    const requiredRoles = props?.['required-roles'];
    if (requiredRoles) lines.push(`${p}.required-roles = ${requiredRoles}`);
    const requiredScopes = props?.['required-scopes'];
    if (requiredScopes) lines.push(`${p}.required-scopes = ${requiredScopes}`);
    const maxRequestSize = props?.['max-request-size'];
    if (maxRequestSize) lines.push(`${p}.max-request-size = ${maxRequestSize}`);

    if (outcomeDash) {
        lines.push(`${p}.create-flowfile = false`);
    } else if (outcomeText) {
        lines.push(`${p}.success-outcome = ${outcomeText}`);
    }

    if (hasSchemaBadge) {
        lines.push(`${p}.schema = <see processor properties>`);
    }

    const trackingMode = props?.['tracking-mode'];
    if (trackingMode && trackingMode !== 'none') {
        lines.push(`${p}.tracking-mode = ${trackingMode}`);
        if (trackingMode === 'attachments') {
            const minCount = props?.['attachments-min-count'];
            if (minCount && minCount !== '0') lines.push(`${p}.attachments-min-count = ${minCount}`);
            const maxCount = props?.['attachments-max-count'];
            if (maxCount && maxCount !== '0') lines.push(`${p}.attachments-max-count = ${maxCount}`);
            const timeout = props?.['attachments-timeout'];
            if (timeout && timeout !== '30 sec') lines.push(`${p}.attachments-timeout = ${timeout}`);
        }
    }
    return lines;
};

/**
 * Build property export text from current route table state.
 * @param {HTMLElement} routesContainer  the .routes-container element
 * @returns {string} property lines
 */
const buildExportText = (routesContainer) => {
    const rows = routesContainer.querySelectorAll('tr[data-route-name]');
    const lines = [];
    for (const row of rows) {
        const data = extractRowData(row);
        lines.push(...buildRouteExportLines(data, row._routeProps));
    }
    return lines.join('\n');
};

/**
 * Build management endpoint export text from current table state.
 * Only emits properties that differ from their defaults.
 * @param {HTMLElement} editor  the .route-config-editor element
 * @returns {string} property lines (empty string if all defaults)
 */
const buildManagementExportText = (editor) => {
    const rows = editor.querySelectorAll('tr[data-mgmt-name]');
    const lines = [];
    for (const row of rows) {
        const name = row.dataset.mgmtName;
        const enabled = row.dataset.mgmtEnabled;
        const authMode = row.dataset.mgmtAuthMode || '';
        const roles = row.dataset.mgmtRoles || '';
        const scopes = row.dataset.mgmtScopes || '';

        if (enabled === 'false') {
            lines.push(`${MGMT_PREFIX}${name}.enabled = false`);
        }
        if (authMode && authMode !== 'local-only,bearer') {
            lines.push(`${MGMT_PREFIX}${name}.auth-mode = ${authMode}`);
        }
        if (roles) {
            lines.push(`${MGMT_PREFIX}${name}.required-roles = ${roles}`);
        }
        if (scopes) {
            lines.push(`${MGMT_PREFIX}${name}.required-scopes = ${scopes}`);
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
        let text = buildExportText(routesContainer);
        const mgmtText = buildManagementExportText(editor);
        if (mgmtText) {
            text += `\n\n# ${t('route.management.heading')}\n${mgmtText}`;
        }
        textarea.value = text;
    }
};

// ---------------------------------------------------------------------------
// Connection map
// ---------------------------------------------------------------------------

/**
 * Refresh the connection map panel from current route table state.
 * @param {HTMLElement} routesContainer  the .routes-container element
 */
const refreshConnectionMap = (routesContainer) => {
    const editor = routesContainer.closest('.route-config-editor');
    if (!editor) return;
    const mapContainer = editor.querySelector('.connection-map-container');
    if (!mapContainer) return;

    const rows = routesContainer.querySelectorAll('tr[data-route-name]');
    // Group routes by connection name
    const groups = {};
    for (const row of rows) {
        const name = row.dataset.routeName;
        const cell = row.querySelectorAll('td')[1];
        if (!cell || cell.querySelector('.empty-state')) continue; // skip create-flowfile=false
        const textNode = Array.from(cell.childNodes)
            .find((node) => node.nodeType === Node.TEXT_NODE);
        const connectionName = (textNode?.textContent || '').trim();
        if (!groups[connectionName]) groups[connectionName] = [];
        groups[connectionName].push(name);
    }

    const connectionNames = Object.keys(groups);
    // Always add failure as always present
    const totalRelationships = connectionNames.length + 1; // +1 for failure

    let tableRows = '';
    for (const [conn, routes] of Object.entries(groups)) {
        const routeList = routes
            .map((r) => sanitizeHtml(r)).join(', ');
        tableRows += '<tr><td>' + sanitizeHtml(conn)
            + '</td><td>' + routeList + '</td></tr>';
    }
    tableRows += `<tr><td>failure</td><td><em>${t('route.connection.map.failure')}</em></td></tr>`;

    const summaryText = '<i class="fa fa-sitemap"></i>'
        + ` ${t('route.connection.map.heading', totalRelationships)}`;
    mapContainer.innerHTML = `
        <details class="connection-map">
            <summary>${summaryText}</summary>
            <table class="connection-map-table config-table">
                <thead><tr><th>${t('route.connection.map.name')}</th><th>${t('route.connection.map.routes')}</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </details>`;
};

/**
 * Show brief "Copied!" feedback on the copy button.
 * @param {HTMLElement} exportSection  the .property-export element
 */
const showCopyFeedback = (exportSection) => {
    const btn = exportSection.querySelector('.copy-properties-button');
    const original = btn.innerHTML;
    btn.innerHTML = `<i class="fa fa-check"></i> ${t('route.export.copied')}`;
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
    banner.innerHTML = t('route.info.banner');
    // Insert before the routes container
    routesContainer.parentNode.insertBefore(banner, routesContainer);
};

/**
 * Show a success banner after persisting changes to NiFi.
 * Auto-hides after 5 seconds.
 * @param {HTMLElement} routesContainer  the .routes-container element
 */
const showSaveSuccessBanner = (routesContainer) => {
    const editor = routesContainer.closest('.route-config-editor');
    if (!editor) return;
    const existing = editor.querySelector('.info-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'info-banner info-banner-success';
    banner.setAttribute('role', 'status');
    banner.innerHTML = t('route.save.success.banner');
    routesContainer.parentNode.insertBefore(banner, routesContainer);
    setTimeout(() => banner.remove(), 5000);
};

/**
 * Save route: validate, persist, update table row, close editor.
 * @param {HTMLElement} form  the inline editor form
 * @param {HTMLElement} errEl  error display element
 * @param {string} componentId  NiFi processor component ID
 * @param {HTMLTableRowElement|null} tableRow  the table row being edited (null for new)
 * @param {HTMLElement} routesContainer  the .routes-container element
 */
/** Apply route save result to the UI (update or add row, close form). */
const applyRouteSaveToUI = (form, formData, tableRow, routesContainer,
    componentId, origin) => {
    form.dataset.originalName = formData.routeName;
    if (tableRow) {
        if (origin) tableRow.dataset.origin = origin;
        updateTableRow(tableRow, formData);
        tableRow.classList.remove('hidden');
    } else {
        addRowToTable(routesContainer, formData, componentId, origin);
    }
    form.remove();
    refreshExportPanel(routesContainer);
    refreshConnectionMap(routesContainer);
};

/** If a route was renamed, mark old properties for deletion. */
const collectRouteRenameCleanup = async (componentId, originalName,
    updates) => {
    const prefix = `${ROUTE_PREFIX}${originalName}.`;
    try {
        const res = await api.getComponentProperties(componentId);
        const props = res.properties || {};
        for (const key of Object.keys(props)) {
            if (key.startsWith(prefix)) updates[key] = null;
        }
    } catch { /* ignore — old props will remain as orphans */ }
};

const saveRoute = async (form, errEl, componentId, tableRow,
    routesContainer) => {
    const f = extractFormFields(form);
    const originalName = form.dataset.originalName || '';
    const v = validateFormData(f, routesContainer, originalName);
    if (!v.isValid) {
        displayUiError(errEl, v.error, {},
            'routeConfigEditor.error.title');
        return;
    }

    const nameChanged = originalName && originalName !== f.routeName;
    const updates = buildPropertyUpdates(f.routeName, f);

    if (nameChanged) {
        await collectRouteRenameCleanup(componentId, originalName,
            updates);
    }

    if (!componentId) {
        applyRouteSaveToUI(form, f, tableRow, routesContainer,
            componentId);
        showInfoBanner(routesContainer);
        return;
    }

    try {
        await api.updateComponentProperties(componentId, updates);
        applyRouteSaveToUI(form, f, tableRow, routesContainer,
            componentId, 'persisted');
        showSaveSuccessBanner(routesContainer);
    } catch (error) {
        displayUiError(errEl, error, {},
            'routeConfigEditor.error.saveFailedTitle');
    }
};

/**
 * Add a new row to the summary table after saving a new route.
 * @param {HTMLElement} routesContainer
 * @param {Object} formData
 * @param {string} componentId
 * @param {'persisted'|'new'} [origin='new']  the route origin state
 */
const addRowToTable = (routesContainer, formData, componentId, origin = 'new') => {
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
        'auth-mode': formData['auth-mode'] || 'bearer',
        'max-request-size': formData['max-request-size'] || '',
        schema: formData.schema,
        'success-outcome': formData['success-outcome'] || '',
        'create-flowfile': formData['create-flowfile'] === false ? 'false' : 'true',
        'tracking-mode': formData['tracking-mode'] || 'none',
        'attachments-min-count': formData['attachments-min-count'] || '',
        'attachments-max-count': formData['attachments-max-count'] || '',
        'attachments-timeout': formData['attachments-timeout'] || ''
    };
    const row = createTableRow(formData.routeName, props, componentId, routesContainer, origin);
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
    if (openForm?.dataset.originalName === routeName) {
        openForm.remove();
    }

    const globalErr = document.querySelector('.global-error-messages');

    if (routeName && componentId) {
        try {
            await clearRouteProperties(componentId, routeName);
            if (globalErr) {
                displayUiSuccess(globalErr, t('route.remove.success', routeName));
                globalErr.classList.remove('hidden');
            }
        } catch (error) {
            if (globalErr) {
                displayUiError(globalErr, error, {}, 'routeConfigEditor.error.removeFailedTitle');
                globalErr.classList.remove('hidden');
            }
        }
    } else if (routeName && globalErr) {
        displayUiSuccess(globalErr, t('route.remove.success.standalone', routeName));
        globalErr.classList.remove('hidden');
    }

    refreshExportPanel(routesContainer);
    refreshConnectionMap(routesContainer);
};
