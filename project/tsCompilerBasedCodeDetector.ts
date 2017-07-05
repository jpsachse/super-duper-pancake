import * as ts from "typescript";
import { CodeDetector } from "./codeDetector";
import { CommentClass, ICommentAnnotation } from "./commentClassificationTypes";
import { SourceComment } from "./sourceComment";

export class TsCompilerBasedCodeDetector extends CodeDetector {

    // based on https://gist.github.com/teppeis/6e0f2d823a94de4ae442
    public getAnnotations(comment: SourceComment): ICommentAnnotation[] {
        const result: ICommentAnnotation[] = [];
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
        comment.getSanitizedCommentLines().forEach((commentLine, index) => {
            commentText = commentLine.text;
            const program = ts.createProgram(["file.ts"], compilerOptions, compilerHost);
            const errors = program.getSyntacticDiagnostics();
            // 0 is a very pessimistic approach and currently won't find anything that spans more than one line
            // I have to strike a balance between trying to match every line separately and whole blocks
            if (errors.length === 0) {
                result.push(this.createAnnotation(index));
            }
        });
        return result;
    }

}
