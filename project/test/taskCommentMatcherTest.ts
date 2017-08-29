import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClass, SourceComment } from "../sourceComment";
import { TaskCommentMatcher } from "../taskCommentMatcher";

describe("classify", () => {
    let matcher: TaskCommentMatcher;
    before(() => {
        matcher = new TaskCommentMatcher();
    });

    function expectFullClassification(commentStart: string) {
        const text = commentStart + " this is fun";
        const comment = new SourceComment(0, text.length, text, []);
        const classifications = matcher.classify(comment);
        // tslint:disable-next-line:no-unused-expression
        expect(classifications).to.not.be.empty;
        expect(classifications[0].commentClass).to.equal(CommentClass.Task);
        expect(classifications[0].lines).to.equal(undefined);
    }

    it("should mark line starting with todo", () => {
        expectFullClassification("todo");
    });

    it("should mark line starting with fixme", () => {
        expectFullClassification("fixme");
    });

    it("should mark line starting with xxx", () => {
        expectFullClassification("xxx");
    });

    it("should mark line starting with hack", () => {
        expectFullClassification("hack");
    });

    it("should mark all lines until a trailing period after a starting keyword", () => {
        const text = "TODO this is fun\nStill a comment.\nNo longer a comment.";
        const comment = new SourceComment(0, text.length, text, []);
        const classifications = matcher.classify(comment);
        // tslint:disable-next-line:no-unused-expression
        expect(classifications).to.not.be.empty;
        expect(classifications[0].commentClass).to.equal(CommentClass.Task);
        expect(classifications[0].lines).to.deep.equal([0, 1]);
    });

    it("should not mark lines if starting keyword is not followed by space or colon", () => {
        const text = "hacking away without thinking about implications";
        const comment = new SourceComment(0, text.length, text, []);
        const classifications = matcher.classify(comment);
        // tslint:disable-next-line:no-unused-expression
        expect(classifications).to.be.empty;
    });
});
