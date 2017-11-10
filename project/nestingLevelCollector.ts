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
        let currentNode = node;
        let lineOfParent = ts.getLineAndCharacterOfPosition(sourceFile, parent.getStart()).line;
        while (parent.parent !== undefined && !this.nestingLevels.has(node)) {
            parent = parent.parent;
            lineOfParent = ts.getLineAndCharacterOfPosition(sourceFile, parent.getStart()).line;
            if (TSUtils.isFunctionScopeBoundary(parent) ||
                    TSUtils.isBlockScopeBoundary(parent) ||
                    (!ts.isBlock(currentNode) && this.isConditionalScoped(currentNode))) {
                nestingLevel++;
            }
            currentNode = parent;
        }
        if (TSUtils.isFunctionScopeBoundary(parent) ||
                TSUtils.isBlockScopeBoundary(parent) ||
                (!ts.isBlock(currentNode) && this.isConditionalScoped(currentNode))) {
            nestingLevel++;
        }
        if (this.nestingLevels.has(node)) {
            nestingLevel += this.nestingLevels.get(node);
        }
        this.nestingLevels.set(node, nestingLevel);
    }

    public getNestingLevel(node?: ts.Node): number | undefined {
        if (!node) { return undefined; }
        let nestingLevel = this.nestingLevels.get(node);
        if (nestingLevel) { return nestingLevel; }
        this.visitNode(node);
        nestingLevel = this.nestingLevels.get(node);
        return nestingLevel;
    }

    /**
     * Checks, whether the given node is a direct descendant of a conditional statement
     * (i.e., an IfStatement or an IterationStatement).
     * @param node The node to be checked
     */
    private isConditionalScoped(node: ts.Node): boolean {
        const parent = node.parent;
        if (!parent) { return false; }
        if (ts.isIfStatement(parent) && (node === parent.thenStatement || node === parent.elseStatement)) {
            return true;
        }
        if (ts.isIterationStatement(parent, false) && (node === parent.statement)) {
            return true;
        }
        return false;
    }

}
