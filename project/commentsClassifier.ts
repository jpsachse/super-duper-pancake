import * as Lint from "tslint";
import * as utils from "tsutils";
import {ICommentPart, SourceComment} from "./sourceComment";

export enum CommentClass {
    Copyright,
    Header,
    Inline,
    Section,
    Code,
    Task,
    Unknown,
}

export interface ICommentClassification {
    commentClass: CommentClass;
    note: string;
}

interface IInternalClassificationResult {
    matchesClass: boolean;
    note: string;
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

    constructor(private ruleLocation: string) {
    }

    public classify(comment: SourceComment): ICommentClassification {
        const commentText = this.stripCommentStartTokens(comment.getCompleteComment().text);
        const result = {
            commentClass: CommentClass.Unknown,
            note: undefined,
        };
        let classificationResult;
        classificationResult = this.isCommentedCode(commentText);
        if (classificationResult.matchesClass) {
            result.commentClass = CommentClass.Code;
        }
        result.note = classificationResult.note;
        return result;
    }

    private isCommentedCode(commentText: string): IInternalClassificationResult {
        const linter = this.setupLinter();
        const configuration = this.getLintConfiguration();
        linter.lint("tmpFile", commentText, configuration);
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
        return {matchesClass: containsCode, note: failureText};
    }

    private stripCommentStartTokens(text: string): string {
        const re = /^(\s*((\/\/+)|(\/\*\**)|(\*\/)|(\**)))*/mg;
        return text.replace(re, "");
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

    private isLicence(): boolean {
        return false;
    }

}
