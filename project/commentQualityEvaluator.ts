import { CommentClass, ICommentClassification, ICommentPart, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";

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
        return CommentQuality.Unknown;
    }

}
