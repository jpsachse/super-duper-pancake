import * as Lint from "tslint";
import * as utils from "tsutils";

export enum CommentClass {
    Copyright,
    Header,
    Inline,
    Section,
    Code,
    Task,
    Unknown,
}

export class CommentsClassifier {

// Comment categories from "Quality analysis of source code comments."
//   - Copyright comments
//   - Header comments
//   - Member comments
//   - Inline comments
//   - Section comments
//   - Code comments
//   - Task comments

    public classify(commentText: string): CommentClass {
        if (this.isCommentedCode(commentText)) {
            return CommentClass.Code;
        }
        return CommentClass.Unknown;
    }

    private isCommentedCode(commentText: string): boolean {
        const linter = this.setupLinter();
        const configuration = this.getLintConfiguration();
        const cleanedText = this.stripCommentTokens(commentText);
        linter.lint("tmpFile", cleanedText, configuration);
        const result = linter.getResult();
        let containsCode = false;
        result.failures.forEach((failure) => {
            if (failure.getRuleName() === "no-code") {
                console.log("contains code!");
                containsCode = true;
                return;
            }
        });
        return containsCode;
    }

    private stripCommentTokens(text: string): string {
        const re = /^\s*(\/\/)|(\/\*)/;
        return text.replace(re, "");
    }

    private setupLinter(): Lint.Linter {
        const options = {
            fix: false,
            // This either has to be relative to the file that calls classify() or the directory,
            // in which tslint is called, which is kind of ridiculous.
            rulesDirectory: ["../repo/project/rules/no-code"],
        };
        return new Lint.Linter(options);
    }

    private getLintConfiguration(): Lint.Configuration.IConfigurationFile {
        const linterRules: Map<string, Partial<Lint.IOptions>> = new Map();
        linterRules.set("no-code", {ruleName: "no-code"});
        const configuration = {
            extends: [],
            jsRules: new Map<string, object>(),
            rules: linterRules,
            rulesDirectory: ["../repo/project/rules/no-code"],
        };
        return configuration;
    }

    private isLicence(): boolean {
        return false;
    }

}
