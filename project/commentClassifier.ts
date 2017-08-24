import * as Lint from "tslint";
import * as ts from "typescript";
import { CodeDetector } from "./codeDetector";
import { ICommentClassification } from "./commentClassificationTypes";
import { LicenseMatcher } from "./licenseMatcher";
import { CommentClass, ICommentPart, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";
import Utils from "./utils";

import SK = ts.SyntaxKind;

interface IInternalClassificationResult {
    matchesClass: boolean;
    description: string;
}

export class CommentClassifier {

// Comment categories from "Quality analysis of source code comments."
//   - Copyright comments
//   - Header comments
//   - Member comments
//   - Inline comments
//   - Section comments
//   - Code comments
//   - Task comments

    private licenseMatcher: LicenseMatcher;

    constructor(private codeDetector: CodeDetector, private sourceMap: SourceMap) {
        this.licenseMatcher = new LicenseMatcher();
    }

    public classify(comment: SourceComment): ICommentClassification[] {
        const commentText = comment.getSanitizedCommentText().text;
        const sanitizedLines = comment.getSanitizedCommentLines();
        const nextNode = this.sourceMap.getNodeFollowing(comment);
        const classifications: ICommentClassification[] = [];
        if (nextNode) {
            const sourceFile = nextNode.getSourceFile();
            // Check for a function start
            if (ts.isFunctionLike(nextNode) || ts.isFunctionLike(nextNode.parent)) {
                classifications.push({commentClass: CommentClass.Header});
            }
            // Check for a member declaration
            if (nextNode.kind === ts.SyntaxKind.PropertyDeclaration) {
                classifications.push({commentClass: CommentClass.Member});
            } else {
                let child = nextNode.getChildCount(sourceFile) > 0 ? nextNode.getChildAt(0, sourceFile) : undefined;
                while (child !== undefined && child.getStart(sourceFile) === nextNode.getStart(sourceFile)) {
                    if (child.kind === ts.SyntaxKind.PropertyDeclaration) {
                        classifications.push({commentClass: CommentClass.Member});
                        break;
                    }
                    child = child.getChildCount(sourceFile) > 0 ? child.getChildAt(0, sourceFile) : undefined;
                }
            }
        }
        const enclosingNodes = this.sourceMap.getEnclosingNodes(comment);
        for (const parentNode of enclosingNodes) {
            if (parentNode && ts.isFunctionLike(parentNode)) {
                classifications.push({commentClass: CommentClass.Inline});
                break;
            }
        }
        // Should also take position inside the file into account, i.e., most licenses
        // are at the beginning of a file and not somewhere in the middle.
        classifications.concat(...this.licenseMatcher.classify(comment));
        classifications.concat(...this.codeDetector.classify(comment));
        return classifications;
    }

}
