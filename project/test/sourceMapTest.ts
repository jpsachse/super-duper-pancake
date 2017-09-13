import { expect } from "chai";
import "mocha";
import * as ts from "typescript";
import { SourceMap } from "../sourceMap";
import Utils from "../utils";
import { createSourceMap } from "./testHelper";

describe("getAllFunctionLikes", () => {

    it("should include functions", () => {
        const map = createSourceMap("test/sourceMapTest/function.ts");
        const functions = map.getAllFunctionLikes().filter((functionDecl) => {
            return functionDecl.name.getText() === "foo" || functionDecl.name.getText() === "baz";
        });
        expect(functions.length).to.equal(2);
    });

    it("should include methods and constructors", () => {
        const map = createSourceMap("test/sourceMapTest/method.ts");
        const functions = map.getAllFunctionLikes().filter((functionDecl) => {
            return functionDecl.kind === ts.SyntaxKind.Constructor ||
                    functionDecl.name.getText() === "bar" ||
                    functionDecl.name.getText() === "foo" ||
                    functionDecl.name.getText() === "baz";
        });
        expect(functions.length).to.equal(4);
    });

    it("should include arrow functions", () => {
        const map = createSourceMap("test/sourceMapTest/arrowFunction.ts");
        const functions = map.getAllFunctionLikes().filter((functionDecl) => {
            return functionDecl.kind === ts.SyntaxKind.ArrowFunction ||
                    functionDecl.name.getText() === "foo";
        });
        expect(functions.length).to.equal(2);
    });

});

describe("getFirstNodeAfterLine", () => {

    it("should return the first node in the next line", () => {
        const map = createSourceMap("test/sourceMapTest/getFirstNodeAfterLine.ts");
        let node = map.getFirstNodeAfterLine(0);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.FunctionDeclaration);
        node = map.getFirstNodeAfterLine(1);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.VariableStatement);
        node = map.getFirstNodeAfterLine(3);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.ReturnStatement);
    });

    it("should return undefined if there is no node in the next line", () => {
        const map = createSourceMap("test/sourceMapTest/getFirstNodeAfterLine.ts");
        const node = map.getFirstNodeAfterLine(2);
        expect(node).to.equal(undefined);
    });

});

describe("getFirstNodeAfterLineOfNode", () => {

    it("should return the first node in the next line after a function block", () => {
        const map = createSourceMap("test/sourceMapTest/getFirstNodeAfterLine.ts");
        let node = map.getFirstNodeInLine(1);
        node = map.getFirstNodeAfterLineOfNode(node);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.ExpressionStatement);
        expect((node as ts.ExpressionStatement).expression.kind).to.equal(ts.SyntaxKind.CallExpression);
    });

    function getLastNodeOfFirstLine(map: SourceMap): ts.Node {
        return map.getSourcePartBefore(map.getFirstNodeInLine(2)) as ts.Node;
    }

    it("should return undefined if no node is given", () => {
        const map = createSourceMap("test/sourceMapTest/getFirstNodeAfterLine.ts");
        expect(map.getFirstNodeAfterLineOfNode(undefined)).to.equal(undefined);
    });

    it("should return the first node in the line following the given node", () => {
        const map = createSourceMap("test/sourceMapTest/getFirstNodeAfterLine.ts");
        let node = getLastNodeOfFirstLine(map);
        node = map.getFirstNodeAfterLineOfNode(node);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.VariableStatement);
    });

    it("should return undefined if there is no node in the next line", () => {
        const map = createSourceMap("test/sourceMapTest/getFirstNodeAfterLine.ts");
        let node = map.getFirstNodeInLine(2);
        node = map.getFirstNodeAfterLineOfNode(node);
        expect(node).to.equal(undefined);
    });

    it("should return the first node in the next line in a class environment", () => {
        const map = createSourceMap("test/sourceMapTest/getFirstNodeAfterLine.ts");
        let node = map.getFirstNodeInLine(10);
        node = map.getFirstNodeAfterLineOfNode(node);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.PropertyDeclaration);
    });

});

describe("getFirstNodeInLine", () => {

    it("should return the first node in the requested line", () => {
        const map = createSourceMap("test/sourceMapTest/getFirstNodeAfterLine.ts");
        let node = map.getFirstNodeInLine(1);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.FunctionDeclaration);
        node = map.getFirstNodeInLine(2);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.VariableStatement);
        node = map.getFirstNodeInLine(4);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.ReturnStatement);
    });

    it("should return undefined if there is no node in the line", () => {
        const map = createSourceMap("test/sourceMapTest/getFirstNodeAfterLine.ts");
        const node = map.getFirstNodeInLine(3);
        expect(node).to.equal(undefined);
    });

});

describe("getSourcePartBefore", () => {

    it("should return the last source part in the line directly above the given node", () => {
        const map = createSourceMap("test/sourceMapTest/getSourcePartBefore.ts");
        const commentNodes = map.getCommentsInLine(4);
        let sourcePart = map.getSourcePartBefore(commentNodes[0]);
        // tslint:disable-next-line:no-unused-expression
        expect(Utils.isNode(sourcePart)).to.be.true;
        let node = sourcePart as ts.Node;
        expect(node.kind).to.equal(ts.SyntaxKind.OpenBraceToken);
        const returnStatement = map.getFirstNodeInLine(6);
        sourcePart = map.getSourcePartBefore(returnStatement);
        // tslint:disable-next-line:no-unused-expression
        expect(Utils.isNode(sourcePart)).to.be.true;
        node = sourcePart as ts.Node;
        expect(node.kind).to.equal(ts.SyntaxKind.SemicolonToken);
    });

});

describe("getMostEnclosingNodeForLine", () => {

    it("should return the first statement of several chained ones", () => {
        const map = createSourceMap("test/sourceMapTest/getMostEnclosingNodeForLine.ts");
        const node = map.getMostEnclosingNodeForLine(1);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.ExpressionStatement);
        const lineAndChar = map.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        expect(lineAndChar.character).to.equal(0);
        expect(lineAndChar.line).to.equal(1);
    });

    it("should return undefined for an empty line", () => {
        const map = createSourceMap("test/sourceMapTest/getMostEnclosingNodeForLine.ts");
        const node = map.getMostEnclosingNodeForLine(0);
        expect(node).to.equal(undefined);
    });

    it("should return undefined for an empty line in a block", () => {
        const map = createSourceMap("test/sourceMapTest/getMostEnclosingNodeForLine.ts");
        const node = map.getMostEnclosingNodeForLine(4);
        expect(node).to.equal(undefined);
    });

    it("should return the enclosing node when requested for a line in a multiline call", () => {
        const map = createSourceMap("test/sourceMapTest/getMostEnclosingNodeForLine.ts");
        const node = map.getMostEnclosingNodeForLine(8);
        expect(node).to.not.equal(undefined);
        expect(node.kind).to.equal(ts.SyntaxKind.ExpressionStatement);
    });

});

describe("isBlockStartingInLine", () => {

    it("should  return true if a block starts in the line", () => {
        const map = createSourceMap("test/sourceMapTest/blockStarts.ts");
        // tslint:disable:no-unused-expression
        expect(map.isBlockStartingInLine(3)).to.be.true;
        expect(map.isBlockStartingInLine(5)).to.be.true;
        // tslint:enable:no-unused-expression
    });

    it("should return false if no block starts in the line", () => {
        const map = createSourceMap("test/sourceMapTest/blockStarts.ts");
        // tslint:disable:no-unused-expression
        expect(map.isBlockStartingInLine(2)).to.be.false;
        expect(map.isBlockStartingInLine(6)).to.be.false;
        // tslint:enable:no-unused-expression
    });

});

describe("getBlockStartingInLine", () => {

    it("should return a block if it starts in the line", () => {
        const map = createSourceMap("test/sourceMapTest/blockStarts.ts");
        expect(map.getBlockStartingInLine(3)).to.not.equal(undefined);
    });

    it("should return undefined if no block starts in the line", () => {
        const map = createSourceMap("test/sourceMapTest/blockStarts.ts");
        expect(map.getBlockStartingInLine(2)).to.equal(undefined);
    });

    it("should return the first block that starts in a line", () => {
        const map = createSourceMap("test/sourceMapTest/blockStarts.ts");
        const startedBlock = map.getBlockStartingInLine(5);
        const lineAndChar = map.sourceFile.getLineAndCharacterOfPosition(startedBlock.getStart());
        expect(lineAndChar.line).to.equal(5);
        expect(lineAndChar.character).to.equal(26);
    });

});

describe("getCommentsWithDistanceClosestToLine", () => {

    it("should return the closest comment not after the line with the corrensponding distance", () => {
        const map = createSourceMap("test/sourceMapTest/lineComments.ts");
        const comments = map.getCommentsWithDistanceClosestToLine(6);
        expect(comments.length).to.equal(1);
        const commentDistance = comments[0];
        expect(commentDistance.distance).to.equal(1);
        const expectedText = "This is commenting the return statement.";
        expect(commentDistance.comment.getSanitizedCommentText().text).to.equal(expectedText);
    });

    it("should return a comment in the same line", () => {
        const map = createSourceMap("test/sourceMapTest/lineComments.ts");
        const comments = map.getCommentsWithDistanceClosestToLine(5);
        expect(comments.length).to.equal(1);
        const commentDistance = comments[0];
        expect(commentDistance.distance).to.equal(0);
        const expectedText = "This is commenting the return statement.";
        expect(commentDistance.comment.getSanitizedCommentText().text).to.equal(expectedText);
    });

    it("should return an empty array if there are no comments before the line", () => {
        const map = createSourceMap("test/sourceMapTest/lineComments.ts");
        const comments = map.getCommentsWithDistanceClosestToLine(0);
        expect(comments.length).to.equal(0);
    });

});
