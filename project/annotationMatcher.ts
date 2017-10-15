import { ENABLE_DISABLE_REGEX } from "tslint";
import { ICommentClassification } from "./commentClassificationTypes";
import { CommentClass, SourceComment } from "./sourceComment";
import Utils from "./utils";

export class AnnotationMatcher {

    /**
     * Assigns comment classes to the given comment based on its contents.
     * @param comment The comment to be classified.
     */
    public classify(comment: SourceComment): ICommentClassification[] {
        const matchedLines: number[] = [];
        const commentLines = comment.getSanitizedCommentLines();
        commentLines.forEach((commentLine, lineIndex) => {
            if (ENABLE_DISABLE_REGEX.test(commentLine.text)) {
                matchedLines.push(lineIndex);
            }
        });
        if (matchedLines.length === 0) {
            return [];
        }
        if (matchedLines.length !== commentLines.length) {
            return [{commentClass: CommentClass.Annotation, lines: matchedLines}];
        }
        return [{commentClass: CommentClass.Annotation}];
    }

}
