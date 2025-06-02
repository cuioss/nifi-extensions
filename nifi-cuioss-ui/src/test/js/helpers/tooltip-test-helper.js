// test/js/helpers/tooltip-test-helper.js
export function expectTooltipInitialized(selector, expectedOptions = {}) {
    const elements = document.querySelectorAll(selector);
    expect(elements.length).toBeGreaterThan(0);

    elements.forEach(element => {
        expect(element.getAttribute('data-tooltip-initialized')).toBe('true');

        if (Object.keys(expectedOptions).length > 0) {
            expect(element._tooltipOptions).toMatchObject(expectedOptions);
        }
    });
}
