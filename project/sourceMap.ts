import { DataInterval, IntervalTree } from "node-interval-tree";
import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { SourceComment } from "./sourceComment";

export type SourcePart = ts.Node | SourceComment;

export class SourceMap {

    private nodesOfLine = new Map<number, SourcePart[]>();
    private positionOfNode = new Map<SourcePart, ts.TextRange>();
    private nodeLocations = new IntervalTree<DataInterval<SourcePart>>();
    private mergedComments: SourceComment[];

    constructor(private sourceFile: ts.SourceFile) {
        const addNodeToMap = (nodeOrComment: SourcePart) => {
            if (this.isNode(nodeOrComment)) {
                this.nodeLocations.insert({
                    low: (nodeOrComment as ts.Node).getStart(sourceFile) || nodeOrComment.pos,
                    high: nodeOrComment.end,
                    data: nodeOrComment,
                });
            }
            this.positionOfNode.set(nodeOrComment, {pos: nodeOrComment.pos, end: nodeOrComment.end});
            const line = sourceFile.getLineAndCharacterOfPosition(nodeOrComment.pos).line;
            if (!this.nodesOfLine.has(line)) {
                this.nodesOfLine.set(line, [nodeOrComment]);
            } else {
                this.nodesOfLine.get(line).push(nodeOrComment);
            }
            if (this.isNode(nodeOrComment)) {
                nodeOrComment.getChildren().forEach(addNodeToMap);
            }
        };
        sourceFile.getChildren().forEach(addNodeToMap);
        this.mergedComments = this.mergeAllComments(sourceFile);
        this.mergedComments.forEach(addNodeToMap);
    }

    public getNodeFollowing(node: SourcePart): ts.Node | undefined {
        const position = this.positionOfNode.get(node);
        if (!position) { return; }
        const endingLine = this.sourceFile.getLineAndCharacterOfPosition(position.end).line;
        const followingNodes = this.nodesOfLine.get(endingLine + 1);
        if (!followingNodes) { return; }
        // As creation of this list is done by iterating the AST, starting at parent nodes,
        // the outermost node of the line is the one containing all other calls.
        const nextElement = followingNodes[0];
        if (this.isNode(nextElement)) {
            return nextElement;
        }
        return;
    }

    public getNodeAfterLine(line: number): ts.Node | undefined {
        const nodes = this.nodesOfLine[line];
        if (!nodes || nodes.length === 0) { return; }
        return this.getNodeFollowing(nodes[0]);
    }

    public getEnclosingNodes(element: SourcePart): ts.Node[] {
        const enclosingNodeIntervals = this.nodeLocations.search(element.pos, element.end);
        const enclosingNodes = enclosingNodeIntervals.map((dataInterval) => dataInterval.data);
        return enclosingNodes.filter((sourcePart) => this.isNode(sourcePart)) as ts.Node[];
    }

    public getAllComments(): SourceComment[] {
        return this.mergedComments;
    }

    private isNode(element: SourcePart): element is ts.Node {
        return (element as ts.Node).kind !== undefined;
    }

    private mergeAllComments(sourceFile: ts.SourceFile): SourceComment[] {
        const result: SourceComment[] = [];
        const sourceLines = sourceFile.getFullText().replace(/\r\n/g, "/n").split("/n");
        let previousCommentEndLine = -1;
        let currentCommentStartLine = 0;
        TSUtils.forEachComment(sourceFile, (fullText, {kind, pos, end}) => {
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
