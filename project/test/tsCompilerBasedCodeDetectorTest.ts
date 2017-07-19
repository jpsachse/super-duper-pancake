import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClass, SourceComment } from "../sourceComment";
import { TsCompilerBasedCodeDetector } from "../tsCompilerBasedCodeDetector";

describe("get annotations", () => {
    let codeDetector: TsCompilerBasedCodeDetector;
    before(() => {
        codeDetector = new TsCompilerBasedCodeDetector();
    });

    it("should create no annotations for english sentence", () => {
        const text = "// This is a comment that resembles an explanation in plain english";
        const comment = new SourceComment(0, text.length, text);
        codeDetector.annotate(comment);
        // tslint:disable-next-line:no-unused-expression
        expect(comment.classifications).to.be.empty;
    });

    it("should create code annotations for single lines of code", () => {
        const text = "console.log();";
        const comment = new SourceComment(0, text.length, text);
        codeDetector.annotate(comment);
        expect(comment.classifications).to.have.lengthOf(1);
        expect(comment.classifications[0].commentClass).to.equal(CommentClass.Code);
        expect(comment.classifications[0].lines).to.equal(undefined);
    });

    it("should create code annotations for code spanning multiple lines and parts", () => {
        const text = "if (true) {\nconsole.log();";
        const comment = new SourceComment(0, text.length, text);
        const secondPart = "}\nconst aNumber = 5;";
        comment.addPart(text.length + 1, text.length + secondPart.length + 1, secondPart);
        codeDetector.annotate(comment);
        expect(comment.classifications).to.have.lengthOf(1);
        expect(comment.classifications[0].lines).to.equal(undefined);
    });

    it("should create code annotations with lines listed if not all lines are code", () => {
        const text = "Now that's my kind of code:\nif (true) {\nconsole.log();";
        const comment = new SourceComment(0, text.length, text);
        const secondPart = "}\nconst aNumber = 5;";
        comment.addPart(text.length + 1, text.length + secondPart.length + 1, secondPart);
        codeDetector.annotate(comment);
        expect(comment.classifications).to.have.lengthOf(1);
        expect(comment.classifications[0].lines).to.have.lengthOf(4);
        expect(comment.classifications[0].lines).to.deep.equal([1, 2, 3, 4]);
    });
});
