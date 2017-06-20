import * as Lint from "tslint";
import * as Utils from "tsutils";
import * as ts from "typescript";
import {CommentClass, CommentsClassifier} from "./commentsClassifier";

export class CommentClassificationWalker extends Lint.AbstractWalker<Set<string>> {

    public walk(sourceFile: ts.SourceFile) {
        // Hey, there is a comment!
        // TODO: use this.options() instead of hardcoded string
        const classifier = new CommentsClassifier("./comment-classification-rules/no-code");
        Utils.forEachComment(sourceFile, (fullText, {kind, pos, end}) => {
            const commentText = fullText.substring(pos, end);
            const classification = classifier.classify(commentText);
            if (classification.commentClass === CommentClass.Code) {
                const failureText = classification.note || "No Code in comments";
                this.addFailure(pos, end, failureText);
            }
        });
    }
}
