
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
        this.commentParts.push({pos, end, text});
    }

    public getCompleteComment(): ICommentPart {
        const text = this.commentParts.map( (part) => part.text ).join("\n");
        return { end: this.commentParts[this.commentParts.length - 1].end,
            pos: this.commentParts[0].pos,
            text,
        };
    }

    public getCommentParts(): ICommentPart[] {
        return this.commentParts;
    }

}