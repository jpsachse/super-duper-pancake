import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { IMetricCollector, SourcePart } from "./commentClassificationTypes";
import Utils from "./utils";

export class CyclomaticComplexityCollector implements IMetricCollector {

    private nodeComplexities = new Map<ts.Node, number>();

    public visitNode(node: SourcePart) {
        if (!(Utils.isNode(node) && TSUtils.isFunctionScopeBoundary(node))) {
            return;
        }
        this.calculateCyclomaticComplexity(node);
    }

    public getAllNodes(): ts.Node[] {
        return Array.from(this.nodeComplexities.keys());
    }

    public getComplexity(node: ts.Node): number | undefined {
        return this.nodeComplexities.get(node);
    }

    // based on: https://github.com/palantir/tslint/blob/master/src/rules/cyclomaticComplexityRule.ts
    private calculateCyclomaticComplexity(node: ts.Node) {
        let complexity = 0;
        const self = this;
        const calculate = (child: ts.Node): void => {
            // if (self.isSomeKindOfBlock(child)) {
            if (ts.isFunctionLike(child)) {
                const old = complexity;
                complexity = 1;
                child.forEachChild(calculate);
                self.nodeComplexities.set(child.body, complexity);
                complexity = old;
            } else {
                if (self.isIncreasingCyclomaticComplexity(child)) {
                    complexity++;
                }
                const previous = complexity;
                child.forEachChild(calculate);
                if (ts.isBlock(child)) {
                    self.nodeComplexities.set(child, Math.max(1, complexity - previous));
                }
            }
        };
        calculate(node);
    }

    private isIncreasingCyclomaticComplexity(node: ts.Node): boolean {
        if (node.kind === ts.SyntaxKind.CaseClause) {
            return (node as ts.CaseClause).statements.length > 0;
        }
        if (node.kind === ts.SyntaxKind.BinaryExpression) {
            const operatorKind = (node as ts.BinaryExpression).operatorToken.kind;
            return operatorKind === ts.SyntaxKind.BarBarToken ||
                    operatorKind === ts.SyntaxKind.AmpersandAmpersandToken;
        }
        return node.kind === ts.SyntaxKind.CatchClause ||
            node.kind === ts.SyntaxKind.ConditionalExpression ||
            node.kind === ts.SyntaxKind.DoStatement ||
            node.kind === ts.SyntaxKind.ForStatement ||
            node.kind === ts.SyntaxKind.ForInStatement ||
            node.kind === ts.SyntaxKind.ForOfStatement ||
            node.kind === ts.SyntaxKind.IfStatement ||
            node.kind === ts.SyntaxKind.WhileStatement;
    }

}
