import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClass, SourceComment } from "../sourceComment";
import Utils from "../utils";
import { buildComment } from "./testHelper";

describe("add part", () => {

    it("should strip newline chars from the end of a line", () => {
        const commentPart1 = "Hello, world!\n";
        const commentPart2 = "Isn't this awesome?\r\n";
        const commentPart3 = "Even supporting good ol' Windows....\n";
        const comment = buildComment(commentPart1, commentPart2, commentPart3);
        // tslint:disable-next-line:no-string-literal
        const addedParts = comment["commentParts"];
        expect(addedParts).to.have.length(3);
        expect(addedParts[0].text).to.equal("Hello, world!");
        expect(addedParts[0].end).to.equal(13); // length of commentPart1 minus the newline char
        expect(addedParts[1].text).to.equal("Isn't this awesome?");
        expect(addedParts[1].pos).to.equal(14);
        expect(addedParts[1].end).to.equal(33);
        expect(addedParts[2].text).to.equal("Even supporting good ol' Windows....");
        expect(addedParts[2].pos).to.equal(35);
        expect(addedParts[2].end).to.equal(71);
    });

});

describe("get complete comment", () => {

    it("should return all parts joined by a newline character with appropriate pos and end", () => {
        const commentTextPart1 = "Hello, world!";
        const commentTextPart2 = "Can't stop, won't stop!";
        const commentTextPart3 = "Precision German engineering!";
        const comment = buildComment(commentTextPart1, commentTextPart2, commentTextPart3);
        const totalLength = commentTextPart1.length + commentTextPart2.length + commentTextPart3.length;
        const joinedComment = comment.getCompleteComment();
        console.log(joinedComment);
        expect(joinedComment.pos).to.equal(0);
        expect(joinedComment.end).to.equal(totalLength);
        expect(joinedComment.text).to.equal(commentTextPart1 + Utils.newLineChar +
                                            commentTextPart2 + Utils.newLineChar + commentTextPart3);
        // tslint:disable-next-line:no-unused-expression
        expect(joinedComment.jsDoc).to.be.empty;
    });

});

describe("get sanitized lines", () => {

    it("should strip trailing spaces", () => {
        const commentTextPart1 = "Hello, world!   ";
        const commentTextPart2 = "Can't stop, won't stop!   ";
        const comment = buildComment(commentTextPart1, commentTextPart2);
        const lines = comment.getSanitizedCommentLines();
        const expectedResults = ["Hello, world!", "Can't stop, won't stop!"];
        lines.forEach((line, index) => {
            expect(line.text).to.equal(expectedResults[index]);
        });
    });

});

describe("strip comment start tokens", () => {

    it("should strip single line comment tokens from the beginning of lines", () => {
        const commentTextPart1 = "// Hello, world!";
        const commentTextPart2 = "//Can't stop, won't stop!";
        const comment = buildComment();
        // tslint:disable-next-line:no-string-literal
        const text = comment["stripCommentStartTokens"](commentTextPart1 + "\n" + commentTextPart2);
        expect(text).to.equal("Hello, world!\nCan't stop, won't stop!");
    });

    it("should strip multi line comment tokens from the beginning and end of lines", () => {
        const commentTextPart1 = "/* Hello, world!";
        const commentTextPart2 = "Can't stop, won't stop!     */";
        const comment = buildComment();
        // tslint:disable-next-line:no-string-literal
        const text = comment["stripCommentStartTokens"](commentTextPart1 + "\n" + commentTextPart2);
        expect(text).to.equal("Hello, world!\nCan't stop, won't stop!");
    });

    it("should strip leading asterisks in jsdoc style comments", () => {
        const commentTextPart1 = "/* Hello, world!";
        const commentTextPart2 = " * Can't stop, won't stop!";
        const commentTextPart3 = " */";
        const comment = buildComment();
        const text = commentTextPart1 + "\n" + commentTextPart2 + "\n" + commentTextPart3;
        // tslint:disable-next-line:no-string-literal
        const strippedText = comment["stripCommentStartTokens"](text);
        expect(strippedText).to.equal("Hello, world!\nCan't stop, won't stop!\n");
    });

});
