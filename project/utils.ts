import * as ts from "typescript";
import { CommentClass, ICommentAnnotation, SourcePart } from "./commentClassificationTypes";
import { SourceComment } from "./sourceComment";

export default class Utils {

    public static createAnnotations(comment: SourceComment,
                                    commentClass: CommentClass,
                                    note: string): ICommentAnnotation[] {
        const result: ICommentAnnotation[] = [];
        const numberOfLines = comment.getSanitizedCommentLines().length;
        for (let line = 0; line < numberOfLines; ++line) {
            result.push({commentClass, line, note});
        }
        return result;
    }

    public static isSomeKindOfFunction(node: ts.Node): boolean {
        return ts.isMethodDeclaration(node) ||
                ts.isFunctionDeclaration(node) ||
                ts.isConstructorDeclaration(node);
    }

    public static isNode(element: SourcePart): element is ts.Node {
        return (element as ts.Node).kind !== undefined;
    }

}
