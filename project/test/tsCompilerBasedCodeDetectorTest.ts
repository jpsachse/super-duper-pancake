import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClass, ICommentAnnotation } from "../commentClassificationTypes";
import { SourceComment } from "../sourceComment";
import { TsCompilerBasedCodeDetector } from "../tsCompilerBasedCodeDetector";

describe("get annotations", () => {
    let codeDetector: TsCompilerBasedCodeDetector;
    before(() => {
        codeDetector = new TsCompilerBasedCodeDetector();
    });

    it("should create no annotations for english sentence", () => {
        const text = "// This is a comment that resembles an explanation in plain english";
        const comment = new SourceComment(0, text.length, text);
        const annotations = codeDetector.getAnnotations(comment);
        // tslint:disable-next-line:no-unused-expression
        expect(annotations).to.be.empty;
    });

    it("should create code annotations for single lines of code", () => {
        const text = "console.log();";
        const comment = new SourceComment(0, text.length, text);
        const annotations = codeDetector.getAnnotations(comment);
        expect(annotations).to.have.lengthOf(1);
        expect(annotations[0].commentClass).to.equal(CommentClass.Code);
    });

    it("should create code annotations for code spanning multiple lines and parts", () => {
        const text = "if (true) {\nconsole.log();";
        const comment = new SourceComment(0, text.length, text);
        const secondPart = "}\nconst aNumber = 5;";
        comment.addPart(text.length + 1, text.length + secondPart.length + 1, secondPart);
        const annotations = codeDetector.getAnnotations(comment);
        expect(annotations).to.have.lengthOf(4);
        annotations.forEach((annotation, line) => {
            const expectedAnnotation: ICommentAnnotation = {
                commentClass: CommentClass.Code,
                line,
                note: "Code should not be part of a comment",
            };
            expect(annotation).to.deep.equal(expectedAnnotation);
        });
    });
});
