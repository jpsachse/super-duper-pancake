import { expect } from "chai";
import { readFileSync } from "fs";
import "mocha";
import * as ts from "typescript";
import { SourceMap } from "../sourceMap";
import Utils from "../utils";

function createSourceMap(fileName: string): SourceMap {
    const sourceFile = ts.createSourceFile(fileName,
                                           readFileSync(fileName).toString(),
                                           ts.ScriptTarget.Latest,
                                           true);
    return new SourceMap(sourceFile, []);
}

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
