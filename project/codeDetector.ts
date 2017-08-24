import { ICommentClassification } from "./commentClassificationTypes";
import { CommentClass, SourceComment } from "./sourceComment";

export abstract class CodeDetector {
    protected NOTE_TEXT = "Code should not be part of a comment";
    constructor(protected ruleLocation?: string) {}
    public abstract classify(comment: SourceComment): ICommentClassification[];

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
