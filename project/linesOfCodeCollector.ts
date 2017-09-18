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
        // TODO: pass the SourceFile as parameter if performance is a problem, as this
        // probably just walks up the AST until it finds a SourceFile
        const sourceFile = node.getSourceFile();
        const textLines = node.getText(sourceFile).split("\n");
        let linesOfCode = 0;
        let position = node.getStart();

        textLines.forEach((line) => {
            if (Utils.isCodeInLine(position, sourceFile, line)) {
                linesOfCode++;
            }
            position += line.length + 1;
        });
        this.linesOfCode.set(node, linesOfCode);
    }

}
