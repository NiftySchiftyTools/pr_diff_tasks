/**
 * Represents a parsed diff with statistics about additions, deletions, and full content.
 */
export class DiffAnalysis {
  // Array of lines that were added (lines starting with '+' excluding '+++')
  addedLines: string[];

  // Array of lines that were deleted (lines starting with '-' excluding '---')
  deletedLines: string[];

  // Array of lines that were both added and deleted (combined)
  addedAndDeletedLines: string[];

  // The full raw diff text
  readonly fullDiff: string;

  constructor(rawDiff: string) {
    this.fullDiff = rawDiff;
    this.addedLines = [];
    this.deletedLines = [];
    this.addedAndDeletedLines = [];

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

  getAddedLineCount(): number {
    return this.addedLines.length;
  }

  getDeletedLineCount(): number {
    return this.deletedLines.length;
  }

  getCombinedLineCount(): number {
    return this.addedAndDeletedLines.length;
  }

  getSummary(): {
    addedCount: number;
    deletedCount: number;
    combinedCount: number;
    totalDiffLength: number;
  } {
    return {
      addedCount: this.getAddedLineCount(),
      deletedCount: this.getDeletedLineCount(),
      combinedCount: this.getCombinedLineCount(),
      totalDiffLength: this.fullDiff.length,
    };
  }
}
