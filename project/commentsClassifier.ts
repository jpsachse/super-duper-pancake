import * as Lint from "tslint";
import * as utils from "tsutils";
import { CodeDetector } from "./codeDetector";
import { CommentClass, ICommentAnnotation, ICommentClassification } from "./commentClassificationTypes";
import { LicenseMatcher } from "./licenseMatcher";
import { ICommentPart, SourceComment } from "./sourceComment";

interface IInternalClassificationResult {
    matchesClass: boolean;
    description: string;
}

export class CommentsClassifier {

// Comment categories from "Quality analysis of source code comments."
//   - Copyright comments
//   - Header comments
//   - Member comments
//   - Inline comments
//   - Section comments
//   - Code comments
//   - Task comments

    constructor(private codeDetector: CodeDetector) {
    }

    public classify(comment: SourceComment): ICommentClassification {
        const commentText = comment.getSanitizedCommentText().text;
        const sanitizedLines = comment.getSanitizedCommentLines();
        const result: ICommentClassification = {
            annotations: [],
            comment,
        };
        const matcher = new LicenseMatcher();
        // Should also take position inside the file into account, i.e., most licenses
        // are at the beginning of a file and not somewhere in the middle.
        const annotations = matcher.getAnnotations(comment);
        result.annotations = result.annotations.concat(annotations);
        sanitizedLines.forEach( (line, index) => {
            const annotation = {
                commentClass: CommentClass.Unknown,
                line: index,
                note: undefined,
            };
            const classificationResult = this.isCommentedCode(line.text);
            if (classificationResult.matchesClass) {
                annotation.commentClass = CommentClass.Code;
                annotation.note = classificationResult.description;
            }
            if (annotation.commentClass !== CommentClass.Unknown) {
                result.annotations.push(annotation);
            }
        });
        return result;
    }

    private isCommentedCode(commentText: string): IInternalClassificationResult {
        if (this.codeDetector.isCommentedCode(commentText)) {
            return {matchesClass: true, description: "Code should not be commented out"};
        }
        return {matchesClass: false, description: undefined};
    }

}
