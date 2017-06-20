import * as Lint from "tslint";
import * as ts from "typescript";
import { CommentClassificationWalker } from "./commentClassificationWalker";

export class Rule extends Lint.Rules.AbstractRule {

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new CommentClassificationWalker(
            sourceFile, "high-comment-quality", new Set(this.ruleArguments.map(String))));
    }
}
