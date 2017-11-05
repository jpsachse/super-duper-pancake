import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { CommentClass, SourceComment } from "../sourceComment";
import Utils from "../utils";

describe("is node", () => {
    it("should return false for SourceComments", () => {
        const text = "TestComment";
        const comment = new SourceComment(0, text.length, text, []);
        const result = Utils.isNode(comment);
        // tslint:disable-next-line:no-unused-expression
        expect(result).to.be.false;
    });

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

describe("splitIntoNormalizedWords", () => {

    it("should split camelCased words into lowercase chunks", () => {
        const words = Utils.splitWords("theseAreSomeCamelCasedWords");
        expect(words).to.deep.equal(["these", "are", "some", "camel", "cased", "words"]);
    });

    it("should split numbers into separate words", () => {
        const words = Utils.splitWords("theseAreSome123numbers12Words");
        expect(words).to.deep.equal(["these", "are", "some", "123", "numbers", "12", "words"]);
    });

    it("should split at existing spaces, underscores and dashes", () => {
        const words = Utils.splitWords("this-isA_very Weird_-text");
        expect(words).to.deep.equal(["this", "is", "a", "very", "weird", "text"]);
    });

    it("should not split ALLCAPS written parts, but instead split at the edges", () => {
        const words = Utils.splitWords("theseAreSomeALLCapsWords");
        expect(words).to.deep.equal(["these", "are", "some", "all", "caps", "words"]);
    });

});

describe("getIntersection", () => {

    it("should return the intersection of two string arrays", () => {
        const intersection = Utils.getIntersection(["declaration", "commented"], ["declaration"]);
        expect(intersection).to.deep.equal(["declaration"]);
    });

    it("should return an empty array if the two given arrays do not intersect", () => {
        const intersection = Utils.getIntersection(["declaration", "commented"], ["stuff", 5]);
        // tslint:disable-next-line:no-unused-expression
        expect(intersection).to.be.empty;
    });
});
