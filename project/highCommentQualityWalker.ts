import Stack from "ts-data.stack";
import * as Lint from "tslint";
import * as ts from "typescript";
import { PriorityQueue } from "typescript-collections";
import { CommentsClassifier } from "./commentsClassifier";
import { CustomCodeDetector } from "./customCodeDetector";
import { ExistingRuleBasedCodeDetector } from "./existingRuleBasedCodeDetector";
// tslint:disable-next-line:max-line-length
import { CyclomaticComplexityCollector, HalsteadCollector, LinesOfCodeCollector, NestingLevelCollector } from "./metricCollectors";
import { CommentClass, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";
import { TsCompilerBasedCodeDetector } from "./tsCompilerBasedCodeDetector";
import Utils from "./utils";

interface ICommentGroup {
    pos: number;
    end: number;
    comments: string[];
}

export class HighCommentQualityWalker extends Lint.AbstractWalker<Set<string>> {

    public walk(sourceFile: ts.SourceFile) {
        // this.printForEachChild(sourceFile);
        // this.printGetChildrenForEach(sourceFile);
        const locCollector = new LinesOfCodeCollector();
        const ccCollector = new CyclomaticComplexityCollector();
        const nestingLevelCollector = new NestingLevelCollector();
        const halsteadCollector = new HalsteadCollector();
        const collectors = [ccCollector, halsteadCollector, locCollector, nestingLevelCollector];
        const sourceMap = new SourceMap(sourceFile, collectors);
        // TODO: use this.options() instead of hardcoded string
        // Also: provide an option to choose from different code detection methods
        // const codeDetector = new CustomCodeDetector("./comment-classification-rules/no-code")
        // const ruleDirectory = "./node_modules/tslint/lib/rules";
        // const codeDetector = new ExistingRuleBasedCodeDetector(ruleDirectory);
        const codeDetector = new TsCompilerBasedCodeDetector();
        const classifier = new CommentsClassifier(codeDetector, sourceMap);

        sourceMap.getAllComments().forEach((commentGroup) => {
            classifier.classify(commentGroup);
            commentGroup.classifications.forEach( (classification, index) => {
                switch (classification.commentClass) {
                    case CommentClass.Code: {
                        this.addFailureForClassification(commentGroup, index);
                        break;
                    }
                    case CommentClass.Copyright:
                    case CommentClass.Header:
                        // Now do something amazing with this information, e.g., decide whether this
                        // is a good or bad comment.
                    case CommentClass.Inline:
                        // Now do something amazing with this information, e.g., decide whether this
                        // is a good or bad comment.
                    case CommentClass.Section:
                    case CommentClass.Task:
                    case CommentClass.Unknown:
                    default:
                        break;
                }
            });
        });
        // TODO: don't pass nested functions here, as they will get handled by their parent
        // Alternative: save nodes / lines for which complexity already has been calculated
        sourceMap.getAllFunctionLikes().forEach((node) => {
            this.analyze(node, sourceFile, sourceMap);
        });

        // sourceMap.getAllFunctionLikes().forEach((node) => {
        //     // skip functions within functions, as they are already handled by their parents' calculation
        //     let parent: ts.Node = node;
        //     while (!ts.isClassLike(parent.parent) && !ts.isSourceFile(parent.parent)) {
        //         if (ts.isFunctionLike(parent.parent)) {
        //             return;
        //         }
        //         parent = parent.parent;
        //     }
        //     const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        //     const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        //     let accumulatingComplexityScore = 0;
        //     let totalComplexityScore = 0;
        //     let startLineOfLogicalBlock = -1;
        //     let previousMostComplexLine = -1;
        //     let previousMostComplexScore = 0;
        //     const accumulatedScores = new Stack<number>();
        //     for (let currentLine = startLine + 1; currentLine < endLine; ++currentLine) {
        //         let complexityDelta = 0;
        //         const commentsInLine = sourceMap.getCommentsInLine(currentLine);
        //         const correspondingComments = sourceMap.getCommentsBelongingToLine(currentLine);
        //         const enclosingNode = sourceMap.getMostEnclosingNodeForLine(currentLine);
        //         // use empty lines to subdivide code blocks and reset complexity counters
        //         if (!enclosingNode) {
        //             if (commentsInLine.length === 0) {
        //                 accumulatingComplexityScore = 0;
        //                 startLineOfLogicalBlock = -1;
        //             }
        //             continue;
        //         }
        //         if (startLineOfLogicalBlock === -1) {
        //             startLineOfLogicalBlock = currentLine;
        //         }
        //         // Lines of code. Let's use 7 as magical border for increasing complexity harder than before
        //         complexityDelta += Math.min(1, ((currentLine + 1) - startLineOfLogicalBlock) / 7);

        //         if (sourceMap.isBlockStartingInLine(currentLine)) {
        //             accumulatedScores.push(accumulatingComplexityScore);
        //             accumulatingComplexityScore = 0;
        //             totalComplexityScore = 0;
        //             // if (correspondingComments.length === 0) {
        //             //     const body = (enclosingNode as ts.FunctionLikeDeclaration).body;
        //             //     if (body) {
        //             //         complexityDelta += ccCollector.getComplexity(body);
        //             //     }
        //             // }
        //         }
        //         if (sourceMap.isBlockEndingInLine(currentLine)) {
        //             // TODO: get a complexity rating from the code inside and add this to the scores
        //             // so that a comment on the enclosing if might be required as well
        //             accumulatingComplexityScore = accumulatedScores.pop();
        //         }

        //         accumulatingComplexityScore += complexityDelta;
        //         totalComplexityScore += complexityDelta;
        //         if (complexityDelta > previousMostComplexScore) {
        //             previousMostComplexLine = currentLine;
        //             previousMostComplexScore = complexityDelta;
        //         }
        //         this.addFailureAt(enclosingNode.getStart(), 1, "" + accumulatingComplexityScore);
        //         if (accumulatingComplexityScore > 5) {
        //             // If the previousMostComplexScore exceeds a threshold, add a comment there.
        //             // TODO: implement

        //             // Otherwise add it to the beginning of the current code block
        //             const firstNodeInLogicalBlock = sourceMap.getMostEnclosingNodeForLine(startLineOfLogicalBlock);
        //             const firstNodeComments = sourceMap.getCommentsBelongingToNode(firstNodeInLogicalBlock);
        //             if (firstNodeInLogicalBlock && firstNodeComments.length === 0) {
        //                 this.addFailure(firstNodeInLogicalBlock.getFullStart(),
        //                     firstNodeInLogicalBlock.getStart(),
        //                     "This should be commented - " + firstNodeInLogicalBlock.kind);
        //             } else {
        //                 console.log("Did not get a first node in logical block starting in line " + startLineOfLogicalBlock);
        //             }
        //             accumulatingComplexityScore = 0;
        //             startLineOfLogicalBlock = -1;
        //         }
        //     }
        //     if (totalComplexityScore > 10) {
        //         const comments = sourceMap.getCommentsBelongingToLine(startLine);
        //         if (comments.length === 0) {
        //             // console.log("Adding failure for function without comments starting in line " + startLine);
        //             const width = node.name ? node.name.getWidth() : 1;
        //             const start = node.name ? node.name.getStart() : node.getStart();
        //             this.addFailureAt(start, width, "This should be commented");
        //         }
        //     }

        //     // if (ccCollector.getComplexity(node.body) > 10) {
        //     //     const children: ts.Node[] = [];
        //     //     const addChild = (child) => {
        //     //         if (ts.isBlock(child)) {
        //     //             children.push(child);
        //     //         }
        //     //         child.forEachChild(addChild);
        //     //     };
        //     //     node.forEachChild(addChild);
        //     //     // Descending by complexity
        //     //     children.sort((a, b) => {
        //     //         return ccCollector.getComplexity(b) - ccCollector.getComplexity(a);
        //     //     });
        //     //     // Add a failure at the parent node of the block with the highest complexity
        //     //     children.forEach((child) => {
        //     //         const complexity = ccCollector.getComplexity(child);
        //     //         const comments = sourceMap.getCommentsForNode(child);
        //     //         if (comments.length === 0) {
        //     //             this.addFailureAtNode(child.parent, "CC: " + complexity);
        //     //         }
        //     //     });
        //     // }
        // });
    }

    /**
     * Calculate complexity metric values for each line in the block and add failures at positions
     * that exceed a complexity threshold.
     * @param node The node whose lines should be analyzed
     * @returns {number} The sum of the complexity scores of all lines of code in the node
     */
    private analyze(node: ts.Node, sourceFile: ts.SourceFile, sourceMap: SourceMap): number {

        interface ILineComplexity {
            line: number;
            complexity: number;
        }

        let sectionComplexity = 0.0;
        let totalComplexity = 0.0;
        const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        let currentSectionStartLine = -1;
        const sortDescending = (a: ILineComplexity, b: ILineComplexity): number => {
            return a.complexity - b.complexity;
        };
        const lineComplexities = new PriorityQueue<ILineComplexity>(sortDescending);

        for (let currentLine = startLine + 1; currentLine < endLine; ++currentLine) {
            const commentsInLine = sourceMap.getCommentsInLine(currentLine);
            const correspondingComments = sourceMap.getCommentsBelongingToLine(currentLine);
            const enclosingNode = sourceMap.getMostEnclosingNodeForLine(currentLine);

            if (currentSectionStartLine === -1) {
                currentSectionStartLine = currentLine;
            }

            if (!enclosingNode || enclosingNode === node) {
                // A line filled only with comments, just like this very one.
                if (commentsInLine.length > 0) {
                    continue;
                }
                // One code section ending, a new one starting.

                // require comments for complex sections
                if (sectionComplexity > 7) {
                    if (!this.requireCommentForLine(currentSectionStartLine, sourceMap, sourceFile)) {
                        this.requireCommentForLine(lineComplexities.dequeue().line, sourceMap, sourceFile);
                    }
                }

                sectionComplexity = 0;
                currentSectionStartLine = -1;
                lineComplexities.clear();
            }

            let lineComplexity = 0;
            // TODO: use more metrics than just LOC since section start
            // Lines of code. Let's use 7 as magical border for increasing complexity by 1 for each line
            lineComplexity += Math.min(1, ((currentLine + 1) - currentSectionStartLine) / 7);

            if (sourceMap.isBlockStartingInLine(currentLine)) {
                const blockNode = sourceMap.getBlockStartingInLine(currentLine);
                const blockComplexity = this.analyze(blockNode, sourceFile, sourceMap);
                lineComplexity += blockComplexity;
                currentLine = ts.getLineAndCharacterOfPosition(sourceFile, blockNode.getEnd()).line;
            }

            // TODO: use a meaningful threshold here
            if (lineComplexity > 5) {
                this.requireCommentForLine(currentLine, sourceMap, sourceFile, "This is a complex statement.");
                // this.addFailureAtNode(enclosingNode, "This is a complex statement.");
            }

            sectionComplexity += lineComplexity;
            totalComplexity += lineComplexity;
            lineComplexities.add({line: currentLine, complexity: lineComplexity});

            const failureStart = sourceFile.getPositionOfLineAndCharacter(currentLine, 0);
            this.addFailureAt(failureStart, 1, "section: " + sectionComplexity + " - line: " + lineComplexity);
        }
        // require comments for complex sections
        if (totalComplexity > 7) {
            if (!this.requireCommentForLine(currentSectionStartLine, sourceMap, sourceFile)) {
                this.requireCommentForLine(lineComplexities.dequeue().line, sourceMap, sourceFile);
            }
        }
        return totalComplexity;
    }

    /**
     * Add a failure to the given line if it doesn't have a meaningful comment yet.
     * @param line The line that should be commented
     * @param sourceMap The SourceMap in which the line is located
     * @param sourceFile The SourceFile in which the line is located
     * @returns {boolean} true if a failure has been added, false if this line already has a comment
     */
    private requireCommentForLine(line: number, sourceMap: SourceMap,
                                  sourceFile: ts.SourceFile, failureMessage?: string): boolean {
        const correspondingComments = sourceMap.getCommentsBelongingToLine(line);
        failureMessage = failureMessage || "This line should be commented";
        // TODO: check meaningfulness of comments instead of just plain existence
        if (correspondingComments.length === 0) {
            const node = sourceMap.getMostEnclosingNodeForLine(line);
            const end = sourceFile.getLineEndOfPosition(node.getStart());
            this.addFailure(node.getStart(), end, failureMessage);
            return true;
        }
        return false;
    }

    private addFailureForClassification(comment: SourceComment, classificationIndex: number) {
        const classification = comment.classifications[classificationIndex];
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

    private printGetChildrenForEach(node: ts.Node, depth: number = 0) {
        console.log("--".repeat(depth), ts.SyntaxKind[node.kind], node.getStart(), node.end);
        node.getChildren().forEach( (child) => this.printGetChildrenForEach(child, depth + 1));
    }

    private printForEachChild(node: ts.Node, depth: number = 0) {
        console.log("--".repeat(depth), ts.SyntaxKind[node.kind], node.getStart(), node.end);
        node.forEachChild( (child) => this.printForEachChild(child, depth + 1));
    }

}
