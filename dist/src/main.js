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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
exports.getDomainGuardConfigs = getDomainGuardConfigs;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const diff_analysis_1 = require("./diff-analysis");
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
        // Parse the diff into a DiffAnalysis object
        const diffAnalysis = new diff_analysis_1.DiffAnalysis(diffText);
        core.info("Diff Analysis:");
        core.info(JSON.stringify(diffAnalysis.getSummary(), null, 2));
        // Parse all .dg files from the repo
        const configs = await getDomainGuardConfigs(github.context.payload.repository?.clone_url ? "." : process.cwd());
        core.info("Parsed Domain Guard Configs:");
        core.info(JSON.stringify(configs, null, 2));
        doTheThing();
    }
    catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error)
            core.setFailed(error.message);
    }
}
function doTheThing() { }
/**
 * Search the repository for all `.dg` files, parse them as YAML, and return
 * a mapping keyed by the parent folder filepath (relative to rootDir).
 *
 * - rootDir: the directory to start searching from (defaults to process.cwd())
 * - Returns: Record<parentFolderRelativePath, mergedYamlObject>
 */
async function getDomainGuardConfigs(rootDir = process.cwd()) {
    const results = {};
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
                    if (!results[key])
                        results[key] = {};
                    Object.assign(results[key], merged);
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