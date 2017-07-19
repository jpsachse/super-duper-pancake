import * as ts from "typescript";
import { CodeDetector } from "./codeDetector";
import { CommentClass, SourceComment } from "./sourceComment";
import Utils from "./utils";

export class TsCompilerBasedCodeDetector extends CodeDetector {

    // based on https://gist.github.com/teppeis/6e0f2d823a94de4ae442
    public annotate(comment: SourceComment) {
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
        const commentLines = comment.getSanitizedCommentLines();
        // Try compiling the comment text with available subsets of continuous lines.
        let start = 0;
        let end = commentLines.length - 1;
        while (start < commentLines.length) {
            while (start <= end) {
                commentText = commentLines.slice(start, end + 1).map((line) => line.text).join("\n");
                commentText = commentText.replace(/^\s+|\s+$/g, "");
                if (commentText.length > 0) {
                    const errors = this.getSyntacticErrors(compilerOptions, compilerHost);
                    if (errors.length === 0) {
                        if (start === 0 && end === commentLines.length - 1) {
                            comment.classifications.push(this.classification);
                            return;
                        }
                        lines.push(...Utils.createRange(start, end));
                        start = end;
                        break;
                    }
                }
                end--;
            }
            start++;
            end = commentLines.length - 1;
        }
        if (lines.length > 0) {
            this.classification.lines = lines;
            comment.classifications.push(this.classification);
        }
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
