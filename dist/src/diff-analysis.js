"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffAnalysis = exports.PRDiff = exports.FileDiff = void 0;
/**
 * Represents a single file's diff with its changes
 */
class FileDiff {
    constructor(filePath, rawDiff) {
        this.filePath = filePath;
        this.rawDiff = rawDiff;
        this._addedLines = [];
        this._deletedLines = [];
        this._changedLines = [];
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
                this._addedLines.push(line.slice(1));
            }
            // Capture deleted lines (start with '-')
            if (line.startsWith("-")) {
                this._deletedLines.push(line.slice(1));
            }
        }
        // Combine added and deleted lines
        this._changedLines = [...this._addedLines, ...this._deletedLines];
    }
    get addedLines() {
        return this._addedLines;
    }
    get deletedLines() {
        return this._deletedLines;
    }
    get changedLines() {
        return this._changedLines;
    }
    getAddedLineCount() {
        return this.addedLines.length;
    }
    getDeletedLineCount() {
        return this.deletedLines.length;
    }
    getChangedLineCount() {
        return this.changedLines.length;
    }
    getSummary() {
        return {
            filePath: this.filePath,
            addedCount: this.getAddedLineCount(),
            deletedCount: this.getDeletedLineCount(),
            changedCount: this.getChangedLineCount(),
        };
    }
    toJSON() {
        return {
            filePath: this.filePath,
            addedLineCount: this.getAddedLineCount(),
            deletedLineCount: this.getDeletedLineCount(),
            changedLineCount: this.getChangedLineCount(),
        };
    }
}
exports.FileDiff = FileDiff;
/**
 * Represents a parsed PR diff containing multiple file diffs
 */
class PRDiff {
    constructor(rawDiff) {
        this.fullDiff = rawDiff;
        this._fileDiffs = new Map();
        this.parse(rawDiff);
    }
    // Parse the raw diff string and split it into individual file diffs
    parse(rawDiff) {
        // Split the diff by file headers (lines starting with "diff --git")
        const fileDiffPattern = /^diff --git a\/(.*?) b\/\1$/gm;
        const lines = rawDiff.split("\n");
        let currentFilePath = null;
        let currentFileLines = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check if this is a new file diff
            const match = line.match(/^diff --git a\/(.*?) b\/(.*)$/);
            if (match) {
                // Save the previous file diff if it exists
                if (currentFilePath !== null && currentFileLines.length > 0) {
                    const fileDiffText = currentFileLines.join("\n");
                    const fileDiff = new FileDiff(currentFilePath, fileDiffText);
                    this._fileDiffs.set(currentFilePath, fileDiff);
                }
                // Start a new file diff
                currentFilePath = match[2]; // Use the 'b/' path as it's the new version
                currentFileLines = [line];
            }
            else {
                // Add line to current file diff
                currentFileLines.push(line);
            }
        }
        // Don't forget the last file
        if (currentFilePath !== null && currentFileLines.length > 0) {
            const fileDiffText = currentFileLines.join("\n");
            const fileDiff = new FileDiff(currentFilePath, fileDiffText);
            this._fileDiffs.set(currentFilePath, fileDiff);
        }
    }
    get fileDiffs() {
        return this._fileDiffs;
    }
    // Get a FileDiff by file path
    getFileDiff(filePath) {
        return this._fileDiffs.get(filePath);
    }
    // Get all file paths in this PR
    getFilePaths() {
        return Array.from(this._fileDiffs.keys());
    }
    // Get total statistics across all files
    getTotalAddedLineCount() {
        let sum = 0;
        for (const fileDiff of this._fileDiffs.values()) {
            sum += fileDiff.getAddedLineCount();
        }
        return sum;
    }
    getTotalDeletedLineCount() {
        let sum = 0;
        for (const fileDiff of this._fileDiffs.values()) {
            sum += fileDiff.getDeletedLineCount();
        }
        return sum;
    }
    getTotalChangedLineCount() {
        let sum = 0;
        for (const fileDiff of this._fileDiffs.values()) {
            sum += fileDiff.getChangedLineCount();
        }
        return sum;
    }
    getSummary() {
        return {
            fileCount: this._fileDiffs.size,
            totalAddedCount: this.getTotalAddedLineCount(),
            totalDeletedCount: this.getTotalDeletedLineCount(),
            totalChangedCount: this.getTotalChangedLineCount(),
            files: Array.from(this._fileDiffs.values()).map((fd) => fd.getSummary()),
        };
    }
}
exports.PRDiff = PRDiff;
exports.DiffAnalysis = PRDiff;
//# sourceMappingURL=diff-analysis.js.map