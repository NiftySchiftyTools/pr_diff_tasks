/**
 * Represents a single file's diff with its changes
 */
export declare class FileDiff {
    readonly filePath: string;
    readonly rawDiff: string;
    private _addedLines;
    private _deletedLines;
    private _changedLines;
    constructor(filePath: string, rawDiff: string);
    private parse;
    get addedLines(): string[];
    get deletedLines(): string[];
    get changedLines(): string[];
    getAddedLineCount(): number;
    getDeletedLineCount(): number;
    getChangedLineCount(): number;
    getSummary(): {
        filePath: string;
        addedCount: number;
        deletedCount: number;
        changedCount: number;
    };
    toJSON(): {
        filePath: string;
        addedLineCount: number;
        deletedLineCount: number;
        changedLineCount: number;
    };
}
/**
 * Represents a parsed PR diff containing multiple file diffs
 */
export declare class PRDiff {
    readonly fullDiff: string;
    private _fileDiffs;
    constructor(rawDiff: string);
    private parse;
    get fileDiffs(): Map<string, FileDiff>;
    getFileDiff(filePath: string): FileDiff | undefined;
    getFilePaths(): string[];
    getTotalAddedLineCount(): number;
    getTotalDeletedLineCount(): number;
    getTotalChangedLineCount(): number;
    getSummary(): {
        fileCount: number;
        totalAddedCount: number;
        totalDeletedCount: number;
        totalChangedCount: number;
        files: Array<{
            filePath: string;
            addedCount: number;
            deletedCount: number;
            changedCount: number;
        }>;
    };
}
export { PRDiff as DiffAnalysis };
//# sourceMappingURL=diff-analysis.d.ts.map