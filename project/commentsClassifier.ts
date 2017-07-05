import * as Lint from "tslint";
import * as utils from "tsutils";
import { CodeDetector } from "./codeDetector";
import { LicenseMatcher } from "./licenseMatcher";
import { ICommentPart, SourceComment } from "./sourceComment";

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
    description: string;
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

    constructor(private codeDetector: CodeDetector) {
    }

    public classify(comment: SourceComment): ICommentClassificationResult {
        const commentText = comment.getSanitizedCommentText().text;
        const sanitizedLines = comment.getSanitizedCommentLines();
        const result = {
            classifications: [],
            comment,
        };
        let classificationResult = this.isLicense(comment);
        if (classificationResult.matchesClass) {
            result.classifications.push({
                commentClass: CommentClass.Copyright,
                 line: 0,
                 note: classificationResult.description,
            });
        }
        sanitizedLines.forEach( (line, index) => {
            const classification = {
                commentClass: CommentClass.Unknown,
                line: index,
                note: undefined,
            };
            classificationResult = this.isCommentedCode(line.text);
            if (classificationResult.matchesClass) {
                classification.commentClass = CommentClass.Code;
                classification.note = classificationResult.description;
            }
            if (classification.commentClass !== CommentClass.Unknown) {
                result.classifications.push(classification);
            }
        });
        return result;
    }

    private isLicense(comment: SourceComment): IInternalClassificationResult {
        const matcher = new LicenseMatcher();
        // Should also take position inside the file into account, i.e., most licenses
        // are at the beginning of a file and not somewhere in the middle.
        return { matchesClass: matcher.isLicense(comment), description: "That's a license" };
    }

    private isCommentedCode(commentText: string): IInternalClassificationResult {
        if (this.codeDetector.isCommentedCode(commentText)) {
            return {matchesClass: true, description: "Code should not be commented out"};
        }
        return {matchesClass: false, description: undefined};
    }

}
