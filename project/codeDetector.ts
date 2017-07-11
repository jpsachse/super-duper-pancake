import { CommentClass, ICommentAnnotation, ICommentAnnotator } from "./commentClassificationTypes";
import { SourceComment } from "./sourceComment";

export abstract class CodeDetector implements ICommentAnnotator {
    protected NOTE_TEXT = "Code should not be part of a comment";
    constructor(protected ruleLocation?: string) {}
    public abstract getAnnotations(comment: SourceComment): ICommentAnnotation[];

    protected createAnnotation(line: number): ICommentAnnotation {
        return {
            commentClass: CommentClass.Code,
            line,
            note: this.NOTE_TEXT,
        };
    }

    protected createAnnotations(startLine: number, endLine: number): ICommentAnnotation[] {
        const result = [];
        while (startLine < endLine) {
            result.push(this.createAnnotation(startLine));
            startLine++;
        }
        return result;
    }
}
