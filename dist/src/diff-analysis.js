"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffAnalysis = void 0;
/**
 * Represents a parsed diff with statistics about additions, deletions, and full content.
 */
class DiffAnalysis {
    constructor(rawDiff) {
        this.fullDiff = rawDiff;
        this.addedLines = [];
        this.deletedLines = [];
        this.addedAndDeletedLines = [];
        this.parse(rawDiff);
    }
    // Parse the raw diff string and extract added, deleted, and combined lines
    parse(rawDiff) {
        const lines = rawDiff.split("\n");
        for (const line of lines) {
            // Skip file headers (+++, ---)
            if (line.startsWith("+++") || line.startsWith("---")) {
                continue;
            }
            // Capture added lines (start with '+')
            if (line.startsWith("+")) {
                this.addedLines.push(line.slice(1));
            }
            // Capture deleted lines (start with '-')
            if (line.startsWith("-")) {
                this.deletedLines.push(line.slice(1));
            }
        }
        // Combine added and deleted lines
        this.addedAndDeletedLines = [...this.addedLines, ...this.deletedLines];
    }
    getAddedLineCount() {
        return this.addedLines.length;
    }
    getDeletedLineCount() {
        return this.deletedLines.length;
    }
    getCombinedLineCount() {
        return this.addedAndDeletedLines.length;
    }
    getSummary() {
        return {
            addedCount: this.getAddedLineCount(),
            deletedCount: this.getDeletedLineCount(),
            combinedCount: this.getCombinedLineCount(),
            totalDiffLength: this.fullDiff.length,
        };
    }
}
exports.DiffAnalysis = DiffAnalysis;
//# sourceMappingURL=diff-analysis.js.map