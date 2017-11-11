import * as ts from "typescript";
import { CodeDetector } from "./codeDetector";
import { ICommentClassification } from "./commentClassificationTypes";
import { CommentClass, SourceComment } from "./sourceComment";
import Utils from "./utils";

export class TsCompilerBasedCodeDetector extends CodeDetector {

    // based on https://gist.github.com/teppeis/6e0f2d823a94de4ae442
    public classify(comment: SourceComment): ICommentClassification[] {
        const classifications: ICommentClassification[] = [];
        const jsDocs = comment.getCompleteComment().jsDoc;
        const commentLines = comment.getSanitizedCommentLines().map((line) => line.text);
        if (jsDocs.length === 0) {
            const lines = this.classifyLinesOfText(commentLines);
            if (lines.length > 0) {
                const classification = this.defaultClassification;
                if (lines.length === commentLines.length) { return [classification]; }
                classification.lines = lines;
                classifications.push(classification);
            }
            return classifications;
        }
        const codeLines: number[] = [];
        jsDocs.forEach((jsDoc) => {
            let textLines = jsDoc.comment.split("\n");
            // increase line index by 1, as the text of JSDoc comments generally starts in the second line
            codeLines.push(...this.classifyLinesOfText(textLines).map((line) => line + 1));
            let lineOffset = textLines.length + 1;
            jsDoc.forEachChild((child) => {
                if (Utils.isJSDocTag(child)) {
                    textLines = child.comment.split("\n");
                    const childCodeLines = this.classifyLinesOfText(textLines).map((line) => line + lineOffset);
                    codeLines.push(...childCodeLines);
                    lineOffset += childCodeLines.length;
                }
            });
        });
        if (codeLines.length > 0) {
            const classification = this.defaultClassification;
            if (codeLines.length === commentLines.length) { return [classification]; }
            classification.lines = codeLines;
            classifications.push(classification);
        }
        return classifications;
    }

    private classifyLinesOfText(textLines: string[]): number[] {
        const lines: number[] = [];
        let commentText: string;
        const compilerOptions: ts.CompilerOptions = {};
        // Create a compilerHost object to allow the compiler to read and write files
        const compilerHost = {
            fileExists: (filename) => false,
            getCanonicalFileName: (filename) => filename,
            getCurrentDirectory: () => "",
            getDefaultLibFileName: () => "",
            getDirectories: (path: string) => [path],
            getNewLine: () => "\n",
            getSourceFile: (filename, languageVersion) => {
                if (filename === "file.ts") {
                    return ts.createSourceFile(filename, commentText, compilerOptions.target, false);
                }
                return undefined;
            },
            readFile: (filename) => commentText,
            useCaseSensitiveFileNames: () => false,
            writeFile: (name, text, writeByteOrderMark) => { return; },
        };
        // Try compiling the comment text with available subsets of continuous lines.
        let start = 0;
        let end = textLines.length - 1;
        while (start < textLines.length) {
            while (start <= end) {
                commentText = textLines.slice(start, end + 1).join("\n");
                commentText = commentText.replace(/^\s+|\s+$/g, "");
                if (commentText.length > 0) {
                    const errors = this.getSyntacticErrors(compilerOptions, compilerHost);
                    if (errors.length === 0) {
                        if (start === 0 && end === textLines.length - 1) {
                            return Utils.createRange(start, end);
                        }
                        lines.push(...Utils.createRange(start, end));
                        start = end;
                        break;
                    }
                }
                end--;
            }
            start++;
            end = textLines.length - 1;
        }
        return lines;
    }

    private getSyntacticErrors(compilerOptions: ts.CompilerOptions,
                               compilerHost: ts.CompilerHost): ts.Diagnostic[] {
        const program = ts.createProgram(["file.ts"], compilerOptions, compilerHost);
        const onlyErrors = (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error;
        const missingBracket = /^\'\}|\)\' expected/;
        const withoutMissingClosingBrackets = (diagnostic: ts.Diagnostic) => {
            if (typeof diagnostic.messageText === "string") {
                return diagnostic.messageText.toString().search(missingBracket) === -1;
            }
            return true;
        };
        return program.getSyntacticDiagnostics().filter(onlyErrors).filter(withoutMissingClosingBrackets);
    }

}
