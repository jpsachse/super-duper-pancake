import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { IMetricCollector, SourcePart } from "./commentClassificationTypes";
import Utils from "./utils";

export class HalsteadCollector implements IMetricCollector {

    public visitNode(node: SourcePart) {
        if (!Utils.isNode(node)) {
            return;
        }

    }

}
