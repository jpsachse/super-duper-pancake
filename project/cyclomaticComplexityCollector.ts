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
        const complexities = new Map<ts.Node, number>();
        const calculate = (child: ts.Node): void => {
            // if (self.isSomeKindOfBlock(child)) {
            if (TSUtils.isFunctionScopeBoundary(child)) {
                const old = complexity;
                complexity = 1;
                child.forEachChild(calculate);
                self.nodeComplexities.set(child, complexity);
                complexities.set(child, complexity);
                complexity = old;
            } else {
                if (self.isIncreasingCyclomaticComplexity(child)) {
                    complexity++;
                }
                return child.forEachChild(calculate);
            }
        };
        calculate(node);
        return complexities;
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

    // private isSomeKindOfBlock(node: ts.Node) {
    //     const scopeBoundary = TSUtils.isScopeBoundary(node);
    //     // return scopeBoundary === TSUtils.ScopeBoundary.Block ||
    //     return       scopeBoundary === TSUtils.ScopeBoundary.Function;
    // }

}
