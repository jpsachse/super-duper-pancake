import * as Lint from "tslint";
import * as utils from "tsutils";
import * as ts from "typescript";

export class NoCodeWalker extends Lint.AbstractWalker<void> {

    public walk(sourceFile: ts.SourceFile) {
        utils.forEachComment(sourceFile, (fullText, {kind, pos, end}) => {
            console.log("\n" + fullText.substring(pos, end));
        });
    }

}
