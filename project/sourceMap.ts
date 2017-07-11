import { DataInterval, IntervalTree } from "node-interval-tree";
import * as Utils from "tsutils";
import * as ts from "typescript";
import { SourceComment } from "./sourceComment";

export type SourcePart = ts.Node | SourceComment;

export class SourceMap {

    private nodesOfLine = new Map<number, SourcePart[]>();
    private lineOfNode = new Map<SourcePart, number>();
    private nodeLocations = new IntervalTree<DataInterval<SourcePart>>();

    constructor(sourceFile: ts.SourceFile) {
        const addNodeToMap = (nodeOrComment: SourcePart) => {
            if (this.isNode(nodeOrComment)) {
                this.nodeLocations.insert({
                    low: nodeOrComment.pos,
                    high: nodeOrComment.end,
                    data: nodeOrComment,
                });
            }
            const line = sourceFile.getLineAndCharacterOfPosition(nodeOrComment.pos).line;
            this.lineOfNode.set(nodeOrComment, line);
            if (!this.nodesOfLine.has(line)) {
                this.nodesOfLine.set(line, [nodeOrComment]);
            } else {
                this.nodesOfLine.get(line).push(nodeOrComment);
            }
        };
        sourceFile.forEachChild(addNodeToMap);
        const mergedComments = this.getMergedComments(sourceFile);
        mergedComments.forEach(addNodeToMap);
    }

    public getNodeFollowing(node: SourcePart): SourcePart | undefined {
        const line = this.lineOfNode.get(node);
        if (!line) { return; }
        const linesWithCode = Array.from(this.nodesOfLine.keys());
        const index = linesWithCode.indexOf(line);
        if (!index || index + 1 >= linesWithCode.length) { return; }
        const nextLine = linesWithCode[index + 1];
        // As creation of this list is done by iterating the AST, starting at parent nodes,
        // the outermost node of the line is the one containing all other calls.
        return this.nodesOfLine.get(nextLine)[0];
    }

    public getNodeAfterLine(line: number): SourcePart | undefined {
        const nodes = this.nodesOfLine[line];
        if (!nodes || nodes.length === 0) { return; }
        return this.getNodeFollowing(nodes[0]);
    }

    public getParent(element: SourcePart): SourcePart | undefined {
        if (this.isNode(element)) {
            return element.parent;
        }
        const enclosingNodes = this.nodeLocations.search(element.pos, element.end);
        if (enclosingNodes.length === 0) {
            return;
        }
        return enclosingNodes[0].data;
    }

    private isNode(element: SourcePart): element is ts.Node {
        return (element as ts.Node).kind !== undefined;
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
