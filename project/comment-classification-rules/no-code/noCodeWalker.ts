import * as Lint from "tslint";
import * as ts from "typescript";

export class NoCodeWalker extends Lint.AbstractWalker<void> {
    public static FAILURE_MESSAGE = "Code should not be commented out";

    public walk(sourceFile: ts.SourceFile) {
        const totalLength = sourceFile.text.length;
        let codeLength = 0;
        const visitNode = (node: ts.Node): void => {
            if (this.isCodeToken(node.kind)) {
                console.log(node.getText() + ": " + node.kind);
                codeLength += node.end - node.pos;
                return;
            }
            // tail call, as suggested at
            // https://palantir.github.io/tslint/develop/custom-rules/performance-tips.html#make-use-of-tail-calls
            return ts.forEachChild(node, visitNode);
        };
        ts.forEachChild(sourceFile, visitNode);
        if (codeLength / totalLength >= 0.75) {
            this.addFailure(0, totalLength, NoCodeWalker.FAILURE_MESSAGE);
        }
    }

    private isCodeToken(tokenKind: ts.SyntaxKind): boolean {
        return tokenKind !== ts.SyntaxKind.Unknown &&
            tokenKind !== ts.SyntaxKind.ExpressionStatement &&
            tokenKind !== ts.SyntaxKind.Identifier &&
            tokenKind !== ts.SyntaxKind.EndOfFileToken &&
            tokenKind !== ts.SyntaxKind.BinaryExpression &&
            tokenKind !== ts.SyntaxKind.AsExpression;
    }

}
