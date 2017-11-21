import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { IMetricCollector, SourcePart } from "./commentClassificationTypes";
import Utils from "./utils";

export class LinesOfCodeCollector implements IMetricCollector {

    private linesOfCode = new Map<ts.Node, number>();

    public visitNode(node: SourcePart) {
        if (!(Utils.isNode(node))) {
            return;
        }
        let codeNode: ts.Node;
        // TODO: handle loops
        if (ts.isFunctionLike(node)) {
            codeNode = node.body;
        } else if (ts.isIfStatement(node)) {
            codeNode = node.thenStatement;
        } else if (node.kind === ts.SyntaxKind.ElseKeyword) {
            codeNode = (node.parent as ts.IfStatement).elseStatement;
        } else if (ts.isBlock(node)) {
            codeNode = node;
            node = node.parent;
        } else {
            return;
        }
        if (!codeNode) { return; }

        const sourceFile = codeNode.getSourceFile();
        const textLines = codeNode.getText(sourceFile).split("\n");
        let linesOfCode = 0;
        let position = codeNode.getStart();

        textLines.forEach((line, index) => {
            if (Utils.isCodeInLine(position, sourceFile, line)) {
                linesOfCode += 1;
            }
            position += line.length + 1;
        });
        this.linesOfCode.set(node, linesOfCode);
    }

    public getLoc(node: ts.Node): number {
        return this.linesOfCode.get(node) || 0;
    }

}
