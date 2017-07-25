import { ICommentAnnotator } from "./commentClassificationTypes";
import { CommentClass, ICommentClassification, SourceComment } from "./sourceComment";

export abstract class CodeDetector implements ICommentAnnotator {
    protected NOTE_TEXT = "Code should not be part of a comment";
    // protected classification: ICommentClassification = {  };
    constructor(protected ruleLocation?: string) {}
    public abstract annotate(comment: SourceComment);

    get defaultClassification(): ICommentClassification {
        return this.classification();
    }

    protected classification(lines?: number[]): ICommentClassification {
        if (lines !== undefined) {
            return {commentClass: CommentClass.Code, lines};
        }
        return {commentClass: CommentClass.Code};
    }
}
