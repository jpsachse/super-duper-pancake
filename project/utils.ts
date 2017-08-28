import * as ts from "typescript";
import { SourcePart } from "./commentClassificationTypes";
import { CommentClass, SourceComment } from "./sourceComment";

export default class Utils {

    public static createRange(start: number, end: number) {
        return Array.from({length: end - start + 1}, (value, key) => key + start);
    }

    public static isNode(element: SourcePart): element is ts.Node {
        return (element as ts.Node).kind !== undefined;
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
                node.kind === ts.SyntaxKind.TypeParameter ||
                node.kind === ts.SyntaxKind.VariableDeclaration);
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
        return camelCaseText.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
                            .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
                            .toLowerCase()
                            .split(/\s/)
                            .map((word) => word.replace(this.basicLatinPunctuation, ""));
    }

    public static flatten(arrayOfArrays: any[][]): any[] {
        return [].concat(...arrayOfArrays);
    }

    public static capitalize(aString: string) {
        return aString.charAt(0).toUpperCase() + aString.slice(1).toLowerCase();
    }

    private static basicLatinPunctuation = /[\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007F]*/g;

}
