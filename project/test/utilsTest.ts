import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClass, ICommentAnnotation } from "../commentClassificationTypes";
import { SourceComment } from "../sourceComment";
import Utils from "../utils";

describe("is node", () => {
    it("should return false for SourceComments", () => {
        const text = "TestComment";
        const comment = new SourceComment(0, text.length, text);
        const result = Utils.isNode(comment);
        // tslint:disable-next-line:no-unused-expression
        expect(result).to.be.false;
    });
});

describe("is node", () => {
    it("should return true for Nodes", () => {
        const node = ts.createNode(ts.SyntaxKind.EmptyStatement);
        const result = Utils.isNode(node);
        // tslint:disable-next-line:no-unused-expression
        expect(result).to.be.true;
    });
});

describe("create Annotations", () => {
    it("should create an annotation with the correct type for each line of a comment", () => {
        const commentText = "This is the first part,\nwhich is even a multiline comment.";
        const secondPart = "And here is a second part with only one line.";
        const comment = new SourceComment(0, commentText.length, commentText);
        comment.addPart(commentText.length + 1, commentText.length + secondPart.length + 1, secondPart);

        const note = "This is a test note";
        const commentClass = CommentClass.Inline;
        const result = Utils.createAnnotations(comment, commentClass, note);
        expect(result).to.have.lengthOf(3);
        let line = 0;
        result.forEach((annotation) => {
            const expectedAnnotation: ICommentAnnotation = {commentClass, line, note};
            expect(annotation).to.deep.equal(expectedAnnotation);
            line++;
        });
    });
});
