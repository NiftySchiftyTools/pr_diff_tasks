import * as path from "path";
import * as core from "@actions/core";
import { minimatch } from "minimatch";
import { FileDiff } from "./diff-analysis";
import { dir } from "console";

export type Quirk = "all" | "last_match";
export type DiffType = "all" | "additions" | "removals" | "raw";

export interface DGFilters {
  diff_regex?: string;
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

export class DGStruct {
  name: string;
  paths: string[];
  filters: DGFilters;
  actions: DGActions;
  // directory where the .dg file lives (used to resolve relative paths)
  dir: string;

  constructor(name: string, obj: any, dir: string) {
    this.name = name;
    this.dir = dir;

    // normalize paths
    this.paths = Array.isArray(obj?.paths) ? obj.paths.map(String) : [];

    // filters with defaults
    const f = obj?.filters ?? {};
    this.filters = {
      diff_regex: typeof f.diff_regex === "string" ? f.diff_regex : ".*",
      quirk: f.quirk === "last_match" ? "last_match" : "all",
      diff_type: ["all", "additions", "removals", "raw"].includes(f.diff_type)
        ? f.diff_type
        : "all",
      exclude_paths: Array.isArray(f.exclude_paths)
        ? f.exclude_paths.map(String)
        : [],
    };

    // actions
    const a = obj?.actions ?? {};
    this.actions = {
      comments: Array.isArray(a.comments) ? a.comments.map(String) : [],
      reviewers: Array.isArray(a.reviewers) ? a.reviewers.map(String) : [],
      assignees: Array.isArray(a.assignees) ? a.assignees.map(String) : [],
      teams: Array.isArray(a.teams) ? a.teams.map(String) : [],
      labels: Array.isArray(a.labels) ? a.labels.map(String) : [],
    };
  }

  /**
   * Parse a full YAML-parsed object from a .dg file (may contain multiple top-level keys)
   * and return an array of DGStruct instances. `fileDir` should be the directory containing
   * the .dg file so relative paths can be evaluated later.
   */
  static fromParsedYaml(parsed: any, fileDir: string): DGStruct[] {
    const results: DGStruct[] = [];
    if (!parsed || typeof parsed !== "object") return results;

    for (const key of Object.keys(parsed)) {
      try {
        results.push(new DGStruct(key, parsed[key], fileDir));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        core.warning(`Failed to parse struct ${key} in ${fileDir}: ${msg}`);
      }
    }

    return results;
  }

  /**
   * Reconstruct a DGStruct from a JSON object (e.g., from toJSON())
   */
  static fromJSON(json: any): DGStruct {
    if (!json || typeof json !== "object") {
      throw new Error("Invalid JSON for DGStruct");
    }
    
    // Create a new instance using the constructor
    const obj = {
      dir: json.dir,
      name: json.name,
      paths: json.paths,
      filters: json.filters,
      actions: json.actions
    };
    
    return new DGStruct(json.name, obj, json.dir);
  }

  private normalizeRelative(target: string): string {
    // produce a path relative to the DG file dir and in posix style
    const rel = path.relative(this.dir, target);
    return rel.replace(/\\/g, "/");
  }

  /**
   * Check whether this struct's path globs match the given file path.
   * `fileFullPath` should be an absolute or repo-root relative path.
   */
  matchesFile(fileFullPath: string): boolean {
    if (!this.paths || this.paths.length === 0) return true; // no paths means match all

    const rel = this.normalizeRelative(fileFullPath);

    // check exclude_paths first
    for (const ex of this.filters.exclude_paths ?? []) {
      if (minimatch(rel, ex)) return false;
    }

    for (const pat of this.paths) {
      if (minimatch(rel, pat)) return true;
    }

    return false;
  }

  /**
   * Check whether the diff text matches the `diff_regex` regex based on diff_type.
   */
  matchesDiff(diffText: string): boolean {
    if (!diffText) return false;
    const regex = new RegExp(this.filters.diff_regex ?? ".*", "s");

    let subject = diffText;
    switch (this.filters.diff_type) {
      case "additions":
        subject = diffText
          .split("\n")
          .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
          .join("\n");
        break;
      case "removals":
        subject = diffText
          .split("\n")
          .filter((l) => l.startsWith("-") && !l.startsWith("---"))
          .join("\n");
        break;
      case "raw":
        subject = diffText;
        break;
      default:
        subject = diffText;
    }

    return regex.test(subject);
  }

  /**
   * Check whether a FileDiff matches this struct's filters.
   * This combines both file path matching and diff content matching.
   *
   * @param fileDiff - The FileDiff to check against this struct's filters
   * @returns true if the FileDiff matches all filters (path + diff content)
   */
  matchesFileDiff(fileDiff: FileDiff): boolean {
    // First check if the file path matches
    if (!this.matchesFile(fileDiff.filePath)) {
      return false;
    }

    // Then check if the diff content matches based on diff_type
    const regex = new RegExp(this.filters.diff_regex ?? ".*", "s");

    let subject = "";
    switch (this.filters.diff_type) {
      case "additions":
        subject = fileDiff.addedLines.join("\n");
        break;
      case "removals":
        subject = fileDiff.deletedLines.join("\n");
        break;
      case "all":
        subject = fileDiff.changedLines.join("\n");
        break;
      case "raw":
        subject = fileDiff.rawDiff;
        break;
      default:
        subject = fileDiff.changedLines.join("\n");
    }

    return regex.test(subject);
  }

  toJSON() {
    return {
      name: this.name,
      paths: this.paths,
      filters: this.filters,
      actions: this.actions,
      dir: this.dir,
    };
  }

  toSummaryString(): string {
    let summary = `${this.dir}/${this.name}:\n`;
    if (this.actions.assignees && this.actions.assignees.length > 0){
      summary += `  - Assignees: [${this.actions.assignees.join(", ")}]\n`;
    }
    if (this.actions.reviewers && this.actions.reviewers.length > 0){
      summary += `  - Reviewers: [${this.actions.reviewers.join(", ")}]\n`;
    }
    if (this.actions.teams && this.actions.teams.length > 0){
      summary += `  - Teams: [${this.actions.teams.join(", ")}]\n`;
    }
    if (this.actions.labels && this.actions.labels.length > 0){
      summary += `  - Labels: [${this.actions.labels.join(", ")}]\n`;
    }
    if (this.actions.comments && this.actions.comments.length > 0){
      summary += `  - Comments: [${this.actions.comments.length} comment(s)]\n`;
    }
    return summary;
  }
}
