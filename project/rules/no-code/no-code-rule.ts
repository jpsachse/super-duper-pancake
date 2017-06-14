import * as Lint from "tslint";
import * as ts from "typescript";
import { NoCodeWalker } from "./noCodeWalker";

export class Rule extends Lint.Rules.AbstractRule {

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoCodeWalker(sourceFile, "no-code", undefined));
    }
}
