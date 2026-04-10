import type * as types from "./types";

type SettingDescriptorKey = keyof ConnectTheDotsSettings;

interface SettingDescriptor {
    key: SettingDescriptorKey;
    id: string;
    name: string;
    description: string;
    section: "preview" | "selection";
    sortOrder: number;
}

export interface ConnectTheDotsSettings {
    showPreviewLinkOnHover: boolean;
    animatePreviewLink: boolean;
    glowPreviewLinkOnChange: boolean;
    closeSidebarOnEmptyCanvasClick: boolean;
    deselectTargetOnRepeatedClick: boolean;
}

export const defaultConnectTheDotsSettings: ConnectTheDotsSettings = {
    showPreviewLinkOnHover: true,
    animatePreviewLink: true,
    glowPreviewLinkOnChange: true,
    closeSidebarOnEmptyCanvasClick: true,
    deselectTargetOnRepeatedClick: true,
};

export const connectTheDotsSettingDescriptors: SettingDescriptor[] = [
    {
        key: "showPreviewLinkOnHover",
        id: "ConnectTheDots.Preview.ShowLinkOnHover",
        name: "Show preview link on hover",
        description:
            "Draw the temporary connection between the target property and the hovered candidate.",
        section: "preview",
        sortOrder: 300,
    },
    {
        key: "animatePreviewLink",
        id: "ConnectTheDots.Preview.AnimateLink",
        name: "Animate preview link",
        description:
            "Turn the preview link into a moving laser instead of a static line.",
        section: "preview",
        sortOrder: 200,
    },
    {
        key: "glowPreviewLinkOnChange",
        id: "ConnectTheDots.Preview.GlowOnChange",
        name: "Preview link glows on change",
        description:
            "Flash the preview link when a connection is created so the change is easier to track.",
        section: "preview",
        sortOrder: 100,
    },
    {
        key: "closeSidebarOnEmptyCanvasClick",
        id: "ConnectTheDots.Selection.CloseSidebarOnEmptyCanvasClick",
        name: "Close sidebar on empty canvas click",
        description: "Clicking empty canvas closes Connect The Dots sidebar.",
        section: "selection",
        sortOrder: 200,
    },
    {
        key: "deselectTargetOnRepeatedClick",
        id: "ConnectTheDots.Selection.DeselectTargetOnRepeatedClick",
        name: "Click to deselect active link",
        description:
            "Clicking the already-selected target node again clears that target instead of leaving it selected.",
        section: "selection",
        sortOrder: 100,
    },
];

export interface ConnectTheDotsSettingsController {
    definitions: types.ExtensionSettingDefinition[];
    get<K extends SettingDescriptorKey>(key: K): ConnectTheDotsSettings[K];
    getAll(): ConnectTheDotsSettings;
    set<K extends SettingDescriptorKey>(
        key: K,
        value: ConnectTheDotsSettings[K],
    ): void;
    subscribe(listener: (settings: ConnectTheDotsSettings) => void): () => void;
}

const buildSettingsSnapshot = (
    extensionManager: types.ExtensionManagerLike | undefined,
): ConnectTheDotsSettings => {
    const snapshot = { ...defaultConnectTheDotsSettings };
    for (const descriptor of connectTheDotsSettingDescriptors) {
        const value = extensionManager?.setting.get(descriptor.id);
        snapshot[descriptor.key] =
            typeof value === "boolean"
                ? value
                : defaultConnectTheDotsSettings[descriptor.key];
    }
    return snapshot;
};

export const createConnectTheDotsSettingsController = (
    app: types.AppLike,
): ConnectTheDotsSettingsController => {
    const listeners = new Set<(settings: ConnectTheDotsSettings) => void>();

    const notify = (): void => {
        const nextSettings = buildSettingsSnapshot(app.extensionManager);
        for (const listener of listeners) {
            listener(nextSettings);
        }
        app.canvas?.setDirty(true, true);
    };

    return {
        definitions: connectTheDotsSettingDescriptors.map((descriptor) => ({
            id: descriptor.id,
            name: descriptor.name,
            type: "boolean",
            defaultValue: defaultConnectTheDotsSettings[descriptor.key],
            tooltip: descriptor.description,
            onChange: () => notify(),
            sortOrder: descriptor.sortOrder,
        })),
        get: (key) => buildSettingsSnapshot(app.extensionManager)[key],
        getAll: () => buildSettingsSnapshot(app.extensionManager),
        set: (key, value) => {
            const descriptor = connectTheDotsSettingDescriptors.find(
                (entry) => entry.key === key,
            );
            if (!descriptor) {
                return;
            }

            void app.extensionManager?.setting.set(descriptor.id, value);
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
};
