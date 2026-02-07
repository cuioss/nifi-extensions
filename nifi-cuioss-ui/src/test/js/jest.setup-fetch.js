// Provide a global fetch mock for Jest (jsdom does not include fetch)
globalThis.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('')
    })
);
