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
    private blockStarts = new Map<number, ts.Block>();
    private blockEnds = new Map<number, ts.Block>();

    constructor(public readonly sourceFile: ts.SourceFile, collectors: IMetricCollector[]) {
        const addNodeToMap = (nodeOrComment: SourcePart) => {
            let partStart = nodeOrComment.pos;
            const partEnd = nodeOrComment.end;
            let startLine = sourceFile.getLineAndCharacterOfPosition(partStart).line;
            const endLine = sourceFile.getLineAndCharacterOfPosition(partEnd).line;
            if (Utils.isNode(nodeOrComment)) {
                partStart = nodeOrComment.getStart(sourceFile);
                startLine = sourceFile.getLineAndCharacterOfPosition(partStart).line;
                if (ts.isFunctionLike(nodeOrComment)) {
                    this.functionLikes.push(nodeOrComment);
                }
                if (ts.isBlock(nodeOrComment)) {
                    this.blockStarts.set(startLine, nodeOrComment);
                    this.blockEnds.set(endLine, nodeOrComment);
                }
            }

            collectors.forEach((collector) => collector.visitNode(nodeOrComment));
            this.nodeLocations.insert({
                low: partStart,
                high: partEnd,
                data: nodeOrComment,
            });
            this.positionOfNode.set(nodeOrComment, {pos: partStart, end: partEnd});
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
        return this.getNodeAfterLine(endingLine);
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
        const nodesSpanningLine = this.nodesOfLine.get(line);
        const followingNodes = [this.sourceFile as SourcePart].concat(...this.nodesOfLine.get(line + 1));
        if (!followingNodes) { return; }
        let parentBlock: ts.Node;
        let i = nodesSpanningLine.length;
        while (i > 0) {
            i--;
            const currentSourcePart = nodesSpanningLine[i];
            if (Utils.isNode(currentSourcePart) && !ts.isJSDoc(currentSourcePart)) {
                parentBlock = currentSourcePart;
                break;
            }
        }
        if (parentBlock === undefined) {
            parentBlock = this.sourceFile;
        }
        // Go up the list of nodes touching a line from the back until we find the parent
        // determined above and use the node directly after it.
        i = followingNodes.length;
        while (i > 0) {
            i--;
            if (followingNodes[i] === parentBlock) {
                let o = i;
                while (o < followingNodes.length - 1) {
                    o++;
                    const result = followingNodes[o];
                    if (Utils.isNode(result)) {
                        if (TSUtils.isSyntaxList(result)) {
                            continue;
                        }
                        return result;
                    }
                }
                break;
            }
        }
        return;
    }

    public getEnclosingNodes(element: SourcePart): ts.Node[] {
        const enclosingNodeIntervals = this.nodeLocations.search(element.pos, element.end);
        const enclosingNodes = enclosingNodeIntervals.map((dataInterval) => dataInterval.data);
        return enclosingNodes.filter((sourcePart) => Utils.isNode(sourcePart)) as ts.Node[];
    }

    /**
     * Fetches the last node of the given line and then traverses the AST upwards until it finds
     * either a statement or declaration, which is returned.
     * @param line The line the node is in.
     * @returns {(ts.Node | undefined)} A node or undefined, if the requested line does not contain code.
     */
    public getMostEnclosingNodeForLine(line: number): ts.Node | undefined {
        // Don't return anything for empty lines
        const lineStart = this.sourceFile.getPositionOfLineAndCharacter(line, 0);
        const lineEnd = this.sourceFile.getLineEndOfPosition(lineStart);
        const lineText = this.sourceFile.getFullText().substring(lineStart, lineEnd);
        if (lineStart === lineEnd || lineText.replace(/\s*/, "").length === 0) {
            return;
        }
        // TODO: cope with blocks ending at the end of a line of code, which currently results in
        // returning the wrong node (the statement corresponding to the enclosing block and not
        // the actual node that started the corresponding line).
        // Easy possible fix: while the fetched node from the array is a closing bracket, reduce
        // the used index, until a non-bracket node is found (if any) and then use that to find a parent.
        // This could also solve the problem of closing brackets resulting in a unwanted recalculation
        // of complexity scores for block-starting lines.
        const nodes = this.nodesOfLine.get(line);
        if (!nodes || nodes.length === 0) { return; }
        let node = nodes[nodes.length - 1];
        if (!Utils.isNode(node)) { return; }
        while (node.parent !== undefined && !Utils.isStatement(node) && !Utils.isDeclaration(node)) {
            node = node.parent;
        }
        return node;
    }

    public isBlockStartingInLine(line: number): boolean {
        return this.blockStarts.has(line);
    }

    public getBlockStartingInLine(line: number): ts.Block {
        return this.blockStarts.get(line);
    }

    public isBlockEndingInLine(line: number): boolean {
        return this.blockEnds.has(line);
    }

    public getCommentsBelongingToNode(node: ts.Node): SourceComment[] {
        const line = ts.getLineAndCharacterOfPosition(this.sourceFile, node.pos).line;
        return this.getCommentsBelongingToLine(line);
    }

    public getCommentsBelongingToLine(line: number): SourceComment[] {
        const leadingNodes = this.nodesOfLine.get(line - 1) || [];
        const trailingNodes = this.nodesOfLine.get(line) || [];
        const leadingComments = leadingNodes.filter((part) => !Utils.isNode(part));
        const trailingComments = trailingNodes.filter((part) => !Utils.isNode(part));
        leadingComments.push(...trailingComments);
        return leadingComments as SourceComment[];
    }

    public getCommentsInLine(line: number): SourceComment[] {
        return (this.nodesOfLine.get(line) || []).filter((part) => !Utils.isNode(part)) as SourceComment[];
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
