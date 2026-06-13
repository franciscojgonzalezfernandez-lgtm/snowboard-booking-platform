// Vitest stand-in for the `server-only` package (F-086g): the real module
// throws outside a React Server environment, which would break the colocated
// unit tests of marked lib/ modules. Aliased in vitest.config.ts.
export {};
