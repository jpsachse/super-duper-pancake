import { Interval, IntervalTree } from "node-interval-tree";
import * as Lint from "tslint";
import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { PriorityQueue } from "typescript-collections";
import { CodeDetector } from "./codeDetector";
import { ICommentClassification } from "./commentClassificationTypes";
import { CommentClassifier } from "./commentClassifier";
import { CommentQuality, CommentQualityEvaluator, EvaluationResult } from "./commentQualityEvaluator";
// tslint:disable-next-line:max-line-length
import { CyclomaticComplexityCollector, HalsteadCollector, LinesOfCodeCollector, NestingLevelCollector } from "./metricCollectors";
import { CommentClass, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";
import Utils from "./utils";

interface ICommentStatistics {
    qualityEvaluation: EvaluationResult;
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

    public static sectionComplexityThreshold = 10;
    public static nodeTotalComplexityThreshold = 20;
    public static lineComplexityThreshold = 5;

    private sourceMap: SourceMap;
    private commentClassifier: CommentClassifier;
    private commentQualityEvaluator: CommentQualityEvaluator;
    private commentStats = new Map<SourceComment, ICommentStatistics>();
    private requiredCommentLines = new Map<number, string[]>();
    private nodeComplexities = new Map<ts.Node, number>();
    private sections = new IntervalTree<Interval>();
    private nestingLevelCollector = new NestingLevelCollector();

    constructor(sourceFile: ts.SourceFile, ruleName: string, options: T,
                private locCollector: LinesOfCodeCollector,
                private ccCollector: CyclomaticComplexityCollector,
                private codeDetector: CodeDetector) {
        super(sourceFile, ruleName, options);
        this.sourceMap = new SourceMap(sourceFile, [locCollector, ccCollector, this.nestingLevelCollector]);
        this.commentQualityEvaluator = new CommentQualityEvaluator();
        this.commentClassifier = new CommentClassifier(codeDetector, this.sourceMap);
    }

    public walk(sourceFile: ts.SourceFile) {
        if (sourceFile !== this.sourceFile) {
            throw new Error("Source file not equal to the one used for construction!");
        }
        this.findSections();
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
        const closestToComment = (a: Interval, b: Interval): number => {
            const bigger = b.low - a.low;
            if (bigger !== 0) {
                return bigger;
            }
            return (b.high - b.low) - (a.high - a.low);
        };

        this.sourceMap.getAllComments().forEach((comment) => {
            const commentEndLine = this.sourceFile.getLineAndCharacterOfPosition(comment.end).line;
            let possibleSections = this.sections.search(commentEndLine + 1, commentEndLine + 1);
            possibleSections = possibleSections.sort(closestToComment);
            const sectionEndLine = possibleSections.length > 0 ? possibleSections[0].high : commentEndLine;
            const classifications = this.commentClassifier.classify(comment);
            const evaluationResult = this.commentQualityEvaluator.evaluateQuality(comment,
                                                                                  classifications,
                                                                                  this.sourceMap,
                                                                                  sectionEndLine);
            this.commentStats.set(comment, {classifications, qualityEvaluation: evaluationResult});
            classifications.forEach( (classification, index) => {
                if (classification.commentClass === CommentClass.Code) {
                    this.addFailureForClassification(comment, classification);
                }
            });
            if (evaluationResult.quality <= CommentQuality.Low && evaluationResult.quality !== CommentQuality.Unknown) {
                const end = this.sourceFile.getLineEndOfPosition(comment.pos);
                const reasoning = evaluationResult.reasons.join("\n");
                let failureMessage = "Low comment quality: " + CommentQuality[evaluationResult.quality];
                if (reasoning.length > 0) {
                    failureMessage += "\n" + reasoning;
                }
                this.addFailure(comment.pos, end, failureMessage);
            }
        });
        // TODO: smooth license comment classifications (add classification to comments between 2 license comments)
    }

    /**
     * Filters lines of a code classification that lie within a context where code is allowed in a comment.
     * This includes lines that are escaped with ``` and code that is placed in the example JSDoc tag.
     * @param classification A code classification including a list of lines that are code.
     * @param comment The comment that has been classified to contain code.
     */
    private getUnescapedCodeLines(classification: ICommentClassification, comment: SourceComment): number[] {
        if (!classification.lines || classification.commentClass !== CommentClass.Code) {
            throw new Error("Need code classification with classification lines to filter!");
        }
        const unacceptableLines = classification.lines.slice(0);
        const commentLines = comment.getSanitizedCommentLines();
        const sanitizedComment = comment.getSanitizedCommentText();
        const jsDocs = sanitizedComment.jsDoc;
        let currentIndex = 0;
        jsDocs.forEach((jsDoc: ts.JSDoc) => {
            while (currentIndex < unacceptableLines.length) {
                const codeLine = commentLines[unacceptableLines[currentIndex]];
                const codePos = codeLine.pos - jsDoc.pos;
                // We can't use jsDoc.end, as that includes all children and we want to know,
                // where the overview text ends.
                const commentEnd = jsDoc.getChildCount(this.sourceFile) > 0 ?
                        jsDoc.getChildAt(0, this.sourceFile).pos - 1 : jsDoc.end;
                if (this.isEscapedCode(codeLine.text, jsDoc.getFullText(), commentEnd - jsDoc.pos, codePos)) {
                    unacceptableLines.splice(currentIndex, 1);
                } else {
                    currentIndex++;
                }
            }
            const commentStartLine = this.sourceFile.getLineAndCharacterOfPosition(jsDoc.pos).line;
            jsDoc.forEachChild((childTag: ts.Node) => {
                currentIndex = 0;
                if (!Utils.isJSDocTag(childTag)) {
                    return;
                }
                const tagLabel =  childTag.getFullText();
                let tagCommentLines = childTag.comment.split("\n");
                // On Windows, multiline descriptions of parameters in JSDoc comments are not using
                // \r\n, but only \r.
                if (tagCommentLines.length === 1) {
                    tagCommentLines = childTag.comment.split("\r");
                }
                const tagCommentPos = childTag.pos + tagLabel.length;
                const tagCommentStartLine = this.sourceFile.getLineAndCharacterOfPosition(tagCommentPos).line;
                const tagCommentStartLineInJsdoc = tagCommentStartLine - commentStartLine;
                // TODO: test this.
                // -1, as the first line of tagCommentLines is in the same line, as the end of the tag label
                const tagCommentEndLineInJsdoc = tagCommentStartLineInJsdoc + tagCommentLines.length - 1;
                while (currentIndex < unacceptableLines.length) {
                    const codeLineInJsdoc = unacceptableLines[currentIndex];
                    if (tagCommentStartLineInJsdoc > codeLineInJsdoc || tagCommentEndLineInJsdoc < codeLineInJsdoc) {
                        currentIndex++;
                        continue;
                    }
                    const codeLineInTagComment = codeLineInJsdoc - tagCommentStartLineInJsdoc;
                    const codeLineText = tagCommentLines[codeLineInTagComment];
                    let codePos = 0;
                    for (let i = 0; i < codeLineInTagComment; ++i) {
                        codePos += tagCommentLines[i].length + 1;
                    }
                    if (childTag.tagName.text === "example") {
                        unacceptableLines.splice(currentIndex, 1);
                    } else if (this.isEscapedCode(codeLineText, childTag.comment, childTag.comment.length, codePos)) {
                        unacceptableLines.splice(currentIndex, 1);
                    } else {
                        currentIndex++;
                    }
                }
            });
        });
        if (jsDocs.length === 0) {
            currentIndex = 0;
            const commentText = sanitizedComment.text;
            while (currentIndex < unacceptableLines.length) {
                const codeLineNumber = unacceptableLines[currentIndex];
                const codePos = commentLines[codeLineNumber].relativePos;
                const commentWidth = comment.end - comment.pos;
                if (this.isEscapedCode(commentLines[codeLineNumber].text, commentText, commentWidth, codePos)) {
                    unacceptableLines.splice(currentIndex, 1);
                } else {
                    currentIndex++;
                }
            }
        }
        return unacceptableLines;
    }

    /**
     * Checks, whether a given part of text that has been classified as comment is escaped using three accents graves.
     * @param codeText The text that has been classified as code.
     * @param commentText The complete comment text.
     * @param commentEnd The width of the comment, which might be different from commentText.length,
     * as windows newlines get stripped in SourceComments.
     * @param codePosition The position in the comment, where the codeText begins,
     * relative to the comment start being 0.
     */
    private isEscapedCode(codeText: string, commentText: string, commentEnd: number, codePosition: number): boolean {
        if (codePosition < 0 || codePosition > commentEnd) { return false; }
        const acceptableRegex = /[``]{3,}[^``]*[``]{3,}/g;
        let match = acceptableRegex.exec(commentText);
        // Iterate over all escaped comment parts to see, whether the code actually lies in one.
        while (match) {
            const matchText = match.toString();
            if (match.index > codePosition) {
                return false;
            }
            const matchEnd = match.index + matchText.length;
            const codeEnd = codePosition + codeText.length;
            if (matchText.includes(codeText) && matchEnd >= codeEnd) { return true; }
            match = acceptableRegex.exec(commentText);
        }
        return false;
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
                ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
            complexity += 0.4 * Math.pow(2, maxChildExpressionNestingDepth);
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
            const lines = this.getUnescapedCodeLines(classification, comment);
            lines.forEach( (lineNumber) => {
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

    /**
     * Searches linearly through the source file to find a line that can be used to determine the nesting
     * level of startLine.
     * @param startLine The line the next available nesting level should be found for.
     * @param summand The summand to be added to the line each time no nesting level could be determined.
     * @param maxLine The threshold up (or down, if the summand is negative) to which the summand
     * gets added to the startline.
     */
    private findNextAvailableNestingLevel(startLine: number, summand: number, maxLine: number): number | undefined {
        if (summand === 0) { return undefined; }
        let line = startLine + summand;
        let node = this.sourceMap.getMostEnclosingNodeForLine(line) || this.sourceMap.getFirstNodeInLine(line);
        // Iterate over lines up or down to maxLine, until a nesting level is determined
        while (((line <= maxLine && summand > 0) || (line >= maxLine && summand < 0)) &&
                (!node || !this.nestingLevelCollector.getNestingLevel(node))) {
            line += summand;
            node = this.sourceMap.getMostEnclosingNodeForLine(line);
        }
        return this.nestingLevelCollector.getNestingLevel(node);
    }

    private findSections() {
        const functions = this.sourceMap.getAllFunctionLikes();
        functions.forEach( (functionLike) => {
            const functionStartLine = this.sourceFile.getLineAndCharacterOfPosition(functionLike.getStart()).line;
            const functionEndLine =  this.sourceFile.getLineAndCharacterOfPosition(functionLike.end).line;
            const eligibleSections = this.sections.search(functionStartLine, functionStartLine);
            if (eligibleSections.length > 0 &&
                    eligibleSections[0].low <= functionStartLine &&
                    eligibleSections[0].high >= functionEndLine) {
                return;
            }
            const findSectionInSection = (startLine: number, nestingLevel: number): number => {
                let previousLineWasCommentOnly = false;
                let currentSectionStartLine = startLine;
                let currentSectionEndLine = startLine;
                for (let currentLine = startLine; currentLine <= functionEndLine; currentLine++) {
                    const commentsInLine = this.sourceMap.getCommentsInLine(currentLine);
                    const enclosingNode = this.sourceMap.getMostEnclosingNodeForLine(currentLine);
                    const firstNodeInLine = this.sourceMap.getFirstNodeInLine(currentLine);
                    const usableNode = enclosingNode || firstNodeInLine;
                    let currentNestingLevel = this.nestingLevelCollector.getNestingLevel(usableNode);
                    if (!usableNode) {
                        // Only comments in the current line
                        if (commentsInLine.length > 0 && !previousLineWasCommentOnly) {
                            previousLineWasCommentOnly = true;
                            continue;
                        }
                        const nextNestingLevel = this.findNextAvailableNestingLevel(currentLine, +1, functionEndLine);
                        if (nestingLevel === nextNestingLevel) {
                            if (currentSectionStartLine > -1) {
                                this.sections.insert({low: currentSectionStartLine, high: currentSectionEndLine});
                            }
                            currentSectionStartLine = -1;
                            continue;
                        }
                        currentNestingLevel = Math.min(nestingLevel, nextNestingLevel);
                    }
                    if (currentSectionStartLine === -1) {
                        // TODO: get the correct starting line, as this might be one (or several) lines too far
                        currentSectionStartLine = currentLine;
                    }

                    previousLineWasCommentOnly = !usableNode && commentsInLine.length > 0;
                    if (currentNestingLevel > nestingLevel) {
                        currentLine = findSectionInSection(currentLine, currentNestingLevel);
                        currentSectionEndLine = currentLine;
                        continue;
                    } else if (currentNestingLevel < nestingLevel) {
                        // This only happens if nesting level gets decreased after an empty line.
                        // Then, this function has not yet correclty returned out of the recursion.
                        if (currentSectionEndLine < currentSectionStartLine) {
                            // Force-return out of the recursion with the line above (for loop increases by 1)
                            return currentLine - 2;
                        }
                        this.sections.insert({low: currentSectionStartLine, high: currentSectionEndLine});
                        return currentSectionEndLine;
                    }
                    currentSectionEndLine = currentLine;
                }
                if (currentSectionStartLine > -1) {
                    this.sections.insert({low: currentSectionStartLine, high: functionEndLine});
                }
                return functionEndLine;
            };
            const startingNestingLevel = this.nestingLevelCollector.getNestingLevel(functionLike);
            findSectionInSection(functionStartLine, startingNestingLevel);
        });
    }

    private addCommentRequirements(node: ts.FunctionLikeDeclaration) {
        const startLine = this.sourceMap.sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const endLine = this.sourceMap.sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        let totalComplexity = 0.0;
        const sortDescending = (a: ILineComplexity, b: ILineComplexity): number => {
            return a.complexity - b.complexity;
        };
        const sectionComplexities = new PriorityQueue<ILineComplexity>(sortDescending);
        const smallestFirstByAscLocation = (a: Interval, b: Interval) => {
            const sizeA = a.high - a.low;
            const sizeB = b.high - b.low;
            if (sizeA === sizeB) { return a.low - b.low; }
            return sizeA - sizeB;
        };
        const sections = this.sections.search(startLine, endLine);
        sections.sort(smallestFirstByAscLocation);

        sections.forEach((section) => {
            let sectionComplexity = 0.0;
            const lineComplexities = new PriorityQueue<ILineComplexity>(sortDescending);
            for (let currentLine = section.low; currentLine < section.high; currentLine++) {
                const enclosingNode = this.sourceMap.getMostEnclosingNodeForLine(currentLine);
                // An empty line or a comment
                if (!enclosingNode) { continue; }
                const lineOfCurrentNode =
                        this.sourceFile.getLineAndCharacterOfPosition(enclosingNode.getStart()).line;
                if (lineOfCurrentNode !== currentLine) { continue; }
                const lineComplexity = this.getComplexityForNode(enclosingNode);
                sectionComplexity += lineComplexity;
                totalComplexity += lineComplexity;
                lineComplexities.add({line: currentLine, complexity: lineComplexity});
            }
            if (sectionComplexity > 0) {
                this.enforceCommentRequirementForSection(sectionComplexity,
                                                         HighCommentQualityWalkerV2.sectionComplexityThreshold,
                                                         section,
                                                         lineComplexities,
                                                         HighCommentQualityWalkerV2.lineComplexityThreshold);
                sectionComplexities.add({line: section.low, complexity: sectionComplexity});
            }
        });
        if (totalComplexity > HighCommentQualityWalkerV2.nodeTotalComplexityThreshold) {
            this.enforceCommentRequirementForSection(totalComplexity,
                                                     HighCommentQualityWalkerV2.nodeTotalComplexityThreshold,
                                                     sections[sections.length - 1],
                                                     sectionComplexities,
                                                     HighCommentQualityWalkerV2.sectionComplexityThreshold);
        }
    }

    /**
     * Searches for precalculated complexity measures for the given node. If none can be found,
     * the search is continued on its childrend. If again none can be found, 0 is returned.
     * @param enclosingNode The node whose complexity is requested.
     */
    private getComplexityForNode(enclosingNode: ts.Node): number {
        let complexity = this.nodeComplexities.get(enclosingNode);
        if (complexity) {
            return complexity;
        }
        // Search for calculated complexities in the children of the given node.
        const children = enclosingNode.getChildren();
        for (const key in children) {
            if (children.hasOwnProperty(key)) {
                const child = children[key];
                complexity = this.getComplexityForNode(child);
                if (complexity) {
                    return complexity;
                }
            }
        }
        return 0;
    }

    /**
     * Adds comment requirements to a part of code. Returns true, if a comment requirement has been added.
     * @param complexity The accumulated complexity of the section.
     * @param threshold The maximum complexity value that is allowed before a comment is required.
     * @param section The interval of the section that should be checked.
     * @param lineComplexities Complexities for the next smaller unit (lines for sections, sections for functions).
     * @param lineThreshold The maximum complexity value for lines that is allowed before a comment is required.
     */
    private enforceCommentRequirementForSection(complexity: number, threshold: number, section: Interval,
                                                lineComplexities: PriorityQueue<ILineComplexity>,
                                                lineThreshold: number) {
        if (complexity < threshold) {
            return false;
        }
        if (!this.requireCommentForLine(section.low, this.sourceMap, "sectionstart: " + complexity + " - (" + section.low + "-" + section.high + ")")) {
            const findCommentRequirementLocation = (): boolean => {
                const highestComplexity = lineComplexities.dequeue();
                if (!highestComplexity || highestComplexity.complexity < lineThreshold) {
                    return true;
                }
                const reason = "most complex: " + highestComplexity.complexity + " - total: " + complexity + " - (" + section.low + "-" + section.high + ")";
                return this.requireCommentForLine(highestComplexity.line, this.sourceMap, reason);
            };
            // tslint:disable-next-line:no-empty
            while (!findCommentRequirementLocation()) {}
        }
        return true;
    }

    /**
     * Requires a comment at the given line if it doesn't have a meaningful comment yet.
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
        // Try to find comments that are (spatially) close to the line that requires a comment
        line = sourceMap.sourceFile.getLineAndCharacterOfPosition(enclosingNode.getStart()).line;
        const nearestComments = sourceMap.getCommentsWithDistanceClosestToLine(line);
        const commentStats = this.commentStats;
        let qualityCommentPresent = nearestComments.some((commentDistance) => {
            const stats = commentStats.get(commentDistance.comment);
            const isAnnotation = (classification: ICommentClassification) => {
                return classification.commentClass === CommentClass.Annotation && !classification.lines;
            };
            if (stats.classifications.some(isAnnotation)) { return false; }
            const quality = stats.qualityEvaluation.quality;
            return quality > CommentQuality.Low && quality !== CommentQuality.Unknown &&
                    commentDistance.distance <= quality - CommentQuality.Low + 1;
        });

        // Try to find comments that are close in terms of nesting-level
        if (!ts.isFunctionLike(enclosingNode)) {
            let parentDepth = 0;
            let comments = sourceMap.getCommentsBelongingToNode(enclosingNode);
            let parentNode = sourceMap.getNextEnclosingParentForNode(enclosingNode) || enclosingNode;
            while (comments.length === 0 && parentNode && !this.isFunctionOrMethodPart(parentNode)) {
                comments = sourceMap.getCommentsBelongingToNode(parentNode);
                parentNode = sourceMap.getNextEnclosingParentForNode(parentNode);
                parentDepth++;
            }
            if (comments && parentDepth < 3 && !qualityCommentPresent) {
                qualityCommentPresent = comments.some((comment) => {
                    const stats = commentStats.get(comment);
                    const isAnnotation = (classification: ICommentClassification) => {
                        return classification.commentClass === CommentClass.Annotation && !classification.lines;
                    };
                    if (stats.classifications.some(isAnnotation)) { return false; }
                    return stats.qualityEvaluation.quality > CommentQuality.Low;
                });
            }
        }

        // Add a comment if nothing has been found before
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

    /**
     * Tests whether a node is a FunctionLike that has been defined with corresponding keywords,
     * as opposed to ArrowFunctions. Also returns true for the ts.Block-type nodes belonging to these
     * FunctionLikes.
     * @param node The node to be tested.
     */
    private isFunctionOrMethodPart(node: ts.Node): boolean {
        return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
                (ts.isBlock(node) && (ts.isFunctionDeclaration(node.parent) || ts.isMethodDeclaration(node.parent)));
    }

    /**
     * Adds tslint failures for comment requirements. Nodes with requirements, whose parent also has
     * a requirement, are skipped.
     */
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
