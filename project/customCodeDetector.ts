import * as Lint from "tslint";
import { CodeDetector } from "./codeDetector";

export class CustomCodeDetector extends CodeDetector {

    public isCommentedCode(text: string): boolean {
        const linter = this.setupLinter();
        const configuration = this.getLintConfiguration();
        linter.lint("tmpFile", text, configuration);
        const result = linter.getResult();
        let containsCode = false;
        let failureText;
        result.failures.forEach((failure) => {
            if (failure.getRuleName() === "no-code") {
                containsCode = true;
                failureText = failure.getFailure();
                return;
            }
        });
        return containsCode;
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