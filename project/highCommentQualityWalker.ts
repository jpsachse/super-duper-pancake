import * as Lint from "tslint";
import * as Utils from "tsutils";
import * as ts from "typescript";
import { CommentClass, CommentsClassifier } from "./commentsClassifier";
import { CustomCodeDetector } from "./customCodeDetector";
import { ExistingRuleBasedCodeDetector } from "./existingRuleBasedCodeDetector";
import { SourceComment } from "./sourceComment";
import { TsCompilerBasedCodeDetector } from "./tsCompilerBasedCodeDetector";

interface ICommentGroup {
    pos: number;
    end: number;
    comments: string[];
}

export class HighCommentQualityWalker extends Lint.AbstractWalker<Set<string>> {

    public walk(sourceFile: ts.SourceFile) {
        // Hey, there is a comment!
        // TODO: use this.options() instead of hardcoded string
        // Also: provide an option to choose from different code detection methods
        // const codeDetector = new CustomCodeDetector("./comment-classification-rules/no-code")
        // const ruleDirectory = "./node_modules/tslint/lib/rules";
        // const codeDetector = new ExistingRuleBasedCodeDetector(ruleDirectory);
        const codeDetector = new TsCompilerBasedCodeDetector();
        const classifier = new CommentsClassifier(codeDetector);
        const mergedComments = this.getMergedComments(sourceFile);
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
        mergedComments.forEach((commentGroup) => {
            const classificationResult = classifier.classify(commentGroup);
            classificationResult.classifications.forEach( (classification) => {
                if (classification.commentClass === CommentClass.Code ||
                        classification.commentClass === CommentClass.Copyright) {
                    const comment = classificationResult.comment.getSanitizedCommentLines()[classification.line];
                    const pos = comment.pos;
                    const end = comment.end;
                    this.addFailure(pos, end, classification.note);
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

    private getMergedComments(sourceFile: ts.SourceFile): SourceComment[] {
        const result: SourceComment[] = [];
        const sourceLines = sourceFile.getFullText().replace(/\r\n/g, "/n").split("/n");
        let previousCommentEndLine = -1;
        let currentCommentStartLine = 0;
        Utils.forEachComment(sourceFile, (fullText, {kind, pos, end}) => {
            currentCommentStartLine = ts.getLineAndCharacterOfPosition(sourceFile, pos).line;
            if (previousCommentEndLine === -1 || currentCommentStartLine > previousCommentEndLine + 1) {
                result.push(new SourceComment(pos, end, fullText.substring(pos, end)));
            } else if (currentCommentStartLine === previousCommentEndLine + 1) {
                result[result.length - 1].addPart(pos, end, fullText.substring(pos, end));
            }
            previousCommentEndLine = ts.getLineAndCharacterOfPosition(sourceFile, end).line;
        });
        return result;
    }
}
