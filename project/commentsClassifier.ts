import * as Lint from "tslint";
import * as utils from "tsutils";
import * as ts from "typescript";
import { CodeDetector } from "./codeDetector";
import { CommentClass, ICommentAnnotation, ICommentClassification } from "./commentClassificationTypes";
import { LicenseMatcher } from "./licenseMatcher";
import { ICommentPart, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";

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
            if (this.isSomeKindOfFunction(nextNode) || this.isSomeKindOfFunction(nextNode.parent)) {
                const headerAnnotations = this.createAnnotations(comment,
                                                                 CommentClass.Header,
                                                                 "That's a function header");
                result.annotations.push(...headerAnnotations);
            }
        }
        const enclosingNodes = this.sourceMap.getEnclosingNodes(comment);
        for (const parentNode of enclosingNodes) {
            if (parentNode && this.isSomeKindOfFunction(parentNode)) {
                const inlineAnnotations = this.createAnnotations(comment, CommentClass.Inline, "Some inline comment");
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

    private isSomeKindOfFunction(node: ts.Node): boolean {
        return ts.isMethodDeclaration(node) ||
                ts.isFunctionDeclaration(node) ||
                ts.isConstructorDeclaration(node);
    }

    private createAnnotations(comment: SourceComment,
                              commentClass: CommentClass,
                              note: string): ICommentAnnotation[] {
        const result: ICommentAnnotation[] = [];
        const numberOfLines = comment.getSanitizedCommentLines().length;
        for (let line = 0; line < numberOfLines; ++line) {
            result.push({commentClass, line, note});
        }
        return result;
    }

}
