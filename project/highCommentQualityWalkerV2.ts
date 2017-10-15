import * as Lint from "tslint";
import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { PriorityQueue } from "typescript-collections";
import { CodeDetector } from "./codeDetector";
import { ICommentClassification } from "./commentClassificationTypes";
import { CommentClassifier } from "./commentClassifier";
import { CommentQuality, CommentQualityEvaluator } from "./commentQualityEvaluator";
// tslint:disable-next-line:max-line-length
import { CyclomaticComplexityCollector, HalsteadCollector, LinesOfCodeCollector, NestingLevelCollector } from "./metricCollectors";
import { CommentClass, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";
import Utils from "./utils";

interface ICommentStatistics {
    quality: CommentQuality;
    classifications: ICommentClassification[];
}

interface ILineComplexity {
    line: number;
    complexity: number;
}

interface IAnalysisResult {
    complexity: number;
    expressionNestingDepth: number;
}

export class HighCommentQualityWalkerV2<T> extends Lint.AbstractWalker<T> {

    public static sectionComplexityThreshold = 7;
    public static nodeTotalComplexityThreshold = 5;
    public static lineComplexityThreshold = 3;

    private sourceMap: SourceMap;
    private commentClassifier: CommentClassifier;
    private commentQualityEvaluator: CommentQualityEvaluator;
    private commentStats = new Map<SourceComment, ICommentStatistics>();
    private requiredCommentLines = new Map<number, string[]>();
    private nodeComplexities = new Map<ts.Node, number>();
    // section start and end are line numbers, not positions in the text
    private sections = new Map<ts.FunctionLikeDeclaration, ts.TextRange[]>();

    constructor(sourceFile: ts.SourceFile, ruleName: string, options: T,
                private locCollector: LinesOfCodeCollector,
                private ccCollector: CyclomaticComplexityCollector,
                private codeDetector: CodeDetector) {
        super(sourceFile, ruleName, options);
        this.sourceMap = new SourceMap(sourceFile, [locCollector, ccCollector]);
        this.commentQualityEvaluator = new CommentQualityEvaluator();
        this.commentClassifier = new CommentClassifier(codeDetector, this.sourceMap);
    }

    public walk(sourceFile: ts.SourceFile) {
        if (sourceFile !== this.sourceFile) {
            throw new Error("Source file not equal to the one used for construction!");
        }
        this.classifyComments();

        this.sourceMap.getAllFunctionLikes().forEach((node) => {
            if (!this.nodeComplexities.has(node)) {
                this.analyze(node);
                this.addCommentRequirements(node);
            }
        });
        this.addFailuresForCommentRequirements();
    }

    private classifyComments() {
        this.sourceMap.getAllComments().forEach((comment) => {
            const classifications = this.commentClassifier.classify(comment);
            const quality = this.commentQualityEvaluator.evaluateQuality(comment, classifications, this.sourceMap);
            this.commentStats.set(comment, {classifications, quality});
            classifications.forEach( (classification, index) => {
                if (classification.commentClass === CommentClass.Code) {
                    this.addFailureForClassification(comment, classification);
                }
            });
            if (quality <= CommentQuality.Low) {
                const end = this.sourceFile.getLineEndOfPosition(comment.pos);
                this.addFailure(comment.pos, end, "Low comment quality: " + CommentQuality[quality]);
            }
        });
        // TODO: smooth license comment classifications (add classification to comments between 2 license comments)
    }

    private analyze(node?: ts.Node): IAnalysisResult {
        if (!node) { return {complexity: 0, expressionNestingDepth: 0}; }
        let complexity = 0;
        // calculate complexity of current line
        // get complexities of children
        // add to complexity of line
        if (ts.isIterationStatement(node, false)) {
            return {complexity: this.analyzeIterationStatement(node), expressionNestingDepth: 0};
        }
        if (ts.isIfStatement(node)) {
            return {complexity: this.analyzeIfStatement(node), expressionNestingDepth: 0};
        }
        if (ts.isBlock(node)) {
            const cyclomaticComplexity = this.ccCollector.getComplexity(node);
            if (cyclomaticComplexity) {
                complexity += cyclomaticComplexity;
            }
            complexity += this.getLocForNode(node) / 2;
        }
        let maxChildExpressionNestingDepth = 0;
        node.forEachChild((child) => {
            const childComplexity = this.analyze(child);
            maxChildExpressionNestingDepth = Math.max(maxChildExpressionNestingDepth,
                                                      childComplexity.expressionNestingDepth);
            complexity += childComplexity.complexity;
        });
        if (ts.isCallLikeExpression(node) || ts.isBinaryExpression(node) ||
                ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression (node)) {
            complexity += 0.5 * Math.pow(2, maxChildExpressionNestingDepth);
            maxChildExpressionNestingDepth++;
        } else {
            maxChildExpressionNestingDepth = 0;
        }
        // if (Utils.isDeclaration(node) || Utils.isStatement(node) || ts.isFunctionLike(node)) {
        this.nodeComplexities.set(node, complexity);
        // }
        return {complexity, expressionNestingDepth: maxChildExpressionNestingDepth};
    }

    private getLocForNode(node: ts.Node): number {
        if (ts.isIfStatement(node.parent)) {
            let locComplexity: number;
            if (node.parent.thenStatement === node) {
                locComplexity = this.locCollector.getLoc(node.parent);
            } else {
                const elseKeyword = node.parent.getChildren().find((child) => {
                    return child.kind === ts.SyntaxKind.ElseKeyword;
                });
                locComplexity = this.locCollector.getLoc(elseKeyword);
            }
            return locComplexity;
        }
        if (ts.isBlock(node)) {
            const locComplexity = this.locCollector.getLoc(node.parent);
            return locComplexity;
        }
        return 1;
    }

    private analyzeIterationStatement(node: ts.IterationStatement): number {
        const statementComplexity = this.analyze(node.statement).complexity;
        let conditionComplexity = 0;
        if (ts.isForInStatement(node) || ts.isForOfStatement(node)) {
            conditionComplexity = this.analyze(node.expression).complexity
                    + this.analyze(node.initializer).complexity;
        } else if (ts.isWhileStatement(node) || ts.isDoStatement(node)) {
            conditionComplexity = this.analyze(node.expression).complexity;
        } else if (ts.isForStatement(node)) {
            conditionComplexity = this.analyze(node.initializer).complexity
                    + this.analyze(node.condition).complexity
                    + this.analyze(node.incrementor).complexity;
        }
        const totalComplexity = statementComplexity + conditionComplexity;
        this.nodeComplexities.set(node, totalComplexity);
        return totalComplexity;
    }

    private analyzeIfStatement(node: ts.IfStatement): number {
        const thenComplexity = this.analyze(node.thenStatement).complexity;
        const elseComplexity = this.analyze(node.elseStatement).complexity;
        const conditionComplexity = this.analyze(node.expression).complexity;
        const children = node.getChildren();
        const ifKeyword = children.find((child) => child.kind === ts.SyntaxKind.IfKeyword);
        if (elseComplexity > 0) {
            const elseKeyword = children.find((child) => child.kind === ts.SyntaxKind.ElseKeyword);
            this.nodeComplexities.set(elseKeyword, elseComplexity);
        }
        const ifComplexity = thenComplexity + conditionComplexity;
        this.nodeComplexities.set(ifKeyword, ifComplexity);
        return ifComplexity;
    }

    private addFailureForClassification(comment: SourceComment, classification: ICommentClassification) {
        const failureMessage = this.getFailureMessage(classification.commentClass);
        if (classification.lines === undefined) {
            const pos = comment.pos;
            const end = comment.end;
            this.addFailure(pos, end, failureMessage);
        } else {
            classification.lines.forEach( (lineNumber) => {
                this.addFailure(comment.getPosOfLine(lineNumber),
                                comment.getEndOfLine(lineNumber),
                                failureMessage);
            });
        }
    }

    private getFailureMessage(commentClass: CommentClass): string | undefined {
        switch (commentClass) {
            case CommentClass.Code: return "Code should not be part of a comment!";
            default: return;
        }
    }

    private addCommentRequirements(node: ts.FunctionLikeDeclaration) {
        const startLine = this.sourceMap.sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const endLine = this.sourceMap.sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        let sectionComplexity = 0.0;
        let totalComplexity = 0.0;
        let currentSectionStartLine = -1;
        const sortDescending = (a: ILineComplexity, b: ILineComplexity): number => {
            return a.complexity - b.complexity;
        };
        const lineComplexities = new PriorityQueue<ILineComplexity>(sortDescending);
        const sectionComplexities = new PriorityQueue<ILineComplexity>(sortDescending);
        const nodeLines = node.getText().split("\n");
        let previousLineWasCommentOnly = false;

        for (let currentLine = startLine + 1; currentLine < endLine; ++currentLine) {
            const commentsInLine = this.sourceMap.getCommentsInLine(currentLine);
            const enclosingNode = this.sourceMap.getMostEnclosingNodeForLine(currentLine);
            const currentLineText = nodeLines[currentLine - startLine];
            const noContentRegexp = /^\s*$/;
            if (currentSectionStartLine === -1) {
                currentSectionStartLine = currentLine;
            }

            // No code in the current line, except for opening / closing braces
            if (!enclosingNode) {
                // Only comments in the current line
                if (commentsInLine.length > 0 && !previousLineWasCommentOnly) {
                    previousLineWasCommentOnly = true;
                    continue;
                }
                // if (noContentRegexp.test(currentLineText) || commentsInLine.length > 0) {
                // TODO: this is just here for live-feedback purposes
                const failureStart = this.sourceMap.sourceFile.getPositionOfLineAndCharacter(currentSectionStartLine, 0);
                this.addFailureAt(failureStart, 1, "sectionComplexity: " + sectionComplexity);
                // start a new section
                if (sectionComplexity > 0) {
                    this.enforceCommentRequirementForSection(sectionComplexity,
                                                             HighCommentQualityWalkerV2.sectionComplexityThreshold,
                                                             currentSectionStartLine,
                                                             lineComplexities,
                                                             HighCommentQualityWalkerV2.lineComplexityThreshold);
                    sectionComplexities.add({line: currentSectionStartLine, complexity: sectionComplexity});
                    sectionComplexity = 0;
                }
                currentSectionStartLine = -1;
                lineComplexities.clear();
                // }
                continue;
            }
            previousLineWasCommentOnly = false;

            const lineOfCurrentNode =
                    this.sourceFile.getLineAndCharacterOfPosition(enclosingNode.getStart()).line;
            if (lineOfCurrentNode !== currentLine) { continue; }
            const lineComplexity = this.getComplexityForNodesInLine(enclosingNode);
            sectionComplexity += lineComplexity;
            totalComplexity += lineComplexity;

            lineComplexities.add({line: currentLine, complexity: lineComplexity});
        }
        // enforce section complexity for last section
        if (sectionComplexity > 0) {
            this.enforceCommentRequirementForSection(sectionComplexity,
                                                     HighCommentQualityWalkerV2.sectionComplexityThreshold,
                                                     currentSectionStartLine,
                                                     lineComplexities,
                                                     HighCommentQualityWalkerV2.lineComplexityThreshold);
        }
        if (totalComplexity > HighCommentQualityWalkerV2.nodeTotalComplexityThreshold) {
            this.enforceCommentRequirementForSection(totalComplexity,
                                                     HighCommentQualityWalkerV2.nodeTotalComplexityThreshold,
                                                     startLine,
                                                     sectionComplexities,
                                                    HighCommentQualityWalkerV2.sectionComplexityThreshold);
        }
    }

    private getComplexityForNodesInLine(enclosingNode: ts.Node): number {
        let complexity = this.nodeComplexities.get(enclosingNode);
        if (complexity) {
            return complexity;
        }
        const children = enclosingNode.getChildren();
        for (const key in children) {
            if (children.hasOwnProperty(key)) {
                const child = children[key];
                complexity = this.getComplexityForNodesInLine(child);
                if (complexity) {
                    return complexity;
                }
            }
        }
        return 0;
    }

    private enforceCommentRequirementForSection(complexity: number, threshold: number, sectionStartLine: number,
                                                lineComplexities: PriorityQueue<ILineComplexity>,
                                                lineThreshold: number) {
        if (complexity > threshold) {
            if (!this.requireCommentForLine(sectionStartLine, this.sourceMap, "sectionstart: " + complexity)) {
                const findCommentRequirementLocation = (): boolean => {
                    const highestComplexity = lineComplexities.dequeue();
                    if (!highestComplexity || highestComplexity.complexity < lineThreshold) {
                        return true;
                    }
                    const reason = "most complex: " + highestComplexity.complexity + " - total: " + complexity;
                    return this.requireCommentForLine(highestComplexity.line, this.sourceMap, reason);
                };
                // tslint:disable-next-line:no-empty
                while (!findCommentRequirementLocation()) {}
            }
            return true;
        }
        return false;
    }

    /**
     * Add a failure to the given line if it doesn't have a meaningful comment yet.
     * @param line The line that should be commented
     * @param sourceMap The SourceMap in which the line is located
     * @param failureMessage An optional message to be used upon failure
     * @returns {boolean} true if a failure has been added, false if this line already has a comment
     */
    private requireCommentForLine(line: number, sourceMap: SourceMap, failureMessage?: string): boolean {
        // TODO: don't add another requirement instead of using an array if already present
        const enclosingNode = sourceMap.getMostEnclosingNodeForLine(line);
        if (!enclosingNode) {
            return false;
        }
        line = sourceMap.sourceFile.getLineAndCharacterOfPosition(enclosingNode.getStart()).line;
        const nearestComments = sourceMap.getCommentsWithDistanceClosestToLine(line);
        const commentStats = this.commentStats;
        let qualityCommentPresent = nearestComments.some((commentDistance) => {
            const stats = commentStats.get(commentDistance.comment);
            const isAnnotation = (classification: ICommentClassification) => {
                return classification.commentClass === CommentClass.Annotation && !classification.lines;
            };
            if (stats.classifications.some(isAnnotation)) { return false; }
            return stats.quality > CommentQuality.Low &&
                commentDistance.distance <= stats.quality - CommentQuality.Low + 1;
        });

        // second attempt: use parents ot get the distance to comments
        if (!ts.isFunctionLike(enclosingNode)) {
            let parentDepth = 0;
            let comments = sourceMap.getCommentsBelongingToNode(enclosingNode);
            let parentNode = enclosingNode;
            while (comments.length === 0 && parentNode && !this.isFunctionOrMethod(parentNode)) {
                parentNode = sourceMap.getNextEnclosingParentForNode(parentNode);
                if (!parentNode) { break; }
                comments = sourceMap.getCommentsBelongingToNode(parentNode);
                parentDepth++;
            }
            if (comments && parentDepth < 3 && !qualityCommentPresent) {
                qualityCommentPresent = comments.some((comment) => {
                    const stats = commentStats.get(comment);
                    const isAnnotation = (classification: ICommentClassification) => {
                        return classification.commentClass === CommentClass.Annotation && !classification.lines;
                    };
                    if (stats.classifications.some(isAnnotation)) { return false; }
                    return stats.quality > CommentQuality.Low;
                });
            }
        }

        if (!qualityCommentPresent) {
            failureMessage = failureMessage || "This line should be commented";
            if (this.requiredCommentLines.has(line)) {
                this.requiredCommentLines.get(line).push(failureMessage);
                // TODO: this is here to allow multiple requirements per line during development
                // but also force the rest of the code to search for additional lines that should have comments
                return false;
            } else {
                this.requiredCommentLines.set(line, [failureMessage]);
            }
            return true;
        }
        return false;
    }

    // FunctionLikes that have been defined with corresponding keywords, as opposed to ArrowFunctions.
    private isFunctionOrMethod(node: ts.Node): boolean {
        return ts.isFunctionDeclaration(node) && ts.isMethodDeclaration(node);
    }

    private addFailuresForCommentRequirements() {
        this.requiredCommentLines.forEach((reasons, line) => {
            const node = this.sourceMap.getMostEnclosingNodeForLine(line);
            // Skip adding failures for comment requirements if the line above
            // (i.e., the line, where the previous enclosing node starts) also has a comment requirement.
            const previousNode = this.sourceMap.getSourcePartBefore(node);
            if (previousNode) {
                let previousLine =
                        this.sourceMap.sourceFile.getLineAndCharacterOfPosition(previousNode.getStart()).line;
                const previousEnclosingNode = this.sourceMap.getMostEnclosingNodeForLine(previousLine);
                if (previousEnclosingNode) {
                    const enclosingStart = previousEnclosingNode.getStart();
                    previousLine = this.sourceMap.sourceFile.getLineAndCharacterOfPosition(enclosingStart).line;
                    if (this.requiredCommentLines.has(previousLine)) {
                        return;
                    }
                }
            }
            const end = this.sourceMap.sourceFile.getLineEndOfPosition(node.getStart());
            reasons.forEach( (reason) => {
                this.addFailure(node.getStart(), end, reason);
            });
        });
    }

}
