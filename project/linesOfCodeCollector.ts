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
        const textLines = node.getText().split("\n");
        // TODO: pass the SourceFile as parameter if performance is a problem, as this
        // probably just walks up the AST until it finds a SourceFile
        const sourceFile = node.getSourceFile();
        let linesOfCode = 0;
        let position = node.getStart();
        textLines.forEach((line) => {
            const whitespace = line.match(/^\s*/);
            let whitespaceLength = 0;
            if (whitespace && whitespace.length > 0) {
                whitespaceLength = whitespace[0].length;
            }
            const startOfLetters = position + whitespaceLength;
            if (whitespaceLength < line.length && !TSUtils.isPositionInComment(sourceFile, startOfLetters)) {
                linesOfCode++;
            }
            position += line.length;
        });
        this.linesOfCode.set(node, linesOfCode);
    }

}
