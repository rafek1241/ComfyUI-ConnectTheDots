import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderPanelView } from "../panelView";
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

const makePanel = (): types.PanelLike => {
    const content = document.createElement("div");
    const titleEl = document.createElement("div");
    const panel = document.createElement("div") as unknown as types.PanelLike;
    panel.content = content;
    panel.title_element = titleEl;
    return panel;
};

const makeCallbacks = (
    overrides: Partial<types.PanelViewCallbacks> = {},
): types.PanelViewCallbacks => ({
    onCandidatePreviewStart: vi.fn(),
    onCandidatePreviewEnd: vi.fn(),
    onCandidateSelect: vi.fn(),
    onCopyLink: vi.fn(),
    onPasteLink: vi.fn(),
    getLinkClipboard: () => null,
    ...overrides,
});

// ── renderPanelView ────────────────────────────────────────────────────────

describe("renderPanelView", () => {
    let panel: types.PanelLike;

    beforeEach(() => {
        panel = makePanel();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("sets panel title", () => {
        const node = makeNode({ type: "TestNode", graph: { nodes: [] } });
        renderPanelView({
            panel,
            targetNode: node,
            title: "Connect The Dots",
            callbacks: makeCallbacks(),
        });
        expect(panel.title_element.textContent).toBe("Connect The Dots");
    });

    it("renders node type as subtitle", () => {
        const node = makeNode({ type: "MyType", graph: { nodes: [] } });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        expect(panel.content.textContent).toContain("MyType");
    });

    it("renders Inputs section title", () => {
        const node = makeNode({
            inputs: [{ name: "image", type: "IMAGE" }],
            graph: { nodes: [] },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        expect(panel.content.textContent).toContain("Inputs");
    });

    it("renders Outputs section title", () => {
        const node = makeNode({
            outputs: [{ name: "out", type: "IMAGE" }],
            graph: { nodes: [] },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        expect(panel.content.textContent).toContain("Outputs");
    });

    it("renders a slot card for each input", () => {
        const node = makeNode({
            inputs: [
                { name: "imageA", type: "IMAGE" },
                { name: "imageB", type: "IMAGE" },
            ],
            graph: { nodes: [] },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        const cards = panel.content.querySelectorAll(".ctd-slot-card");
        expect(cards.length).toBeGreaterThanOrEqual(2);
    });

    it("renders a slot card for each output", () => {
        const node = makeNode({
            outputs: [
                { name: "out1", type: "IMAGE" },
                { name: "out2", type: "LATENT" },
            ],
            graph: { nodes: [] },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        const cards = panel.content.querySelectorAll(".ctd-slot-card");
        expect(cards.length).toBeGreaterThanOrEqual(2);
    });

    it("all slot cards are collapsed by default", () => {
        const node = makeNode({
            inputs: [{ name: "x", type: "IMAGE" }],
            outputs: [{ name: "y", type: "IMAGE" }],
            graph: { nodes: [] },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        const cards =
            panel.content.querySelectorAll<HTMLElement>(".ctd-slot-card");
        for (const card of cards) {
            expect(card.dataset.collapsed).toBe("true");
        }
    });

    it("toggles a slot card to expanded on toggle button click", () => {
        const node = makeNode({
            inputs: [{ name: "img", type: "IMAGE" }],
            graph: { nodes: [] },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        const card = panel.content.querySelector<HTMLElement>(".ctd-slot-card");
        const toggle =
            card?.querySelector<HTMLButtonElement>(".ctd-slot-toggle");
        expect(card?.dataset.collapsed).toBe("true");
        toggle?.click();
        expect(card?.dataset.collapsed).toBe("false");
        toggle?.click();
        expect(card?.dataset.collapsed).toBe("true");
    });

    it("renders search box", () => {
        const node = makeNode({ graph: { nodes: [] } });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        const search = panel.content.querySelector(".ctd-search");
        expect(search).not.toBeNull();
    });

    it("hides non-matching slot cards on search input", async () => {
        const node = makeNode({
            inputs: [
                { name: "alpha", type: "IMAGE" },
                { name: "beta", type: "IMAGE" },
            ],
            graph: { nodes: [] },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });

        const searchInput =
            panel.content.querySelector<HTMLInputElement>(".ctd-search");
        expect(searchInput).not.toBeNull();

        // simulate typing "alpha"
        if (searchInput) {
            searchInput.value = "alpha";
            searchInput.dispatchEvent(new Event("input"));
        }

        const cards =
            panel.content.querySelectorAll<HTMLElement>(".ctd-slot-card");
        const alphaCard = Array.from(cards).find(
            (c) => c.dataset.slotName === "alpha",
        );
        const betaCard = Array.from(cards).find(
            (c) => c.dataset.slotName === "beta",
        );
        expect(alphaCard?.style.display).not.toBe("none");
        expect(betaCard?.style.display).toBe("none");
    });

    it("shows all cards when search is cleared", () => {
        const node = makeNode({
            inputs: [
                { name: "alpha", type: "IMAGE" },
                { name: "beta", type: "IMAGE" },
            ],
            graph: { nodes: [] },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });

        const searchInput =
            panel.content.querySelector<HTMLInputElement>(".ctd-search");
        if (searchInput) {
            searchInput.value = "alpha";
            searchInput.dispatchEvent(new Event("input"));

            searchInput.value = "";
            searchInput.dispatchEvent(new Event("input"));
        }

        const cards =
            panel.content.querySelectorAll<HTMLElement>(".ctd-slot-card");
        for (const card of cards) {
            expect(card.style.display).not.toBe("none");
        }
    });

    it("renders 'Connected' pill for connected input", () => {
        const link: types.GraphLink = {
            origin_id: 2,
            origin_slot: 0,
            target_id: 1,
            target_slot: 0,
        };
        const node = makeNode({
            id: 1,
            inputs: [{ name: "img", type: "IMAGE", link: 10 }],
            graph: { nodes: [], links: { 10: link } },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        const pill = panel.content.querySelector(".ctd-connection-pill");
        expect(pill?.textContent).toContain("Connected");
    });

    it("renders copy link button for connected slot", () => {
        const link: types.GraphLink = {
            origin_id: 2,
            origin_slot: 0,
            target_id: 1,
            target_slot: 0,
        };
        const node = makeNode({
            id: 1,
            inputs: [{ name: "img", type: "IMAGE", link: 10 }],
            graph: { nodes: [], links: { 10: link } },
        });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        const copyBtn = panel.content.querySelector<HTMLButtonElement>(
            ".ctd-action-btn:not(.ctd-action-btn--paste)",
        );
        expect(copyBtn?.textContent?.trim()).toBe("Copy link");
    });

    it("calls onCopyLink when copy button is clicked", () => {
        const link: types.GraphLink = {
            origin_id: 2,
            origin_slot: 0,
            target_id: 1,
            target_slot: 0,
        };
        const node = makeNode({
            id: 1,
            inputs: [{ name: "img", type: "IMAGE", link: 10 }],
            graph: { nodes: [], links: { 10: link } },
        });
        const callbacks = makeCallbacks();
        renderPanelView({ panel, targetNode: node, title: "T", callbacks });
        const copyBtn = panel.content.querySelector<HTMLButtonElement>(
            ".ctd-action-btn:not(.ctd-action-btn--paste)",
        );
        copyBtn?.click();
        expect(callbacks.onCopyLink).toHaveBeenCalledOnce();
    });

    it("renders paste link button when clipboard is compatible", () => {
        const clipboard: types.LinkClipboard = {
            mode: "input",
            originNodeId: 2,
            originSlot: 0,
            originTypeName: "IMAGE",
        };
        const node = makeNode({
            id: 1,
            inputs: [{ name: "img", type: "IMAGE" }],
            graph: { nodes: [] },
        });
        const callbacks = makeCallbacks({
            getLinkClipboard: () => clipboard,
        });
        renderPanelView({ panel, targetNode: node, title: "T", callbacks });
        const pasteBtn = panel.content.querySelector<HTMLButtonElement>(
            ".ctd-action-btn--paste",
        );
        expect(pasteBtn?.textContent?.trim()).toBe("Paste link");
    });

    it("calls onPasteLink when paste button is clicked", () => {
        const clipboard: types.LinkClipboard = {
            mode: "input",
            originNodeId: 2,
            originSlot: 0,
            originTypeName: "IMAGE",
        };
        const node = makeNode({
            id: 1,
            inputs: [{ name: "img", type: "IMAGE" }],
            graph: { nodes: [] },
        });
        const callbacks = makeCallbacks({
            getLinkClipboard: () => clipboard,
        });
        renderPanelView({ panel, targetNode: node, title: "T", callbacks });
        const pasteBtn = panel.content.querySelector<HTMLButtonElement>(
            ".ctd-action-btn--paste",
        );
        pasteBtn?.click();
        expect(callbacks.onPasteLink).toHaveBeenCalledOnce();
    });

    it("renders error status when panel has error state", () => {
        const node = makeNode({ graph: { nodes: [] } });
        panel.__ctdStatus = { message: "Something failed", state: "error" };
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        const status = panel.content.querySelector<HTMLElement>(".ctd-status");
        expect(status?.dataset.state).toBe("error");
        expect(status?.textContent).toContain("Something failed");
    });

    it("shows 'no inputs' message when node has no inputs", () => {
        const node = makeNode({ inputs: [], graph: { nodes: [] } });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        expect(panel.content.textContent).toContain("This node has no inputs.");
    });

    it("shows 'no outputs' message when node has no outputs", () => {
        const node = makeNode({ outputs: [], graph: { nodes: [] } });
        renderPanelView({
            panel,
            targetNode: node,
            title: "T",
            callbacks: makeCallbacks(),
        });
        expect(panel.content.textContent).toContain(
            "This node has no outputs.",
        );
    });

    it("calls onCandidatePreviewStart on mouseenter of candidate button", () => {
        const sourceNode = makeNode({
            id: 2,
            outputs: [{ type: "IMAGE" }],
            canConnectTo: () => true,
        });
        const targetNode = makeNode({
            id: 1,
            inputs: [{ name: "img", type: "IMAGE" }],
            canConnectTo: () => true,
        });
        const graph: types.GraphLike = { nodes: [targetNode, sourceNode] };
        targetNode.graph = graph;

        const callbacks = makeCallbacks();
        renderPanelView({
            panel,
            targetNode,
            title: "T",
            callbacks,
        });

        // expand the first card to see candidates
        const toggle =
            panel.content.querySelector<HTMLButtonElement>(".ctd-slot-toggle");
        toggle?.click();

        const candidateBtn =
            panel.content.querySelector<HTMLButtonElement>(".ctd-candidate");
        candidateBtn?.dispatchEvent(new MouseEvent("mouseenter"));
        expect(callbacks.onCandidatePreviewStart).toHaveBeenCalledOnce();
    });

    it("calls onCandidateSelect on candidate button click", () => {
        const sourceNode = makeNode({
            id: 2,
            outputs: [{ type: "IMAGE" }],
            canConnectTo: () => true,
        });
        const targetNode = makeNode({
            id: 1,
            inputs: [{ name: "img", type: "IMAGE" }],
            canConnectTo: () => true,
        });
        const graph: types.GraphLike = { nodes: [targetNode, sourceNode] };
        targetNode.graph = graph;

        const callbacks = makeCallbacks();
        renderPanelView({ panel, targetNode, title: "T", callbacks });

        const toggle =
            panel.content.querySelector<HTMLButtonElement>(".ctd-slot-toggle");
        toggle?.click();

        const candidateBtn =
            panel.content.querySelector<HTMLButtonElement>(".ctd-candidate");
        candidateBtn?.click();
        expect(callbacks.onCandidateSelect).toHaveBeenCalledOnce();
    });
});
