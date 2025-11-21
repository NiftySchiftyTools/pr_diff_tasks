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
exports.run = run;
exports.getDomainGuardStructs = getDomainGuardStructs;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const diff_analysis_1 = require("./diff-analysis");
const dg_struct_1 = require("./dg-struct");
const match_1 = require("./match");
/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
    try {
        const github_token = core.getInput("github_token");
        const pr_number = parseInt(core.getInput("pr_number"));
        const octokit = github.getOctokit(github_token);
        const { data: pr } = await octokit.rest.pulls.get({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: pr_number,
        });
        const { data: raw_diff } = await octokit.rest.repos.compareCommits({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            base: pr.base.sha,
            head: pr.head.sha,
            mediaType: {
                format: "diff",
            },
        });
        // The raw_diff when using mediaType.format: 'diff' returns the diff as a string
        // Cast it to string since the API returns raw text
        const diffText = typeof raw_diff === "string" ? raw_diff : JSON.stringify(raw_diff);
        // Parse the diff into a PRDiff object
        const prDiff = new diff_analysis_1.PRDiff(diffText);
        core.info("PR Diff Analysis:");
        core.info(JSON.stringify(prDiff.getSummary(), null, 2));
        // Parse all .dg files from the repo
        const configs = await getDomainGuardStructs(github.context.payload.repository?.clone_url ? "." : process.cwd());
        core.info("Parsed Domain Guard Configs:");
        core.info(JSON.stringify(configs, null, 2));
        // Collect matching structures for the PR diff
        core.info("Starting to collect matching structures...");
        const matches = collectMatchingStructures(configs, prDiff);
        core.info("Domain Guard Matches:");
        core.info(JSON.stringify(Array.from(matches.entries()), null, 2));
    }
    catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) {
            core.error(`Error: ${error.message}`);
            core.error(`Stack: ${error.stack}`);
            core.setFailed(error.message);
        }
        else {
            core.setFailed(String(error));
        }
    }
}
function collectMatchingStructures(all_structs, prDiff) {
    const matches = new Map();
    for (const [filePath, fileDiff] of prDiff.fileDiffs) {
        const matchesForFile = new match_1.FileMatches(filePath);
        for (const [configPath, structs] of all_structs) {
            if (filePath.startsWith(configPath) || configPath === ".") {
                for (const [_, struct] of structs) {
                    if (struct.matchesFileDiff(fileDiff)) {
                        switch (struct.filters.quirk) {
                            case "all":
                                matchesForFile.addDirectMatch(struct);
                                break;
                            case "last_match":
                                matchesForFile.updateLastMatch(struct, configPath.split(path.sep).length);
                                break;
                        }
                    }
                }
            }
        }
        // Only add to matches if there are any matches for this file
        if (matchesForFile.hasMatches()) {
            matches.set(filePath, matchesForFile);
        }
    }
    return matches;
}
/**
 * Search the repository for all `.dg` files, parse them as YAML, and return
 * a mapping keyed by the parent folder filepath (relative to rootDir).
 *
 * - rootDir: the directory to start searching from (defaults to process.cwd())
 * - Returns: Record<parentFolderRelativePath, Record<structName, DGStruct>>
 */
async function getDomainGuardStructs(rootDir = process.cwd()) {
    const results = new Map();
    async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            }
            else if (entry.isFile() && entry.name.endsWith(".dg")) {
                try {
                    const content = await fs.readFile(full, "utf8");
                    const docs = [];
                    // loadAll will push each document into docs
                    yaml.loadAll(content, (doc) => {
                        if (doc !== undefined)
                            docs.push(doc);
                    });
                    const merged = Object.assign({}, ...docs);
                    const parent = path.dirname(full);
                    const key = path.relative(rootDir, parent) || ".";
                    // Parse the merged YAML into DGStruct instances
                    const structs = dg_struct_1.DGStruct.fromParsedYaml(merged, parent);
                    if (!results.has(key)) {
                        results.set(key, new Map());
                    }
                    // Store each struct by its name
                    const structsMap = results.get(key);
                    for (const struct of structs) {
                        structsMap.set(struct.name, struct);
                    }
                }
                catch (err) {
                    // Don't throw; log a warning and continue
                    const msg = err instanceof Error ? err.message : String(err);
                    core.warning(`Failed to read/parse .dg file at ${full}: ${msg}`);
                }
            }
        }
    }
    await walk(rootDir);
    return results;
}
//# sourceMappingURL=main.js.map