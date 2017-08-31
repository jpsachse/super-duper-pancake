import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CodeDetector } from "../codeDetector";
import { CommentClass } from "../sourceComment";
import { buildComment } from "./testHelper";

export function shouldClassifySimpleMethodCall(detector: CodeDetector) {
    const commentText = "// console.log(\"Hello, world!\");";
    const comment = buildComment(commentText);
    const result = detector.classify(comment);
    expect(result.length).to.equal(1);
    expect(result[0].commentClass).to.equal(CommentClass.Code);
    // tslint:disable-next-line:no-unused-expression
    expect(result[0].lines).to.equal(undefined);
}

export function shouldNotClassifyEnglish(detector: CodeDetector) {
    const text = "// This is a comment that resembles an explanation in plain english";
    const comment = buildComment(text);
    const classifications = detector.classify(comment);
    // tslint:disable-next-line:no-unused-expression
    expect(classifications).to.be.empty;
}

export function shouldClassifyMultilineCode(detector: CodeDetector) {
    const firstPart = "if (true) {\nconsole.log();";
    const secondPart = "}\nconst aNumber = 5;";
    const comment = buildComment(firstPart, secondPart);
    const classifications = detector.classify(comment);
    expect(classifications).to.have.lengthOf(1);
    expect(classifications[0].lines).to.equal(undefined);
}

export function shouldClassifyPartialCodeComments(detector: CodeDetector) {
    const firstPart = "Now that's my kind of code:\nif (true) {\nconsole.log();";
    const secondPart = "}\nconst aNumber = 5;";
    const comment = buildComment(firstPart, secondPart);
    const classifications = detector.classify(comment);
    expect(classifications).to.have.lengthOf(1);
    expect(classifications[0].lines).to.have.lengthOf(4);
    expect(classifications[0].lines).to.deep.equal([1, 2, 3, 4]);
}
