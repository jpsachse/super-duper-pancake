import * as ts from "typescript";
import { CommentClass, ICommentClassification, ICommentPart, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";
import Utils from "./utils";

export enum CommentQuality {
    Unknown,
    Unhelpful,
    Low,
    Medium,
    High,
}

export default class CommentQualityEvaluator {

    public evaluateQuality(comment: SourceComment, sourceMap: SourceMap): CommentQuality {
        const pureCodeComment = (classification: ICommentClassification): boolean => {
            return classification.lines === undefined &&
                    classification.commentClass === CommentClass.Code;
        };
        if (comment.classifications.find(pureCodeComment)) {
            return CommentQuality.Unhelpful;
        }
        const commentEndLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(comment.end).line;
        const nextNode = sourceMap.getNodeAfterLine(commentEndLine);
        if (Utils.isDeclaration(nextNode)) {
            // TODO: this has to be refined considerably, e.g., by stripping common fill words (a, this, any, ...)
            // and also add handling for texts that reference parameters of functions
            const name = ts.getNameOfDeclaration(nextNode);
            const nameText = name === undefined ? ts.SyntaxKind[nextNode.kind] : name.getText(sourceMap.sourceFile);
            const nameParts = Utils.splitIntoNormalizedWords(nameText).sort();
            const commentWords = Utils.splitIntoNormalizedWords(comment.getSanitizedCommentText().text).sort();
            const intersection = Utils.getIntersection(nameParts, commentWords);
            if (intersection.length / commentWords.length > 0.5) {
                return CommentQuality.Low;
            }
        }
        return CommentQuality.Unknown;
    }

}
