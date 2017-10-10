import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { LinesOfCodeCollector } from "../linesOfCodeCollector";
import { createSourceMap } from "./testHelper";

describe("visitNode", () => {

    const sourceMap = createSourceMap("test/linesOfCodeCollectorTest/testFile.ts");
    const collector = new LinesOfCodeCollector();

    function expectLinesOfCodeForFunction(functionIndex: number, expectedLoc: number) {
        const node = sourceMap.getAllFunctionLikes()[functionIndex];
        collector.visitNode(node);
        // tslint:disable-next-line:no-string-literal
        const locMap = collector["linesOfCode"] as Map<ts.Node, number>;
        expect(locMap.get(node)).to.equal(expectedLoc);
    }

    it("should count all lines with code in them", () => {
        expectLinesOfCodeForFunction(0, 2);
    });

    it("should ignore empty lines", () => {
        expectLinesOfCodeForFunction(1, 2);
    });

    it("should ignore comment-only lines", () => {
        expectLinesOfCodeForFunction(2, 2);
    });

    it("should count code lines even when they start and end with a comment", () => {
        expectLinesOfCodeForFunction(3, 3);
    });

    it("should ignore comment-only lines with multiple comments", () => {
        expectLinesOfCodeForFunction(4, 2);
    });

    it("should include lines with code and braces in them", () => {
        expectLinesOfCodeForFunction(5, 2);
    });

    it("should ignore enclosing brace lines, but include inner braces", () => {
        expectLinesOfCodeForFunction(6, 5);
    });

    it("should return 0 for a function without body", () => {
        expectLinesOfCodeForFunction(7, 0);
    });

});
