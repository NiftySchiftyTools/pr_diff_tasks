import { DGStruct } from "./dg-struct";
export declare class FileMatches {
    filePath: string;
    directMatches: DGStruct[];
    lastMatchMatches: DGStruct[];
    lastMatchDepth: number;
    constructor(filePath: string);
    addDirectMatch(match: DGStruct): void;
    updateLastMatch(match: DGStruct, depth: number): void;
    getDirectMatchNames(): string[];
    getLastMatchNames(): string[];
}
//# sourceMappingURL=match.d.ts.map