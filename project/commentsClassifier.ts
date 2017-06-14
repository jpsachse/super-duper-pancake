import * as Lint from "tslint";
import * as utils from "tsutils";

enum CommentClass {
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
        return false;
    }

    private setupLinter(): Lint.Linter {
        const options = {
            fix: false,
            rulesDirectory: ["./rules"], ///Users/janphilippsachse/Documents/Studium_lokal/Master/Masterarbeit/ts_rules/
        };
        const linterRules: Map<string, Partial<Lint.IOptions>> = new Map();
        linterRules.set("no-code", {ruleName: "no-code"});
        const configuration = {
            extends: [],
            jsRules: new Map<string, object>(),
            rules: linterRules,
            rulesDirectory: ["./rules"],
        };
        return new Lint.Linter(options);
    }

    private isLicence(): boolean {
        return false;
    }

}