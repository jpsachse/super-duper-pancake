import * as Lint from "tslint";
import { CodeDetector } from "./codeDetector";

export class ExistingRuleBasedCodeDetector extends CodeDetector {

    public isCommentedCode(text: string): boolean {
        const linter = this.setupLinter();
        const configuration = this.getLintConfiguration();
        linter.lint("tmpFile", text, configuration);
        const result = linter.getResult();
        const numberOfTokens = text.split(/\s/).length;
        let numberOfFailures = 0;
        result.failures.forEach((failure) => {
            numberOfFailures += failure.getRuleName() === "no-unused-expression" ? 1 : 0;
        });
        return numberOfFailures / numberOfTokens < 0.5;
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
