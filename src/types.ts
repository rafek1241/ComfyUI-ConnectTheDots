export type SlotDirection = "input" | "output";
export type SlotTypeValue =
    | string
    | number
    | null
    | undefined
    | SlotTypeValue[];

export interface GraphSlot {
    label?: string;
    localized_name?: string;
    name?: string;
    type?: SlotTypeValue;
    link?: number | null;
    links?: number[];
    widget?: { name?: string };
}

export interface GraphLink {
    origin_id: number | string;
    origin_slot: number;
    target_id: number | string;
    target_slot: number;
}

export interface GraphLike {
    nodes?: GraphNode[];
    _nodes?: GraphNode[];
    links?: Record<number | string, GraphLink>;
    _links?: Record<number | string, GraphLink> | Map<number, GraphLink>;
    getNodeById?(id: number | string): GraphNode | null;
}

export interface GraphNode {
    id: number | string;
    title?: string;
    type?: string;
    selected?: boolean;
    graph?: GraphLike | null;
    subgraph?: GraphLike | null;
    inputs?: GraphSlot[];
    outputs?: GraphSlot[];
    pos?: [number, number];
    size?: [number, number];
    boundingRect?: [number, number, number, number];
    getTitle?(): string;
    connect(
        originSlot: number,
        targetNode: GraphNode,
        targetSlot: number,
    ): unknown;
    disconnectInput?(slot: number | string, keepReroutes?: boolean): boolean;
    canConnectTo(
        targetNode: GraphNode,
        targetSlot: GraphSlot,
        sourceSlot: GraphSlot,
    ): boolean;
    getConnectionPos?(
        isInput: boolean,
        slotNumber: number,
        out?: [number, number],
    ): [number, number];
}

export interface CanvasView {
    graph?: GraphLike | null;
    offset: [number, number];
    scale: number;
}

export interface PanelStatus {
    message: string;
    state: string;
}

export interface HighlightOptions {
    strokeStyle: string;
    fillStyle: string;
    shadowColor: string;
    lineWidth?: number;
    radius?: number;
    shadowBlur?: number;
}

export interface CandidateDescriptor {
    node: GraphNode;
    nodeName: string;
    slotIndex: number;
    slotName: string;
    typeName: string;
}

export interface PropertyDescriptor {
    index: number;
    slot: GraphSlot;
    name: string;
}

export interface CandidateSelection {
    panel: PanelLike;
    targetNode: GraphNode;
    property: PropertyDescriptor;
    mode: SlotDirection;
    candidate: CandidateDescriptor;
    isConnected: boolean;
}

export interface PreviewLinkDescriptor {
    originNode: GraphNode;
    originSlot: number;
    targetNode: GraphNode;
    targetSlot: number;
}

export interface LinkClipboard {
    mode: SlotDirection;
    originNodeId: number | string;
    originSlot: number;
    originTypeName: string;
}

export interface PanelViewCallbacks {
    onCandidatePreviewStart(selection: CandidateSelection): void;
    onCandidatePreviewEnd(panel: PanelLike | null): void;
    onCandidateSelect(selection: CandidateSelection): void;
    onCopyLink(property: PropertyDescriptor, mode: SlotDirection): void;
    onPasteLink(
        panel: PanelLike,
        targetNode: GraphNode,
        property: PropertyDescriptor,
        mode: SlotDirection,
    ): void;
    getLinkClipboard(): LinkClipboard | null;
}

export interface ExtensionSettingDefinition {
    id: string;
    name: string;
    type: "boolean" | "text" | "number" | "slider" | "combo" | "color";
    defaultValue: unknown;
    tooltip?: string;
    onChange?: (newValue: unknown, oldValue: unknown) => void;
    attrs?: Record<string, unknown>;
    options?: Array<string | { text: string; value: unknown }>;
    sortOrder?: number;
}

export interface ExtensionManagerLike {
    setting: {
        get: <T = unknown>(id: string) => T | undefined;
        set: <T = unknown>(id: string, value: T) => void | Promise<void>;
    };
}

export interface CanvasDisplaySpace {
    offset: [number, number];
    scale: number;
}

export interface PanelLike extends HTMLElement {
    content: HTMLElement;
    title_element: HTMLElement;
    footer?: HTMLElement;
    node?: GraphNode;
    graph?: GraphLike | null;
    close?(): void;
    onClose?: () => void;
    __ctdBaseView?: CanvasView | null;
    __ctdStatus?: PanelStatus | null;
    __ctdGraphChangedHandler?: EventListener | null;
    __ctdConnectionSignature?: string;
    __ctdConnectionFlashActive?: boolean;
    __ctdConnectionFlashTimeout?: number | null;
    __ctdHostObserver?: ResizeObserver | null;
}

export interface CanvasLike {
    graph?: GraphLike | null;
    canvas?: HTMLCanvasElement | null;
    ds?: CanvasDisplaySpace;
    multi_select?: boolean;
    selected_nodes?: Record<number | string, GraphNode>;
    onDrawForeground?: (
        ctx: CanvasRenderingContext2D,
        visibleArea?: unknown,
    ) => void;
    onSelectionChange?: (selected: Record<number | string, GraphNode>) => void;
    __ctdDrawWrapped?: boolean;
    __ctdSelectionChangeWrapped?: boolean;
    __ctdProcessSelectWrapped?: boolean;
    setDirty(foreground?: boolean, background?: boolean): void;
    createPanel(title: string, options: { closable: boolean }): PanelLike;
    centerOnNode?(node: GraphNode): void;
    setGraph?(graph: GraphLike): void;
    openSubgraph?(graph: GraphLike): void;
    processSelect?(
        item: GraphNode | null | undefined,
        event: MouseEvent | undefined,
        sticky?: boolean,
    ): void;
    select?(item: GraphNode): void;
    deselect?(item: GraphNode): void;
    deselectAll?(keepSelected?: GraphNode): void;
}

export interface ContextMenuItem {
    content: string;
    callback?: () => void;
    disabled?: boolean;
}

export interface AppLike {
    graph?: GraphLike | null;
    canvas?: CanvasLike;
    extensionManager?: ExtensionManagerLike;
    registerExtension(extension: {
        name: string;
        getNodeMenuItems?: (node: GraphNode) => (ContextMenuItem | null)[];
        settings?: ExtensionSettingDefinition[];
        setup?: () => void;
    }): void;
}

export interface ApiLike {
    addEventListener(
        type: "graphChanged",
        listener: EventListener | null,
        options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener(
        type: "graphChanged",
        listener: EventListener | null,
        options?: boolean | EventListenerOptions,
    ): void;
}
