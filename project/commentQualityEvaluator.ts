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

    private static WORD_MATCH_THRESHOLD = 0.5;
    private static PARAMETER_WORD_MATCH_THRESHOLD = 0.8;

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
        if (!nextNode) {
            nextNode = sourceMap.getFirstNodeAfterLine(commentEndLine);
        }
        if (!nextNode) {
            return CommentQuality.Unknown;
        }
        // If this comment is a jsDoc comment, its end will lie within the JSDoc node, which will be
        // returned by getFirstNodeInLine, but we actually want to assess the quality relative to its parent.
        if (ts.isJSDoc(nextNode) && comment.getCompleteComment().jsDoc.find((jsDoc) => jsDoc === nextNode)) {
            nextNode = nextNode.parent;
        }
        if (Utils.isDeclaration(nextNode)) {
            return this.assessDeclarationComment(comment, nextNode, sourceMap);
        } else {
            return this.assessInlineComment(comment, nextNode, sourceMap);
        }
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
        let name = this.getNameOfDeclaration(declaration);
        let additionalNameParts: string[] = [];
        // Add the names of the parameters to the declaration names to force naming them in the comment
        // text, but only do so if it's not a JSDoc comment, as this is handled in assessJSDocComment.
        if (ts.isFunctionLike(declaration) && jsDocs.length === 0) {
            additionalNameParts = this.getParameterNames(declaration);
        }
        name += " " + additionalNameParts.join(" ");
        quality = this.assessQualityBasedOnName(commentText,
                                                name,
                                                quality,
                                                CommentQualityEvaluator.WORD_MATCH_THRESHOLD);
        return quality;
    }

    private getParameterNames(declaration: ts.FunctionLikeDeclaration): string[] {
        return declaration.parameters.map((parameter) => {
            return this.getNameOfDeclaration(parameter);
        });
    }

    private getNameOfDeclaration(declaration: ts.Declaration): string {
        const name = ts.getNameOfDeclaration(declaration);
        return name ? name.getText() : ts.SyntaxKind[declaration.kind];
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
        const assessParameterCommentQuality = (comment: string, parameter: ts.ParameterDeclaration): CommentQuality => {
            return this.assessQualityBasedOnName(comment,
                                                 this.getNameOfDeclaration(parameter),
                                                 CommentQuality.Medium,
                                                 CommentQualityEvaluator.PARAMETER_WORD_MATCH_THRESHOLD);
        };
        const jsDocParameterComments = new Map<string, string>();
        jsDoc.forEachChild((docChild) => {
            if (ts.isJSDocParameterTag(docChild)) {
                jsDocParameterComments.set(docChild.name.getText(), docChild.comment);
            }
        });
        // Lower the comment quality if parameters are missing from the JSDoc
        let commentedParameterCount = 0;
        let lowQualityCommentParameterCount = 0;
        declaration.forEachChild((child) => {
            if (ts.isParameter(child)) {
                const parameterComment = jsDocParameterComments.get(child.name.getText());
                if (!parameterComment) {
                    quality = this.lowerQuality(quality);
                    return;
                }
                commentedParameterCount++;
                const parameterQuality = assessParameterCommentQuality(parameterComment, child);
                if (parameterQuality < CommentQuality.Medium) {
                    lowQualityCommentParameterCount += CommentQuality.Medium - parameterQuality;
                } else if (parameterQuality > CommentQuality.Medium) {
                    lowQualityCommentParameterCount -= parameterQuality - CommentQuality.Medium;
                }
            }
        });
        if (lowQualityCommentParameterCount >= commentedParameterCount) {
            quality = this.lowerQuality(quality);
        } else if (lowQualityCommentParameterCount < 0) {
            quality = this.higherQuality(quality);
        }
        return quality;
    }

    private assessQualityBasedOnName(comment: string, nodeName: string,
                                     quality: CommentQuality, threshold: number): CommentQuality {
        const usefulCommentParts = this.normaliseWords(
                    this.filterCommonWords(Utils.splitIntoNormalizedWords(comment))).sort();
        const nameParts = this.normaliseWords(
                this.filterCommonWords(Utils.splitIntoNormalizedWords(nodeName))).sort();
        const intersection = Utils.getIntersection(nameParts, usefulCommentParts);
        if (intersection.length / usefulCommentParts.length > threshold) {
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
