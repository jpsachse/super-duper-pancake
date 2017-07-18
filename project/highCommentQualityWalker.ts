import * as Lint from "tslint";
import * as ts from "typescript";
import { CommentClass, ICommentAnnotation, ICommentClassification } from "./commentClassificationTypes";
import { CommentsClassifier } from "./commentsClassifier";
import { CustomCodeDetector } from "./customCodeDetector";
import { ExistingRuleBasedCodeDetector } from "./existingRuleBasedCodeDetector";
import { CyclomaticComplexityCollector, LinesOfCodeCollector } from "./metricCollectors";
import { SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";
import { TsCompilerBasedCodeDetector } from "./tsCompilerBasedCodeDetector";

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
        // Hey, there is a comment!
        // TODO: use this.options() instead of hardcoded string
        // Also: provide an option to choose from different code detection methods
        // const codeDetector = new CustomCodeDetector("./comment-classification-rules/no-code")
        // const ruleDirectory = "./node_modules/tslint/lib/rules";
        // const codeDetector = new ExistingRuleBasedCodeDetector(ruleDirectory);
        const codeDetector = new TsCompilerBasedCodeDetector();
        const classifier = new CommentsClassifier(codeDetector, sourceMap);

        sourceMap.getAllComments().forEach((commentGroup) => {
            const classificationResult = classifier.classify(commentGroup);
            classificationResult.annotations.forEach( (annotation) => {
                // this.addFailureForClassification(classificationResult, annotation);
                switch (annotation.commentClass) {
                    case CommentClass.Code: {
                        this.addFailureForClassification(classificationResult, annotation);
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
        ccCollector.getAllNodes().forEach((node) => {
            if (ccCollector.getComplexity(node) > 10) {
                this.addFailureAtNode(node, "This seems too complex");
            }
        });
    }

    private addFailureForClassification(classificationResult: ICommentClassification, annotation: ICommentAnnotation) {
        const comment = classificationResult.comment.getSanitizedCommentLines()[annotation.line];
        const pos = comment.pos;
        const end = comment.end;
        this.addFailure(pos, end, annotation.note);
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
