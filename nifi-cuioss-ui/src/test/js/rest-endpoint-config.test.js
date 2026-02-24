'use strict';

/**
 * Tests for rest-endpoint-config.js — Gateway route configuration CRUD editor.
 * Verifies the list-first UX: summary table on load, inline edit on click.
 */

jest.mock('../../main/webapp/js/api.js');
jest.mock('../../main/webapp/js/utils.js');

import { init, cleanup } from '../../main/webapp/js/rest-endpoint-config.js';
import * as api from '../../main/webapp/js/api.js';
import * as utils from '../../main/webapp/js/utils.js';

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

const tick = () => new Promise((r) => setTimeout(r, 10));

describe('rest-endpoint-config', () => {
    let container;

    beforeEach(() => {
        // eslint-disable-next-line no-import-assign -- Jest auto-mock requires manual log stub
        utils.log = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
        utils.sanitizeHtml.mockImplementation((s) => s || '');
        utils.displayUiError.mockImplementation(() => {});
        utils.displayUiSuccess.mockImplementation(() => {});
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
        expect(headerTexts).toEqual(['Name', 'Path', 'Methods', 'Enabled', 'Actions']);
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
        expect(cells[1].textContent).toBe('/api/health');
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
        expect(statusCell.textContent).toBe('Disabled');
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
        expect(settingsDisplay.textContent).toContain('Listening Port');
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
        expect(emptyState.textContent).toContain('No routes configured');
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
        expect(healthRow.querySelectorAll('td')[1].textContent).toBe('/api/health/v2');
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
        expect(newRow.querySelectorAll('td')[1].textContent).toBe('/api/new');
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
        expect(modeLabels[0].textContent).toContain('File path');
        expect(modeLabels[1].textContent).toContain('Inline JSON');
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
        expect(badge.textContent).toBe('New');
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
        expect(badge.textContent).toBe('Modified');
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
        expect(banner.textContent).toContain('current session only');
        expect(banner.textContent).toContain('export the properties');
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
});
