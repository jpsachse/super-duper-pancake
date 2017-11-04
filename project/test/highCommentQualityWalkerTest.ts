import { expect } from "chai";
import { readFileSync } from "fs";
import "mocha";
import * as ts from "typescript";
import { HighCommentQualityWalkerV2 } from "../highCommentQualityWalkerV2";
import { CyclomaticComplexityCollector, LinesOfCodeCollector } from "../metricCollectors";
import { CommentClass } from "../sourceComment";
import { TsCompilerBasedCodeDetector } from "../tsCompilerBasedCodeDetector";

function createWalker(fileName: string): HighCommentQualityWalkerV2<Set<object>> {
    const sourceFile = ts.createSourceFile(fileName,
        readFileSync(fileName).toString(),
        ts.ScriptTarget.Latest,
        true);
    const locCollector = new LinesOfCodeCollector();
    const ccCollector = new CyclomaticComplexityCollector();
    const codeDetector = new TsCompilerBasedCodeDetector();
    const walker = new HighCommentQualityWalkerV2(
        sourceFile, "high-comment-quality", new Set(),
        locCollector, ccCollector, codeDetector);
    walker.walk(sourceFile);
    return walker;
}
// tslint:disable:no-string-literal
describe("filterLinesInUnacceptableContext", () => {

    it("should filter code in @example jsDoc tags", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/filterLinesInUnacceptableContext.ts");
        const commentClassification = walker["commentStats"].entries().next().value;
        const comment = commentClassification[0];
        const codeClassification = commentClassification[1].classifications.find((c) => {
            return c.commentClass === CommentClass.Code;
        });
        const unacceptableLines = walker["getUnescapedCodeLines"](codeClassification, comment);
        expect(unacceptableLines).to.not.include(7);
        expect(unacceptableLines).to.not.include(8);
    });

    it("should filter code that is ``` escaped in jsDoc comment ", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/filterLinesInUnacceptableContext.ts");
        const commentClassification = walker["commentStats"].entries().next().value;
        const comment = commentClassification[0];
        const codeClassification = commentClassification[1].classifications.find((c) => {
            return c.commentClass === CommentClass.Code;
        });
        const unacceptableLines = walker["getUnescapedCodeLines"](codeClassification, comment);
        expect(unacceptableLines).to.not.include(3);
        expect(unacceptableLines).to.not.include(4);
        expect(unacceptableLines).to.not.include(5);
    });

    it("should filter code that is ``` escaped in a normal comment", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/filterLinesInUnacceptableContext.ts");
        const commentStats = walker["commentStats"];
        const iterator = commentStats.entries();
        iterator.next();
        const commentClassification = iterator.next().value;
        const comment = commentClassification[0];
        const codeClassification = commentClassification[1].classifications.find((c) => {
            return c.commentClass === CommentClass.Code;
        });
        const unacceptableLines = walker["getUnescapedCodeLines"](codeClassification, comment);
        expect(unacceptableLines).to.not.include(3);
        expect(unacceptableLines).to.not.include(4);
        expect(unacceptableLines).to.not.include(5);
    });

    it("should not filter code that is not escaped in a normal comment", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/filterLinesInUnacceptableContext.ts");
        const commentStats = walker["commentStats"];
        const iterator = commentStats.entries();
        iterator.next();
        const commentClassification = iterator.next().value;
        const comment = commentClassification[0];
        const codeClassification = commentClassification[1].classifications.find((c) => {
            return c.commentClass === CommentClass.Code;
        });
        const unacceptableLines = walker["getUnescapedCodeLines"](codeClassification, comment);
        expect(unacceptableLines).to.include(1);
        expect(unacceptableLines).to.include(6);
    });

    it("should not filter code that is not escaped or in @example tags", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/filterLinesInUnacceptableContext.ts");
        const commentClassification = walker["commentStats"].entries().next().value;
        const comment = commentClassification[0];
        const codeClassification = commentClassification[1].classifications.find((c) => {
            return c.commentClass === CommentClass.Code;
        });
        const unacceptableLines = walker["getUnescapedCodeLines"](codeClassification, comment);
        expect(unacceptableLines).to.include(2);
        expect(unacceptableLines).to.include(6);
    });
});

describe("findSections", () => {

    it("should start and end a section in function start and end lines", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/findSections.ts");
        const sections = walker["sections"];
        expect(sections.search(1, 9)).to.deep.include({low: 1, high: 13});
    });

    it("should start and end a section at block start and end lines of ifs", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/findSections.ts");
        const sections = walker["sections"];
        expect(sections.search(4, 6)).to.deep.include({low: 5, high: 6});
    });

    it("should end a section on empty lines", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/findSections.ts");
        const sections = walker["sections"];
        expect(sections.search(7, 7)).to.deep.include({low: 2, high: 7});
    });

    it("should start a new section in the first line containing a node after whitespace", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/findSections.ts");
        const sections = walker["sections"];
        expect(sections.search(9, 9)).to.deep.include({low: 9, high: 9});
    });

    it("should end a section with long comments", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/findSections.ts");
        const sections = walker["sections"];
        expect(sections.search(9, 9)).to.deep.include({low: 9, high: 9});
    });

    it("should start a new section in the first line containing a node after a long comment", () => {
        const walker = createWalker("test/highCommentQualityWalkerTest/findSections.ts");
        const sections = walker["sections"];
        expect(sections.search(12, 12)).to.deep.include({low: 12, high: 13});
    });

});
