import * as Lint from "tslint";
import * as ts from "typescript";
import { CommentsClassifier } from "./commentsClassifier";
import { CustomCodeDetector } from "./customCodeDetector";
import { ExistingRuleBasedCodeDetector } from "./existingRuleBasedCodeDetector";
import { CyclomaticComplexityCollector, LinesOfCodeCollector } from "./metricCollectors";
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
        this.printForEachChild(sourceFile);
        this.printGetChildrenForEach(sourceFile);
        const locCollector = new LinesOfCodeCollector();
        const ccCollector = new CyclomaticComplexityCollector();
        const sourceMap = new SourceMap(sourceFile, [ccCollector, locCollector]);
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
        sourceMap.getAllFunctionLikes().forEach((node) => {
            if (ts.isFunctionLike(node) && ccCollector.getComplexity(node.body) > 10) {
                const children: ts.Node[] = [];
                const addChild = (child) => {
                    if (ts.isBlock(child)) {
                        children.push(child);
                    }
                    child.forEachChild(addChild);
                };
                node.forEachChild(addChild);
                // Descending by complexity
                children.sort((a, b) => {
                    return ccCollector.getComplexity(b) - ccCollector.getComplexity(a);
                });
                // Add a failure at the parent node of the block with the highest complexity
                children.forEach((child) => {
                    const complexity = ccCollector.getComplexity(child);
                    const comments = sourceMap.getCommentsForNode(child);
                    if (comments.length === 0) {
                        this.addFailureAtNode(child.parent, "CC: " + complexity);
                    }
                });
                // this.addFailureAtNode(children[0].parent, "This seems too complex");
            }
        });
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
