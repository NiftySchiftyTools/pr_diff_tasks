import { PRDiff } from "./diff-analysis";
import { DGStruct } from "./dg-struct";
import { FileMatches, StructMatches } from "./match";
import { PullRequest } from "@octokit/webhooks-types";
import { getOctokit } from "@actions/github";
import { isFloat64Array } from "util/types";

interface ReviewCommentStruct {
    path: string;
    position?: number;
    body: string;
    line?: number;
    side?: string;
    start_line?: number;
    start_side?: string;
}

export function handleMatches(matches: Map<string, FileMatches>, pr_response: PullRequest, octokit: ReturnType<typeof getOctokit>): void {
    const structs: Map<string, StructMatches> = new Map();
    // Deduplicate Matches using StructMatches
    for ( const [filePath, FileMatches] of matches) {
        for ( const dg_struct of FileMatches.getMatches()) {
            if (structs.has(`${dg_struct.dir}/${dg_struct.name}`)) {
                structs.get(`${dg_struct.dir}/${dg_struct.name}`)?.addFilePath(filePath);
            } else {
                const structMatch = new StructMatches(dg_struct, filePath);
                structs.set(`${dg_struct.dir}/${dg_struct.name}`, structMatch);
            }
        }   
    }
    // Prepare review comments and summary
    const review_comments: ReviewCommentStruct[] = [];
    let summary = `Domain Guard Comments triggered`;
    for ( const [_, structMatch] of structs) {
        for ( const comment of structMatch.struct.actions.comments ?? []) {
            const additionalFilesContext = structMatch.additionalFilePaths.size > 0 ? `\n\n_Also affects files:_\n${Array.from(structMatch.additionalFilePaths).map(f => `- ${f}`).join('\n')}` : '';
            review_comments.push({
                path: structMatch.anchorFilePath,
                body: `${comment}${additionalFilesContext}`,
                position: null,
            })
        }
    }
    if (review_comments.length > 0) {
        summary += `: ${review_comments.length} comment(s) added.`;
        postReview(summary, octokit, pr_response, review_comments);
    }
    // Request Reviewers and Teams
    // TODO: handle reviewers to be requested
    // Assign Users
    // TODO: handle assignees
    // Add Labels
    // TODO: handle labels

}

function postReview(summary: string, octokit: ReturnType<typeof getOctokit>, pr_response: PullRequest, comments: ReviewCommentStruct[] ): void {
    octokit.rest.pulls.createReview({
        owner: pr_response.base.repo.owner.login,
        repo: pr_response.base.repo.name,
        pull_number: pr_response.number,
        body: summary,
        event: "COMMENT",
        comments: comments
    })
}