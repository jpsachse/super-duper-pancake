import { DataInterval, IntervalTree } from "node-interval-tree";
import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { SourceComment } from "./sourceComment";

export type SourcePart = ts.Node | SourceComment;

interface INodeMetrics {
    node: ts.Node;
    linesOfCode: number;
    cyclomaticComplexity: number;
}

export class SourceMap {

    private nodesOfLine = new Map<number, SourcePart[]>();
    private positionOfNode = new Map<SourcePart, ts.TextRange>();
    private nodeLocations = new IntervalTree<DataInterval<SourcePart>>();
    private mergedComments: SourceComment[];
    private functionsAndMethods: INodeMetrics[] = [];
    private nodeComplexities = new Map<ts.Node, number>();

    constructor(private sourceFile: ts.SourceFile) {
        const addNodeToMap = (nodeOrComment: SourcePart) => {
            if (this.isNode(nodeOrComment)) {
                this.nodeLocations.insert({
                    low: (nodeOrComment as ts.Node).getStart(sourceFile) || nodeOrComment.pos,
                    high: nodeOrComment.end,
                    data: nodeOrComment,
                });
                if (ts.isMethodDeclaration(nodeOrComment) || ts.isFunctionDeclaration(nodeOrComment)) {
                    const linesOfCode = nodeOrComment.getText().split("\n").length;
                    this.calculateCyclomaticComplexity(nodeOrComment);
                    const cyclomaticComplexity = this.nodeComplexities.get(nodeOrComment);
                    const metrics = {node: nodeOrComment, linesOfCode, cyclomaticComplexity};
                    this.functionsAndMethods.push(metrics);
                }
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

    // based on: https://github.com/palantir/tslint/blob/master/src/rules/cyclomaticComplexityRule.ts
    private calculateCyclomaticComplexity(node: ts.Node) {
        let complexity = 0;
        const self = this;
        const calculate = (child: ts.Node): void => {
            const scopeBoundary = TSUtils.isScopeBoundary(child);
            if (scopeBoundary === TSUtils.ScopeBoundary.Block || scopeBoundary === TSUtils.ScopeBoundary.Function) {
                const old = complexity;
                complexity = 1;
                child.forEachChild(calculate);
                self.nodeComplexities.set(child, complexity);
                complexity = old;
            } else {
                if (self.isIncreasingCC(child)) {
                    complexity++;
                }
                return child.forEachChild(calculate);
            }
        };
        return calculate(node);
    }

    private isIncreasingCC(node: ts.Node): boolean {
        if (node.kind === ts.SyntaxKind.CaseClause) {
            return (node as ts.CaseClause).statements.length > 0;
        }
        if (node.kind === ts.SyntaxKind.BinaryExpression) {
            const operatorKind = (node as ts.BinaryExpression).operatorToken.kind;
            return operatorKind === ts.SyntaxKind.BarBarToken ||
                    operatorKind === ts.SyntaxKind.AmpersandAmpersandToken;
        }
        return node.kind === ts.SyntaxKind.CatchClause ||
            node.kind === ts.SyntaxKind.ConditionalExpression ||
            node.kind === ts.SyntaxKind.DoStatement ||
            node.kind === ts.SyntaxKind.ForStatement ||
            node.kind === ts.SyntaxKind.ForInStatement ||
            node.kind === ts.SyntaxKind.ForOfStatement ||
            node.kind === ts.SyntaxKind.IfStatement ||
            node.kind === ts.SyntaxKind.WhileStatement;
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
        }, sourceFile);
        return result;
    }

}
