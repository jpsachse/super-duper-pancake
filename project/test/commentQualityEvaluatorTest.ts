import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentQualityEvaluator } from "../commentQualityEvaluator";
import { createSourceMap } from "./testHelper";

describe("collectKeywords", () => {

    const map = createSourceMap("test/commentQualityEvaluatorTest/collectKeywords.ts");

    it("should include identifier names of variables and called functions", () => {
        const evaluator = new CommentQualityEvaluator();
        // tslint:disable-next-line:no-string-literal
        const collectedWords = evaluator["collectKeywords"](map, 5, 12);
        expect(collectedWords).to.deep.equal(["console", "log",
                                              "aVariable", "testMethod",
                                              "anotherVariable", "Math", "random",
                                              "aVariable", "anotherVariable",
                                              "console", "log", "aVariable",
                                              "console", "log", "anotherVariable"]);
    });

});
