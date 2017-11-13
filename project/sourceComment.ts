import { JSDoc, TextRange } from "typescript";
import Utils from "./utils";

export enum CommentClass {
    Copyright,
    Header,
    Inline,
    Member,
    Section,
    Code,
    Task,
    Annotation,
    Unknown,
}

export interface ICommentPart {
    relativePos: number;
    pos: number;
    end: number;
    text: string;
    jsDoc: JSDoc[];
}

export class SourceComment implements TextRange {

    private commentParts: ICommentPart[] = [];

    constructor(pos: number, end: number, text: string, jsDoc: JSDoc[], private trailing: boolean = false) {
        this.addPart(pos, end, text, jsDoc);
    }

    public addPart(pos: number, end: number, text: string, jsDoc: JSDoc[]) {
        const originalLength = text.length;
        if (end - pos !== originalLength) {
            throw new Error("The length of the comment does not match the position and end values!");
        }
        text = text.replace(/\r\n$/, "\n").replace(/\n$/, "");
        end = pos + text.length;
        let relativePos = 0;
        if (this.commentParts.length > 0) {
            const lastPart = this.commentParts[this.commentParts.length - 1];
            relativePos = lastPart.relativePos + lastPart.text.length;
        }
        this.commentParts.push({pos, end, relativePos, text, jsDoc});
    }

    public getCompleteComment(): ICommentPart {
        const text = this.commentParts.map( (part) => part.text ).join(Utils.newLineChar);
        return { end: this.commentParts[this.commentParts.length - 1].end,
            pos: this.commentParts[0].pos,
            relativePos: 0,
            text,
            jsDoc: Utils.flatten(this.commentParts.map((part) => part.jsDoc)),
        };
    }

    public inspect(depth, opts) {
        const parts = this.commentParts.map<string>( (part) => {
            return "(" + part.pos + "-" + part.end + ") " + part.text;
        }).join(",\n");
        return "SourceComment [ " + parts + " ]";
    }

    // Returns the complete comment text but without the usual comment chrome around it.
    // Leaves start and end position as they were in the original source file,
    // including the removed chrome.
    public getSanitizedCommentText(): ICommentPart {
        const comment = this.getCompleteComment();
        comment.text = this.stripCommentStartTokens(comment.text);
        return comment;
    }

    public getSanitizedCommentLines(): ICommentPart[] {
        const unsanitizedLines = this.getUnsanitizedCommentLines();
        let currentPartStartLine = 0;
        let relativePos = 0;
        const sanitizedComments = this.commentParts.map( (part) => {
            const cleansedText = this.stripCommentStartTokens(part.text);
            let pos = part.pos;
            const cleansedLines = cleansedText.split("\n");
            const sanitizedLines = cleansedLines.map( (line, index): ICommentPart => {
                const unsanitizedLineText = unsanitizedLines[currentPartStartLine + index].text;
                const positionInLine = unsanitizedLineText.indexOf(line);
                const lineLength = unsanitizedLineText.length;
                line = Utils.trimTrailingSpace(line);
                const result: ICommentPart = { pos: pos + positionInLine,
                    end: pos + lineLength,
                    relativePos,
                    text: line,
                    jsDoc: part.jsDoc,
                };
                // + 1 to include the removed newline character
                relativePos += line.length + 1;
                pos += lineLength + 1;
                return result;
            });
            // One-line comments do not include the newline chars in their text.
            // The \r char does not hurt in multiline comments, as it is included in line.length (above)
            // But since it's not in this case, we have to +1 once more
            if (cleansedLines.length === 1 && Utils.isWindows()) {
                relativePos++;
            }
            currentPartStartLine += cleansedLines.length;
            return sanitizedLines;
        });
        return Utils.flatten(sanitizedComments);
    }

    public getCommentParts(): ICommentPart[] {
        return this.commentParts;
    }

    public getPosOfLine(line: number): number {
        return this.getSanitizedCommentLines()[line].pos;
    }

    public getEndOfLine(line: number): number {
        return this.getSanitizedCommentLines()[line].end;
    }

    get isTrailing(): boolean {
        return this.trailing;
    }

    get pos(): number {
        return this.commentParts[0].pos;
    }

    get end(): number {
        return this.commentParts[this.commentParts.length - 1].end;
    }

    public getStart(): number {
        return this.pos;
    }

    private getUnsanitizedCommentLines(): ICommentPart[] {
        let relativePos = 0;
        return Utils.flatten(this.commentParts.map((part) => {
            let pos = part.pos;
            return part.text.split("\n").map((lineText) => {
                const matches = lineText.match(/^\s*/);
                const leadingSpace = matches.length > 0 ? matches[0].length : 0;
                const result: ICommentPart = {
                    pos: pos + leadingSpace,
                    end: pos + lineText.length,
                    relativePos,
                    text: lineText,
                    jsDoc: part.jsDoc,
                };
                const contentLength = lineText.replace(/^\s*/, "").length;
                relativePos += contentLength;
                pos += lineText.length;
                return result;
            });
        }));
    }

    private stripCommentStartTokens(text: string): string {
        const lines = text.split("\n");
        const result = [];
        let isMultiLineComment = false;
        // TODO: handle multiline comment ending + any other comment starting in the same line
        lines.forEach((line) => {
            if (isMultiLineComment) {
                // Multiline comment end
                const matchedEnd = line.match(/\s*\*\//);
                if (matchedEnd && matchedEnd.length >= 0) {
                    const position = matchedEnd.index;
                    result.push(line.substring(0, position) + line.substring(position + matchedEnd[0].length));
                    isMultiLineComment = false;
                    return;
                }
                // Asterisks from JSDoc-styled comments
                const leadingAsterisk = /^\s*\*+\s*/;
                const matchedAsterisks = line.match(leadingAsterisk);
                if (matchedAsterisks && matchedAsterisks.length) {
                    result.push(line.substring(matchedAsterisks[0].length));
                    return;
                }
                result.push(line);
                return;
            }
            // Multiline comment start
            const multilineCommentstart = /^\s*\/\*+\s*/;
            let matchedCommentStarts = line.match(multilineCommentstart);
            if (matchedCommentStarts && matchedCommentStarts.length) {
                result.push(line.substring(matchedCommentStarts[0].length));
                isMultiLineComment = true;
                return;
            }
            // Single line comment start
            const singleLineCommentStart = /^\/\/+\s*/;
            matchedCommentStarts = line.match(singleLineCommentStart);
            if (matchedCommentStarts && matchedCommentStarts.length) {
                result.push(line.substring(matchedCommentStarts[0].length));
                return;
            }
            result.push(line);
        });
        return result.join("\n");
    }

}
