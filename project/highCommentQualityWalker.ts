import * as Lint from "tslint";
import * as Utils from "tsutils";
import * as ts from "typescript";
import { CommentClass } from "./commentClassificationTypes";
import { CommentsClassifier } from "./commentsClassifier";
import { CustomCodeDetector } from "./customCodeDetector";
import { ExistingRuleBasedCodeDetector } from "./existingRuleBasedCodeDetector";
import { SourceComment } from "./sourceComment";
import { TsCompilerBasedCodeDetector } from "./tsCompilerBasedCodeDetector";
import { SourceMap } from "./sourceMap";

interface ICommentGroup {
    pos: number;
    end: number;
    comments: string[];
}

export class HighCommentQualityWalker extends Lint.AbstractWalker<Set<string>> {

    public walk(sourceFile: ts.SourceFile) {
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
            const parent = sourceMap.getParent(commentGroup);
            const classificationResult = classifier.classify(commentGroup);
            classificationResult.annotations.forEach( (annotation) => {
                // if (annotation.commentClass === CommentClass.Code ||
                //         annotation.commentClass === CommentClass.Copyright) {
                    const comment = classificationResult.comment.getSanitizedCommentLines()[annotation.line];
                    const pos = comment.pos;
                    const end = comment.end;
                    this.addFailure(pos, end, annotation.note);
                // }
            });

            // const text = commentGroup.comments.join("/n");
            // const classification = classifier.classify(text);
            // if (classification.commentClass === CommentClass.Code) {
            //     const failureText = classification.note || "No Code in comments";
            //     this.addFailure(commentGroup.pos, commentGroup.end, failureText);
            // }
        });
    }
}
