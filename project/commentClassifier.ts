import * as Lint from "tslint";
import * as ts from "typescript";
import { AnnotationMatcher } from "./annotationMatcher";
import { CodeDetector } from "./codeDetector";
import { ICommentClassification } from "./commentClassificationTypes";
import { LicenseMatcher } from "./licenseMatcher";
import { CommentClass, ICommentPart, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";
import { TaskCommentMatcher } from "./taskCommentMatcher";
import Utils from "./utils";

import SK = ts.SyntaxKind;

interface IInternalClassificationResult {
    matchesClass: boolean;
    description: string;
}

export class CommentClassifier {

    private licenseMatcher = new LicenseMatcher();
    private taskCommentMatcher = new TaskCommentMatcher();
    private annotationMatcher = new AnnotationMatcher();

    constructor(private codeDetector: CodeDetector, private sourceMap: SourceMap) {}

    public classify(comment: SourceComment): ICommentClassification[] {
        const commentText = comment.getSanitizedCommentText().text;
        const commentLine = this.sourceMap.sourceFile.getLineAndCharacterOfPosition(comment.end).line;
        const nodeLine = comment.isTrailing ? commentLine : commentLine + 1;
        const nextNode = this.sourceMap.getMostEnclosingNodeForLine(nodeLine);
        const classifications: ICommentClassification[] = [];
        const enclosingNodes = this.sourceMap.getEnclosingNodes(comment);

        for (const parentNode of enclosingNodes) {
            if (parentNode && ts.isFunctionLike(parentNode)) {
                classifications.push({commentClass: CommentClass.Inline});
                break;
            }
        }

        if (classifications.length === 0 && nextNode) {
            const sourceFile = nextNode.getSourceFile();
            // Check for a function or class start
            if (ts.isFunctionLike(nextNode) || ts.isFunctionLike(nextNode.parent) ||
                    ts.isClassLike(nextNode) || ts.isEnumDeclaration(nextNode)) {
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
        classifications.push(...this.licenseMatcher.classify(comment));
        classifications.push(...this.annotationMatcher.classify(comment));
        classifications.push(...this.codeDetector.classify(comment));
        classifications.push(...this.taskCommentMatcher.classify(comment));
        if (classifications.length === 0) {
            classifications.push({commentClass: CommentClass.Unknown});
        }
        return classifications;
    }

}
