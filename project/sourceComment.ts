import { TextRange } from "typescript";

export enum CommentClass {
    Copyright,
    Header,
    Inline,
    Member,
    Section,
    Code,
    Task,
    Unknown,
}

export interface ICommentPart {
    pos: number;
    end: number;
    text: string;
}

export interface ICommentClassification {
    commentClass: CommentClass;
    lines?: number[];
}

export class SourceComment implements TextRange {

    public classifications: ICommentClassification[] = [];
    private commentParts: ICommentPart[] = [];

    constructor(pos: number, end: number, text: string) {
        this.addPart(pos, end, text);
    }

    public addPart(pos: number, end: number, text: string) {
        this.commentParts.push({pos, end, text: text.replace(/\r\n/g, "\n")});
    }

    public getCompleteComment(): ICommentPart {
        const text = this.commentParts.map( (part) => part.text ).join("\n");
        return { end: this.commentParts[this.commentParts.length - 1].end,
            pos: this.commentParts[0].pos,
            text,
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
        const sanitizedComments = this.commentParts.map( (part) => {
            const cleansedText = this.stripCommentStartTokens(part.text);
            let pos = part.pos;
            const unsanitizedLines = part.text.split("\n");
            return cleansedText.split("\n").map( (line, index) => {
                const lineLength = unsanitizedLines[index].length;
                const result = { pos,
                    end: pos + lineLength,
                    text: line,
                };
                // + 1 to include the removed newline character
                pos += unsanitizedLines[index].length + 1;
                return result;
            });
        });
        return [].concat(...sanitizedComments);
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

    get pos(): number {
        return this.commentParts[0].pos;
    }

    get end(): number {
        return this.commentParts[this.commentParts.length - 1].end;
    }

    private stripCommentStartTokens(text: string): string {
        const lines = text.split("\n");
        const result = [];
        let isMultiLineComment = false;
        // TODO: handle multiline comment ending + any other comment starting in the same line
        lines.forEach((line) => {
            if (isMultiLineComment) {
                // Multiline comment end
                const position = line.search(/\*\//);
                if (position >= 0) {
                    result.push(line.substring(0, position) + line.substring(position + 2));
                    isMultiLineComment = false;
                    return;
                }
                // Asterisks from JSDoc-styled comments
                const leadingAsterisk = /^\s*\*+/;
                const matchedAsterisks = line.match(leadingAsterisk);
                if (matchedAsterisks && matchedAsterisks.length) {
                    result.push(line.substring(matchedAsterisks[0].length));
                    return;
                }
                result.push(line);
                return;
            }
            // Multiline comment start
            const multilineCommentstart = /^\s*\/\*+/;
            let matchedCommentStarts = line.match(multilineCommentstart);
            if (matchedCommentStarts && matchedCommentStarts.length) {
                result.push(line.substring(matchedCommentStarts[0].length));
                isMultiLineComment = true;
                return;
            }
            // Single line comment start
            const singleLineCommentStart = /^\/\/+/;
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
