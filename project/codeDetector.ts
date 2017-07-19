import { ICommentAnnotator } from "./commentClassificationTypes";
import { CommentClass, ICommentClassification, SourceComment } from "./sourceComment";

export abstract class CodeDetector implements ICommentAnnotator {
    protected NOTE_TEXT = "Code should not be part of a comment";
    protected classification: ICommentClassification = {commentClass: CommentClass.Code};
    constructor(protected ruleLocation?: string) {}
    public abstract annotate(comment: SourceComment);
}
