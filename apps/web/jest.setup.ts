// Polyfill URL APIs missing in jsdom
// @ts-expect-error — jsdom types do not include these
if (typeof URL.createObjectURL === "undefined") {
  // @ts-expect-error — assigning to readonly in test env
  URL.createObjectURL = () => "blob:mock-url";
}
// @ts-expect-error
if (typeof URL.revokeObjectURL === "undefined") {
  // @ts-expect-error
  URL.revokeObjectURL = () => {};
}

// Polyfill window.open mock for PDF export tests
if (typeof window.open === "undefined") {
  // @ts-expect-error
  window.open = () => null;
}

export {};
