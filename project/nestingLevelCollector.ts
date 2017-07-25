import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { IMetricCollector, SourcePart } from "./commentClassificationTypes";
import Utils from "./utils";

export class NestingLevelCollector implements IMetricCollector {

    private nestingLevels = new Map<number, number>();

    public visitNode(node: SourcePart) {
        if (!Utils.isNode(node)) { return; }
        const sourceFile = node.getSourceFile();
        const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).line;
        if (this.nestingLevels.has(line)) { return; }

        let nestingLevel = 0;
        let parent = node;
        let lineOfParent = ts.getLineAndCharacterOfPosition(sourceFile, parent.getStart()).line;
        while (parent.parent !== undefined && !this.nestingLevels.has(lineOfParent)) {
            parent = parent.parent;
            lineOfParent = ts.getLineAndCharacterOfPosition(sourceFile, parent.getStart()).line;
            nestingLevel++;
        }
        if (this.nestingLevels.has(lineOfParent)) {
            nestingLevel += this.nestingLevels.get(lineOfParent);
        }
        this.nestingLevels.set(line, nestingLevel);
    }

    public getNestingLevel(line: number) {
        return this.nestingLevels.get(line);
    }

}
