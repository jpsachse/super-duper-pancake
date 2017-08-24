import * as Lint from "tslint";
import { CodeDetector } from "./codeDetector";
import { ICommentClassification } from "./commentClassificationTypes";
import { CommentClass, SourceComment } from "./sourceComment";

export class ExistingRuleBasedCodeDetector extends CodeDetector {

    public classify(comment: SourceComment): ICommentClassification[] {
        const classifications: ICommentClassification[] = [];
        const linter = this.setupLinter();
        const configuration = this.getLintConfiguration();
        const lines: number[] = [];
        const commentLines = comment.getSanitizedCommentLines();
        commentLines.forEach((commentLine, index) => {
            linter.lint("tmpFile", commentLine.text, configuration);
            const lintResult = linter.getResult();
            const numberOfTokens = commentLine.text.split(/\s/).length;
            let numberOfFailures = 0;
            lintResult.failures.forEach((failure) => {
                numberOfFailures += failure.getRuleName() === "no-unused-expression" ? 1 : 0;
            });
            if (numberOfFailures / numberOfTokens < 0.5) {
                lines.push(index);
            }
        });
        if (lines.length === 0) { return classifications; }
        if (lines.length < commentLines.length) {
            classifications.push(this.classification(lines));
        } else {
            classifications.push(this.defaultClassification);
        }
        return classifications;

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
        linterRules.set("no-unused-expression", {ruleName: "​no-unused-expression"});
        const configuration = {
            extends: [],
            jsRules: new Map<string, object>(),
            rules: linterRules,
            rulesDirectory: [ this.ruleLocation ],
        };
        return configuration;
    }

}
