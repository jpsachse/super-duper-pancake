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
        return (node.kind === ts.SyntaxKind.PropertyDeclaration ||
                node.kind === ts.SyntaxKind.MethodDeclaration ||
                node.kind === ts.SyntaxKind.VariableDeclaration ||
                node.kind === ts.SyntaxKind.FunctionDeclaration ||
                node.kind === ts.SyntaxKind.ClassDeclaration ||
                node.kind === ts.SyntaxKind.InterfaceDeclaration ||
                node.kind === ts.SyntaxKind.TypeAliasDeclaration ||
                node.kind === ts.SyntaxKind.EnumDeclaration ||
                node.kind === ts.SyntaxKind.ModuleDeclaration ||
                node.kind === ts.SyntaxKind.NamespaceExportDeclaration ||
                node.kind === ts.SyntaxKind.ImportEqualsDeclaration ||
                node.kind === ts.SyntaxKind.ImportDeclaration ||
                node.kind === ts.SyntaxKind.ExportDeclaration);
    }

}
