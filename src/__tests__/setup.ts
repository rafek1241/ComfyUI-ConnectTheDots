// Stub the LiteGraph global that ComfyUI injects at runtime.
// graphUtils.ts references it via `declare const LiteGraph`, which becomes
// a bare identifier reference in the compiled output.
Object.defineProperty(globalThis, "LiteGraph", {
    value: {
        EVENT: Symbol("EVENT"),
        ACTION: Symbol("ACTION"),
    },
    configurable: true,
    writable: true,
});
