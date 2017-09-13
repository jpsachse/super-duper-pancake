import * as TSUtils from "tsutils";
import * as ts from "typescript";
import { IMetricCollector, SourcePart } from "./commentClassificationTypes";
import Utils from "./utils";

export class LinesOfCodeCollector implements IMetricCollector {

    private linesOfCode = new Map<ts.Node, number>();

    public visitNode(node: SourcePart) {
        if (!(Utils.isNode(node) && TSUtils.isFunctionScopeBoundary(node))) {
            return;
        }
        // TODO: pass the SourceFile as parameter if performance is a problem, as this
        // probably just walks up the AST until it finds a SourceFile
        const sourceFile = node.getSourceFile();
        const textLines = node.getText(sourceFile).split("\n");
        let linesOfCode = 0;
        let position = node.getStart();
        const whiteSpaceRegexp = /^\s*/;

        textLines.forEach((line) => {
            let whitespace = line.match(whiteSpaceRegexp);
            let whitespaceLength = this.getLength(whitespace);
            const startOfLetters = position + whitespaceLength;
            const comment = TSUtils.getCommentAtPosition(sourceFile, startOfLetters);
            position += line.length + 1;
            if (whitespaceLength >= line.length) {
                return;
            }
            if (comment !== undefined) {
                if (comment.end + 1 >= position) {
                    return;
                } else {
                    let positionInLine = comment.end + 1;
                    while (positionInLine < position) {
                        const nextComment = TSUtils.getCommentAtPosition(sourceFile, positionInLine);
                        if (nextComment !== undefined) {
                            const textStart = comment.end - comment.pos + whitespaceLength;
                            const textEnd = positionInLine - comment.pos + whitespaceLength;
                            const textBetweenComments = line.substring(textStart, textEnd);
                            whitespace = textBetweenComments.match(whiteSpaceRegexp);
                            whitespaceLength = this.getLength(whitespace);
                            if (whitespaceLength < positionInLine - comment.end) {
                                linesOfCode++;
                                return;
                            }
                            positionInLine = nextComment.end;
                        } else {
                            positionInLine++;
                        }
                    }
                    return;
                }
            }
            linesOfCode++;
        });
        this.linesOfCode.set(node, linesOfCode);
    }

    private getLength(match: RegExpMatchArray | null): number {
        return (match && match.length > 0) ? match[0].length : 0;
    }

}
