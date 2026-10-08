import '@testing-library/jest-dom/vitest';

/**
 * Browser APIs jsdom does not implement, which Radix primitives call on mount.
 *
 * `ResizeObserver` is used by `@radix-ui/react-use-size`, which every `Select` and every
 * `Dialog` pulls in; `scrollIntoView` and `hasPointerCapture` are used by the select's
 * keyboard and pointer handling. jsdom implements none of the three, so a screen carrying
 * a `SelectField` throws on render rather than failing an assertion — which reads as a
 * broken test rather than as a missing environment.
 *
 * Stubbed here rather than per suite, because the alternative is every future screen with
 * a dropdown rediscovering the same three lines. They are **stubs, not implementations**:
 * nothing in this console reads a measured size or asserts on scrolling, and a test that
 * needed either would need a real browser rather than a better stub.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView ??= function scrollIntoView(): void {};
  Element.prototype.hasPointerCapture ??= function hasPointerCapture(): boolean {
    return false;
  };
  Element.prototype.setPointerCapture ??= function setPointerCapture(): void {};
  Element.prototype.releasePointerCapture ??= function releasePointerCapture(): void {};
}
