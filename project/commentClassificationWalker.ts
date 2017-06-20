import * as Lint from "tslint";
import * as Utils from "tsutils";
import * as ts from "typescript";
import {CommentClass, CommentsClassifier} from "./commentsClassifier";
import {SourceComment} from "./sourceComment";

interface ICommentGroup {
    pos: number;
    end: number;
    comments: string[];
}

export class CommentClassificationWalker extends Lint.AbstractWalker<Set<string>> {

    public walk(sourceFile: ts.SourceFile) {
        // Hey, there is a comment!
        // TODO: use this.options() instead of hardcoded string
        const classifier = new CommentsClassifier("./comment-classification-rules/no-code");
        const mergedComments = this.getMergedComments(sourceFile);
        Utils.forEachComment(sourceFile, (fullText, range) => {
            const text = fullText.substring(range.pos, range.end);
            const classification = classifier.classify(new SourceComment(range.pos, range.end, text));
            if (classification.commentClass === CommentClass.Code) {
                const failureText = classification.note || "No Code in comments";
                this.addFailure(range.pos, range.end, failureText);
            }
        });
        // mergedComments.forEach((commentGroup) => {
        //     const text = commentGroup.comments.join("\n");
        //     const classification = classifier.classify(text);
        //     if (classification.commentClass === CommentClass.Code) {
        //         const failureText = classification.note || "No Code in comments";
        //         this.addFailure(commentGroup.pos, commentGroup.end, failureText);
        //     }
        // });
    }

    private getMergedComments(sourceFile: ts.SourceFile): ICommentGroup[] {
        const result: ICommentGroup[] = [];
        const sourceLines = sourceFile.getFullText().split("\n");
        const sourceLineEnds = [];
        sourceLines.forEach((line) => {
            const previousLength = sourceLineEnds.length > 0 ? sourceLineEnds[sourceLineEnds.length - 1] : 0;
            // + 1 because of the newline char that gets stripped in split() above
            sourceLineEnds.push(previousLength + line.length + 1);
        });
        let previousCommentEndLine = -1;
        let currentCommentStartLine = 0;
        Utils.forEachComment(sourceFile, (fullText, {kind, pos, end}) => {
            while (pos > sourceLineEnds[currentCommentStartLine]) {
                currentCommentStartLine++;
            }
            if (previousCommentEndLine > -1 && previousCommentEndLine === currentCommentStartLine - 1) {
                result[result.length - 1].comments.push(fullText.substring(pos, end));
                result[result.length - 1].end = end;
            } else {
                result.push({pos, end, comments: [fullText.substring(pos, end)]});
            }
            let currentCommentEndLine = currentCommentStartLine;
            while (end > sourceLineEnds[currentCommentEndLine]) {
                currentCommentEndLine++;
            }
            previousCommentEndLine = currentCommentEndLine;
        });
        return result;
    }
}
