import * as Lint from "tslint";
import { CodeDetector } from "./codeDetector";
import { CommentClass, ICommentAnnotation } from "./commentClassificationTypes";
import { SourceComment } from "./sourceComment";

export class ExistingRuleBasedCodeDetector extends CodeDetector {

    public getAnnotations(comment: SourceComment): ICommentAnnotation[] {
        const linter = this.setupLinter();
        const configuration = this.getLintConfiguration();
        const result: ICommentAnnotation[] = [];
        comment.getSanitizedCommentLines().forEach((commentLine, index) => {
            linter.lint("tmpFile", commentLine.text, configuration);
            const lintResult = linter.getResult();
            const numberOfTokens = commentLine.text.split(/\s/).length;
            let numberOfFailures = 0;
            lintResult.failures.forEach((failure) => {
                numberOfFailures += failure.getRuleName() === "no-unused-expression" ? 1 : 0;
            });
            if (numberOfFailures / numberOfTokens < 0.5) {
                result.push(this.createAnnotation(index));
            }
        });
        return result;
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
