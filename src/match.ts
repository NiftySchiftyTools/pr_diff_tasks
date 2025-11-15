/*
    Helper class to store matches dg structs to changes in a diff
*/

import { DGStruct } from './dg-struct'

export class FileMatches {
    filePath: string;
    // stores direct matching DGStruct instances
    directMatches: DGStruct[];
    // stores last_match DGStruct instances (deepest matches)
    lastMatchMatches: DGStruct[];
    lastMatchDepth: number;

    constructor(filePath: string) {
        this.filePath = filePath;
        this.directMatches = [];
        this.lastMatchMatches = [];
        this.lastMatchDepth = 0;
    }

    addDirectMatch(match: DGStruct) {
        this.directMatches.push(match);
    }

    updateLastMatch(match: DGStruct, depth: number) {
        if (depth > this.lastMatchDepth) {
            this.lastMatchMatches = [match];
            this.lastMatchDepth = depth;
        } else if (depth === this.lastMatchDepth) {
            this.lastMatchMatches.push(match);
        }
    }

    // convenience: return the names of direct matches
    getDirectMatchNames(): string[] {
        return this.directMatches.map(m => m.name)
    }

    // convenience: return the names of last-match matches
    getLastMatchNames(): string[] {
        return this.lastMatchMatches.map(m => m.name)
    }
    
}