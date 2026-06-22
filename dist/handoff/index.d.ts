import { M as MachinaDomSummary } from '../types-bJlg6wno.js';
import { M as MachinaViewport, a as MachinaScreenViewportTask } from '../screenCatalog-ZjonGiOi.js';
import '../types-CYgsjDai.js';

type MachinaHandoffArtifactPaths = {
    screenshot?: string;
    domSummary?: string;
    layoutSnapshot?: string;
    manifest: string;
};
type MachinaHandoffBundleManifest = {
    schemaVersion: 1;
    createdAt: string;
    route?: string;
    fixture?: string;
    screenKey?: string;
    viewportKey?: string;
    viewport?: MachinaViewport;
    tags?: readonly string[];
    artifactBaseName?: string;
    artifacts: MachinaHandoffArtifactPaths;
    metadata?: Record<string, unknown>;
};
type WriteMachinaHandoffBundleInput = {
    outputDir: string;
    artifactBaseName?: string;
    screenshotPath?: string;
    domSummary?: MachinaDomSummary;
    layoutSnapshot?: unknown;
    task?: MachinaScreenViewportTask;
    route?: string;
    fixture?: string;
    tags?: readonly string[];
    metadata?: Record<string, unknown>;
    createdAt?: string;
};
type WriteMachinaHandoffBundleResult = {
    manifest: MachinaHandoffBundleManifest;
    paths: MachinaHandoffArtifactPaths;
};

declare function writeMachinaHandoffBundle(input: WriteMachinaHandoffBundleInput): Promise<WriteMachinaHandoffBundleResult>;

export { type MachinaHandoffArtifactPaths, type MachinaHandoffBundleManifest, type WriteMachinaHandoffBundleInput, type WriteMachinaHandoffBundleResult, writeMachinaHandoffBundle };
