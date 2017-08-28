import Stack from "ts-data.stack";
import * as Lint from "tslint";
import * as ts from "typescript";
import { PriorityQueue } from "typescript-collections";
import { ICommentClassification } from "./commentClassificationTypes";
import { CommentClassifier } from "./commentClassifier";
import { CommentQuality, CommentQualityEvaluator} from "./commentQualityEvaluator";
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

interface ILineComplexity {
    line: number;
    complexity: number;
}

interface ICommentStatistics {
    quality: CommentQuality;
    classifications: ICommentClassification[];
}

export class HighCommentQualityWalker extends Lint.AbstractWalker<Set<string>> {

    // lines that should have a comment, mapped to the string representing the reason
    // TODO: make this single string instead of array
    private requiredCommentLines = new Map<number, [string]>();
    private locCollector = new LinesOfCodeCollector();
    private ccCollector = new CyclomaticComplexityCollector();
    private nestingLevelCollector = new NestingLevelCollector();
    private halsteadCollector = new HalsteadCollector();
    private commentQualityEvaluator = new CommentQualityEvaluator();
    private commentStats = new Map<SourceComment, ICommentStatistics>();

    public walk(sourceFile: ts.SourceFile) {
        // this.printForEachChild(sourceFile);
        // this.printGetChildrenForEach(sourceFile);
        const collectors = [this.ccCollector, this.halsteadCollector, this.locCollector, this.nestingLevelCollector];
        const sourceMap = new SourceMap(sourceFile, collectors);
        // TODO: use this.options() instead of hardcoded string
        // Also: provide an option to choose from different code detection methods
        // const codeDetector = new CustomCodeDetector("./comment-classification-rules/no-code")
        // const ruleDirectory = "./node_modules/tslint/lib/rules";
        // const codeDetector = new ExistingRuleBasedCodeDetector(ruleDirectory);
        const codeDetector = new TsCompilerBasedCodeDetector();
        const classifier = new CommentClassifier(codeDetector, sourceMap);

        sourceMap.getAllComments().forEach((commentGroup) => {
            const classifications = classifier.classify(commentGroup);
            const quality = this.commentQualityEvaluator.evaluateQuality(commentGroup, classifications, sourceMap);
            this.commentStats.set(commentGroup, {classifications, quality});
            // TODO: act on all classifications / quality and add failures for low quality comments
            classifications.forEach( (classification, index) => {
                switch (classification.commentClass) {
                    case CommentClass.Code: {
                        this.addFailureForClassification(commentGroup, classification);
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
            if (quality <= CommentQuality.Low) {
                const end = sourceFile.getLineEndOfPosition(commentGroup.pos);
                this.addFailure(commentGroup.pos, end, "Low comment quality: " + CommentQuality[quality]);
            }
        });
        // TODO: don't pass nested functions here, as they will get handled by their parent
        // Alternative: save nodes / lines for which complexity already has been calculated
        sourceMap.getAllFunctionLikes().forEach((node) => {
            this.analyze(node, sourceMap);
        });
        this.addFailuresForCommentRequirements(sourceMap);
    }

    /**
     * Calculate complexity metric values for each line in the block and add failures at positions
     * that exceed a complexity threshold.
     * @param node The node whose lines should be analyzed
     * @returns {number} The sum of the complexity scores of all lines of code in the node
     */
    private analyze(node: ts.Node, sourceMap: SourceMap): number {
        const sectionComplexityThreshold = 7;
        const nodeTotalComplexityThreshold = 5;
        const lineComplexityThreshold = 3;
        let sectionComplexity = 0.0;
        let totalComplexity = 0.0;
        const startLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const endLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        let currentSectionStartLine = -1;
        const sortDescending = (a: ILineComplexity, b: ILineComplexity): number => {
            return a.complexity - b.complexity;
        };
        const lineComplexities = new PriorityQueue<ILineComplexity>(sortDescending);
        const sectionComplexities = new PriorityQueue<ILineComplexity>(sortDescending);

        let previousLineWasCommentOnly = false;
        for (let currentLine = startLine + 1; currentLine < endLine; ++currentLine) {
            const commentsInLine = sourceMap.getCommentsInLine(currentLine);
            const correspondingComments = sourceMap.getCommentsBelongingToLine(currentLine);
            const enclosingNode = sourceMap.getMostEnclosingNodeForLine(currentLine);

            if (currentSectionStartLine === -1) {
                currentSectionStartLine = currentLine;
            }

            if (!enclosingNode) {
                // A line filled only with comments, just like this very one.
                if (commentsInLine.length > 0 && !previousLineWasCommentOnly) {
                    previousLineWasCommentOnly = true;
                    continue;
                }
                // TODO: this is just here for live-feedback purposes
                const failureStart = sourceMap.sourceFile.getPositionOfLineAndCharacter(currentSectionStartLine, 0);
                this.addFailureAt(failureStart, 1, "sectionComplexity: " + sectionComplexity);

                // One code section ending, a new one starting.
                if (sectionComplexity > 0) {
                    // require comments for complex sections
                    this.enforceCommentRequirementForSection(sectionComplexity, sectionComplexityThreshold,
                            currentSectionStartLine, sourceMap, lineComplexities, lineComplexityThreshold);
                    sectionComplexities.add({line: currentSectionStartLine, complexity: sectionComplexity});
                    sectionComplexity = 0;
                }
                currentSectionStartLine = -1;
                lineComplexities.clear();
                continue;
            }
            previousLineWasCommentOnly = false;

            let lineComplexity = 0;
            // TODO: use more metrics
            // Lines of code. Let's use 7 as magical border for increasing complexity by 1 for each line
            // TODO: this includes comment lines, as they don't break sections and this is just start - end
            const distanceToStartComplexity = Math.min(1, ((currentLine + 1) - currentSectionStartLine) / 7);

            // Compare complexity here before adding any block/child related complexities,
            // as I want to catch complex lines in themselves and not nearly everything that has
            // a code block.
            if (lineComplexity > lineComplexityThreshold) {
                this.requireCommentForLine(currentLine, sourceMap,
                                           "This is a complex statement: " + lineComplexity);
            }

            if (sourceMap.isBlockStartingInLine(currentLine)) {
                const blockNode = sourceMap.getBlockStartingInLine(currentLine);
                // Cyclomatic complexity. Only useful for block-nodes
                lineComplexity += this.ccCollector.getComplexity(blockNode);
                const blockComplexity = this.analyze(blockNode, sourceMap);
                lineComplexity += blockComplexity;
            }

            lineComplexities.add({line: currentLine, complexity: lineComplexity});
            lineComplexity += distanceToStartComplexity;
            sectionComplexity += lineComplexity;
            totalComplexity += lineComplexity;

            if (sourceMap.isBlockStartingInLine(currentLine)) {
                const blockNode = sourceMap.getBlockStartingInLine(currentLine);
                currentLine = ts.getLineAndCharacterOfPosition(sourceMap.sourceFile, blockNode.getEnd()).line;
            }
        }
        // if (sectionComplexities.isEmpty()) {
        //     sectionComplexities.add({line: currentSectionStartLine, complexity: sectionComplexity});
        // }
        // require comments for complex sections, but only if there is more than one section in a function
        let didAdd = false;
        if (sectionComplexities.size() > 1) {
            didAdd = this.enforceCommentRequirementForSection(sectionComplexity, sectionComplexityThreshold,
                    currentSectionStartLine, sourceMap, lineComplexities, lineComplexityThreshold);
        }
        if (!didAdd) {
            didAdd = this.enforceCommentRequirementForSection(totalComplexity, nodeTotalComplexityThreshold,
                    startLine, sourceMap, sectionComplexities, sectionComplexityThreshold);
        }
        return totalComplexity;
    }

    private enforceCommentRequirementForSection(complexity: number, threshold: number,
                                                sectionStartLine: number, sourceMap: SourceMap,
                                                lineComplexities: PriorityQueue<ILineComplexity>,
                                                lineThreshold: number) {
        if (complexity > threshold) {
            if (!this.requireCommentForLine(sectionStartLine, sourceMap, "sectionstart: " + complexity)) {
                const findCommentRequirementLocation = (): boolean => {
                    const highestComplexity = lineComplexities.dequeue();
                    if (!highestComplexity || highestComplexity.complexity < lineThreshold) { return true; }
                    const reason = "most complex: " + highestComplexity.complexity + " - total: " + complexity;
                    return this.requireCommentForLine(highestComplexity.line, sourceMap, reason);
                };
                while (true) {
                    if (findCommentRequirementLocation()) { break; }
                }
            }
            return true;
        }
        return false;
    }

    /**
     * Add a failure to the given line if it doesn't have a meaningful comment yet.
     * @param line The line that should be commented
     * @param sourceMap The SourceMap in which the line is located
     * @param sourceFile The SourceFile in which the line is located
     * @returns {boolean} true if a failure has been added, false if this line already has a comment
     */
    private requireCommentForLine(line: number, sourceMap: SourceMap, failureMessage?: string): boolean {
        // TODO: don't add another requirement instead of using an array if already present
        const enclosingNode = sourceMap.getMostEnclosingNodeForLine(line);
        if (enclosingNode) {
            line = sourceMap.sourceFile.getLineAndCharacterOfPosition(enclosingNode.getStart()).line;
        }
        const correspondingComments = sourceMap.getCommentsBelongingToLine(line);
        const nearestComments = sourceMap.getCommentsWithDistanceClosestToLine(line);
        failureMessage = failureMessage || "This line should be commented";
        // TODO: check meaningfulness of comments instead of just plain existence
        if (correspondingComments.length === 0) {
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

    private addFailuresForCommentRequirements(sourceMap: SourceMap) {
        this.requiredCommentLines.forEach((reasons, line) => {
            const node = sourceMap.getMostEnclosingNodeForLine(line);
            // Skip adding failures for comment requirements if the line above
            // (i.e., the line, where the previous enclosing node starts) also has a comment requirement.
            const previousNode = sourceMap.getSourcePartBefore(node);
            if (previousNode) {
                let previousLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(previousNode.pos).line;
                const previousEnclosingNode = sourceMap.getMostEnclosingNodeForLine(previousLine);
                if (previousEnclosingNode) {
                    const enclosingStart = previousEnclosingNode.getStart();
                    previousLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(enclosingStart).line;
                    if (this.requiredCommentLines.has(previousLine)) {
                        return;
                    }
                }
            }
            const end = sourceMap.sourceFile.getLineEndOfPosition(node.getStart());
            reasons.forEach( (reason) => {
                this.addFailure(node.getStart(), end, reason);
            });
        });
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

    private printGetChildrenForEach(node: ts.Node, depth: number = 0) {
        console.log("--".repeat(depth), ts.SyntaxKind[node.kind], node.getStart(), node.end);
        node.getChildren().forEach( (child) => this.printGetChildrenForEach(child, depth + 1));
    }

    private printForEachChild(node: ts.Node, depth: number = 0) {
        console.log("--".repeat(depth), ts.SyntaxKind[node.kind], node.getStart(), node.end);
        node.forEachChild( (child) => this.printForEachChild(child, depth + 1));
    }

}
