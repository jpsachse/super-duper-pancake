import * as Lint from "tslint";
import { CodeDetector } from "./codeDetector";
import { CommentClass, ICommentClassification, SourceComment } from "./sourceComment";

export class CustomCodeDetector extends CodeDetector {

    public annotate(comment: SourceComment) {
        const linter = this.setupLinter();
        const configuration = this.getLintConfiguration();
        const lines: number[] = [];
        const commentLines = comment.getSanitizedCommentLines();
        commentLines.forEach((commentLine, index) => {
            linter.lint("tmpFile", commentLine.text, configuration);
            const lintResult = linter.getResult();
            let containsCode = false;
            lintResult.failures.forEach((failure) => {
                if (failure.getRuleName() === "no-code") {
                    containsCode = true;
                    return;
                }
            });
            if (containsCode) {
                lines.push(index);
            }
        });
        if (lines.length === 0) {
            return;
        }
        if (lines.length < commentLines.length) {
            this.classification.lines = lines;
        }
        comment.classifications.push(this.classification);
    }

    private setupLinter(): Lint.Linter {
        const options = {
            fix: false,
            // This has to be relative to the directory in which tslint is called, which is kind of ridiculous.
            rulesDirectory: [this.ruleLocation],
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
            rulesDirectory: [this.ruleLocation],
        };
        return configuration;
    }
}