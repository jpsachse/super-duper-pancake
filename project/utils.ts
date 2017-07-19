import * as ts from "typescript";
import { SourcePart } from "./commentClassificationTypes";
import { CommentClass, SourceComment } from "./sourceComment";

export default class Utils {

    public static createRange(start: number, end: number) {
        return Array.from({length: end - start + 1}, (value, key) => key + start);
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
