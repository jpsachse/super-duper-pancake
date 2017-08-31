import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClass, SourceComment } from "../sourceComment";

function buildComment(lines?: string[]): SourceComment {
    if (!lines || lines.length === 0) {
        return new SourceComment(0, 0, "", []);
    }
    let result: SourceComment;
    let currentPos = 0;
    lines.forEach((line) => {
        currentPos += line.length;
        if (!result) {
            result = new SourceComment(0, currentPos, line, []);
        } else {
            result.addPart(currentPos - line.length, currentPos, line, []);
        }
    });
    return result;
}

describe("get complete comment", () => {

    it("should return all parts joined by a newline character with appropriate pos and end", () => {
        const commentTextPart1 = "Hello, world!";
        const commentTextPart2 = "Can't stop, won't stop!";
        const commentTextPart3 = "Precision German engineering!";
        const allComments = [commentTextPart1, commentTextPart2, commentTextPart3];
        const comment = buildComment(allComments);
        const totalLength = allComments.reduce((previous, current) => {
            return previous + current.length;
        }, 0);
        const joinedComment = comment.getCompleteComment();
        expect(joinedComment.pos).to.equal(0);
        expect(joinedComment.end).to.equal(totalLength);
        expect(joinedComment.text).to.equal(commentTextPart1 + "\n" + commentTextPart2 + "\n" + commentTextPart3);
        // tslint:disable-next-line:no-unused-expression
        expect(joinedComment.jsDoc).to.be.empty;
    });

});

describe("get sanitized lines", () => {

    it("should strip trailing spaces", () => {
        const commentTextPart1 = "Hello, world!   ";
        const commentTextPart2 = "Can't stop, won't stop!   ";
        const comment = buildComment([commentTextPart1, commentTextPart2]);
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
