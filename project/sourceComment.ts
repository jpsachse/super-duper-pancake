
export interface ICommentPart {
    pos: number;
    end: number;
    text: string;
}

export class SourceComment {

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

    private stripCommentStartTokens(text: string): string {
        const re = /^(\s*((\/\/+)|(\/\*+)|(\**)))*|((\*\/))/mg;
        return text.replace(re, "");
    }

}