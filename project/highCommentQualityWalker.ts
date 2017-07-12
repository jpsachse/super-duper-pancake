import * as Lint from "tslint";
import * as ts from "typescript";
import { CommentClass, ICommentAnnotation, ICommentClassification } from "./commentClassificationTypes";
import { CommentsClassifier } from "./commentsClassifier";
import { CustomCodeDetector } from "./customCodeDetector";
import { ExistingRuleBasedCodeDetector } from "./existingRuleBasedCodeDetector";
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
        this.printAllChildren(sourceFile);
        const sourceMap = new SourceMap(sourceFile);
        // Hey, there is a comment!
        // TODO: use this.options() instead of hardcoded string
        // Also: provide an option to choose from different code detection methods
        // const codeDetector = new CustomCodeDetector("./comment-classification-rules/no-code")
        // const ruleDirectory = "./node_modules/tslint/lib/rules";
        // const codeDetector = new ExistingRuleBasedCodeDetector(ruleDirectory);
        const codeDetector = new TsCompilerBasedCodeDetector();
        const classifier = new CommentsClassifier(codeDetector, sourceMap);
        // Utils.forEachComment(sourceFile, (fullText, range) => {
        //     const text = fullText.substring(range.pos, range.end);
        //     const classificationResult = classifier.classify(new SourceComment(range.pos, range.end, text));
        //     classificationResult.classifications.forEach( (classification) => {
        //         if (classification.commentClass === CommentClass.Code) {
        //             const pos = classificationResult.comment.getCommentParts()[classification.line].pos;
        //             const end = classificationResult.comment.getCommentParts()[classification.line].end;
        //             this.addFailure(pos, end, classification.note);
        //         }
        //     });
        // });
        sourceMap.getAllComments().forEach((commentGroup) => {
            const classificationResult = classifier.classify(commentGroup);
            classificationResult.annotations.forEach( (annotation) => {
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

            // const text = commentGroup.comments.join("/n");
            // const classification = classifier.classify(text);
            // if (classification.commentClass === CommentClass.Code) {
            //     const failureText = classification.note || "No Code in comments";
            //     this.addFailure(commentGroup.pos, commentGroup.end, failureText);
            // }
        });
    }

    private addFailureForClassification(classificationResult: ICommentClassification, annotation: ICommentAnnotation) {
        const comment = classificationResult.comment.getSanitizedCommentLines()[annotation.line];
        const pos = comment.pos;
        const end = comment.end;
        this.addFailure(pos, end, annotation.note);
    }

    private printAllChildren(node: ts.Node, depth: number = 0) {
        console.log("--".repeat(depth), ts.SyntaxKind[node.kind], node.getStart(), node.end);
        node.getChildren().forEach( (child) => this.printAllChildren(child, depth + 1));
    }

}
