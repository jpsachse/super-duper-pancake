import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClass, SourceComment } from "../sourceComment";
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

describe("create range", () => {
    it("should create an array containing all numbers between start and end (inclusive)", () => {
        const range = Utils.createRange(3, 7);
        expect(range).to.deep.equal([3, 4, 5, 6, 7]);
    });
});
