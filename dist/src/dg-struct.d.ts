import { FileDiff } from "./diff-analysis";
export type Quirk = "all" | "last_match";
export type DiffType = "all" | "additions" | "removals" | "raw";
export interface DGFilters {
    contains?: string;
    quirk?: Quirk;
    diff_type?: DiffType;
    exclude_paths?: string[];
}
export interface DGActions {
    comments?: string[];
    reviewers?: string[];
    assignees?: string[];
    teams?: string[];
    labels?: string[];
}
export declare class DGStruct {
    name: string;
    paths: string[];
    filters: DGFilters;
    actions: DGActions;
    dir: string;
    constructor(name: string, obj: any, dir: string);
    /**
     * Parse a full YAML-parsed object from a .dg file (may contain multiple top-level keys)
     * and return an array of DGStruct instances. `fileDir` should be the directory containing
     * the .dg file so relative paths can be evaluated later.
     */
    static fromParsedYaml(parsed: any, fileDir: string): DGStruct[];
    /**
     * Reconstruct a DGStruct from a JSON object (e.g., from toJSON())
     */
    static fromJSON(json: any): DGStruct;
    private normalizeRelative;
    /**
     * Check whether this struct's path globs match the given file path.
     * `fileFullPath` should be an absolute or repo-root relative path.
     */
    matchesFile(fileFullPath: string): boolean;
    /**
     * Check whether the diff text matches the `contains` regex based on diff_type.
     */
    matchesDiff(diffText: string): boolean;
    /**
     * Check whether a FileDiff matches this struct's filters.
     * This combines both file path matching and diff content matching.
     *
     * @param fileDiff - The FileDiff to check against this struct's filters
     * @returns true if the FileDiff matches all filters (path + diff content)
     */
    matchesFileDiff(fileDiff: FileDiff): boolean;
    toJSON(): {
        name: string;
        paths: string[];
        filters: DGFilters;
        actions: DGActions;
        dir: string;
    };
    toSummaryString(): string;
}
//# sourceMappingURL=dg-struct.d.ts.map