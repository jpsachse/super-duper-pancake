import * as Lint from "tslint";
import * as ts from "typescript";
import { HighCommentQualityWalker } from "./highCommentQualityWalker";
import { CyclomaticComplexityCollector, LinesOfCodeCollector } from "./metricCollectors";
import { TsCompilerBasedCodeDetector } from "./tsCompilerBasedCodeDetector";

export class Rule extends Lint.Rules.AbstractRule {

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        const locCollector = new LinesOfCodeCollector();
        const ccCollector = new CyclomaticComplexityCollector();
        const codeDetector = new TsCompilerBasedCodeDetector();
        return this.applyWithWalker(new HighCommentQualityWalker(
            sourceFile, "high-comment-quality", new Set(this.ruleArguments.map(String)),
            locCollector, ccCollector, codeDetector));
    }
}
