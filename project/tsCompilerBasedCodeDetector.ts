import * as ts from "typescript";
import { CodeDetector } from "./codeDetector";
import { CommentClass, ICommentAnnotation } from "./commentClassificationTypes";
import { SourceComment } from "./sourceComment";

export class TsCompilerBasedCodeDetector extends CodeDetector {

    // based on https://gist.github.com/teppeis/6e0f2d823a94de4ae442
    public getAnnotations(comment: SourceComment): ICommentAnnotation[] {
        let result: ICommentAnnotation[] = [];
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
        // Try to compile the whole comment first and see if it works.
        commentText = comment.getSanitizedCommentText().text;
        let errors = this.getSyntacticErrors(compilerOptions, compilerHost);
        if (errors.length === 0) {
            return this.createAnnotations(0, commentLines.length);
        }
        // If the compilation did not work for the whole comment text, try it again with
        // all available subsets of continuous lines.
        let start = 1;
        let end = commentLines.length - 1;
        while (start < commentLines.length) {
            while (start <= end) {
                // TODO: don't include leading/trailing empty lines
                commentText = commentLines.slice(start, end + 1).map((line) => line.text).join("\n");
                commentText = commentText.replace(/^\s+|\s+$/g, "");
                if (commentText.length > 0) {
                    errors = this.getSyntacticErrors(compilerOptions, compilerHost);
                    if (errors.length === 0) {
                        result = result.concat(this.createAnnotations(start, end));
                        errors = [];
                        start = end;
                        break;
                    }
                }
                end--;
            }
            start++;
            end = commentLines.length;
        }
        return result;
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
