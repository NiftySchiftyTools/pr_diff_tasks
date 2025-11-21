"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DGStruct = void 0;
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
const minimatch_1 = require("minimatch");
class DGStruct {
    constructor(name, obj, dir) {
        this.name = name;
        this.dir = dir;
        // normalize paths
        this.paths = Array.isArray(obj?.paths) ? obj.paths.map(String) : [];
        // filters with defaults
        const f = obj?.filters ?? {};
        this.filters = {
            contains: typeof f.contains === "string" ? f.contains : ".*",
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
    static fromParsedYaml(parsed, fileDir) {
        const results = [];
        if (!parsed || typeof parsed !== "object")
            return results;
        for (const key of Object.keys(parsed)) {
            try {
                results.push(new DGStruct(key, parsed[key], fileDir));
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                core.warning(`Failed to parse struct ${key} in ${fileDir}: ${msg}`);
            }
        }
        return results;
    }
    normalizeRelative(target) {
        // produce a path relative to the DG file dir and in posix style
        const rel = path.relative(this.dir, target);
        return rel.replace(/\\/g, "/");
    }
    /**
     * Check whether this struct's path globs match the given file path.
     * `fileFullPath` should be an absolute or repo-root relative path.
     */
    matchesFile(fileFullPath) {
        if (!this.paths || this.paths.length === 0)
            return true; // no paths means match all
        const rel = this.normalizeRelative(fileFullPath);
        // check exclude_paths first
        for (const ex of this.filters.exclude_paths ?? []) {
            if ((0, minimatch_1.minimatch)(rel, ex))
                return false;
        }
        for (const pat of this.paths) {
            if ((0, minimatch_1.minimatch)(rel, pat))
                return true;
        }
        return false;
    }
    /**
     * Check whether the diff text matches the `contains` regex based on diff_type.
     */
    matchesDiff(diffText) {
        if (!diffText)
            return false;
        const regex = new RegExp(this.filters.contains ?? ".*", "s");
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
    matchesFileDiff(fileDiff) {
        // First check if the file path matches
        if (!this.matchesFile(fileDiff.filePath)) {
            return false;
        }
        // Then check if the diff content matches based on diff_type
        const regex = new RegExp(this.filters.contains ?? ".*", "s");
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
}
exports.DGStruct = DGStruct;
//# sourceMappingURL=dg-struct.js.map