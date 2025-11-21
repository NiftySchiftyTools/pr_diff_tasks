/**
 * Represents a single file's diff with its changes
 */
export class FileDiff {
  // The file path
  readonly filePath: string;

  // The raw diff text for this file
  readonly rawDiff: string;

  // Array of lines that were added (lines starting with '+' excluding '+++')
  private _addedLines: string[];

  // Array of lines that were deleted (lines starting with '-' excluding '---')
  private _deletedLines: string[];

  // Array of lines that were both added and deleted (combined)
  private _changedLines: string[];

  constructor(filePath: string, rawDiff: string) {
    this.filePath = filePath;
    this.rawDiff = rawDiff;
    this._addedLines = [];
    this._deletedLines = [];
    this._changedLines = [];

    this.parse(rawDiff);
  }

  // Parse the raw diff string and extract added, deleted, and combined lines
  private parse(rawDiff: string): void {
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

  get addedLines(): string[] {
    return this._addedLines;
  }

  get deletedLines(): string[] {
    return this._deletedLines;
  }

  get changedLines(): string[] {
    return this._changedLines;
  }

  getAddedLineCount(): number {
    return this.addedLines.length;
  }

  getDeletedLineCount(): number {
    return this.deletedLines.length;
  }

  getChangedLineCount(): number {
    return this.changedLines.length;
  }

  getSummary(): {
    filePath: string;
    addedCount: number;
    deletedCount: number;
    changedCount: number;
  } {
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

/**
 * Represents a parsed PR diff containing multiple file diffs
 */
export class PRDiff {
  // The full raw diff text for the entire PR
  readonly fullDiff: string;

  // Map of FileDiff objects keyed by file path
  private _fileDiffs: Map<string, FileDiff>;

  constructor(rawDiff: string) {
    this.fullDiff = rawDiff;
    this._fileDiffs = new Map();

    this.parse(rawDiff);
  }

  // Parse the raw diff string and split it into individual file diffs
  private parse(rawDiff: string): void {
    // Split the diff by file headers (lines starting with "diff --git")
    const fileDiffPattern = /^diff --git a\/(.*?) b\/\1$/gm;
    const lines = rawDiff.split("\n");

    let currentFilePath: string | null = null;
    let currentFileLines: string[] = [];

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
      } else {
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

  get fileDiffs(): Map<string, FileDiff> {
    return this._fileDiffs;
  }

  // Get a FileDiff by file path
  getFileDiff(filePath: string): FileDiff | undefined {
    return this._fileDiffs.get(filePath);
  }

  // Get all file paths in this PR
  getFilePaths(): string[] {
    return Array.from(this._fileDiffs.keys());
  }

  // Get total statistics across all files
  getTotalAddedLineCount(): number {
    let sum = 0;
    for (const fileDiff of this._fileDiffs.values()) {
      sum += fileDiff.getAddedLineCount();
    }
    return sum;
  }

  getTotalDeletedLineCount(): number {
    let sum = 0;
    for (const fileDiff of this._fileDiffs.values()) {
      sum += fileDiff.getDeletedLineCount();
    }
    return sum;
  }

  getTotalChangedLineCount(): number {
    let sum = 0;
    for (const fileDiff of this._fileDiffs.values()) {
      sum += fileDiff.getChangedLineCount();
    }
    return sum;
  }

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
  } {
    return {
      fileCount: this._fileDiffs.size,
      totalAddedCount: this.getTotalAddedLineCount(),
      totalDeletedCount: this.getTotalDeletedLineCount(),
      totalChangedCount: this.getTotalChangedLineCount(),
      files: Array.from(this._fileDiffs.values()).map((fd) => fd.getSummary()),
    };
  }
}

// Legacy export for backwards compatibility
export { PRDiff as DiffAnalysis };
