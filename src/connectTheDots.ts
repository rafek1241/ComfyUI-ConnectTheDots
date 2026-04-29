import { canvasPreviewController } from "./canvasPreview";
import { api, app } from "./comfy";
import styles from "./connectTheDots.css";
import {
    getCachedTypeDisplay,
    createRenderCache,
    getGraphLink,
    getNodeConnectionSignature,
} from "./graphUtils";
import { panelHostController } from "./panelHost";
import { renderPanelView } from "./panelView";
import { createConnectTheDotsSettingsController } from "./settings";
import type * as types from "./types";

const connectTheDotsExtension = (
    api: types.ApiLike,
    app: types.AppLike,
): void => {
    const MENU_LABEL = "Connect The Dots";

    let currentPanel: types.PanelLike | null = null;
    let pendingSelectionClearTimeout: number | null = null;
    let linkClipboard: types.LinkClipboard | null = null;
    const panelHost = panelHostController();
    const settings = createConnectTheDotsSettingsController(app);
    const canvasPreview = canvasPreviewController(
        () => app.canvas,
        () => app.graph,
        settings,
    );

    const chainCanvasCallback = <TOwner, TArgs extends unknown[]>(
        originalCallback:
            | ((this: TOwner, ...args: TArgs) => unknown)
            | undefined,
        callback: (this: TOwner, ...args: TArgs) => void,
    ): ((this: TOwner, ...args: TArgs) => void) => {
        return function (this: TOwner, ...args: TArgs): void {
            originalCallback?.call(this, ...args);
            callback.call(this, ...args);
        };
    };

    const getSingleSelectedNode = (
        canvas: types.CanvasLike | undefined,
    ): types.GraphNode | null => {
        const selectedNodes = Object.values(canvas?.selected_nodes || {});
        return selectedNodes.length === 1 ? selectedNodes[0] : null;
    };

    const clearPendingSelectionClose = (): void => {
        if (pendingSelectionClearTimeout == null) {
            return;
        }

        window.clearTimeout(pendingSelectionClearTimeout);
        pendingSelectionClearTimeout = null;
    };

    const syncPanelToSettledSelection = (): void => {
        const panel = currentPanel ?? panelHost.findMountedPanel();
        if (!panel || !document.body.contains(panel)) {
            return;
        }

        const selectedNodes = Object.values(app.canvas?.selected_nodes || {});
        if (!selectedNodes.length) {
            if (settings.get("closeSidebarOnEmptyCanvasClick")) {
                closePanel();
            }
            return;
        }

        const nextNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
        if (!nextNode || panel.node === nextNode) {
            return;
        }

        showPanel(nextNode);
    };

    const handleSelectionChange = (): void => {
        const panel = currentPanel ?? panelHost.findMountedPanel();
        if (!panel || !document.body.contains(panel)) {
            clearPendingSelectionClose();
            return;
        }

        const selectedNodes = Object.values(app.canvas?.selected_nodes || {});
        if (!selectedNodes.length) {
            clearPendingSelectionClose();
            pendingSelectionClearTimeout = window.setTimeout(() => {
                pendingSelectionClearTimeout = null;
                syncPanelToSettledSelection();
            }, 0);
            return;
        }

        clearPendingSelectionClose();
        const nextNode = getSingleSelectedNode(app.canvas);
        if (!nextNode || panel.node === nextNode) {
            return;
        }

        showPanel(nextNode);
    };

    const setupSelectionChangeSync = (): void => {
        const canvas = app.canvas;
        if (!canvas || canvas.__ctdSelectionChangeWrapped) {
            return;
        }

        canvas.onSelectionChange = chainCanvasCallback(
            canvas.onSelectionChange,
            handleSelectionChange,
        );
        canvas.__ctdSelectionChangeWrapped = true;
    };

    const setupRepeatedTargetDeselect = (): void => {
        const canvas = app.canvas;
        if (
            !canvas ||
            canvas.__ctdProcessSelectWrapped ||
            !canvas.processSelect
        ) {
            return;
        }

        const originalProcessSelect = canvas.processSelect.bind(canvas);
        canvas.processSelect = (item, event, sticky) => {
            const panel = currentPanel ?? panelHost.findMountedPanel();
            const targetNode = panel?.node;
            const shouldDeselectRepeatedTarget =
                settings.get("deselectTargetOnRepeatedClick") &&
                Boolean(
                    item &&
                        targetNode &&
                        item === targetNode &&
                        targetNode.selected &&
                        !sticky &&
                        !event?.shiftKey &&
                        !event?.metaKey &&
                        !event?.ctrlKey,
                );

            if (!shouldDeselectRepeatedTarget || !targetNode) {
                originalProcessSelect(item, event, sticky);
                return;
            }

            canvas.deselect?.(targetNode);
            canvas.onSelectionChange?.(canvas.selected_nodes || {});
            canvas.setDirty(true, true);

            if (!Object.keys(canvas.selected_nodes || {}).length) {
                closePanel();
            }
        };
        canvas.__ctdProcessSelectWrapped = true;
    };

    const setup = (): void => {
        panelHost.ensureStyles(styles);
        canvasPreview.setupForegroundDrawing();
        setupSelectionChangeSync();
        setupRepeatedTargetDeselect();
    };

    const getNodeMenuItems = (
        node: types.GraphNode,
    ): (types.ContextMenuItem | null)[] => {
        if (!node) {
            return [];
        }

        return [
            null,
            {
                content: MENU_LABEL,
                callback: () => showPanel(node),
            },
        ];
    };

    const setPanelStatus = (
        panel: types.PanelLike,
        message: string | null,
        state = "",
    ): void => {
        panel.__ctdStatus = message ? { message, state } : null;
    };

    const clearPanelConnectionFlash = (panel: types.PanelLike | null): void => {
        if (!panel) {
            return;
        }

        panel.__ctdConnectionFlashActive = false;
        if (panel.__ctdConnectionFlashTimeout == null) {
            return;
        }

        window.clearTimeout(panel.__ctdConnectionFlashTimeout);
        panel.__ctdConnectionFlashTimeout = null;
    };

    const handleCopyLink = (
        panel: types.PanelLike,
        targetNode: types.GraphNode,
        property: types.PropertyDescriptor,
        mode: types.SlotDirection,
    ): void => {
        const graph = targetNode.graph;
        if (!graph) {
            return;
        }

        if (mode === "input") {
            const link = getGraphLink(graph, property.slot.link ?? null);
            if (!link) {
                return;
            }
            const renderCache = createRenderCache(targetNode);
            const originNode = graph.getNodeById?.(link.origin_id);
            const originSlot = originNode?.outputs?.[link.origin_slot];
            linkClipboard = {
                mode: "input",
                originNodeId: link.origin_id,
                originSlot: link.origin_slot,
                originTypeName: getCachedTypeDisplay(
                    renderCache,
                    originSlot?.type,
                ),
            };
        } else {
            const linkIds = property.slot.links ?? [];
            if (!linkIds.length) {
                return;
            }
            const link = getGraphLink(graph, linkIds[0]);
            if (!link) {
                return;
            }
            const renderCache = createRenderCache(targetNode);
            const targetSlot = targetNode.outputs?.[property.index];
            linkClipboard = {
                mode: "output",
                originNodeId: targetNode.id,
                originSlot: property.index,
                originTypeName: getCachedTypeDisplay(
                    renderCache,
                    targetSlot?.type,
                ),
            };
        }

        setPanelStatus(panel, "Link copied to clipboard.");
        renderPanel(panel, targetNode);
    };

    const handlePasteLink = (
        panel: types.PanelLike,
        targetNode: types.GraphNode,
        property: types.PropertyDescriptor,
        mode: types.SlotDirection,
    ): void => {
        if (!linkClipboard || linkClipboard.mode !== mode) {
            return;
        }

        const graph = targetNode.graph;
        if (!graph) {
            return;
        }

        clearPanelConnectionFlash(panel);

        if (mode === "input") {
            const originNode = graph.getNodeById?.(linkClipboard.originNodeId);
            if (!originNode) {
                setPanelStatus(panel, "Source node not found.", "error");
                renderPanel(panel, targetNode);
                return;
            }

            const link = originNode.connect(
                linkClipboard.originSlot,
                targetNode,
                property.index,
            );

            if (!link) {
                setPanelStatus(
                    panel,
                    "ComfyUI rejected the pasted connection.",
                    "error",
                );
                renderPanel(panel, targetNode);
                return;
            }
        } else {
            const originNode = graph.getNodeById?.(linkClipboard.originNodeId);
            if (!originNode) {
                setPanelStatus(panel, "Source node not found.", "error");
                renderPanel(panel, targetNode);
                return;
            }

            const link = targetNode.connect(
                property.index,
                originNode,
                linkClipboard.originSlot,
            );

            if (!link) {
                setPanelStatus(
                    panel,
                    "ComfyUI rejected the pasted connection.",
                    "error",
                );
                renderPanel(panel, targetNode);
                return;
            }
        }

        setPanelStatus(panel, null);
        renderPanel(panel, targetNode);
    };

    const renderPanel = (
        panel: types.PanelLike,
        targetNode: types.GraphNode,
    ): void => {
        renderPanelView({
            panel,
            targetNode,
            title: MENU_LABEL,
            callbacks: {
                onCandidatePreviewStart: (selection) =>
                    canvasPreview.beginCandidatePreview(selection),
                onCandidatePreviewEnd: (nextPanel) =>
                    canvasPreview.endCandidatePreview(nextPanel),
                onCandidateSelect: (selection) =>
                    handleCandidateSelect(selection),
                onCopyLink: (property, mode) =>
                    handleCopyLink(panel, targetNode, property, mode),
                onPasteLink: (p, node, property, mode) =>
                    handlePasteLink(p, node, property, mode),
                getLinkClipboard: () => linkClipboard,
            },
        });

        panel.__ctdConnectionSignature = getNodeConnectionSignature(targetNode);
    };

    const handleCandidateSelect = (
        selection: types.CandidateSelection,
    ): void => {
        const { panel, targetNode, property, mode, candidate, isConnected } =
            selection;

        clearPanelConnectionFlash(panel);

        if (isConnected) {
            canvasPreview.endCandidatePreview(panel);
            const didDisconnect =
                mode === "input"
                    ? targetNode.disconnectInput?.(property.index)
                    : candidate.node.disconnectInput?.(candidate.slotIndex);

            if (!didDisconnect) {
                setPanelStatus(
                    panel,
                    "ComfyUI rejected that disconnection.",
                    "error",
                );
                renderPanel(panel, targetNode);
                return;
            }

            setPanelStatus(panel, null);
            renderPanel(panel, targetNode);
            return;
        }

        panel.__ctdBaseView =
            panel.__ctdBaseView || canvasPreview.captureCanvasView();
        panel.__ctdConnectionFlashActive = true;
        const link =
            mode === "input"
                ? candidate.node.connect(
                      candidate.slotIndex,
                      targetNode,
                      property.index,
                  )
                : targetNode.connect(
                      property.index,
                      candidate.node,
                      candidate.slotIndex,
                  );

        if (!link) {
            clearPanelConnectionFlash(panel);
            canvasPreview.endCandidatePreview(panel);
            setPanelStatus(panel, "ComfyUI rejected that connection.", "error");
            renderPanel(panel, targetNode);
            return;
        }

        canvasPreview.confirmCandidateSelection(selection);
        panel.__ctdConnectionFlashTimeout = window.setTimeout(() => {
            panel.__ctdConnectionFlashTimeout = null;
            panel.__ctdConnectionFlashActive = false;
            canvasPreview.endCandidatePreview(panel);
            setPanelStatus(panel, null);
            renderPanel(panel, targetNode);
        }, 250);
    };

    const stopPanelGraphChangeListener = (
        panel: types.PanelLike | null,
    ): void => {
        if (!panel?.__ctdGraphChangedHandler) {
            return;
        }

        clearPanelConnectionFlash(panel);
        api.removeEventListener("graphChanged", panel.__ctdGraphChangedHandler);
        panel.__ctdGraphChangedHandler = null;
    };

    const startPanelGraphChangeListener = (
        panel: types.PanelLike,
        targetNode: types.GraphNode,
    ): void => {
        stopPanelGraphChangeListener(panel);
        panel.__ctdConnectionSignature = getNodeConnectionSignature(targetNode);

        const handleGraphChanged = (): void => {
            if (currentPanel !== panel || panel.node !== targetNode) {
                stopPanelGraphChangeListener(panel);
                return;
            }

            if (!document.body.contains(panel)) {
                stopPanelGraphChangeListener(panel);
                return;
            }

            if (panel.__ctdConnectionFlashActive) {
                return;
            }

            const nextSignature = getNodeConnectionSignature(targetNode);
            if (nextSignature === panel.__ctdConnectionSignature) {
                return;
            }

            canvasPreview.endCandidatePreview(panel);
            renderPanel(panel, targetNode);
        };

        panel.__ctdGraphChangedHandler = handleGraphChanged;
        api.addEventListener("graphChanged", handleGraphChanged);
    };

    const closePanel = (): void => {
        clearPendingSelectionClose();
        const panel = currentPanel ?? panelHost.findMountedPanel();
        if (!panel) {
            return;
        }

        stopPanelGraphChangeListener(panel);
        panelHost.close(panel);
    };

    const showPanel = (targetNode: types.GraphNode): void => {
        const canvas = app.canvas;
        if (!targetNode || !canvas) {
            return;
        }

        clearPendingSelectionClose();
        panelHost.ensureStyles(styles);
        canvasPreview.endCandidatePreview(
            currentPanel ?? panelHost.findMountedPanel(),
        );
        closePanel();
        canvasPreview.setSidebarTargetNode(targetNode);

        const panel = panelHost.create(canvas, MENU_LABEL);
        panel.node = targetNode;
        panel.graph = canvas.graph;

        panel.onClose = () => {
            stopPanelGraphChangeListener(panel);
            panelHost.disconnect(panel);
            canvasPreview.endCandidatePreview(panel);
            canvasPreview.setSidebarTargetNode(null);
            if (currentPanel === panel) {
                currentPanel = null;
            }
        };

        renderPanel(panel, targetNode);

        if (!panelHost.mount(panel, canvas)) {
            panel.onClose?.();
            panel.remove();
            return;
        }

        currentPanel = panel;
        startPanelGraphChangeListener(panel, targetNode);
    };

    app.registerExtension({
        name: "jtreminio.connect-the-dots",
        getNodeMenuItems,
        settings: settings.definitions,
        setup,
    });
};

connectTheDotsExtension(api, app);
