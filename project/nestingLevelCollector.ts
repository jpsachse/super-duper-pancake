import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { IMetricCollector, SourcePart } from "./commentClassificationTypes";
import Utils from "./utils";

export class NestingLevelCollector implements IMetricCollector {

    private nestingLevels = new Map<ts.Node, number>();

    public visitNode(node: SourcePart) {
        if (!Utils.isNode(node)) { return; }
        const sourceFile = node.getSourceFile();
        const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).line;
        if (this.nestingLevels.has(node)) { return; }

        let nestingLevel = 0;
        let parent = node;
        let lineOfParent = ts.getLineAndCharacterOfPosition(sourceFile, parent.getStart()).line;
        while (parent.parent !== undefined && !this.nestingLevels.has(node)) {
            parent = parent.parent;
            lineOfParent = ts.getLineAndCharacterOfPosition(sourceFile, parent.getStart()).line;
            if (TSUtils.isFunctionScopeBoundary(parent) || TSUtils.isBlockScopeBoundary(parent)) {
                nestingLevel++;
            }
        }
        if (TSUtils.isFunctionScopeBoundary(parent) || TSUtils.isBlockScopeBoundary(parent)) {
            nestingLevel++;
        }
        if (this.nestingLevels.has(node)) {
            nestingLevel += this.nestingLevels.get(node);
        }
        this.nestingLevels.set(node, nestingLevel);
    }

    public getNestingLevel(node: ts.Node): number | undefined {
        let nestingLevel = this.nestingLevels.get(node);
        if (nestingLevel) { return nestingLevel; }
        this.visitNode(node);
        nestingLevel = this.nestingLevels.get(node);
        return nestingLevel;
    }

}
