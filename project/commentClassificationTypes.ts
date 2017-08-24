import * as ts from "typescript";
import { CommentClass, SourceComment } from "./sourceComment";

export type SourcePart = ts.Node | SourceComment;

export interface ICommentClassification {
    commentClass: CommentClass;
    lines?: number[];
}

export interface IMetricCollector {
    visitNode(node: SourcePart);
}
