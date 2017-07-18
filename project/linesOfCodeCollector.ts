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
        const linesOfCode = node.getText().split("\n").length;
        this.linesOfCode.set(node, linesOfCode);
    }

}
