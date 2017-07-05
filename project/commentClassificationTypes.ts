import { SourceComment } from "./sourceComment";

export enum CommentClass {
    Copyright,
    Header,
    Inline,
    Section,
    Code,
    Task,
    Unknown,
}

export interface ICommentAnnotation {
    commentClass: CommentClass;
    line: number;
    note: string;
}

export interface ICommentClassification {
    comment: SourceComment;
    annotations: ICommentAnnotation[];
}

export interface ICommentAnnotator {
    getAnnotations(comment: SourceComment): ICommentAnnotation[];
}
