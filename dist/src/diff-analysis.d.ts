/**
 * Represents a parsed diff with statistics about additions, deletions, and full content.
 */
export declare class DiffAnalysis {
    addedLines: string[];
    deletedLines: string[];
    addedAndDeletedLines: string[];
    readonly fullDiff: string;
    constructor(rawDiff: string);
    private parse;
    getAddedLineCount(): number;
    getDeletedLineCount(): number;
    getCombinedLineCount(): number;
    getSummary(): {
        addedCount: number;
        deletedCount: number;
        combinedCount: number;
        totalDiffLength: number;
    };
}
//# sourceMappingURL=diff-analysis.d.ts.map