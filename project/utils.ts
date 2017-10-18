import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { SourcePart } from "./commentClassificationTypes";
import { CommentClass, SourceComment } from "./sourceComment";

export default class Utils {

    public static commentOnlyLineRegxp = /^\s*(\/\/|\/\*)/gm;

    public static createRange(start: number, end: number) {
        return Array.from({length: end - start + 1}, (value, key) => key + start);
    }

    public static isNode(element?: SourcePart): element is ts.Node {
        return element && (element as ts.Node).kind !== undefined;
    }

    public static isStatement(node: ts.Node): node is ts.Statement {
        return (node.kind === ts.SyntaxKind.VariableStatement ||
                node.kind === ts.SyntaxKind.EmptyStatement ||
                node.kind === ts.SyntaxKind.ExpressionStatement ||
                node.kind === ts.SyntaxKind.IfStatement ||
                node.kind === ts.SyntaxKind.DoStatement ||
                node.kind === ts.SyntaxKind.WhileStatement ||
                node.kind === ts.SyntaxKind.ForStatement ||
                node.kind === ts.SyntaxKind.ForInStatement ||
                node.kind === ts.SyntaxKind.ForOfStatement ||
                node.kind === ts.SyntaxKind.ContinueStatement ||
                node.kind === ts.SyntaxKind.BreakStatement ||
                node.kind === ts.SyntaxKind.ReturnStatement ||
                node.kind === ts.SyntaxKind.WithStatement ||
                node.kind === ts.SyntaxKind.SwitchStatement ||
                node.kind === ts.SyntaxKind.LabeledStatement ||
                node.kind === ts.SyntaxKind.ThrowStatement ||
                node.kind === ts.SyntaxKind.TryStatement ||
                node.kind === ts.SyntaxKind.DebuggerStatement);
    }

    public static isDeclaration(node: ts.Node): node is ts.Declaration {
        // Possibly also handle these:
        // ts.SyntaxKind.CallSignatureDeclaration
        // ts.SyntaxKind.ConstructSignatureDeclaration
        // ts.SyntaxKind.Parameter
        // ts.SyntaxKind.IndexSignature
        // ts.SyntaxKind.VariableDeclaration
        // special case: ts.SyntaxKind.VariableDeclarationList, which has an array of VariableDeclarations
        return (node.kind === ts.SyntaxKind.ClassDeclaration ||
                node.kind === ts.SyntaxKind.Constructor ||
                node.kind === ts.SyntaxKind.EnumDeclaration ||
                node.kind === ts.SyntaxKind.ExportDeclaration ||
                node.kind === ts.SyntaxKind.FunctionDeclaration ||
                node.kind === ts.SyntaxKind.GetAccessor ||
                node.kind === ts.SyntaxKind.ImportDeclaration ||
                node.kind === ts.SyntaxKind.ImportEqualsDeclaration ||
                node.kind === ts.SyntaxKind.InterfaceDeclaration ||
                node.kind === ts.SyntaxKind.MethodDeclaration ||
                node.kind === ts.SyntaxKind.ModuleDeclaration ||
                node.kind === ts.SyntaxKind.NamespaceExportDeclaration ||
                node.kind === ts.SyntaxKind.PropertyDeclaration ||
                node.kind === ts.SyntaxKind.SetAccessor ||
                node.kind === ts.SyntaxKind.TypeAliasDeclaration ||
                node.kind === ts.SyntaxKind.TypeParameter);
    }

    public static isJSDocTag(node: ts.Node): node is ts.JSDocTag {
        return node.kind === ts.SyntaxKind.JSDocTag;
    }

    public static trimTrailingSpace(aString: string): string {
        return aString.replace(/\s+$/, "");
    }

    /**
     * Gets the intersection of two arrays
     * @param first First array
     * @param second Second array
     */
    public static getIntersection<T>(first: T[], second: T[]): T[] {
        const result: T[] = [];
        let i = 0;
        let o = 0;
        while (i < first.length && o < second.length) {
            if (first[i] === second[o]) {
                result.push(first[o]);
                i++;
                o++;
            } else if (first[i] < second[o]) {
                i++;
            } else {
                o++;
            }
        }
        return result;
    }

    /**
     * Splits camelCased text into an array of lowercase words. Works only for standard ASCII characters.
     * Will also strip basic latin punctuation characters from the words.
     * @param camelCaseText Text with camelcase words in it. The text will be split along camelCasing and whitespace.
     */
    public static splitIntoNormalizedWords(camelCaseText: string): string[] {
        return Array.from(new Set(camelCaseText.replace(/([0-9])([a-zA-Z])/g, "$1 $2")
                    .replace(/([a-zA-Z])([0-9])/g, "$1 $2")
                    .replace(/([a-z])([A-Z])/g, "$1 $2")
                    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
                    .toLowerCase()
                    .split(/[\s\.\-\_]/)
                    .map((word) => word.replace(this.basicLatinPunctuation, ""))
                    .filter((word) => word.length > 0)));
    }

    public static flatten(arrayOfArrays: any[][]): any[] {
        return [].concat(...arrayOfArrays);
    }

    public static capitalize(aString: string) {
        return aString.charAt(0).toUpperCase() + aString.slice(1).toLowerCase();
    }

    /**
     * Determines based on comment ranges if anything but comments and whitespace are contained in the passed line.
     * @param startPos The starting position of the line in the source file.
     * @param sourceFile The source file that contains the line.
     * * @param text The text of the line. If not provided, the text will be fetched from the source file.
     */
    public static isCodeInLine(startPos: number, sourceFile: ts.SourceFile, text?: string): boolean {
        const lineEnd = sourceFile.getLineEndOfPosition(startPos);
        if (!text) {
            text = sourceFile.text.substring(startPos, lineEnd);
        }
        const whiteSpaceRegexp = /^\s*/;
        let whitespace = text.match(whiteSpaceRegexp);
        let whitespaceLength = this.getLength(whitespace);
        if (whitespaceLength >= text.length) {
            return false;
        }
        const startOfLetters = startPos + whitespaceLength;
        const comment = TSUtils.getCommentAtPosition(sourceFile, startOfLetters);
        if (!comment) {
            return true;
        }

        if (comment.end + 1 >= lineEnd) {
            return false;
        }
        let positionInLine = comment.end + 1;
        while (positionInLine < lineEnd) {
            const nextComment = TSUtils.getCommentAtPosition(sourceFile, positionInLine);
            if (nextComment !== undefined) {
                const textStart = comment.end - comment.pos + whitespaceLength;
                const textEnd = positionInLine - comment.pos + whitespaceLength;
                const textBetweenComments = text.substring(textStart, textEnd);
                whitespace = textBetweenComments.match(whiteSpaceRegexp);
                whitespaceLength = this.getLength(whitespace);
                if (whitespaceLength < positionInLine - comment.end) {
                    return true;
                }
                positionInLine = nextComment.end;
            } else {
                positionInLine++;
            }
        }
        return false;
    }

    private static basicLatinPunctuation = /[\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007F]*/g;

    private static getLength(match: RegExpMatchArray | null): number {
        return (match && match.length > 0) ? match[0].length : 0;
    }

}
