import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { SourcePart } from "../commentClassificationTypes";
import { NestingLevelCollector } from "../nestingLevelCollector";
import Utils from "../utils";
import { createSourceMap } from "./testHelper";

describe("visitNode", () => {

    const sourceMap = createSourceMap("test/nestingLevelCollectorTest/testFile.ts");
    const collector = new NestingLevelCollector();

    it("should calculate a nesting level of 0 for nodes that are direct children of the source file", () => {
        const node = sourceMap.getMostEnclosingNodeForLine(1);
        collector.visitNode(node);
        expect(collector.getNestingLevel(node)).to.equal(0);
    });

    it("should calculate a nesting level of 2 for nodes that are in a method in a class", () => {
        const node = sourceMap.getMostEnclosingNodeForLine(4);
        collector.visitNode(node);
        expect(collector.getNestingLevel(node)).to.equal(2);
    });

    it("should calculate a nesting level of 3 for nodes that are in an arrow function in a method in a class", () => {
        const node = sourceMap.getMostEnclosingNodeForLine(5);
        collector.visitNode(node);
        expect(collector.getNestingLevel(node)).to.equal(3);
    });

    it("enums should not increase the nesting level", () => {
        const node = sourceMap.getMostEnclosingNodeForLine(14);
        collector.visitNode(node);
        expect(collector.getNestingLevel(node)).to.equal(0);
    });

    it("JS object definitions should not increase the nesting level", () => {
        // Get a node inside the object literal
        // tslint:disable-next-line:no-string-literal
        const nodes = (sourceMap["nodesOfLine"] as Map<number, SourcePart[]>).get(18);
        let node: ts.Node;
        for (let i = nodes.length - 1; i > 0; --i) {
            const candidate = nodes[i];
            if (Utils.isNode(candidate) && ts.isPropertyAssignment(candidate)) {
                node = candidate;
                break;
            }
        }
        collector.visitNode(node);
        expect(collector.getNestingLevel(node)).to.equal(0);
    });

});
