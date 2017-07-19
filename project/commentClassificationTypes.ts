import * as ts from "typescript";
import { SourceComment } from "./sourceComment";

export type SourcePart = ts.Node | SourceComment;

export interface ICommentAnnotator {
    annotate(comment: SourceComment);
}

export interface IMetricCollector {
    visitNode(node: SourcePart);
}
