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
    'rest.gateway.cors.allowed.origins': '*',
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
        createContextHelp.mockImplementation(mockCreateContextHelp);
        createFormField.mockImplementation(mockCreateFormField);
        // Mock getComponentId from api.js to return a valid processor ID
        api.getComponentId.mockReturnValue('test-processor-id');
        utils.confirmRemoveRoute.mockImplementation((name, onConfirm) => {
            onConfirm();
            return Promise.resolve(true);
        });

        Object.defineProperty(globalThis, 'location', {
            value: { href: 'http://localhost:8080/nifi-jwt-ui/?id=test-processor-id' },
            writable: true
        });

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
        expect(headerTexts).toEqual(['route.table.name', 'route.table.connection', 'route.table.path', 'route.table.methods', 'route.table.enabled', 'route.table.actions']);
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
        const inputs = form.querySelectorAll('.form-input');
        for (const input of inputs) {
            expect(input.value).toBe('');
        }
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
        expect(badge.textContent).toBe('Schema');
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

    it('should show new badge for UI-created route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Add a new route
        container.querySelector('.add-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'brand-new';
        form.querySelector('.field-path').value = '/api/brand-new';
        form.querySelector('.save-route-button').click();
        await tick();

        const newRow = container.querySelector('tr[data-route-name="brand-new"]');
        expect(newRow.dataset.origin).toBe('new');
        const badge = newRow.querySelector('.origin-new');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toBe('origin.badge.new');
        expect(badge.title).toBe('origin.badge.new.title');
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

    it('should show modified badge after editing persisted route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        const healthRow = container.querySelector('tr[data-route-name="health"]');
        expect(healthRow.dataset.origin).toBe('persisted');

        // Edit and save
        healthRow.querySelector('.edit-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.field-path').value = '/api/health/v2';
        form.querySelector('.save-route-button').click();
        await tick();

        expect(healthRow.dataset.origin).toBe('modified');
        const badge = healthRow.querySelector('.origin-modified');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toBe('origin.badge.modified');
        expect(badge.title).toBe('origin.badge.modified.title');
    });

    it('should keep new badge when editing a new route', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Add a new route
        container.querySelector('.add-route-button').click();
        let form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'temp-route';
        form.querySelector('.field-path').value = '/api/temp';
        form.querySelector('.save-route-button').click();
        await tick();

        const newRow = container.querySelector('tr[data-route-name="temp-route"]');
        expect(newRow.dataset.origin).toBe('new');

        // Edit the new route
        newRow.querySelector('.edit-route-button').click();
        form = container.querySelector('.route-form');
        form.querySelector('.field-path').value = '/api/temp/v2';
        form.querySelector('.save-route-button').click();
        await tick();

        // Should still be 'new', not 'modified'
        expect(newRow.dataset.origin).toBe('new');
        expect(newRow.querySelector('.origin-new')).not.toBeNull();
    });

    it('should use i18n keys for origin badge text and tooltips', async () => {
        // Provide realistic translations to verify i18n wiring
        utils.t.mockImplementation((key) => {
            const translations = {
                'origin.badge.new': 'Neu',
                'origin.badge.new.title': 'In dieser Sitzung erstellt',
                'origin.badge.modified': 'Geändert',
                'origin.badge.modified.title': 'In dieser Sitzung geändert',
                'origin.badge.persisted.title': 'Aus Prozessor-Eigenschaften geladen'
            };
            return translations[key] || key;
        });

        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Verify persisted badge tooltip uses translated text
        const healthRow = container.querySelector('tr[data-route-name="health"]');
        const persistedBadge = healthRow.querySelector('.origin-persisted');
        expect(persistedBadge.title).toBe('Aus Prozessor-Eigenschaften geladen');

        // Add a new route and verify badge uses translated text
        container.querySelector('.add-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'i18n-test';
        form.querySelector('.field-path').value = '/api/i18n';
        form.querySelector('.save-route-button').click();
        await tick();

        const newRow = container.querySelector('tr[data-route-name="i18n-test"]');
        const newBadge = newRow.querySelector('.origin-new');
        expect(newBadge.textContent).toBe('Neu');
        expect(newBadge.title).toBe('In dieser Sitzung erstellt');

        // Edit persisted route and verify modified badge uses translated text
        healthRow.querySelector('.edit-route-button').click();
        const editForm = container.querySelector('.route-form');
        editForm.querySelector('.field-path').value = '/api/health/v2';
        editForm.querySelector('.save-route-button').click();
        await tick();

        const modBadge = healthRow.querySelector('.origin-modified');
        expect(modBadge.textContent).toBe('Geändert');
        expect(modBadge.title).toBe('In dieser Sitzung geändert');
    });

    // -----------------------------------------------------------------------
    // Export annotation (session-only prefix)
    // -----------------------------------------------------------------------

    it('should annotate session-only routes in export', async () => {
        api.getComponentProperties.mockResolvedValue({
            properties: SAMPLE_PROPERTIES,
            revision: { version: 1 }
        });
        api.updateComponentProperties.mockResolvedValue({});

        await init(container);

        // Add a new route
        container.querySelector('.add-route-button').click();
        const form = container.querySelector('.route-form');
        form.querySelector('.route-name').value = 'export-test';
        form.querySelector('.field-path').value = '/api/export-test';
        form.querySelector('.save-route-button').click();
        await tick();

        const textarea = container.querySelector('.property-export-textarea');
        expect(textarea.value).toContain('# [session-only] restapi.export-test.path');
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

    it('should show info banner after saving a route', async () => {
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
        expect(banner.textContent).toContain('route.info.banner');
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
        expect(helpButtons.length).toBe(6); // one per global setting
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
        // name, enabled, path, roles, scopes, create-flowfile, connection, schema = 8
        expect(helpButtons.length).toBeGreaterThanOrEqual(6);
    });
});
