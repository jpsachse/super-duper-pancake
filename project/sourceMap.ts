import { DataInterval, IntervalTree } from "node-interval-tree";
import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { IMetricCollector, SourcePart } from "./commentClassificationTypes";
import { SourceComment } from "./sourceComment";
import Utils from "./utils";

export class SourceMap {

    private nodesOfLine = new Map<number, SourcePart[]>();
    private positionOfNode = new Map<SourcePart, ts.TextRange>();
    private nodeLocations = new IntervalTree<DataInterval<SourcePart>>();
    private mergedComments: SourceComment[];
    private functionLikes: ts.FunctionLikeDeclaration[] = [];

    constructor(private sourceFile: ts.SourceFile, collectors: IMetricCollector[]) {
        const addNodeToMap = (nodeOrComment: SourcePart) => {
            let partStart = nodeOrComment.pos;
            if (Utils.isNode(nodeOrComment)) {
                if (ts.isFunctionLike(nodeOrComment)) {
                    this.functionLikes.push(nodeOrComment);
                }
                partStart = nodeOrComment.getStart(sourceFile);
            }
            const partEnd = nodeOrComment.end;
            collectors.forEach((collector) => collector.visitNode(nodeOrComment));
            this.nodeLocations.insert({
                low: partStart,
                high: partEnd,
                data: nodeOrComment,
            });
            this.positionOfNode.set(nodeOrComment, {pos: partStart, end: partEnd});
            const startLine = sourceFile.getLineAndCharacterOfPosition(partStart).line;
            const endLine = sourceFile.getLineAndCharacterOfPosition(partEnd).line;
            for (let line = startLine; line <= endLine; ++line) {
                if (!this.nodesOfLine.has(line)) {
                    this.nodesOfLine.set(line, [nodeOrComment]);
                } else {
                    this.nodesOfLine.get(line).push(nodeOrComment);
                }
            }
            if (Utils.isNode(nodeOrComment)) {
                nodeOrComment.getChildren().forEach(addNodeToMap);
            }
        };
        sourceFile.getChildren().forEach(addNodeToMap);
        this.mergedComments = this.mergeAllComments(sourceFile);
        this.mergedComments.forEach(addNodeToMap);
    }

    public getAllFunctionLikes(): ts.FunctionLikeDeclaration[] {
        return this.functionLikes;
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
        if (Utils.isNode(nextElement)) {
            return nextElement;
        }
        return;
    }

    public getSourcePartBefore(node: SourcePart): SourcePart | undefined {
        const position = this.positionOfNode.get(node);
        if (!position) { return; }
        const startLine = this.sourceFile.getLineAndCharacterOfPosition(position.pos).line;
        const previousNodes = this.nodesOfLine.get(startLine - 1);
        if (!previousNodes) { return; }
        return previousNodes[previousNodes.length - 1];
    }

    public getNodeAfterLine(line: number): ts.Node | undefined {
        const nodes = this.nodesOfLine[line];
        if (!nodes || nodes.length === 0) { return; }
        return this.getNodeFollowing(nodes[0]);
    }

    public getEnclosingNodes(element: SourcePart): ts.Node[] {
        const enclosingNodeIntervals = this.nodeLocations.search(element.pos, element.end);
        const enclosingNodes = enclosingNodeIntervals.map((dataInterval) => dataInterval.data);
        return enclosingNodes.filter((sourcePart) => Utils.isNode(sourcePart)) as ts.Node[];
    }

    public getCommentsForNode(node: ts.Node): SourceComment[] {
        const line = ts.getLineAndCharacterOfPosition(this.sourceFile, node.pos).line;
        const leadingNodes = this.nodesOfLine.get(line - 1) || [];
        const trailingNodes = this.nodesOfLine.get(line) || [];
        const leadingComments = leadingNodes.filter((part) => !Utils.isNode(part));
        const trailingComments = trailingNodes.filter((part) => !Utils.isNode(part));
        leadingComments.push(...trailingComments);
        return leadingComments as SourceComment[];
    }

    public getAllComments(): SourceComment[] {
        return this.mergedComments;
    }

    private mergeAllComments(sourceFile: ts.SourceFile): SourceComment[] {
        const result: SourceComment[] = [];
        const sourceLines = sourceFile.getFullText().replace(/\r\n/g, "\n").split("\n");
        let previousCommentEndLine = -1;
        let currentCommentStartLine = 0;
        let previousLineWasTrailing = false;
        TSUtils.forEachComment(sourceFile, (fullText, {kind, pos, end}) => {
            currentCommentStartLine = ts.getLineAndCharacterOfPosition(sourceFile, pos).line;
            const commentOnlyLineRegxp = /^\s*(\/\/|\/\*)/gm;
            const currentLineText = sourceLines[currentCommentStartLine];
            const isTrailingComment = !currentLineText.match(commentOnlyLineRegxp);
            if (previousLineWasTrailing || isTrailingComment ||
                    previousCommentEndLine === -1 || currentCommentStartLine > previousCommentEndLine + 1) {
                result.push(new SourceComment(pos, end, fullText.substring(pos, end)));
            } else if (currentCommentStartLine === previousCommentEndLine + 1) {
                result[result.length - 1].addPart(pos, end, fullText.substring(pos, end));
            }
            previousCommentEndLine = ts.getLineAndCharacterOfPosition(sourceFile, end).line;
            previousLineWasTrailing = isTrailingComment;
        }, sourceFile);
        return result;
    }

}
