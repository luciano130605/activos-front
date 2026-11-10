/// <reference types="vite/client" />

type TauriWindowAPI = {
    startDragging(): Promise<void>;
    startResizeDragging(direction: 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West'): Promise<void>;
};

type TauriGlobal = {
    core: {
        invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
    };
    window?: {
        getCurrentWindow(): TauriWindowAPI;
    };
};

interface Window {
    __TAURI__?: TauriGlobal;
}
