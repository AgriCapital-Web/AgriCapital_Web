import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

if (typeof globalThis.ResizeObserver === "undefined") {
  // @ts-expect-error ResizeObserver is intentionally provided by the test environment
  globalThis.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
}
