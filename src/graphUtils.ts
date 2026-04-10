import type * as types from "./types";

declare const LiteGraph: {
    EVENT?: unknown;
    ACTION?: unknown;
};

const candidateCollator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
});

export interface PanelRenderCache {
    graphNodes: types.GraphNode[];
    nodeDisplayNames: WeakMap<types.GraphNode, string>;
    typeDisplays: Map<unknown, string>;
    inputCandidates: types.CandidateDescriptor[];
    outputCandidates: types.CandidateDescriptor[];
}

const compareCandidates = (
    a: types.CandidateDescriptor,
    b: types.CandidateDescriptor,
): number => {
    return (
        candidateCollator.compare(a.nodeName, b.nodeName) ||
        candidateCollator.compare(a.slotName, b.slotName)
    );
};

const buildBaseCandidates = (
    nodes: types.GraphNode[],
    mode: types.SlotDirection,
    renderCache: PanelRenderCache,
): types.CandidateDescriptor[] => {
    return nodes
        .flatMap((node) => {
            const slots =
                mode === "input" ? node.outputs || [] : node.inputs || [];
            const fallbackPrefix = mode === "input" ? "output" : "input";

            return slots.map((slot, slotIndex) => ({
                node,
                nodeName: getCachedNodeDisplayName(renderCache, node),
                slotIndex,
                slotName: getSlotDisplayName(
                    slot,
                    `${fallbackPrefix} ${slotIndex}`,
                ),
                typeName: getCachedTypeDisplay(renderCache, slot?.type),
            }));
        })
        .sort(compareCandidates);
};

const getDisplayNameForRender = (
    node: types.GraphNode | null | undefined,
    renderCache?: PanelRenderCache,
): string => {
    return renderCache
        ? getCachedNodeDisplayName(renderCache, node)
        : getNodeDisplayName(node);
};

export const getSlotDisplayName = (
    slot: types.GraphSlot | undefined,
    fallback = "slot",
): string => {
    return slot?.label || slot?.localized_name || slot?.name || fallback;
};

export const getNodeDisplayName = (
    node: types.GraphNode | null | undefined,
): string => {
    return (
        node?.getTitle?.() ||
        node?.title ||
        node?.type ||
        `Node ${node?.id ?? "?"}`
    );
};

export const getCachedNodeDisplayName = (
    renderCache: PanelRenderCache,
    node: types.GraphNode | null | undefined,
): string => {
    if (!node) {
        return getNodeDisplayName(node);
    }

    const cachedLabel = renderCache.nodeDisplayNames.get(node);
    if (cachedLabel !== undefined) {
        return cachedLabel;
    }

    const label = getNodeDisplayName(node);
    renderCache.nodeDisplayNames.set(node, label);
    return label;
};

export const getTypeDisplay = (type: types.SlotTypeValue): string => {
    if (Array.isArray(type)) {
        return type.map((value) => getTypeDisplay(value)).join(", ");
    }
    if (
        type == null ||
        type === "" ||
        type === 0 ||
        type === "0" ||
        type === "*"
    ) {
        return "*";
    }
    if (type === LiteGraph.EVENT) {
        return "EVENT";
    }
    if (type === LiteGraph.ACTION) {
        return "ACTION";
    }
    return String(type);
};

export const getCachedTypeDisplay = (
    renderCache: PanelRenderCache,
    type: types.SlotTypeValue,
): string => {
    if (renderCache.typeDisplays.has(type)) {
        return renderCache.typeDisplays.get(type) as string;
    }

    const display = Array.isArray(type)
        ? type
              .map((value) => getCachedTypeDisplay(renderCache, value))
              .join(", ")
        : getTypeDisplay(type);

    renderCache.typeDisplays.set(type, display);
    return display;
};

export const getGraphNodes = (node: types.GraphNode): types.GraphNode[] => {
    return node.graph?.nodes || node.graph?._nodes || [];
};

export const createRenderCache = (
    targetNode: types.GraphNode,
): PanelRenderCache => {
    const graphNodes = getGraphNodes(targetNode).filter(
        (node): node is types.GraphNode => Boolean(node),
    );
    const candidateNodes = graphNodes.filter((node) => node !== targetNode);

    const renderCache: PanelRenderCache = {
        graphNodes,
        nodeDisplayNames: new WeakMap(),
        typeDisplays: new Map(),
        inputCandidates: [],
        outputCandidates: [],
    };

    renderCache.inputCandidates = buildBaseCandidates(
        candidateNodes,
        "input",
        renderCache,
    );
    renderCache.outputCandidates = buildBaseCandidates(
        candidateNodes,
        "output",
        renderCache,
    );

    return renderCache;
};

export const getGraphLink = (
    graph: types.GraphLike | null | undefined,
    linkId: number | null | undefined,
): types.GraphLink | null => {
    if (!graph || linkId == null) {
        return null;
    }

    const internalLinks = graph._links;
    if (
        internalLinks &&
        typeof (internalLinks as Map<number, types.GraphLink>).get ===
            "function"
    ) {
        return (
            (internalLinks as Map<number, types.GraphLink>).get(linkId) ?? null
        );
    }

    return (
        (
            internalLinks as
                | Record<number | string, types.GraphLink>
                | undefined
        )?.[linkId] ??
        graph.links?.[linkId] ??
        null
    );
};

export const getConnectedNodeLabel = (
    graph: types.GraphLike | null | undefined,
    linkId: number | null | undefined,
    side: types.SlotDirection,
    renderCache?: PanelRenderCache,
): string | null => {
    const link = getGraphLink(graph, linkId);
    if (!link) {
        return null;
    }

    if (side === "input") {
        const originNode = graph?.getNodeById?.(link.origin_id);
        const originSlot = originNode?.outputs?.[link.origin_slot];
        return `${getDisplayNameForRender(originNode, renderCache)} -> ${getSlotDisplayName(originSlot, `output ${link.origin_slot}`)}`;
    }

    const targetNode = graph?.getNodeById?.(link.target_id);
    const targetSlot = targetNode?.inputs?.[link.target_slot];
    return `${getDisplayNameForRender(targetNode, renderCache)} -> ${getSlotDisplayName(targetSlot, `input ${link.target_slot}`)}`;
};

export const getPropertyConnectionCount = (
    property: types.PropertyDescriptor,
    mode: types.SlotDirection,
): number => {
    return mode === "input"
        ? property.slot.link != null
            ? 1
            : 0
        : property.slot.links?.length || 0;
};

export const getConnectionPillText = (
    count: number,
    mode: types.SlotDirection,
): string => {
    if (!count) {
        return "";
    }

    if (mode === "input") {
        return "Connected";
    }

    return count === 1 ? "1 Linked" : `${count} Linked`;
};

export const collectInputCandidates = (
    renderCache: PanelRenderCache,
    targetNode: types.GraphNode,
    input: types.GraphSlot,
): types.CandidateDescriptor[] => {
    return renderCache.inputCandidates.filter((candidate) =>
        candidate.node.canConnectTo(
            targetNode,
            input,
            candidate.node.outputs?.[candidate.slotIndex] ?? {},
        ),
    );
};

export const collectOutputCandidates = (
    renderCache: PanelRenderCache,
    sourceNode: types.GraphNode,
    output: types.GraphSlot,
): types.CandidateDescriptor[] => {
    return renderCache.outputCandidates.filter((candidate) =>
        sourceNode.canConnectTo(
            candidate.node,
            candidate.node.inputs?.[candidate.slotIndex] ?? {},
            output,
        ),
    );
};

export const getNodeConnectionSignature = (
    targetNode: types.GraphNode,
): string => {
    if (!targetNode.graph) {
        return "";
    }

    const inputSignature = (targetNode.inputs || []).map((slot, index) => {
        const link = getGraphLink(targetNode.graph, slot.link ?? null);
        return link
            ? `in:${index}:${link.origin_id}:${link.origin_slot}`
            : `in:${index}:-`;
    });

    const outputSignature = (targetNode.outputs || []).map((slot, index) => {
        const targets = (slot.links || [])
            .map((linkId) => getGraphLink(targetNode.graph, linkId))
            .filter((link): link is types.GraphLink => Boolean(link))
            .map((link) => `${link.target_id}:${link.target_slot}`)
            .sort();
        return `out:${index}:${targets.join(",")}`;
    });

    return [...inputSignature, ...outputSignature].join("|");
};
