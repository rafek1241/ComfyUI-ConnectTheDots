import { describe, expect, it } from "vitest";
import {
    collectInputCandidates,
    collectOutputCandidates,
    createRenderCache,
    getCachedNodeDisplayName,
    getCachedTypeDisplay,
    getConnectionPillText,
    getGraphLink,
    getNodeConnectionSignature,
    getNodeDisplayName,
    getPropertyConnectionCount,
    getSlotDisplayName,
    getTypeDisplay,
} from "../graphUtils";
import type * as types from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

const makeNode = (
    overrides: Partial<types.GraphNode> = {},
): types.GraphNode => ({
    id: 1,
    connect: () => null,
    canConnectTo: () => true,
    ...overrides,
});

const makeSlot = (overrides: Partial<types.GraphSlot> = {}): types.GraphSlot =>
    overrides;

// ── getSlotDisplayName ─────────────────────────────────────────────────────

describe("getSlotDisplayName", () => {
    it("returns label when present", () => {
        expect(getSlotDisplayName({ label: "My Label" })).toBe("My Label");
    });

    it("falls back to localized_name", () => {
        expect(getSlotDisplayName({ localized_name: "Localized" })).toBe(
            "Localized",
        );
    });

    it("falls back to name", () => {
        expect(getSlotDisplayName({ name: "plain" })).toBe("plain");
    });

    it("uses provided fallback when slot has no name fields", () => {
        expect(getSlotDisplayName({}, "fallback")).toBe("fallback");
    });

    it("uses default fallback 'slot'", () => {
        expect(getSlotDisplayName(undefined)).toBe("slot");
    });

    it("label takes priority over localized_name and name", () => {
        expect(
            getSlotDisplayName({
                label: "L",
                localized_name: "LN",
                name: "N",
            }),
        ).toBe("L");
    });
});

// ── getNodeDisplayName ─────────────────────────────────────────────────────

describe("getNodeDisplayName", () => {
    it("prefers getTitle()", () => {
        const node = makeNode({
            getTitle: () => "title fn",
            title: "title prop",
        });
        expect(getNodeDisplayName(node)).toBe("title fn");
    });

    it("falls back to title property", () => {
        expect(getNodeDisplayName(makeNode({ title: "My Node" }))).toBe(
            "My Node",
        );
    });

    it("falls back to type", () => {
        expect(getNodeDisplayName(makeNode({ type: "MyNodeType" }))).toBe(
            "MyNodeType",
        );
    });

    it("falls back to Node N", () => {
        expect(getNodeDisplayName(makeNode({ id: 42 }))).toBe("Node 42");
    });

    it("handles null node", () => {
        expect(getNodeDisplayName(null)).toBe("Node ?");
    });
});

// ── getTypeDisplay ─────────────────────────────────────────────────────────

describe("getTypeDisplay", () => {
    it("returns * for null", () => expect(getTypeDisplay(null)).toBe("*"));
    it("returns * for undefined", () =>
        expect(getTypeDisplay(undefined)).toBe("*"));
    it("returns * for empty string", () =>
        expect(getTypeDisplay("")).toBe("*"));
    it("returns * for 0", () => expect(getTypeDisplay(0)).toBe("*"));
    it("returns * for '0'", () => expect(getTypeDisplay("0")).toBe("*"));
    it("returns * for '*'", () => expect(getTypeDisplay("*")).toBe("*"));
    it("returns string type as-is", () =>
        expect(getTypeDisplay("IMAGE")).toBe("IMAGE"));
    it("joins array types with comma", () =>
        expect(getTypeDisplay(["A", "B"])).toBe("A, B"));
    it("handles nested arrays", () =>
        expect(getTypeDisplay(["A", ["B", "C"]])).toBe("A, B, C"));
});

// ── getCachedTypeDisplay ───────────────────────────────────────────────────

describe("getCachedTypeDisplay", () => {
    it("caches and returns type display", () => {
        const node = makeNode({
            graph: { nodes: [] },
        });
        const cache = createRenderCache(node);
        expect(getCachedTypeDisplay(cache, "IMAGE")).toBe("IMAGE");
        expect(getCachedTypeDisplay(cache, "IMAGE")).toBe("IMAGE");
        // confirm it's in the cache
        expect(cache.typeDisplays.has("IMAGE")).toBe(true);
    });
});

// ── getPropertyConnectionCount ─────────────────────────────────────────────

describe("getPropertyConnectionCount", () => {
    it("returns 1 for a connected input", () => {
        const property: types.PropertyDescriptor = {
            index: 0,
            slot: { link: 5 },
            name: "x",
        };
        expect(getPropertyConnectionCount(property, "input")).toBe(1);
    });

    it("returns 0 for unconnected input", () => {
        const property: types.PropertyDescriptor = {
            index: 0,
            slot: {},
            name: "x",
        };
        expect(getPropertyConnectionCount(property, "input")).toBe(0);
    });

    it("returns link count for output", () => {
        const property: types.PropertyDescriptor = {
            index: 0,
            slot: { links: [1, 2, 3] },
            name: "out",
        };
        expect(getPropertyConnectionCount(property, "output")).toBe(3);
    });

    it("returns 0 for output with no links", () => {
        const property: types.PropertyDescriptor = {
            index: 0,
            slot: {},
            name: "out",
        };
        expect(getPropertyConnectionCount(property, "output")).toBe(0);
    });
});

// ── getConnectionPillText ──────────────────────────────────────────────────

describe("getConnectionPillText", () => {
    it("returns empty string for 0", () => {
        expect(getConnectionPillText(0, "input")).toBe("");
        expect(getConnectionPillText(0, "output")).toBe("");
    });

    it("returns 'Connected' for input with count > 0", () => {
        expect(getConnectionPillText(1, "input")).toBe("Connected");
    });

    it("returns '1 Linked' for single output link", () => {
        expect(getConnectionPillText(1, "output")).toBe("1 Linked");
    });

    it("returns 'N Linked' for multiple output links", () => {
        expect(getConnectionPillText(3, "output")).toBe("3 Linked");
    });
});

// ── getGraphLink ───────────────────────────────────────────────────────────

describe("getGraphLink", () => {
    const link: types.GraphLink = {
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 1,
    };

    it("returns null for null graph", () => {
        expect(getGraphLink(null, 1)).toBeNull();
    });

    it("returns null for null linkId", () => {
        expect(getGraphLink({ links: { 1: link } }, null)).toBeNull();
    });

    it("resolves from graph.links", () => {
        const graph: types.GraphLike = { links: { 1: link } };
        expect(getGraphLink(graph, 1)).toBe(link);
    });

    it("resolves from graph._links as Record", () => {
        const graph: types.GraphLike = { _links: { 1: link } };
        expect(getGraphLink(graph, 1)).toBe(link);
    });

    it("resolves from graph._links as Map", () => {
        const map = new Map<number, types.GraphLink>();
        map.set(1, link);
        const graph = { _links: map } as unknown as types.GraphLike;
        expect(getGraphLink(graph, 1)).toBe(link);
    });

    it("returns null for missing link id", () => {
        const graph: types.GraphLike = { links: { 1: link } };
        expect(getGraphLink(graph, 99)).toBeNull();
    });
});

// ── createRenderCache ──────────────────────────────────────────────────────

describe("createRenderCache", () => {
    it("excludes the target node from candidates", () => {
        const other = makeNode({
            id: 2,
            outputs: [{ type: "IMAGE" }],
        });
        const graph: types.GraphLike = { nodes: [] };
        const target = makeNode({ id: 1, outputs: [{ type: "IMAGE" }], graph });
        // put both nodes in the graph
        graph.nodes = [target, other];
        const cache = createRenderCache(target);
        const ids = cache.inputCandidates.map((c) => c.node.id);
        expect(ids).not.toContain(1);
        expect(ids).toContain(2);
    });

    it("handles nodes with no graph gracefully", () => {
        const node = makeNode({ id: 1 });
        const cache = createRenderCache(node);
        expect(cache.graphNodes).toHaveLength(0);
        expect(cache.inputCandidates).toHaveLength(0);
        expect(cache.outputCandidates).toHaveLength(0);
    });
});

// ── getCachedNodeDisplayName ───────────────────────────────────────────────

describe("getCachedNodeDisplayName", () => {
    it("returns display name and caches it", () => {
        const node = makeNode({ id: 5, title: "Alpha" });
        const cache = createRenderCache(makeNode({ graph: { nodes: [node] } }));
        const name = getCachedNodeDisplayName(cache, node);
        expect(name).toBe("Alpha");
        expect(cache.nodeDisplayNames.get(node)).toBe("Alpha");
    });

    it("handles null node", () => {
        const cache = createRenderCache(makeNode({ graph: { nodes: [] } }));
        expect(getCachedNodeDisplayName(cache, null)).toBe("Node ?");
    });
});

// ── collectInputCandidates / collectOutputCandidates ───────────────────────

describe("collectInputCandidates", () => {
    it("filters out candidates that canConnectTo returns false for", () => {
        const targetNode = makeNode({
            id: 10,
            inputs: [{ type: "IMAGE" }],
            canConnectTo: () => false,
        });
        const sourceNode = makeNode({
            id: 11,
            outputs: [{ type: "IMAGE" }],
            canConnectTo: () => false,
        });
        const graph: types.GraphLike = { nodes: [targetNode, sourceNode] };
        targetNode.graph = graph;
        sourceNode.graph = graph;
        const cache = createRenderCache(targetNode);
        const candidates = collectInputCandidates(
            cache,
            targetNode,
            makeSlot({ type: "IMAGE" }),
        );
        expect(candidates).toHaveLength(0);
    });

    it("includes candidates that canConnectTo returns true for", () => {
        const targetNode = makeNode({
            id: 10,
            inputs: [{ type: "IMAGE" }],
            canConnectTo: () => true,
        });
        const sourceNode = makeNode({
            id: 11,
            outputs: [{ type: "IMAGE" }],
            canConnectTo: () => true,
        });
        const graph: types.GraphLike = { nodes: [targetNode, sourceNode] };
        targetNode.graph = graph;
        const cache = createRenderCache(targetNode);
        const candidates = collectInputCandidates(
            cache,
            targetNode,
            makeSlot({ type: "IMAGE" }),
        );
        expect(candidates).toHaveLength(1);
        expect(candidates[0].node.id).toBe(11);
    });
});

describe("collectOutputCandidates", () => {
    it("returns candidates that canConnectTo returns true for", () => {
        const sourceNode = makeNode({
            id: 1,
            outputs: [{ type: "IMAGE" }],
            canConnectTo: () => true,
        });
        const targetNode = makeNode({
            id: 2,
            inputs: [{ type: "IMAGE" }],
            canConnectTo: () => true,
        });
        const graph: types.GraphLike = { nodes: [sourceNode, targetNode] };
        sourceNode.graph = graph;
        const cache = createRenderCache(sourceNode);
        const candidates = collectOutputCandidates(
            cache,
            sourceNode,
            makeSlot({ type: "IMAGE" }),
        );
        expect(candidates).toHaveLength(1);
        expect(candidates[0].node.id).toBe(2);
    });
});

// ── getNodeConnectionSignature ─────────────────────────────────────────────

describe("getNodeConnectionSignature", () => {
    it("returns empty string for node with no graph", () => {
        const node = makeNode({ id: 1 });
        expect(getNodeConnectionSignature(node)).toBe("");
    });

    it("returns a stable string for a node with no connections", () => {
        const node = makeNode({
            id: 1,
            inputs: [{ type: "IMAGE" }],
            outputs: [{ type: "LATENT" }],
            graph: { nodes: [] },
        });
        const sig = getNodeConnectionSignature(node);
        expect(sig).toBe("in:0:-|out:0:");
    });

    it("includes input link info in signature", () => {
        const link: types.GraphLink = {
            origin_id: 5,
            origin_slot: 2,
            target_id: 1,
            target_slot: 0,
        };
        const node = makeNode({
            id: 1,
            inputs: [{ type: "IMAGE", link: 10 }],
            outputs: [],
            graph: { nodes: [], links: { 10: link } },
        });
        const sig = getNodeConnectionSignature(node);
        expect(sig).toContain("in:0:5:2");
    });

    it("changes when connections change", () => {
        const nodeA = makeNode({
            id: 1,
            inputs: [{ type: "IMAGE" }],
            outputs: [],
            graph: { nodes: [] },
        });
        const link: types.GraphLink = {
            origin_id: 5,
            origin_slot: 0,
            target_id: 1,
            target_slot: 0,
        };
        const nodeB = makeNode({
            id: 1,
            inputs: [{ type: "IMAGE", link: 10 }],
            outputs: [],
            graph: { nodes: [], links: { 10: link } },
        });
        expect(getNodeConnectionSignature(nodeA)).not.toBe(
            getNodeConnectionSignature(nodeB),
        );
    });
});
