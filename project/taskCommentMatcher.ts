import { ICommentClassification } from "./commentClassificationTypes";
import { CommentClass, SourceComment } from "./sourceComment";
import Utils from "./utils";

export class TaskCommentMatcher {

    // Based on "TODO or To Bug" http://dl.acm.org/citation.cfm?id=1368123
    private static SUPPORTED_TASKS = ["TODO", "FIXME", "XXX", "HACK"];
    private taskRegex: RegExp;

    constructor() {
        const regexString = "^\\s*(" + TaskCommentMatcher.SUPPORTED_TASKS.join("|") + ")[:|\\s]";
        this.taskRegex = new RegExp(regexString, "i");
    }

    public classify(comment: SourceComment): ICommentClassification[] {
        const lines = comment.getSanitizedCommentLines();
        let isTask = false;
        const linesWithTaskComment: number[] = [];
        lines.forEach((commentLine, lineNumber) => {
            if (this.taskRegex.test(commentLine.text)) {
                isTask = true;
            }
            if (isTask) {
                linesWithTaskComment.push(lineNumber);
                if (commentLine.text.endsWith(".")) {
                    isTask = false;
                }
            }
        });
        if (linesWithTaskComment.length === 0) {
            return [];
        }
        if (linesWithTaskComment.length === lines.length) {
            return [{commentClass: CommentClass.Task}];
        }
        return [{commentClass: CommentClass.Task, lines: linesWithTaskComment}];
    }

}
