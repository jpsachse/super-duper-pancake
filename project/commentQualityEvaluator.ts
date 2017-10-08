import * as compendium from "compendium-js";
import * as stopword from "stopword";
import * as ts from "typescript";
import { ICommentClassification } from "./commentClassificationTypes";
import { CommentClass, ICommentPart, SourceComment } from "./sourceComment";
import { SourceMap } from "./sourceMap";
import Utils from "./utils";

export enum CommentQuality {
    Unknown,
    Unhelpful,
    Low,
    Medium,
    High,
}

export class CommentQualityEvaluator {

    public evaluateQuality(comment: SourceComment,
                           classifications: ICommentClassification[],
                           sourceMap: SourceMap): CommentQuality {
        const pureCodeComment = (classification: ICommentClassification): boolean => {
            return classification.lines === undefined &&
                    classification.commentClass === CommentClass.Code;
        };
        if (classifications.find(pureCodeComment)) {
            return CommentQuality.Unhelpful;
        }
        const commentEndLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(comment.end).line;
        let nextNode = sourceMap.getFirstNodeInLine(commentEndLine);
        if (nextNode === undefined) {
            nextNode = sourceMap.getFirstNodeAfterLine(commentEndLine);
        }
        if (nextNode !== undefined) {
            if (Utils.isDeclaration(nextNode)) {
                return this.assessDeclarationComment(comment, nextNode, sourceMap);
            } else {
                return this.assessInlineComment(comment, nextNode, sourceMap);
            }
        }
        return CommentQuality.Unknown;
    }

    private assessInlineComment(comment: SourceComment, nextNode: ts.Node, sourceMap: SourceMap): CommentQuality {
        let quality = CommentQuality.Low;
        quality = this.higherQuality(quality);
        return quality;
    }

    private assessDeclarationComment(comment: SourceComment,
                                     declaration: ts.Declaration,
                                     sourceMap: SourceMap): CommentQuality {
        // TODO: this has to be refined considerably, e.g., by stripping common fill words (a, this, any, ...)
        // and also add handling for texts that reference parameters of functions
        let quality = CommentQuality.Low;
        const jsDocs = comment.getCompleteComment().jsDoc;
        let commentText: string;
        if (jsDocs.length > 0) {
            commentText = jsDocs.map((jsDoc) => jsDoc.comment).join("\n");
            quality = this.assessJSDocComment(jsDocs[jsDocs.length - 1], declaration, quality);
            // TODO: throw exception when there is more than one associated jsdoc comment
            // or handle it gracefully by using the longest one
        } else {
            commentText = comment.getSanitizedCommentText().text;
        }
        const name = ts.getNameOfDeclaration(declaration);
        const nameText = name === undefined ? ts.SyntaxKind[declaration.kind] : name.getText(sourceMap.sourceFile);
        quality = this.assessQualityBasedOnName(commentText, nameText, quality);
        return quality;
    }

    /**
     * Assesses the quality and completeness of the JSDoc comment, similar to the valid-jsdoc eslint rule.
     * For a function, all parameters should be listed and have a comment with more than just being a type
     * or character name reference (e.g. "@param aString A string").
     * @param jsDoc The JSDoc object representing the comment
     * @param declaration The declaration that is being commented
     * @param quality The quality of the comment, as assessed until the point of calling this method
     */
    private assessJSDocComment(jsDoc: ts.JSDoc, declaration: ts.Declaration, quality: CommentQuality): CommentQuality {
        const test = Utils.capitalize("");
        const assessParameterCommentQuality = (comment: string, parameter: ts.ParameterDeclaration): CommentQuality => {
            const typeName = parameter.type.getText();
            const typedParameterName = parameter.name.getText() + Utils.capitalize(typeName);
            return this.assessQualityBasedOnName(comment, typedParameterName, CommentQuality.Medium);
        };
        const jsDocParameterComments = new Map<string, string>();
        jsDoc.forEachChild((docChild) => {
            if (ts.isJSDocParameterTag(docChild)) {
                jsDocParameterComments.set(docChild.name.getText(), docChild.comment);
            }
        });
        // Lower the comment quality if parameters are missing from the JSDoc
        let didCommentAllParametersWell = true;
        declaration.forEachChild((child) => {
            if (ts.isParameter(child)) {
                const parameterComment = jsDocParameterComments.get(child.name.getText());
                let parameterQuality = CommentQuality.Unhelpful;
                if (parameterComment) {
                    parameterQuality = assessParameterCommentQuality(parameterComment, child);
                }
                if (parameterQuality < CommentQuality.Medium) {
                    quality = this.lowerQuality(quality);
                    didCommentAllParametersWell = false;
                }
            }
        });
        if (didCommentAllParametersWell) {
            quality = this.higherQuality(quality);
        }
        return quality;
    }

    private assessQualityBasedOnName(comment: string, nodeName: string, quality: CommentQuality): CommentQuality {
        const commentParts = this.normaliseWords(
                this.filterCommonWords(Utils.splitIntoNormalizedWords(comment))).sort();
        const nameParts = this.normaliseWords(
                this.filterCommonWords(Utils.splitIntoNormalizedWords(nodeName))).sort();
        const intersection = Utils.getIntersection(nameParts, commentParts);
        if (intersection.length / commentParts.length > 0.5) {
            quality = this.lowerQuality(quality);
        } else {
            // TODO: more heuristics upon what is good comment text
            quality = this.higherQuality(quality);
        }
        return quality;
    }

    private filterCommonWords(words: string[]): string[] {
        return stopword.removeStopwords(words);
    }

    private normaliseWords(words: string[]): string[] {
        const inflector = compendium.inflector;
        const result: string[] = [];
        return words.map((word, index) => {
            const normalized = inflector.infinitive(word);
            return normalized ? normalized : word;
        });
    }

    private higherQuality(current: CommentQuality): CommentQuality {
        return Math.min(current + 1, CommentQuality.High);
    }

    private lowerQuality(current: CommentQuality): CommentQuality {
        return Math.max(current - 1, CommentQuality.Unhelpful);
    }

}
