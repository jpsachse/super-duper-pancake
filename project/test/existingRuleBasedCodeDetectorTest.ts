import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { ExistingRuleBasedCodeDetector } from "../existingRuleBasedCodeDetector";
import { CommentClass, SourceComment } from "../sourceComment";
import * as DetectorTestHelper from "./codeDetectorTestHelper";

describe("classify", () => {
    let codeDetector: ExistingRuleBasedCodeDetector;
    before(() => {
        codeDetector = new ExistingRuleBasedCodeDetector("./node-modules/tslint/lib/rules");
    });

    it("should recognize a simple method call", () => {
        DetectorTestHelper.shouldClassifySimpleMethodCall(codeDetector);
    });

    it("should create no annotations for english sentence", () => {
        DetectorTestHelper.shouldNotClassifyEnglish(codeDetector);
    });

    it("should create code annotations for code spanning multiple lines and parts", () => {
        DetectorTestHelper.shouldClassifyMultilineCode(codeDetector);
    });

    it("should create code annotations with lines listed if not all lines are code", () => {
        DetectorTestHelper.shouldClassifyPartialCodeComments(codeDetector);
    });
});
