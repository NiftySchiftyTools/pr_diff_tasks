"use strict";
/*
    Helper class to store matches dg structs to changes in a diff
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileMatches = void 0;
class FileMatches {
    constructor(filePath) {
        this.filePath = filePath;
        this.directMatches = [];
        this.lastMatchMatches = [];
        this.lastMatchDepth = 0;
    }
    addDirectMatch(match) {
        this.directMatches.push(match);
    }
    updateLastMatch(match, depth) {
        if (depth > this.lastMatchDepth) {
            this.lastMatchMatches = [match];
            this.lastMatchDepth = depth;
        }
        else if (depth === this.lastMatchDepth) {
            this.lastMatchMatches.push(match);
        }
    }
    // convenience: return the names of direct matches
    getDirectMatchNames() {
        return this.directMatches.map((m) => m.name);
    }
    // convenience: return the names of last-match matches
    getLastMatchNames() {
        return this.lastMatchMatches.map((m) => m.name);
    }
    // check if there are any matches
    hasMatches() {
        return this.directMatches.length > 0 || this.lastMatchMatches.length > 0;
    }
    toJSON() {
        return {
            filePath: this.filePath,
            directMatches: this.directMatches.map((m) => m.toJSON()),
            lastMatchMatches: this.lastMatchMatches.map((m) => m.toJSON()),
        };
    }
}
exports.FileMatches = FileMatches;
//# sourceMappingURL=match.js.map