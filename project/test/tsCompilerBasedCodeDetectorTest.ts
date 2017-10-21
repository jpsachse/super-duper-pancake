import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClass, SourceComment } from "../sourceComment";
import { TsCompilerBasedCodeDetector } from "../tsCompilerBasedCodeDetector";
import * as DetectorTestHelper from "./codeDetectorTestHelper";

describe("classify", () => {
    let codeDetector: TsCompilerBasedCodeDetector;
    before(() => {
        codeDetector = new TsCompilerBasedCodeDetector();
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

    it("should classify escaped code in comments", () => {
        DetectorTestHelper.shouldClassifyEscapedCode(codeDetector);
    });
});
