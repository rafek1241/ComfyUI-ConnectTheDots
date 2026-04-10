import { canvasPreviewController } from "./canvasPreview";
import { api, app } from "./comfy";
import styles from "./connectTheDots.css";
import { getNodeConnectionSignature } from "./graphUtils";
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
