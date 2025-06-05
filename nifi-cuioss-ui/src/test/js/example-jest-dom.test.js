/**
 * Example test demonstrating the use of @testing-library/jest-dom custom matchers.
 * This test shows how these matchers can make DOM assertions more readable and expressive.
 */

describe('Example @testing-library/jest-dom usage', () => {
    // Set up a simple DOM element for testing
    beforeEach(() => {
        document.body.innerHTML = `
      <div>
        <button class="btn" disabled>Click me</button>
        <input type="text" placeholder="Enter your name" value="John" />
        <div class="hidden-element" style="display: none;">Hidden content</div>
        <div class="visible-element">Visible content</div>
        <div data-testid="custom-element" class="test-class">Element with test ID</div>
      </div>
    `;
    });

    it('demonstrates toBeDisabled matcher', () => {
        const button = document.querySelector('.btn');

        // Traditional way
        expect(button.disabled).toBe(true);

        // With @testing-library/jest-dom
        expect(button).toBeDisabled();
    });

    it('demonstrates toHaveValue matcher', () => {
        const input = document.querySelector('input');

        // Traditional way
        expect(input.value).toBe('John');

        // With @testing-library/jest-dom
        expect(input).toHaveValue('John');
    });

    it('demonstrates toBeVisible and toBeInTheDocument matchers', () => {
        const hiddenElement = document.querySelector('.hidden-element');
        const visibleElement = document.querySelector('.visible-element');

        // Traditional way
        expect(window.getComputedStyle(hiddenElement).display).toBe('none');
        expect(document.body.contains(visibleElement)).toBe(true);

        // With @testing-library/jest-dom
        expect(hiddenElement).not.toBeVisible();
        expect(visibleElement).toBeVisible();
        expect(visibleElement).toBeInTheDocument();
    });

    it('demonstrates toHaveClass and toHaveAttribute matchers', () => {
        const element = document.querySelector('[data-testid="custom-element"]');

        // Traditional way
        expect(element.classList.contains('test-class')).toBe(true);
        expect(element.hasAttribute('data-testid')).toBe(true);
        expect(element.getAttribute('data-testid')).toBe('custom-element');

        // With @testing-library/jest-dom
        expect(element).toHaveClass('test-class');
        expect(element).toHaveAttribute('data-testid', 'custom-element');
    });

    it('demonstrates toHaveTextContent matcher', () => {
        const element = document.querySelector('[data-testid="custom-element"]');

        // Traditional way
        expect(element.textContent).toBe('Element with test ID');
        expect(element.textContent).toContain('test ID');

        // With @testing-library/jest-dom
        expect(element).toHaveTextContent('Element with test ID');
        expect(element).toHaveTextContent(/test ID/);
    });
});
