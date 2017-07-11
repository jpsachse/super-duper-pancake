import * as Utils from "tsutils";
import * as ts from "typescript";
import { SourceComment } from "./sourceComment";

export class SourceMap {

    private lineMap: Map<number, Array<ts.Node | SourceComment>>;

    constructor(sourceFile: ts.SourceFile) {
        this.lineMap = new Map();
        const addNodeToMap = (nodeOrComment: ts.Node | SourceComment) => {
            const line = sourceFile.getLineAndCharacterOfPosition(nodeOrComment.pos).line;
            if (!this.lineMap.has(line)) {
                this.lineMap.set(line, [nodeOrComment]);
            } else {
                this.lineMap.get(line).push(nodeOrComment);
            }
        };
        sourceFile.forEachChild(addNodeToMap);
        const mergedComments = this.getMergedComments(sourceFile);
        mergedComments.forEach(addNodeToMap);
    }

    private getMergedComments(sourceFile: ts.SourceFile): SourceComment[] {
        const result: SourceComment[] = [];
        const sourceLines = sourceFile.getFullText().replace(/\r\n/g, "/n").split("/n");
        let previousCommentEndLine = -1;
        let currentCommentStartLine = 0;
        Utils.forEachComment(sourceFile, (fullText, {kind, pos, end}) => {
            currentCommentStartLine = ts.getLineAndCharacterOfPosition(sourceFile, pos).line;
            if (previousCommentEndLine === -1 || currentCommentStartLine > previousCommentEndLine + 1) {
                result.push(new SourceComment(pos, end, fullText.substring(pos, end)));
            } else if (currentCommentStartLine === previousCommentEndLine + 1) {
                result[result.length - 1].addPart(pos, end, fullText.substring(pos, end));
            }
            previousCommentEndLine = ts.getLineAndCharacterOfPosition(sourceFile, end).line;
        });
        return result;
    }

}
