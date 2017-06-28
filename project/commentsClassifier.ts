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

interface ICommentClassification {
    line: number;
    commentClass: CommentClass;
    note: string;
}

export interface ICommentClassificationResult {
    comment: SourceComment;
    classifications: ICommentClassification[];
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

    public classify(comment: SourceComment): ICommentClassificationResult {
        const commentText = comment.getSanitizedCommentText().text;
        const sanitizedLines = comment.getSanitizedCommentLines();
        const result = {
            classifications: [],
            comment,
        };
        sanitizedLines.forEach( (line, index) => {
            let classificationResult;
            const classification = {
                commentClass: CommentClass.Unknown,
                line: index,
                note: undefined,
            };
            classificationResult = this.isCommentedCode(commentText);
            if (classificationResult.matchesClass) {
                classification.commentClass = CommentClass.Code;
                classification.note = classificationResult.note;
            }
            result.classifications.push(classification);
        });
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
