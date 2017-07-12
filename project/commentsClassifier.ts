import * as Lint from "tslint";
import * as utils from "tsutils";
import * as ts from "typescript";
import { CodeDetector } from "./codeDetector";
import { CommentClass, ICommentAnnotation, ICommentClassification } from "./commentClassificationTypes";
import { LicenseMatcher } from "./licenseMatcher";
import { ICommentPart, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";
import Utils from "./utils";

import SK = ts.SyntaxKind;

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

    constructor(private codeDetector: CodeDetector, private sourceMap: SourceMap) {
    }

    public classify(comment: SourceComment): ICommentClassification {
        const commentText = comment.getSanitizedCommentText().text;
        const sanitizedLines = comment.getSanitizedCommentLines();
        const result: ICommentClassification = {
            annotations: [],
            comment,
        };
        const nextNode = this.sourceMap.getNodeFollowing(comment);
        if (nextNode) {
            if (Utils.isSomeKindOfFunction(nextNode) || Utils.isSomeKindOfFunction(nextNode.parent)) {
                const headerAnnotations = Utils.createAnnotations(comment,
                                                                  CommentClass.Header,
                                                                  "That's a function header");
                result.annotations.push(...headerAnnotations);
            }
        }
        const enclosingNodes = this.sourceMap.getEnclosingNodes(comment);
        for (const parentNode of enclosingNodes) {
            if (parentNode && Utils.isSomeKindOfFunction(parentNode)) {
                const inlineAnnotations = Utils.createAnnotations(comment, CommentClass.Inline, "Some inline comment");
                result.annotations.push(...inlineAnnotations);
                break;
            }
        }
        const matcher = new LicenseMatcher();
        // Should also take position inside the file into account, i.e., most licenses
        // are at the beginning of a file and not somewhere in the middle.
        let annotations = matcher.getAnnotations(comment);
        result.annotations.push(...annotations);
        annotations = this.codeDetector.getAnnotations(comment);
        result.annotations.push(...annotations);
        return result;
    }

}
