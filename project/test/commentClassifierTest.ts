import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClassifier } from "../commentClassifier";
import { CommentClass } from "../sourceComment";
import { TsCompilerBasedCodeDetector } from "../tsCompilerBasedCodeDetector";
import { createSourceMap } from "./testHelper";

describe("classify", () => {

    const map = createSourceMap("test/commentClassifierTest/commentClasses.ts");
    const codeDetector = new TsCompilerBasedCodeDetector();
    const classifier = new CommentClassifier(codeDetector, map);

    it("should classify comments before classes as header comment", () => {
        const comments = map.getAllComments();
        const classifications = classifier.classify(comments[0]);
        expect(classifications).to.deep.equal([{ commentClass: CommentClass.Header }]);
    });

    it("should classify comments before members as member comment", () => {
        const comments = map.getAllComments();
        const classifications = classifier.classify(comments[1]);
        expect(classifications).to.deep.equal([{ commentClass: CommentClass.Member }]);
    });

    it("should ignore superfluous tokens", () => {
        const comments = map.getAllComments();
        const classifications = classifier.classify(comments[2]);
        expect(classifications).to.deep.equal([{ commentClass: CommentClass.Member }]);
    });

    it("should classify comments before constructors as header comment", () => {
        const comments = map.getAllComments();
        const classifications = classifier.classify(comments[3]);
        expect(classifications).to.deep.equal([{ commentClass: CommentClass.Header }]);
    });

    it("should classify comments before methods as header comment", () => {
        const comments = map.getAllComments();
        const classifications = classifier.classify(comments[4]);
        expect(classifications).to.deep.equal([{ commentClass: CommentClass.Header }]);
    });

    it("should classify comments in functions as inline comment", () => {
        const comments = map.getAllComments();
        const classifications = classifier.classify(comments[5]);
        expect(classifications).to.deep.equal([{ commentClass: CommentClass.Inline }]);
    });

    it("should classify trailing comments in enums as inline comment", () => {
        const comments = map.getAllComments();
        const classifications = classifier.classify(comments[6]);
        expect(classifications).to.deep.equal([{ commentClass: CommentClass.Inline }]);
    });

    it("should classify trailing comments in functions as inline comment", () => {
        const comments = map.getAllComments();
        const classifications = classifier.classify(comments[7]);
        expect(classifications).to.deep.equal([{ commentClass: CommentClass.Inline }]);
    });

    it("should classify comments before functions as header comment", () => {
        const comments = map.getAllComments();
        const classifications = classifier.classify(comments[8]);
        expect(classifications).to.deep.equal([{ commentClass: CommentClass.Header }]);
    });

});
