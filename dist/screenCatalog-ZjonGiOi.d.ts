type MachinaViewport = {
    key: string;
    width: number;
    height: number;
    deviceScaleFactor?: number;
    label?: string;
    tags?: readonly string[];
};
type MachinaViewportMatrix = readonly MachinaViewport[];
type MachinaScreen = {
    key: string;
    route: string;
    fixture?: string;
    viewports?: readonly string[];
    tags?: readonly string[];
    title?: string;
    metadata?: Record<string, unknown>;
};
type MachinaScreenCatalog = {
    screens: Record<string, MachinaScreen>;
    order: string[];
};
type MachinaScreenViewportTask = {
    key: string;
    screenKey: string;
    viewportKey: string;
    route: string;
    fixture?: string;
    viewport: MachinaViewport;
    screen: MachinaScreen;
    tags: readonly string[];
    artifactBaseName: string;
};
type ExpandOptions = {
    screenKeys?: readonly string[];
    viewportKeys?: readonly string[];
    tags?: readonly string[];
};
declare function defineMachinaViewports(viewports: readonly MachinaViewport[]): MachinaViewportMatrix;
declare function createViewportMatrix(preset?: "standard-responsive" | "desktop-only" | "mobile-first"): MachinaViewportMatrix;
declare function defineMachinaScreens(screens: readonly MachinaScreen[]): MachinaScreenCatalog;
declare function slugMachinaArtifactName(input: string): string;
declare function getMachinaViewport(viewports: MachinaViewportMatrix, key: string): MachinaViewport;
declare function expandScreenViewportTasks(catalog: MachinaScreenCatalog, viewports: MachinaViewportMatrix, options?: ExpandOptions): MachinaScreenViewportTask[];

export { type MachinaViewport as M, type MachinaScreenViewportTask as a, type MachinaScreen as b, type MachinaScreenCatalog as c, type MachinaViewportMatrix as d, createViewportMatrix as e, defineMachinaScreens as f, defineMachinaViewports as g, expandScreenViewportTasks as h, getMachinaViewport as i, slugMachinaArtifactName as s };
