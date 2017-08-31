import { SourceComment } from "../sourceComment";

export function buildComment(...lines: string[]): SourceComment {
    if (!lines || lines.length === 0) {
        return new SourceComment(0, 0, "", []);
    }
    let result: SourceComment;
    let currentPos = 0;
    lines.forEach((line) => {
        currentPos += line.length;
        if (!result) {
            result = new SourceComment(0, currentPos, line, []);
        } else {
            result.addPart(currentPos - line.length, currentPos, line, []);
        }
    });
    return result;
}
