import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { IMetricCollector, SourcePart } from "./commentClassificationTypes";
import Utils from "./utils";

export class LinesOfCodeCollector implements IMetricCollector {

    private linesOfCode = new Map<ts.Node, number>();

    public visitNode(node: SourcePart) {
        if (!(Utils.isNode(node) && TSUtils.isFunctionScopeBoundary(node))) {
            return;
        }
        const codeNode = ts.isFunctionLike(node) ? node.body : node;

        const sourceFile = codeNode.getSourceFile();
        const textLines = codeNode.getText(sourceFile).split("\n");
        let linesOfCode = 0;
        let position = codeNode.getStart();
        let didIncludeCodePreviously = false;
        let skippedLines = 0;

        textLines.forEach((line) => {
            const potentiallyContainsCode = !this.containsOnlyBraces(line);
            if (!potentiallyContainsCode && didIncludeCodePreviously) {
                skippedLines++;
            }
            if (potentiallyContainsCode && Utils.isCodeInLine(position, sourceFile, line)) {
                didIncludeCodePreviously = true;
                linesOfCode += skippedLines + 1;
                skippedLines = 0;
            }
            position += line.length + 1;
        });
        this.linesOfCode.set(node, linesOfCode);
    }

    public getLoc(node: ts.Node): number | undefined {
        return this.linesOfCode.get(node);
    }

    private containsOnlyBraces(text: string): boolean {
        return /^\s*[{|}]+\s*$/.test(text);
    }

}
