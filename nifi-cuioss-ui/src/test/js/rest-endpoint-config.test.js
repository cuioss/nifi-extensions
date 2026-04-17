/**
 * @jest-environment jest-environment-jsdom
 * @jest-environment-options {"url": "http://localhost:8080/nifi-jwt-ui/?id=test-processor-id"}
 */
'use strict';

/**
 * Tests for rest-endpoint-config.js — Gateway route configuration CRUD editor.
 * Verifies the list-first UX: summary table on load, inline edit on click.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');
jest.mock('../../main/webapp/js/context-help.js');

import { init, cleanup } from '../../main/webapp/js/rest-endpoint-config.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';
import { createContextHelp, createFormField } from '../../main/webapp/js/context-help.js';
import { mockCreateContextHelp, mockCreateFormField } from './test-helpers.js';

const SAMPLE_PROPERTIES = {
    'rest.gateway.listening.port': '9443',
    'rest.gateway.max.request.size': '1048576',
    'rest.gateway.request.queue.size': '100',
    'rest.gateway.ssl.context.service': '',
    'restapi.health.path': '/api/health',
    'restapi.health.methods': 'GET',
    'restapi.health.enabled': 'true',
    'restapi.health.required-roles': '',
    'restapi.health.required-scopes': '',
    'restapi.data.path': '/api/data',
    'restapi.data.methods': 'GET,POST',
    'restapi.data.enabled': 'true',
    'restapi.data.required-roles': 'admin',
    'restapi.data.required-scopes': 'read,write'
};

const PROPERTIES_WITH_SCHEMA = {
    ...SAMPLE_PROPERTIES,
    'restapi.health.schema': '{"type":"object"}'
};

const PROPERTIES_WITH_OUTCOME = {
    ...SAMPLE_PROPERTIES,
    'restapi.data.success-outcome': 'api-data'
};

const PROPERTIES_NO_FLOWFILE = {
    ...SAMPLE_PROPERTIES,
    'restapi.health.create-flowfile': 'false'
};

const PROPERTIES_WITH_TRACKING = {
    ...SAMPLE_PROPERTIES,
    'restapi.data.tracking-mode': 'simple'
};

const tick = () => new Promise((r) => setTimeout(r, 10));

describe('rest-endpoint-config', () => {
    let container;

    beforeEach(() => {
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
        utils.sanitizeHtml.mockImplementation((s) => s || '');
        utils.t.mockImplementation((key) => key);
        utils.displayUiError.mockImplementation(() => {});
        utils.displayUiSuccess.mockImplementation(() => {});
        utils.buildOriginBadge.mockImplementation((origin) => {
            const o = origin || 'persisted';
            const title = utils.t(`origin.badge.${o}.title`);
            const text = utils.t(`origin.badge.${o}`);
            return ` <span class="origin-badge origin-${o}" title="${title}"><i class="fa fa-database"></i> ${text}</span>`;
        });
        createContextHelp.mockImplementation(mockCreateContextHelp);
        createFormField.mockImplementation(mockCreateFormField);
        // Mock getComponentId from api.js to return a valid processor ID
        api.getComponentId.mockReturnValue('test-processor-id');
        utils.confirmRemoveRoute.mockImplementation((name, onConfirm) => {
            onConfirm();
            return Promise.resolve(true);
        });
        // Default: all relationships appear connected (bootstrapped on NiFi canvas)
        api.getConnectedRelationships.mockResolvedValue(new Set(['health', 'data', 'api-data']));

        // Reset location (URL set via @jest-environment-options docblock)
        history.replaceState({}, '', '/nifi-jwt-ui/?id=test-processor-id');

        container = document.createElement('div');
        container.id = 'endpoint-config';
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    // -----------------------------------------------------------------------
    // Summary table rendering
    // -----------------------------------------------------------------------

    it('should render summary table with route data on load', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const table = container.querySelector('.route-summary-table');
        expect(table).not.toBeNull();

        const rows = container.querySelectorAll('.route-summary-table tbody tr[data-route-name]');
        expect(rows.length).toBe(2);
    });

    it('should display table headers: Name, Path, Methods, Enabled, Actions', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const headers = container.querySelectorAll('.route-summary-table thead th');
        const headerTexts = Array.from(headers).map((th) => th.textContent.trim());
        expect(headerTexts).toEqual(['route.table.name', 'route.table.connection', 'route.table.path', 'route.table.methods', 'route.table.authmode', 'route.table.enabled', 'route.table.actions']);
    });

    it('should display route name and path in table cells', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        expect(healthRow).not.toBeNull();
        const cells = healthRow.querySelectorAll('td');
        expect(cells[0].textContent).toContain('health');
        expect(cells[1].textContent).toContain('health'); // Connection defaults to route name
        expect(cells[2].textContent).toBe('/api/health');
    });

    it('should display method badges in table', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const dataRow = container.querySelector('tr[data-route-name="data"]');
        const badges = dataRow.querySelectorAll('.method-badge');
        expect(badges.length).toBe(2);
        expect(badges[0].textContent).toBe('GET');
        expect(badges[1].textContent).toBe('POST');
    });

    it('should display enabled/disabled status in table', async () => {
        const props = {
            ...SAMPLE_PROPERTIES,
            'restapi.disabled-route.path': '/api/disabled',
            'restapi.disabled-route.enabled': 'false'
        };
        api.getComponentProperties.mockResolvedValue({
            properties: props,
            revision: { version: 1 }
        });

        await init(container);

        const disabledRow = container.querySelector('tr[data-route-name="disabled-route"]');
        expect(disabledRow).not.toBeNull();
        const statusCell = disabledRow.querySelector('.status-disabled');
        expect(statusCell).not.toBeNull();
        expect(statusCell.textContent).toBe('common.status.disabled');
    });

    it('should show Edit and Remove buttons per row', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const editBtns = container.querySelectorAll('.edit-route-button');
        const removeBtns = container.querySelectorAll('.route-summary-table .remove-route-button');
        expect(editBtns.length).toBe(2);
        expect(removeBtns.length).toBe(2);
    });

    it('should not show any route-form on initial load', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const forms = container.querySelectorAll('.route-form');
        expect(forms.length).toBe(0);
    });

    it('should display global settings', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const settingsDisplay = container.querySelector('.global-settings-display');
        expect(settingsDisplay).not.toBeNull();
        expect(settingsDisplay.textContent).toContain('route.global.listening.port');
        expect(settingsDisplay.textContent).toContain('9443');
    });

    it('should show empty-state message when no routes exist', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: { 'rest.gateway.listening.port': '9443' },
            revision: { version: 1 }
        });

        await init(container);

        const emptyState = container.querySelector('.route-summary-table .empty-state');
        expect(emptyState).not.toBeNull();
        expect(emptyState.textContent).toContain('route.table.empty');
    });

    // -----------------------------------------------------------------------
    // Inline editor — Edit button
    // -----------------------------------------------------------------------

    it('should open inline editor on Edit click', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const editBtn = container.querySelector('.edit-route-button');
        editBtn.click();

        const form = container.querySelector('.route-form');
        expect(form).not.toBeNull();
        expect(form.classList.contains('inline-edit')).toBe(true);
    });

    it('should populate form fields with route data on Edit click', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        expect(form.querySelector('.route-name').value).toBe('health');
        expect(form.querySelector('.field-path').value).toBe('/api/health');
        expect(form.querySelector('.field-methods').value).toBe('GET');
        expect(form.querySelector('.route-enabled').checked).toBe(true);
    });

    it('should hide table row when editing', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        expect(healthRow.classList.contains('hidden')).toBe(true);
    });

    it('should show Save and Cancel buttons in editor', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        expect(form.querySelector('.save-route-button')).not.toBeNull();
        expect(form.querySelector('.cancel-route-button')).not.toBeNull();
    });

    // -----------------------------------------------------------------------
    // Cancel button
    // -----------------------------------------------------------------------

    it('should close inline editor on Cancel click and restore table row', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        // Editor is open, row is hidden
        expect(container.querySelector('.route-form')).not.toBeNull();
        expect(healthRow.classList.contains('hidden')).toBe(true);

        // Click Cancel
        container.querySelector('.cancel-route-button').click();

        // Editor removed, row visible again
        expect(container.querySelector('.route-form')).toBeNull();
        expect(healthRow.classList.contains('hidden')).toBe(false);
    });

    it('should remove new unsaved route form on Cancel', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        // Click Add Route
        container.querySelector('.add-route-button').click();
        expect(container.querySelector('.route-form')).not.toBeNull();

        // Click Cancel
        container.querySelector('.cancel-route-button').click();
        expect(container.querySelector('.route-form')).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Add Route
    // -----------------------------------------------------------------------

    it('should open empty form when clicking Add Route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.add-route-button').click();

        const form = container.querySelector('.route-form');
        expect(form).not.toBeNull();
        expect(form.querySelector('.route-name').value).toBe('');
        expect(form.querySelector('.field-path').value).toBe('');
        expect(form.querySelector('.field-methods').value).toBe('');
    });

    it('should not pre-fill data when adding new route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.add-route-button').click();

        const form = container.querySelector('.route-form');
        const inputs = form.querySelectorAll('input.form-input');
        for (const input of inputs) {
            expect(input.value).toBe('');
        }
        // Auth-mode chip input defaults to 'bearer'
        const authModeHidden = form.querySelector('.field-auth-mode');
        expect(authModeHidden).not.toBeNull();
        expect(authModeHidden.value).toBe('bearer');
    });

    // -----------------------------------------------------------------------
    // Schema validation checkbox
    // -----------------------------------------------------------------------

    it('should show schema checkbox unchecked by default when editing route without schema', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
        expect(schemaCheckbox).not.toBeNull();
        expect(schemaCheckbox.checked).toBe(false);
    });

    it('should hide schema textarea when checkbox is unchecked', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const schemaContainer = form.querySelector('.field-container-schema');
        expect(schemaContainer.classList.contains('hidden')).toBe(true);
    });

    it('should toggle schema textarea via checkbox', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
        const schemaContainer = form.querySelector('.field-container-schema');

        // Initially hidden
        expect(schemaContainer.classList.contains('hidden')).toBe(true);

        // Check the checkbox — textarea becomes visible
        schemaCheckbox.checked = true;
        schemaCheckbox.dispatchEvent(new Event('change'));
        expect(schemaContainer.classList.contains('hidden')).toBe(false);

        // Uncheck — hidden again
        schemaCheckbox.checked = false;
        schemaCheckbox.dispatchEvent(new Event('change'));
        expect(schemaContainer.classList.contains('hidden')).toBe(true);
    });

    it('should show schema checkbox checked when route has schema', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_SCHEMA,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
        expect(schemaCheckbox.checked).toBe(true);

        const schemaContainer = form.querySelector('.field-container-schema');
        expect(schemaContainer.classList.contains('hidden')).toBe(false);
    });

    it('should set schema to null when checkbox unchecked on save', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_SCHEMA,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        // Uncheck schema checkbox
        const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
        schemaCheckbox.checked = false;
        schemaCheckbox.dispatchEvent(new Event('change'));

        // Save
        form.querySelector('.save-route-button').click();
        await tick();

        expect(api.updateComponentProperties).toHaveBeenCalledWith(
            'test-processor-id',
            expect.objectContaining({
                'restapi.health.schema': null
            })
        );
    });

    // -----------------------------------------------------------------------
    // Schema badge in summary table
    // -----------------------------------------------------------------------

    it('should show schema badge for route with schema', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_SCHEMA,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        const badge = healthRow.querySelector('.schema-badge');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toContain('Schema');
    });

    it('should not show schema badge for route without schema', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_SCHEMA,
            revision: { version: 1 }
        });

        await init(container);

        const dataRow = container.querySelector('tr[data-route-name="data"]');
        const badge = dataRow.querySelector('.schema-badge');
        expect(badge).toBeNull();
    });

    it('should update schema badge after save', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        // No badge initially
        expect(healthRow.querySelector('.schema-badge')).toBeNull();

        healthRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        // Enable schema and enter inline JSON
        const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
        schemaCheckbox.checked = true;
        schemaCheckbox.dispatchEvent(new Event('change'));

        // Switch to inline mode and enter schema
        const inlineRadio = form.querySelector('.schema-mode-inline');
        inlineRadio.checked = true;
        inlineRadio.dispatchEvent(new Event('change'));
        form.querySelector('.field-schema-inline').value = '{"type":"object"}';

        form.querySelector('.save-route-button').click();
        await tick();

        // Badge should now appear
        expect(healthRow.querySelector('.schema-badge')).not.toBeNull();
    });

    // -----------------------------------------------------------------------
    // Save route
    // -----------------------------------------------------------------------

    it('should save route via API when clicking Save', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Click Edit on first route
        container.querySelector('.edit-route-button').click();

        // Click Save
        container.querySelector('.save-route-button').click();
        await tick();

        expect(api.updateComponentProperties).toHaveBeenCalledWith(
            'test-processor-id',
            expect.objectContaining({
                'restapi.health.path': '/api/health'
            })
        );
    });

    it('should update table row after successful save', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        // Change path
        const form = container.querySelector('.route-form');
        form.querySelector('.field-path').value = '/api/health/v2';

        form.querySelector('.save-route-button').click();
        await tick();

        // Form should be removed, row should be visible with updated data
        expect(container.querySelector('.route-form')).toBeNull();
        expect(healthRow.classList.contains('hidden')).toBe(false);
        expect(healthRow.querySelectorAll('td')[2].textContent).toBe('/api/health/v2');
    });

    it('should add new row to table after saving new route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Click Add Route
        container.querySelector('.add-route-button').click();

        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'new-route';
        form.querySelector('.field-path').value = '/api/new';
        form.querySelector('.field-methods').value = 'POST';

        form.querySelector('.save-route-button').click();
        await tick();

        // Form removed, new row added
        expect(container.querySelector('.route-form')).toBeNull();
        const newRow = container.querySelector('tr[data-route-name="new-route"]');
        expect(newRow).not.toBeNull();
        expect(newRow.querySelectorAll('td')[2].textContent).toBe('/api/new');
    });

    // -----------------------------------------------------------------------
    // Remove route
    // -----------------------------------------------------------------------

    it('should remove a route from table', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const rows = container.querySelectorAll('tr[data-route-name]');
        expect(rows.length).toBe(2);

        const removeBtn = container.querySelector('.route-summary-table .remove-route-button');
        removeBtn.click();
        await tick();

        const remainingRows = container.querySelectorAll('tr[data-route-name]');
        expect(remainingRows.length).toBe(1);
    });

    // -----------------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------------

    it('should validate missing route name', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: { 'restapi.test.path': '/api/test' },
            revision: { version: 1 }
        });

        await init(container);

        // Open editor
        container.querySelector('.edit-route-button').click();

        // Clear the route name
        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = '';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(utils.displayUiError).toHaveBeenCalled();
    });

    it('should validate missing path', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: { 'restapi.test.path': '/api/test' },
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        form.querySelector('.field-path').value = '';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(utils.displayUiError).toHaveBeenCalled();
    });

    it('should validate route name format', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: { 'restapi.test.path': '/api/test' },
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'invalid.name';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(utils.displayUiError).toHaveBeenCalled();
    });

    it('should reject duplicate route name on new route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: { 'restapi.existing.path': '/api/existing', 'restapi.existing.methods': 'GET' },
            revision: { version: 1 }
        });

        await init(container);

        // Add a new route with the same name as the existing one
        container.querySelector('.add-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'existing';
        form.querySelector('.field-path').value = '/api/duplicate';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(utils.displayUiError).toHaveBeenCalled();
        expect(api.updateComponentProperties).not.toHaveBeenCalled();
    });

    it('should allow saving route with same name when editing that route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: { 'restapi.existing.path': '/api/existing', 'restapi.existing.methods': 'GET' },
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Edit the existing route — keeping the same name should be allowed
        container.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        form.querySelector('.save-route-button').click();
        await tick();

        expect(api.updateComponentProperties).toHaveBeenCalled();
    });

    it('should set optional properties to null when empty', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: { 'restapi.test.path': '/api/test', 'restapi.test.methods': 'GET' },
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        form.querySelector('.field-methods').value = '';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(api.updateComponentProperties).toHaveBeenCalledWith(
            'test-processor-id',
            expect.objectContaining({
                'restapi.test.methods': null
            })
        );
    });

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    it('should store original name on route form', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        expect(form.dataset.originalName).toBe('health');
    });

    it('should not re-initialize if already initialized', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        const firstContent = container.innerHTML;
        await init(container);
        expect(container.innerHTML).toBe(firstContent);
    });

    it('should return early for null container', async () => {
        await init(null);
        expect(api.getComponentProperties).not.toHaveBeenCalled();
    });

    it('should show empty table when no component ID', async () => {
        api.getComponentId.mockReturnValue('');

        await init(container);

        const table = container.querySelector('.route-summary-table');
        expect(table).not.toBeNull();
        const emptyState = table.querySelector('.empty-state');
        expect(emptyState).not.toBeNull();
    });

    it('should show empty table when API fails', async () => {
        api.getComponentProperties.mockRejectedValue(new Error('API error'));

        await init(container);

        const table = container.querySelector('.route-summary-table');
        expect(table).not.toBeNull();
    });

    it('should call cleanup without error', () => {
        expect(() => cleanup()).not.toThrow();
    });

    // -----------------------------------------------------------------------
    // Schema mode toggle
    // -----------------------------------------------------------------------

    it('should show file mode for file-path schema', async () => {
        const propsWithFileSchema = {
            ...SAMPLE_PROPERTIES,
            'restapi.health.schema': './conf/schemas/my-schema.json'
        };
        api.getComponentProperties.mockResolvedValue({
            properties: propsWithFileSchema,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const fileRadio = form.querySelector('.schema-mode-file');
        expect(fileRadio.checked).toBe(true);

        const fileInput = form.querySelector('.field-schema-file');
        expect(fileInput.value).toBe('./conf/schemas/my-schema.json');
    });

    it('should show inline mode for inline JSON schema', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_SCHEMA,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const inlineRadio = form.querySelector('.schema-mode-inline');
        expect(inlineRadio.checked).toBe(true);

        const inlineTextarea = form.querySelector('.field-schema-inline');
        expect(inlineTextarea.value).toBe('{"type":"object"}');
    });

    it('should toggle between file input and textarea', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        // Enable schema
        const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
        schemaCheckbox.checked = true;
        schemaCheckbox.dispatchEvent(new Event('change'));

        const fileRadio = form.querySelector('.schema-mode-file');
        const inlineRadio = form.querySelector('.schema-mode-inline');
        const fileDiv = form.querySelector('.schema-file-input');
        const inlineDiv = form.querySelector('.schema-inline-input');

        // File mode by default
        expect(fileRadio.checked).toBe(true);
        expect(fileDiv.classList.contains('hidden')).toBe(false);
        expect(inlineDiv.classList.contains('hidden')).toBe(true);

        // Switch to inline
        inlineRadio.checked = true;
        inlineRadio.dispatchEvent(new Event('change'));
        expect(fileDiv.classList.contains('hidden')).toBe(true);
        expect(inlineDiv.classList.contains('hidden')).toBe(false);

        // Switch back to file
        fileRadio.checked = true;
        fileRadio.dispatchEvent(new Event('change'));
        expect(fileDiv.classList.contains('hidden')).toBe(false);
        expect(inlineDiv.classList.contains('hidden')).toBe(true);
    });

    it('should read from active mode input on save', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        // Enable schema
        const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
        schemaCheckbox.checked = true;
        schemaCheckbox.dispatchEvent(new Event('change'));

        // Enter file path value
        form.querySelector('.field-schema-file').value = './conf/schemas/test.json';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(api.updateComponentProperties).toHaveBeenCalledWith(
            'test-processor-id',
            expect.objectContaining({
                'restapi.health.schema': './conf/schemas/test.json'
            })
        );
    });

    it('should show schema mode toggle labels (File path / Inline JSON)', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const schemaCheckbox = form.querySelector('.schema-validation-checkbox');
        schemaCheckbox.checked = true;
        schemaCheckbox.dispatchEvent(new Event('change'));

        const modeLabels = form.querySelectorAll('.schema-mode-label');
        expect(modeLabels.length).toBe(2);
        expect(modeLabels[0].textContent).toContain('route.form.schema.file');
        expect(modeLabels[1].textContent).toContain('route.form.schema.inline');
    });

    // -----------------------------------------------------------------------
    // Origin badges (persisted / modified / new)
    // -----------------------------------------------------------------------

    it('should show persisted badge for routes loaded from properties', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        expect(healthRow.dataset.origin).toBe('persisted');
        const badge = healthRow.querySelector('.origin-persisted');
        expect(badge).not.toBeNull();
    });

    it('should mark UI-created route as persisted when componentId is set', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Add a new route — with componentId present, it gets persisted
        container.querySelector('.add-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'brand-new';
        form.querySelector('.field-path').value = '/api/brand-new';
        form.querySelector('.save-route-button').click();
        await tick();

        const newRow = container.querySelector('tr[data-route-name="brand-new"]');
        expect(newRow.dataset.origin).toBe('persisted');
        // Persisted badge always shown for persisted routes
        expect(newRow.querySelector('.origin-persisted')).not.toBeNull();
    });

    it('should show persisted badge with tooltip', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        const badge = healthRow.querySelector('.origin-persisted');
        expect(badge).not.toBeNull();
        expect(badge.title).toBe('origin.badge.persisted.title');
    });

    it('should keep persisted origin after editing and saving persisted route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        expect(healthRow.dataset.origin).toBe('persisted');

        // Edit and save — with componentId, it gets persisted again
        healthRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.field-path').value = '/api/health/v2';
        form.querySelector('.save-route-button').click();
        await tick();

        expect(healthRow.dataset.origin).toBe('persisted');
        // After save, lock icon is not shown (connection status unknown until reload)
    });

    it('should keep persisted origin when re-editing a persisted route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Add a new route — persisted via API
        container.querySelector('.add-route-button').click();
        let form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'temp-route';
        form.querySelector('.field-path').value = '/api/temp';
        form.querySelector('.save-route-button').click();
        await tick();

        const newRow = container.querySelector('tr[data-route-name="temp-route"]');
        expect(newRow.dataset.origin).toBe('persisted');

        // Edit the route again
        newRow.querySelector('.edit-route-button').click();
        form = container.querySelector('.route-form');
        form.querySelector('.field-path').value = '/api/temp/v2';
        form.querySelector('.save-route-button').click();
        await tick();

        // Should still be 'persisted'
        expect(newRow.dataset.origin).toBe('persisted');
    });

    it('should use i18n keys for origin badge text and tooltips', async () => {
        // Provide realistic translations to verify i18n wiring
        utils.t.mockImplementation((key) => {
            const translations = {
                'origin.badge.new': 'Neu',
                'origin.badge.new.title': 'In dieser Sitzung erstellt',
                'origin.badge.modified': 'Geändert',
                'origin.badge.modified.title': 'In dieser Sitzung geändert',
                'origin.badge.persisted.title': 'Aus Prozessor-Eigenschaften geladen',
                'route.save.success.banner': 'Erfolgreich gespeichert.'
            };
            return translations[key] || key;
        });

        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Verify persisted badge tooltip uses translated text (health is connected in mock)
        const healthRow = container.querySelector('tr[data-route-name="health"]');
        const persistedBadge = healthRow.querySelector('.origin-persisted');
        expect(persistedBadge.title).toBe('Aus Prozessor-Eigenschaften geladen');

        // After editing and saving, origin stays persisted but lock icon
        // is not shown (connection status unknown until page reload)
        healthRow.querySelector('.edit-route-button').click();
        const editForm = container.querySelector('.route-form');
        editForm.querySelector('.field-path').value = '/api/health/v2';
        editForm.querySelector('.save-route-button').click();
        await tick();

        expect(healthRow.dataset.origin).toBe('persisted');
    });

    it('should show saved values when reopening route editor', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Edit health route: change path and roles, then save
        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();
        const form1 = container.querySelector('.route-form');
        form1.querySelector('.field-path').value = '/api/health/v2';
        form1.querySelector('.field-required-roles').value = 'admin';
        form1.querySelector('.save-route-button').click();
        await tick();

        // Reopen editor — fields should retain saved values
        healthRow.querySelector('.edit-route-button').click();
        const form2 = container.querySelector('.route-form');
        expect(form2.querySelector('.field-path').value).toBe('/api/health/v2');
        expect(form2.querySelector('.field-required-roles').value).toBe('admin');
    });

    // -----------------------------------------------------------------------
    // Export annotation (session-only prefix)
    // -----------------------------------------------------------------------

    it('should not annotate persisted routes in export when saved with componentId', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Add a new route — persisted via API
        container.querySelector('.add-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'export-test';
        form.querySelector('.field-path').value = '/api/export-test';
        form.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        // Route was persisted, so no session-only prefix
        expect(textarea.value).toContain('restapi.export-test.path = /api/export-test');
        expect(textarea.value).not.toContain('# [session-only]');
    });

    it('should not annotate persisted routes in export', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Save an existing route without changes to trigger export refresh
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        // Persisted routes should NOT have the session-only prefix
        // The 'data' route (second row) was not edited so remains persisted
        const lines = textarea.value.split('\n');
        const dataLines = lines.filter((l) => l.includes('restapi.data.'));
        for (const line of dataLines) {
            expect(line).not.toContain('# [session-only]');
        }
    });

    it('should show origin badge for all persisted routes regardless of connection', async () => {
        // Only 'health' is connected; 'data' is not
        api.getConnectedRelationships.mockResolvedValue(new Set(['health']));
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        // Both routes are persisted and should show origin badge
        const healthRow = container.querySelector('tr[data-route-name="health"]');
        expect(healthRow.dataset.origin).toBe('persisted');
        expect(healthRow.querySelector('.origin-persisted')).not.toBeNull();

        const dataRow = container.querySelector('tr[data-route-name="data"]');
        expect(dataRow.dataset.origin).toBe('persisted');
        expect(dataRow.querySelector('.origin-persisted')).not.toBeNull();
    });

    it('should show dash in Connection column when create-flowfile is false', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_NO_FLOWFILE,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        const outcomeCell = healthRow.querySelectorAll('td')[1];
        expect(outcomeCell.querySelector('.empty-state')).toBeTruthy();
        expect(outcomeCell.textContent).toContain('—');
    });

    it('should show custom success-outcome in Connection column', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_OUTCOME,
            revision: { version: 1 }
        });

        await init(container);

        const dataRow = container.querySelector('tr[data-route-name="data"]');
        const outcomeCell = dataRow.querySelectorAll('td')[1];
        expect(outcomeCell.textContent).toContain('api-data');
    });

    it('should toggle connection name field visibility via create-flowfile checkbox', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        // Open editor
        container.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');
        const checkbox = form.querySelector('.create-flowfile-checkbox');
        const outcomeContainer = form.querySelector('.field-container-success-outcome');

        // Initially visible (create-flowfile is checked)
        expect(checkbox.checked).toBe(true);
        expect(outcomeContainer.classList.contains('hidden')).toBe(false);

        // Uncheck — should hide
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        expect(outcomeContainer.classList.contains('hidden')).toBe(true);

        // Re-check — should show
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        expect(outcomeContainer.classList.contains('hidden')).toBe(false);
    });

    it('should include create-flowfile=false in export text', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_NO_FLOWFILE,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Save a route to trigger export refresh
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('create-flowfile = false');
    });

    it('should always include success-outcome in export text for FlowFile routes', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Save a route to trigger export refresh
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('success-outcome = health');
    });

    it('should include custom success-outcome in export text', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_OUTCOME,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Save a route to trigger export refresh
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('success-outcome = api-data');
    });

    it('should include required-roles in export text when route has them', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Trigger export refresh by saving the data route (index 1 — has required-roles="admin")
        container.querySelectorAll('.edit-route-button')[1].click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('restapi.data.required-roles = admin');
    });

    it('should include required-scopes in export text when route has them', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        container.querySelectorAll('.edit-route-button')[1].click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('restapi.data.required-scopes = read,write');
    });

    it('should include max-request-size in export text when route has it', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: {
                ...SAMPLE_PROPERTIES,
                'restapi.data.max-request-size': '2097152'
            },
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        container.querySelectorAll('.edit-route-button')[1].click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('restapi.data.max-request-size = 2097152');
    });

    it('should omit required-roles/required-scopes/max-request-size in export when empty', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // health route (index 0) has empty required-roles and required-scopes
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        const healthLines = textarea.value.split('\n').filter((l) => l.startsWith('restapi.health.'));
        for (const line of healthLines) {
            expect(line).not.toContain('.required-roles');
            expect(line).not.toContain('.required-scopes');
            expect(line).not.toContain('.max-request-size');
        }
    });

    // -----------------------------------------------------------------------
    // Management endpoint export
    // -----------------------------------------------------------------------

    it('should include management properties in export when non-default', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});
        api.fetchGatewayApi.mockResolvedValue({
            managementEndpoints: [
                { name: 'health', path: '/health', enabled: false, authMode: 'bearer', methods: 'GET',
                    requiredRoles: 'admin', requiredScopes: '' }
            ]
        });

        await init(container);
        await tick();

        // Trigger export refresh via route save
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('rest.gateway.management.health.enabled = false');
        expect(textarea.value).toContain('rest.gateway.management.health.auth-mode = bearer');
        expect(textarea.value).toContain('rest.gateway.management.health.required-roles = admin');
    });

    it('should include management section header when management properties are non-default', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});
        api.fetchGatewayApi.mockResolvedValue({
            managementEndpoints: [
                { name: 'health', path: '/health', enabled: false, authMode: 'local-only,bearer', methods: 'GET' }
            ]
        });

        await init(container);
        await tick();

        // Trigger export refresh
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('# route.management.heading');
    });

    it('should omit management section when all values are defaults', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});
        api.fetchGatewayApi.mockResolvedValue({
            managementEndpoints: [
                { name: 'health', path: '/health', enabled: true, authMode: 'local-only,bearer', methods: 'GET' }
            ]
        });

        await init(container);
        await tick();

        // Trigger export refresh
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).not.toContain('rest.gateway.management.');
        expect(textarea.value).not.toContain('# route.management.heading');
    });

    it('should store management data attributes on table rows', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.fetchGatewayApi.mockResolvedValue({
            managementEndpoints: [
                { name: 'health', path: '/health', enabled: true, authMode: 'bearer', methods: 'GET',
                    requiredRoles: 'admin', requiredScopes: 'read' }
            ]
        });

        await init(container);
        await tick();

        const row = container.querySelector('tr[data-mgmt-name="health"]');
        expect(row.dataset.mgmtEnabled).toBe('true');
        expect(row.dataset.mgmtAuthMode).toBe('bearer');
        expect(row.dataset.mgmtRoles).toBe('admin');
        expect(row.dataset.mgmtScopes).toBe('read');
    });

    it('should show saved roles/scopes when reopening management editor', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});
        api.fetchGatewayApi.mockResolvedValue({
            managementEndpoints: [
                { name: 'health', path: '/health', enabled: true, authMode: 'local-only,bearer', methods: 'GET' }
            ]
        });

        await init(container);
        await tick();

        // First edit: enter roles and scopes, then save
        const row = container.querySelector('tr[data-mgmt-name="health"]');
        row.querySelector('.btn-edit').click();
        const form1 = container.querySelector('.mgmt-edit-form');
        form1.querySelector('.field-required-roles').value = 'admin,operator';
        form1.querySelector('.field-required-scopes').value = 'metrics:read';
        form1.querySelector('.save-route-button').click();
        await tick();

        // Reopen editor — fields should retain saved values
        row.querySelector('.btn-edit').click();
        const form2 = container.querySelector('.mgmt-edit-form');
        expect(form2.querySelector('.field-required-roles').value).toBe('admin,operator');
        expect(form2.querySelector('.field-required-scopes').value).toBe('metrics:read');
    });

    it('should refresh export after management endpoint save', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});
        api.fetchGatewayApi.mockResolvedValue({
            managementEndpoints: [
                { name: 'health', path: '/health', enabled: true, authMode: 'local-only,bearer', methods: 'GET' }
            ]
        });

        await init(container);
        await tick();

        // Open management editor and disable the endpoint
        const row = container.querySelector('tr[data-mgmt-name="health"]');
        row.querySelector('.btn-edit').click();
        const form = container.querySelector('.mgmt-edit-form');
        form.querySelector('.mgmt-enabled').checked = false;
        form.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('rest.gateway.management.health.enabled = false');
    });

    // -----------------------------------------------------------------------
    // Datalist autocomplete for connection name
    // -----------------------------------------------------------------------

    it('should populate datalist with existing connection names when editing', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_OUTCOME,
            revision: { version: 1 }
        });

        await init(container);

        // Edit the health route (which has default connection name "health")
        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const datalist = form.querySelector('datalist');
        expect(datalist).not.toBeNull();

        // Should contain "api-data" from the data route's custom outcome
        const options = Array.from(datalist.querySelectorAll('option')).map((o) => o.value);
        expect(options).toContain('api-data');
    });

    it('should exclude current route name from datalist suggestions', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        // Edit the health route
        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const datalist = form.querySelector('datalist');
        const options = Array.from(datalist.querySelectorAll('option')).map((o) => o.value);

        // "health" is the current route's connection name — should not be in datalist
        // "data" is the other route — should be in datalist
        expect(options).not.toContain('health');
        expect(options).toContain('data');
    });

    // -----------------------------------------------------------------------
    // Connection map
    // -----------------------------------------------------------------------

    it('should render connection map section after loading routes', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const connectionMap = container.querySelector('.connection-map');
        expect(connectionMap).not.toBeNull();
        expect(connectionMap.tagName.toLowerCase()).toBe('details');

        const summary = connectionMap.querySelector('summary');
        expect(summary.textContent).toContain('route.connection.map.heading');
    });

    it('should group routes by connection name in connection map', async () => {
        const propsShared = {
            ...SAMPLE_PROPERTIES,
            'restapi.data.success-outcome': 'health' // data route shares health's connection
        };
        api.getComponentProperties.mockResolvedValue({
            properties: propsShared,
            revision: { version: 1 }
        });

        await init(container);

        const mapTable = container.querySelector('.connection-map-table');
        const rows = mapTable.querySelectorAll('tbody tr');
        // Should have "health" (grouping health + data) and "failure"
        expect(rows.length).toBe(2);
        expect(rows[0].querySelectorAll('td')[0].textContent).toBe('health');
        expect(rows[0].querySelectorAll('td')[1].textContent).toContain('health');
        expect(rows[0].querySelectorAll('td')[1].textContent).toContain('data');
    });

    it('should show failure as always present in connection map', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const mapTable = container.querySelector('.connection-map-table');
        const rows = mapTable.querySelectorAll('tbody tr');
        const lastRow = rows[rows.length - 1];
        expect(lastRow.querySelectorAll('td')[0].textContent).toBe('failure');
        expect(lastRow.querySelector('em').textContent).toBe('route.connection.map.failure');
    });

    it('should update connection map after save', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Edit health route and change its success-outcome
        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.field-success-outcome').value = 'api-shared';
        form.querySelector('.save-route-button').click();
        await tick();

        const mapTable = container.querySelector('.connection-map-table');
        expect(mapTable.textContent).toContain('api-shared');
    });

    it('should exclude create-flowfile=false routes from connection map', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_NO_FLOWFILE,
            revision: { version: 1 }
        });

        await init(container);

        const mapTable = container.querySelector('.connection-map-table');
        const rows = mapTable.querySelectorAll('tbody tr');
        // health has create-flowfile=false, so only "data" + "failure" rows
        expect(rows.length).toBe(2);
        const connectionNames = Array.from(rows).map((r) => r.querySelectorAll('td')[0].textContent);
        expect(connectionNames).toContain('data');
        expect(connectionNames).toContain('failure');
        expect(connectionNames).not.toContain('health');
    });

    it('should handle disabled route in table', async () => {
        const props = {
            ...SAMPLE_PROPERTIES,
            'restapi.disabled.path': '/api/disabled',
            'restapi.disabled.enabled': 'false'
        };
        api.getComponentProperties.mockResolvedValue({
            properties: props,
            revision: { version: 1 }
        });

        await init(container);

        const rows = container.querySelectorAll('tr[data-route-name]');
        expect(rows.length).toBe(3);

        const disabledRow = container.querySelector('tr[data-route-name="disabled"]');
        const statusBadge = disabledRow.querySelector('.status-disabled');
        expect(statusBadge).not.toBeNull();
    });

    // -----------------------------------------------------------------------
    // Info banner (ephemeral change warning)
    // -----------------------------------------------------------------------

    it('should show success banner after saving a route with componentId', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // No banner initially
        expect(container.querySelector('.info-banner')).toBeNull();

        // Edit and save
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const banner = container.querySelector('.info-banner');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toContain('route.save.success.banner');
        expect(banner.classList.contains('info-banner-success')).toBe(true);
    });

    // -----------------------------------------------------------------------
    // Property export panel
    // -----------------------------------------------------------------------

    it('should render export section', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const exportSection = container.querySelector('.property-export');
        expect(exportSection).not.toBeNull();
        expect(exportSection.querySelector('.property-export-textarea')).not.toBeNull();
        expect(exportSection.querySelector('.copy-properties-button')).not.toBeNull();
    });

    it('should update export after save', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Edit and save
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('restapi.health.path');
    });

    it('should copy properties to clipboard', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Trigger a save first to populate export
        container.querySelector('.edit-route-button').click();
        container.querySelector('.save-route-button').click();
        await tick();

        // Mock clipboard
        const writeTextMock = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            writable: true,
            configurable: true
        });

        container.querySelector('.copy-properties-button').click();
        await tick();

        expect(writeTextMock).toHaveBeenCalled();
    });

    it('should close open editor when clicking Edit on different row', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        // Edit health row
        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();
        expect(container.querySelector('.route-form')).not.toBeNull();

        // Edit data row — should close health editor
        const dataRow = container.querySelector('tr[data-route-name="data"]');
        dataRow.querySelector('.edit-route-button').click();

        // Only one form should be open
        const forms = container.querySelectorAll('.route-form');
        expect(forms.length).toBe(1);

        // Health row should be visible again, data row hidden
        expect(healthRow.classList.contains('hidden')).toBe(false);
        expect(dataRow.classList.contains('hidden')).toBe(true);
    });

    // -------------------------------------------------------------------
    // Context help on global settings
    // -------------------------------------------------------------------

    it('should render context help buttons in global settings rows', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const helpButtons = container.querySelectorAll('.global-settings-display .context-help-toggle');
        expect(helpButtons.length).toBe(5); // one per global setting
    });

    it('should toggle context help panel when button is clicked', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const helpButton = container.querySelector('.global-settings-display .context-help-toggle');
        expect(helpButton).not.toBeNull();

        const panel = container.querySelector('.global-settings-display .context-help-panel');
        expect(panel).not.toBeNull();
        expect(panel.hidden).toBe(true);

        helpButton.click();
        expect(panel.hidden).toBe(false);
        expect(helpButton.getAttribute('aria-expanded')).toBe('true');
    });

    it('should display property key in context help panel', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const panel = container.querySelector('.global-settings-display .context-help-panel');
        const code = panel.querySelector('code');
        expect(code).not.toBeNull();
        // First global setting key
        expect(code.textContent).toBe('rest.gateway.listening.port');
    });

    it('should render context help buttons in route inline editor', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        // Click edit on the first route
        const editBtn = container.querySelector('.edit-route-button');
        editBtn.click();

        const routeForm = container.querySelector('.route-form');
        expect(routeForm).not.toBeNull();

        // Route form fields should have context help buttons
        const helpButtons = routeForm.querySelectorAll('.context-help-toggle');
        // name, enabled, path, auth-mode, roles, scopes, create-flowfile, connection, schema = 9
        expect(helpButtons.length).toBeGreaterThanOrEqual(7);
    });

    // -------------------------------------------------------------------
    // API Routes heading
    // -------------------------------------------------------------------

    it('should render API Routes heading as h3', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const heading = container.querySelector('h3.api-routes-heading');
        expect(heading).not.toBeNull();
        expect(heading.textContent).toBe('route.api.heading');
    });

    // -------------------------------------------------------------------
    // Form field order and roles/scopes visibility
    // -------------------------------------------------------------------

    it('should render auth-mode before roles and scopes in form field order', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const containers = Array.from(form.querySelectorAll('.form-field'));
        const authModeIdx = containers.findIndex((el) => el.classList.contains('field-container-auth-mode'));
        const rolesIdx = containers.findIndex((el) => el.classList.contains('field-container-required-roles'));
        const scopesIdx = containers.findIndex((el) => el.classList.contains('field-container-required-scopes'));

        expect(authModeIdx).toBeGreaterThan(-1);
        expect(rolesIdx).toBeGreaterThan(-1);
        expect(scopesIdx).toBeGreaterThan(-1);
        expect(authModeIdx).toBeLessThan(rolesIdx);
        expect(authModeIdx).toBeLessThan(scopesIdx);
    });

    it('should hide roles and scopes containers when auth-mode is none', async () => {
        const propsNone = {
            ...SAMPLE_PROPERTIES,
            'restapi.health.auth-mode': 'none'
        };
        api.getComponentProperties.mockResolvedValue({
            properties: propsNone,
            revision: { version: 1 }
        });

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const rolesContainer = form.querySelector('.field-container-required-roles');
        const scopesContainer = form.querySelector('.field-container-required-scopes');

        expect(rolesContainer.classList.contains('hidden')).toBe(true);
        expect(scopesContainer.classList.contains('hidden')).toBe(true);
    });

    it('should show roles and scopes containers when auth-mode includes bearer', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const rolesContainer = form.querySelector('.field-container-required-roles');
        const scopesContainer = form.querySelector('.field-container-required-scopes');

        // Default auth-mode is 'bearer', so roles/scopes should be visible
        expect(rolesContainer.classList.contains('hidden')).toBe(false);
        expect(scopesContainer.classList.contains('hidden')).toBe(false);
    });

    // -------------------------------------------------------------------
    // Management endpoints — rendering and editing
    // -------------------------------------------------------------------

    const MGMT_ENDPOINTS = [
        { name: 'health', path: '/health', enabled: true, authMode: 'local-only,bearer', methods: 'GET' },
        { name: 'config', path: '/config', enabled: false, authMode: 'bearer', methods: 'GET' }
    ];

    const initWithMgmt = async (mgmtEndpoints = MGMT_ENDPOINTS) => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.fetchGatewayApi.mockResolvedValue({
            managementEndpoints: mgmtEndpoints
        });
        await init(container);
        await tick();
    };

    it('should render management endpoints table with Actions column', async () => {
        await initWithMgmt();

        const mgmtTable = container.querySelector('.management-endpoints-table');
        expect(mgmtTable).not.toBeNull();

        const headers = mgmtTable.querySelectorAll('thead th');
        const headerTexts = Array.from(headers).map((th) => th.textContent.trim());
        expect(headerTexts).toContain('route.management.table.actions');
    });

    it('should render Edit button for each management endpoint', async () => {
        await initWithMgmt();

        const editBtns = container.querySelectorAll('.management-endpoints-table .btn-edit');
        expect(editBtns.length).toBe(2);
    });

    it('should display combined auth-mode badges for comma-separated values', async () => {
        await initWithMgmt();

        const healthRow = container.querySelector('tr[data-mgmt-name="health"]');
        const authCell = healthRow.querySelectorAll('td')[4];
        const badge = authCell.querySelector('.authmode-badge');
        expect(badge).not.toBeNull();
        // Should contain combined label
        expect(badge.textContent).toContain('route.authmode.local-only');
        expect(badge.textContent).toContain('route.authmode.bearer');
    });

    it('should open management editor on Edit click', async () => {
        await initWithMgmt();

        const editBtn = container.querySelector('.management-endpoints-table .btn-edit');
        editBtn.click();

        const mgmtForm = container.querySelector('.mgmt-edit-form');
        expect(mgmtForm).not.toBeNull();
    });

    it('should hide table row when management editor is open', async () => {
        await initWithMgmt();

        const row = container.querySelector('tr[data-mgmt-name="health"]');
        const editBtn = row.querySelector('.btn-edit');
        editBtn.click();

        expect(row.classList.contains('hidden')).toBe(true);
    });

    it('should show endpoint name and path as read-only in management editor', async () => {
        await initWithMgmt();

        container.querySelector('.management-endpoints-table .btn-edit').click();
        const form = container.querySelector('.mgmt-edit-form');
        const header = form.querySelector('.form-header');
        expect(header.textContent).toContain('health');
        expect(header.textContent).toContain('/health');
    });

    it('should show enabled checkbox in management editor', async () => {
        await initWithMgmt();

        container.querySelector('.management-endpoints-table .btn-edit').click();
        const form = container.querySelector('.mgmt-edit-form');
        const checkbox = form.querySelector('.mgmt-enabled');
        expect(checkbox).not.toBeNull();
        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(true);
    });

    it('should show auth-mode chip input in management editor', async () => {
        await initWithMgmt();

        container.querySelector('.management-endpoints-table .btn-edit').click();
        const form = container.querySelector('.mgmt-edit-form');
        const chipArea = form.querySelector('.auth-mode-chip-area');
        expect(chipArea).not.toBeNull();
        const chips = form.querySelectorAll('.auth-mode-chip');
        expect(chips.length).toBe(2);
    });

    it('should close management editor on Cancel and restore row', async () => {
        await initWithMgmt();

        const row = container.querySelector('tr[data-mgmt-name="health"]');
        row.querySelector('.btn-edit').click();

        const form = container.querySelector('.mgmt-edit-form');
        form.querySelector('.cancel-route-button').click();

        expect(container.querySelector('.mgmt-edit-form')).toBeNull();
        expect(row.classList.contains('hidden')).toBe(false);
    });

    it('should save management endpoint via API on Save click', async () => {
        api.updateComponentProperties.mockResolvedValue({});
        await initWithMgmt();

        container.querySelector('.management-endpoints-table .btn-edit').click();
        const form = container.querySelector('.mgmt-edit-form');

        form.querySelector('.save-route-button').click();
        await tick();

        expect(api.updateComponentProperties).toHaveBeenCalledWith(
            'test-processor-id',
            expect.objectContaining({
                'rest.gateway.management.health.enabled': 'true',
                'rest.gateway.management.health.auth-mode': 'local-only,bearer',
                'rest.gateway.management.health.required-roles': '',
                'rest.gateway.management.health.required-scopes': ''
            })
        );
    });

    it('should update table row after management save', async () => {
        api.updateComponentProperties.mockResolvedValue({});
        await initWithMgmt();

        const row = container.querySelector('tr[data-mgmt-name="health"]');
        row.querySelector('.btn-edit').click();
        const form = container.querySelector('.mgmt-edit-form');

        // Uncheck enabled
        const checkbox = form.querySelector('.mgmt-enabled');
        checkbox.checked = false;

        form.querySelector('.save-route-button').click();
        await tick();

        // Row should be visible again with updated status
        expect(row.classList.contains('hidden')).toBe(false);
        const enabledCell = row.querySelectorAll('td')[2];
        expect(enabledCell.querySelector('.status-disabled')).not.toBeNull();
    });

    it('should close previous management editor when opening another', async () => {
        await initWithMgmt();

        // Open first editor
        const firstRow = container.querySelector('tr[data-mgmt-name="health"]');
        firstRow.querySelector('.btn-edit').click();
        expect(container.querySelector('.mgmt-edit-form')).not.toBeNull();

        // Open second editor
        const secondRow = container.querySelector('tr[data-mgmt-name="config"]');
        secondRow.querySelector('.btn-edit').click();

        // Only one form should be open
        const forms = container.querySelectorAll('.mgmt-edit-form');
        expect(forms.length).toBe(1);
        // First row should be restored
        expect(firstRow.classList.contains('hidden')).toBe(false);
    });

    it('should handle management endpoint save when API call is not needed', async () => {
        await initWithMgmt();

        // Open editor for the disabled config endpoint
        const configRow = container.querySelector('tr[data-mgmt-name="config"]');
        configRow.querySelector('.btn-edit').click();
        const form = container.querySelector('.mgmt-edit-form');

        // Verify editor shows the disabled state
        const checkbox = form.querySelector('.mgmt-enabled');
        expect(checkbox.checked).toBe(false);

        // Enable it and save
        checkbox.checked = true;
        api.updateComponentProperties.mockResolvedValue({});
        form.querySelector('.save-route-button').click();
        await tick();

        // Row should be updated with enabled status
        expect(configRow.classList.contains('hidden')).toBe(false);
        const enabledCell = configRow.querySelectorAll('td')[2];
        expect(enabledCell.querySelector('.status-enabled')).not.toBeNull();
    });

    it('should show combined auth-mode badges in user route summary table', async () => {
        const propsWithMultiAuth = {
            ...SAMPLE_PROPERTIES,
            'restapi.health.auth-mode': 'local-only,bearer'
        };
        api.getComponentProperties.mockResolvedValue({
            properties: propsWithMultiAuth,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        const authCell = healthRow.querySelectorAll('td')[4];
        const badge = authCell.querySelector('.authmode-badge');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toContain('route.authmode.local-only');
        expect(badge.textContent).toContain('route.authmode.bearer');
    });

    it('should display error when management save fails', async () => {
        api.updateComponentProperties.mockRejectedValue(new Error('Save failed'));
        await initWithMgmt();

        container.querySelector('.management-endpoints-table .btn-edit').click();
        const form = container.querySelector('.mgmt-edit-form');

        form.querySelector('.save-route-button').click();
        await tick();

        // Form should still be open (not closed on error)
        expect(container.querySelector('.mgmt-edit-form')).not.toBeNull();
        expect(utils.displayUiError).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // Management endpoint editing — standalone describe block
    // -------------------------------------------------------------------

    describe('management endpoint editing', () => {
        const MGMT_CONFIG = {
            managementEndpoints: [
                { name: 'health', path: '/health', enabled: true, authMode: 'local-only,bearer', methods: 'GET' },
                { name: 'metrics', path: '/metrics', enabled: true, authMode: 'local-only,bearer', methods: 'GET' }
            ]
        };

        const setupMgmtMocks = () => {
            api.getComponentProperties.mockResolvedValue({
                properties: { 'restapi.data.path': '/api/data' },
                revision: { version: 1 }
            });
            api.fetchGatewayApi.mockResolvedValue(MGMT_CONFIG);
        };

        it('should render management endpoints table when gateway config is available', async () => {
            setupMgmtMocks();
            await init(container);
            await tick();

            const mgmtTable = container.querySelector('.management-endpoints-table');
            expect(mgmtTable).not.toBeNull();

            const rows = mgmtTable.querySelectorAll('tbody tr[data-mgmt-name]');
            expect(rows.length).toBe(2);
            expect(rows[0].getAttribute('data-mgmt-name')).toBe('health');
            expect(rows[1].getAttribute('data-mgmt-name')).toBe('metrics');
        });

        it('should display Edit buttons for management endpoints', async () => {
            setupMgmtMocks();
            await init(container);
            await tick();

            const mgmtTable = container.querySelector('.management-endpoints-table');
            const editButtons = mgmtTable.querySelectorAll('.btn-edit');
            expect(editButtons.length).toBe(2);
        });

        it('should open management editor on Edit click', async () => {
            setupMgmtMocks();
            await init(container);
            await tick();

            const editBtn = container.querySelector('.management-endpoints-table .btn-edit');
            editBtn.click();

            const mgmtForm = container.querySelector('.mgmt-edit-form');
            expect(mgmtForm).not.toBeNull();
        });

        it('should hide table row when editing', async () => {
            setupMgmtMocks();
            await init(container);
            await tick();

            const row = container.querySelector('tr[data-mgmt-name="health"]');
            row.querySelector('.btn-edit').click();

            expect(row.classList.contains('hidden')).toBe(true);
        });

        it('should restore row on Cancel', async () => {
            setupMgmtMocks();
            await init(container);
            await tick();

            const row = container.querySelector('tr[data-mgmt-name="health"]');
            row.querySelector('.btn-edit').click();

            // Verify form is present and row is hidden
            const form = container.querySelector('.mgmt-edit-form');
            expect(form).not.toBeNull();
            expect(row.classList.contains('hidden')).toBe(true);

            // Click Cancel
            form.querySelector('.cancel-route-button').click();

            // Row should be restored and form removed
            expect(row.classList.contains('hidden')).toBe(false);
            expect(container.querySelector('.mgmt-edit-form')).toBeNull();
        });

        it('should call updateComponentProperties on Save', async () => {
            setupMgmtMocks();
            api.updateComponentProperties.mockResolvedValue({});
            await init(container);
            await tick();

            container.querySelector('.management-endpoints-table .btn-edit').click();
            const form = container.querySelector('.mgmt-edit-form');

            form.querySelector('.save-route-button').click();
            await tick();

            expect(api.updateComponentProperties).toHaveBeenCalledWith(
                'test-processor-id',
                expect.objectContaining({
                    'rest.gateway.management.health.enabled': 'true',
                    'rest.gateway.management.health.auth-mode': 'local-only,bearer',
                    'rest.gateway.management.health.required-roles': '',
                    'rest.gateway.management.health.required-scopes': ''
                })
            );
        });

        it('should show roles/scopes fields in management editor when bearer is selected', async () => {
            setupMgmtMocks();
            await init(container);
            await tick();

            container.querySelector('.management-endpoints-table .btn-edit').click();
            const form = container.querySelector('.mgmt-edit-form');

            const rolesContainer = form.querySelector('.field-container-required-roles');
            const scopesContainer = form.querySelector('.field-container-required-scopes');
            expect(rolesContainer).not.toBeNull();
            expect(scopesContainer).not.toBeNull();

            // Auth-mode includes bearer, so roles/scopes should be visible
            expect(rolesContainer.classList.contains('hidden')).toBe(false);
            expect(scopesContainer.classList.contains('hidden')).toBe(false);
        });

        it('should save roles/scopes values with management endpoint', async () => {
            setupMgmtMocks();
            api.updateComponentProperties.mockResolvedValue({});
            await init(container);
            await tick();

            container.querySelector('.management-endpoints-table .btn-edit').click();
            const form = container.querySelector('.mgmt-edit-form');

            // Enter roles and scopes
            const rolesInput = form.querySelector('.field-required-roles');
            const scopesInput = form.querySelector('.field-required-scopes');
            rolesInput.value = 'admin,operator';
            scopesInput.value = 'metrics:read';

            form.querySelector('.save-route-button').click();
            await tick();

            expect(api.updateComponentProperties).toHaveBeenCalledWith(
                'test-processor-id',
                expect.objectContaining({
                    'rest.gateway.management.health.required-roles': 'admin,operator',
                    'rest.gateway.management.health.required-scopes': 'metrics:read'
                })
            );
        });
    });

    // -----------------------------------------------------------------------
    // External routes from /config
    // -----------------------------------------------------------------------

    describe('external routes from /config', () => {
        const GATEWAY_CONFIG_WITH_EXTERNAL = {
            managementEndpoints: [
                { name: 'health', path: '/health', enabled: true, authMode: 'local-only,bearer',
                    methods: ['GET'], requiredRoles: '', requiredScopes: '', builtIn: true }
            ],
            routes: [
                { name: 'data', path: '/api/data', enabled: true, methods: ['GET', 'POST'],
                    requiredRoles: [], requiredScopes: [], authMode: 'bearer',
                    createFlowFile: true, successOutcome: 'data', source: 'external' },
                { name: 'users', path: '/api/users', enabled: true, methods: ['GET'],
                    requiredRoles: ['ADMIN'], requiredScopes: [], authMode: 'bearer',
                    createFlowFile: true, successOutcome: 'users', source: 'nifi' }
            ],
            externalConfigLoaded: true
        };

        it('should render external routes with external origin badge', async () => {
            api.getComponentProperties.mockResolvedValue({
                properties: SAMPLE_PROPERTIES,
                revision: { version: 1 }
            });
            api.fetchGatewayApi.mockResolvedValue(GATEWAY_CONFIG_WITH_EXTERNAL);

            await init(container);
            await tick();

            const dataRow = container.querySelector('tr[data-route-name="data"]');
            expect(dataRow).not.toBeNull();
            expect(dataRow.dataset.origin).toBe('external');
            const badge = dataRow.querySelector('.origin-external');
            expect(badge).not.toBeNull();
        });

        it('should show edit button but no delete button for external routes', async () => {
            api.getComponentProperties.mockResolvedValue({
                properties: SAMPLE_PROPERTIES,
                revision: { version: 1 }
            });
            api.fetchGatewayApi.mockResolvedValue(GATEWAY_CONFIG_WITH_EXTERNAL);

            await init(container);
            await tick();

            const dataRow = container.querySelector('tr[data-route-name="data"]');
            expect(dataRow.querySelector('.edit-route-button')).not.toBeNull();
            expect(dataRow.querySelector('.remove-route-button')).toBeNull();
        });

        it('should show edit/delete buttons for NiFi routes even when external routes exist', async () => {
            api.getComponentProperties.mockResolvedValue({
                properties: SAMPLE_PROPERTIES,
                revision: { version: 1 }
            });
            api.fetchGatewayApi.mockResolvedValue(GATEWAY_CONFIG_WITH_EXTERNAL);

            await init(container);
            await tick();

            const usersRow = container.querySelector('tr[data-route-name="users"]');
            expect(usersRow).not.toBeNull();
            expect(usersRow.dataset.origin).toBe('persisted');
            expect(usersRow.querySelector('.edit-route-button')).not.toBeNull();
            expect(usersRow.querySelector('.remove-route-button')).not.toBeNull();
        });

        it('should fall back to NiFi-only routes when /config unavailable', async () => {
            api.getComponentProperties.mockResolvedValue({
                properties: SAMPLE_PROPERTIES,
                revision: { version: 1 }
            });
            api.fetchGatewayApi.mockRejectedValue(new Error('Gateway unavailable'));

            await init(container);
            await tick();

            // Should still render routes from NiFi properties
            const rows = container.querySelectorAll('.route-summary-table tbody tr[data-route-name]');
            expect(rows.length).toBe(2); // health and data from SAMPLE_PROPERTIES
        });

        it('should not display disabled-test external routes', async () => {
            api.getComponentProperties.mockResolvedValue({
                properties: SAMPLE_PROPERTIES,
                revision: { version: 1 }
            });
            api.fetchGatewayApi.mockResolvedValue({
                managementEndpoints: [],
                routes: [
                    { name: 'data', path: '/api/data', enabled: false, methods: ['GET'],
                        requiredRoles: [], requiredScopes: [], authMode: 'bearer',
                        createFlowFile: true, source: 'external' }
                ],
                externalConfigLoaded: true
            });

            await init(container);
            await tick();

            // Disabled routes are filtered out by convertGatewayRoutesToMap
            const dataRow = container.querySelector('tr[data-route-name="data"]');
            expect(dataRow).toBeNull();
        });
    });

    // -------------------------------------------------------------------
    // Tracking enabled
    // -------------------------------------------------------------------

    it('should render tracking-mode dropdown in route editor (none by default)', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');
        const select = form.querySelector('.tracking-mode-select');
        expect(select).not.toBeNull();
        expect(select.value).toBe('none');
    });

    it('should render tracking-mode dropdown with simple selected when tracking-mode=simple', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_TRACKING,
            revision: { version: 1 }
        });

        await init(container);

        // Click edit on the data route (which has tracking-mode=simple)
        const dataRow = container.querySelector('tr[data-route-name="data"]');
        dataRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');
        const select = form.querySelector('.tracking-mode-select');
        expect(select).not.toBeNull();
        expect(select.value).toBe('simple');
    });

    it('should include tracking-mode in extractFormFields', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Edit the data route (GET,POST — has body method, passes validation)
        const dataRow = container.querySelector('tr[data-route-name="data"]');
        dataRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        // Set tracking to simple
        const select = form.querySelector('.tracking-mode-select');
        select.value = 'simple';

        // Save and check the API call includes tracking-mode
        form.querySelector('.save-route-button').click();
        await tick();

        const call = api.updateComponentProperties.mock.calls[0];
        const props = call[1];
        expect(props['restapi.data.tracking-mode']).toBe('simple');
    });

    it('should reject tracking on GET-only routes', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        // Edit the health route (GET only)
        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        // Set tracking to simple
        const select = form.querySelector('.tracking-mode-select');
        select.value = 'simple';

        // Try to save
        form.querySelector('.save-route-button').click();
        await tick();

        // Validation should call displayUiError
        expect(utils.displayUiError).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ message: 'route.validate.tracking.methods' }),
            expect.anything(),
            expect.anything()
        );
    });

    it('should allow tracking on POST routes', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Edit the data route (GET,POST)
        const dataRow = container.querySelector('tr[data-route-name="data"]');
        dataRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        // Set tracking to simple
        const select = form.querySelector('.tracking-mode-select');
        select.value = 'simple';

        form.querySelector('.save-route-button').click();
        await tick();

        // Should save successfully
        expect(api.updateComponentProperties).toHaveBeenCalled();
    });

    it('should allow tracking when methods is empty (all methods)', async () => {
        const propsNoMethods = {
            ...SAMPLE_PROPERTIES,
            'restapi.health.methods': ''
        };
        api.getComponentProperties.mockResolvedValue({
            properties: propsNoMethods,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        healthRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        const select = form.querySelector('.tracking-mode-select');
        select.value = 'simple';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(api.updateComponentProperties).toHaveBeenCalled();
    });

    it('should show tracking badge in table when tracking-mode=simple', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: PROPERTIES_WITH_TRACKING,
            revision: { version: 1 }
        });

        await init(container);

        const dataRow = container.querySelector('tr[data-route-name="data"]');
        const badge = dataRow.querySelector('.tracking-badge');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toContain('route.table.tracking');
    });

    it('should not show tracking badge when tracking-mode is none', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        const badge = healthRow.querySelector('.tracking-badge');
        expect(badge).toBeNull();
    });

    it('should include tracking-mode=simple in buildPropertyUpdates', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Edit the data route (GET,POST — passes tracking validation)
        const dataRow = container.querySelector('tr[data-route-name="data"]');
        dataRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        // Set tracking to simple
        form.querySelector('.tracking-mode-select').value = 'simple';

        form.querySelector('.save-route-button').click();
        await tick();

        const call = api.updateComponentProperties.mock.calls[0];
        const props = call[1];
        expect(props['restapi.data.tracking-mode']).toBe('simple');
    });

    it('should render context help button for tracking field', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        const trackingContainer = form.querySelector('.field-container-tracking-mode');
        expect(trackingContainer).not.toBeNull();
        const helpButton = trackingContainer.querySelector('.context-help-toggle');
        expect(helpButton).not.toBeNull();
    });

    it('should update tracking badge after save', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const dataRow = container.querySelector('tr[data-route-name="data"]');
        // No badge initially
        expect(dataRow.querySelector('.tracking-badge')).toBeNull();

        dataRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        // Set tracking to simple
        form.querySelector('.tracking-mode-select').value = 'simple';

        form.querySelector('.save-route-button').click();
        await tick();

        // Badge should now appear
        expect(dataRow.querySelector('.tracking-badge')).not.toBeNull();
    });

    it('should persist tracking-mode in export when creating a new route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Add new route via "add route" button
        container.querySelector('.add-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'new-tracked';
        form.querySelector('.field-path').value = '/api/new-tracked';
        form.querySelector('.field-methods').value = 'POST';
        form.querySelector('.tracking-mode-select').value = 'simple';

        form.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('restapi.new-tracked.tracking-mode = simple');
    });

    it('should retain tracking-mode in dropdown when reopening a newly created route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Add new route with tracking-mode=simple
        container.querySelector('.add-route-button').click();
        let form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'new-tracked';
        form.querySelector('.field-path').value = '/api/new-tracked';
        form.querySelector('.field-methods').value = 'POST';
        form.querySelector('.tracking-mode-select').value = 'simple';
        form.querySelector('.save-route-button').click();
        await tick();

        // Reopen the newly-created route for editing
        const newRow = container.querySelector('tr[data-route-name="new-tracked"]');
        newRow.querySelector('.edit-route-button').click();
        form = container.querySelector('.route-form');

        expect(form.querySelector('.tracking-mode-select').value).toBe('simple');
    });

    it('should persist attachments bounds in export when creating a new route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Add new route with tracking-mode=attachments + bounds
        container.querySelector('.add-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'new-attached';
        form.querySelector('.field-path').value = '/api/new-attached';
        form.querySelector('.field-methods').value = 'POST';
        form.querySelector('.tracking-mode-select').value = 'attachments';
        form.querySelector('.field-attachments-min-count').value = '2';
        form.querySelector('.field-attachments-max-count').value = '4';
        form.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('restapi.new-attached.tracking-mode = attachments');
        expect(textarea.value).toContain('restapi.new-attached.attachments-min-count = 2');
        expect(textarea.value).toContain('restapi.new-attached.attachments-max-count = 4');
    });

    it('should show attachment bounds fields only when mode is attachments', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        const attachmentFields = form.querySelector('.attachment-bounds-fields');
        expect(attachmentFields).not.toBeNull();
        // Should be hidden by default (mode=none)
        expect(attachmentFields.classList.contains('hidden')).toBe(true);

        // Switch to attachments mode
        const select = form.querySelector('.tracking-mode-select');
        select.value = 'attachments';
        select.dispatchEvent(new Event('change'));

        // Should now be visible
        expect(attachmentFields.classList.contains('hidden')).toBe(false);

        // Switch back to none
        select.value = 'none';
        select.dispatchEvent(new Event('change'));
        expect(attachmentFields.classList.contains('hidden')).toBe(true);
    });

    it('should reject attachments when min > max', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const dataRow = container.querySelector('tr[data-route-name="data"]');
        dataRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        form.querySelector('.tracking-mode-select').value = 'attachments';
        form.querySelector('.field-attachments-min-count').value = '5';
        form.querySelector('.field-attachments-max-count').value = '3';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(utils.displayUiError).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ message: 'route.validate.attachments.min.exceeds.max' }),
            expect.anything(),
            expect.anything()
        );
    });

    it('should show timeout field with default value when mode is attachments', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        container.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        // Switch to attachments mode
        const select = form.querySelector('.tracking-mode-select');
        select.value = 'attachments';
        select.dispatchEvent(new Event('change'));

        // Timeout value + unit fields should be present with defaults
        const timeoutValue = form.querySelector('.field-attachments-timeout-value');
        const timeoutUnit = form.querySelector('.field-attachments-timeout-unit');
        expect(timeoutValue).not.toBeNull();
        expect(timeoutValue.value).toBe('30');
        expect(timeoutUnit).not.toBeNull();
        expect(timeoutUnit.value).toBe('sec');
    });

    it('should reject attachments when max > hard limit', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const dataRow = container.querySelector('tr[data-route-name="data"]');
        dataRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        form.querySelector('.tracking-mode-select').value = 'attachments';
        form.querySelector('.field-attachments-max-count').value = '25';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(utils.displayUiError).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ message: 'route.validate.attachments.max.exceeds.limit' }),
            expect.anything(),
            expect.anything()
        );
    });

    it('should reject attachments when timeout is zero', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);

        const dataRow = container.querySelector('tr[data-route-name="data"]');
        dataRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');

        form.querySelector('.tracking-mode-select').value = 'attachments';
        form.querySelector('.field-attachments-timeout-value').value = '0';

        form.querySelector('.save-route-button').click();
        await tick();

        expect(utils.displayUiError).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ message: 'route.validate.attachments.timeout.invalid' }),
            expect.anything(),
            expect.anything()
        );
    });

    it('should include tracking properties in export for routes with tracking', async () => {
        const propsWithTracking = {
            ...SAMPLE_PROPERTIES,
            'restapi.data.tracking-mode': 'attachments',
            'restapi.data.attachments-min-count': '2',
            'restapi.data.attachments-max-count': '10',
            'restapi.data.attachments-timeout': '5 min'
        };
        api.getComponentProperties.mockResolvedValue({
            properties: propsWithTracking,
            revision: { version: 1 }
        });

        await init(container);

        const details = container.querySelector('.property-export');
        details.open = true;
        details.dispatchEvent(new Event('toggle'));

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('restapi.data.tracking-mode = attachments');
        expect(textarea.value).toContain('restapi.data.attachments-min-count = 2');
        expect(textarea.value).toContain('restapi.data.attachments-max-count = 10');
        expect(textarea.value).toContain('restapi.data.attachments-timeout = 5 min');
    });

    it('should not include badge text in exported path values', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: {
                ...SAMPLE_PROPERTIES,
                'restapi.health.schema': '{"type":"object"}',
                'restapi.data.tracking-mode': 'simple'
            },
            revision: { version: 1 }
        });

        await init(container);

        const details = container.querySelector('.property-export');
        details.open = true;
        details.dispatchEvent(new Event('toggle'));

        const textarea = container.querySelector('.property-export-textarea');
        // Path values should be clean, without badge text
        expect(textarea.value).toContain('restapi.health.path = /api/health');
        expect(textarea.value).not.toMatch(/restapi\.health\.path = .*Schema/);
        expect(textarea.value).toContain('restapi.data.path = /api/data');
        expect(textarea.value).not.toMatch(/restapi\.data\.path = .*Tracking/);
    });

    it('should render four form sections with correct titles', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });

        await init(container);
        container.querySelector('.edit-route-button').click();

        const form = container.querySelector('.route-form');
        const sections = form.querySelectorAll('.route-form-section');
        expect(sections).toHaveLength(4);

        const titles = Array.from(sections).map(
            (s) => s.querySelector('.route-form-section-title').textContent
        );
        expect(titles).toEqual([
            'route.form.section.basic',
            'route.form.section.auth',
            'route.form.section.tracking',
            'route.form.section.advanced'
        ]);
    });
});
