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

export interface IEvaluationResult {
    quality: CommentQuality;
    reasons: string[];
}

export class CommentQualityEvaluator {

    private static WORD_MATCH_THRESHOLD = 0.5;
    private static PARAMETER_WORD_MATCH_THRESHOLD = 0.8;

    public evaluateQuality(comment: SourceComment,
                           classifications: ICommentClassification[],
                           sourceMap: SourceMap,
                           sectionEndLine: number): IEvaluationResult {
        if (classifications.find((c) => c.lines === undefined &&
                (c.commentClass === CommentClass.Task || c.commentClass === CommentClass.Annotation))) {
            return {quality: CommentQuality.Unknown, reasons: []};
        }
        if (classifications.find((c) => c.lines === undefined && c.commentClass === CommentClass.Code)) {
            return {quality: CommentQuality.Unhelpful, reasons: ["Code should not be commented out"]};
        }
        const commentEndLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(comment.end).line;
        let nextNode = sourceMap.getFirstNodeInLine(commentEndLine);
        if (!nextNode) {
            nextNode = sourceMap.getFirstNodeAfterLine(commentEndLine);
        }
        if (!nextNode) {
            return {quality: CommentQuality.Unknown, reasons: []};
        }
        // If this comment is a jsDoc comment, its end will lie within the JSDoc node, which will be
        // returned by getFirstNodeInLine, but we actually want to assess the quality relative to its parent.
        if (ts.isJSDoc(nextNode) && comment.getCompleteComment().jsDoc.find((jsDoc) => jsDoc === nextNode)) {
            nextNode = nextNode.parent;
        }
        if (Utils.isDeclaration(nextNode)) {
            return this.assessDeclarationComment(comment, nextNode, sourceMap);
        } else {
            return this.assessInlineComment(comment, nextNode, sourceMap, sectionEndLine);
        }
    }

    private assessInlineComment(comment: SourceComment, nextNode: ts.Node,
                                sourceMap: SourceMap, sectionEndLine: number): IEvaluationResult {
        if (!nextNode) {
            // TODO: try to grasp a wider understanding of the section that follows a node
            // instead of just comparing it to the next node and its children
            return {quality: CommentQuality.Unknown, reasons: []};
        }
        const evaluationResult = {quality: CommentQuality.Low, reasons: []};

        // TODO: fix this and add the real section end
        const keywords = this.collectKeywords(comment, sourceMap, sectionEndLine);
        const codeContent = keywords.join("-");
        this.assessQualityBasedOnName(comment.getSanitizedCommentText().text, codeContent, evaluationResult, 0.2);
        return evaluationResult;
    }

    private collectKeywords(comment: SourceComment, sourceMap: SourceMap, sectionEnd: number): string[] {
        const result: string[] = [];
        let currentLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(comment.end).line + 1;
        let previousNode: ts.Node;
        while (currentLine <= sectionEnd) {
            if (sourceMap.getCommentsInLine(currentLine).length > 0) {
                break;
            }
            const enclosingNode = sourceMap.getMostEnclosingNodeForLine(currentLine);
            if (enclosingNode === previousNode || enclosingNode === undefined) {
                currentLine++;
                continue;
            }
            previousNode = enclosingNode;
            result.push(...this.collectKeywordsForNode(enclosingNode));
            currentLine++;
        }
        return result;
    }

    private collectKeywordsForNode(node: ts.Node): string[] {
        const result: string[] = [];
        const addIdentifiersAndNames = (child: ts.Node) => {
            if (ts.isIdentifier(child)) {
                result.push(child.text);
                return;
            }
            // TODO: add more cases
            child.forEachChild(addIdentifiersAndNames);
        };
        addIdentifiersAndNames(node);
        return result;
    }

    private assessDeclarationComment(comment: SourceComment,
                                     declaration: ts.Declaration,
                                     sourceMap: SourceMap): IEvaluationResult {
        // TODO: this has to be refined considerably, e.g., by stripping common fill words (a, this, any, ...)
        // and also add handling for texts that reference parameters of functions
        const evaluationResult = {quality: CommentQuality.Low, reasons: []};
        const jsDocs = comment.getCompleteComment().jsDoc;
        let commentText: string;
        if (jsDocs.length > 0) {
            commentText = jsDocs.map((jsDoc) => jsDoc.comment).join("\n");
            this.assessJSDocComment(jsDocs[jsDocs.length - 1], declaration, evaluationResult);
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
        this.assessQualityBasedOnName(commentText,
                                                name,
                                                evaluationResult,
                                                CommentQualityEvaluator.WORD_MATCH_THRESHOLD);
        return evaluationResult;
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
     * @param evaluationResult The result of the quality evaluation of the comment,
     * as assessed until the point of calling this method
     */
    private assessJSDocComment(jsDoc: ts.JSDoc, declaration: ts.Declaration, evaluationResult: IEvaluationResult) {
        const assessParamCommentQuality = (comment: string, parameter: ts.ParameterDeclaration): IEvaluationResult => {
            const result = {quality: CommentQuality.Medium, reasons: []};
            const parameterName = this.getNameOfDeclaration(parameter);
            this.assessQualityBasedOnName(comment,
                                          parameterName,
                                          result,
                                          CommentQualityEvaluator.PARAMETER_WORD_MATCH_THRESHOLD);
            if (result.quality < CommentQuality.Medium) {
                result.reasons[result.reasons.length - 1] += ": " + parameterName;
            }
            return result;
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
        let parameterCount = 0;
        declaration.forEachChild((child) => {
            if (ts.isParameter(child)) {
                parameterCount++;
                const parameterComment = jsDocParameterComments.get(child.name.getText());
                if (!parameterComment) {
                    this.decreaseQuality(evaluationResult);
                    const failureReason = "Missing explanation for parameter: " + this.getNameOfDeclaration(child);
                    evaluationResult.reasons.push(failureReason);
                    return;
                }
                commentedParameterCount++;
                const parameterQuality = assessParamCommentQuality(parameterComment, child);
                if (parameterQuality.quality < CommentQuality.Medium) {
                    lowQualityCommentParameterCount += CommentQuality.Medium - parameterQuality.quality;
                    evaluationResult.reasons.push(...parameterQuality.reasons);
                } else if (parameterQuality.quality > CommentQuality.Medium) {
                    lowQualityCommentParameterCount -= parameterQuality.quality - CommentQuality.Medium;
                }
            }
        });
        if (parameterCount > 0) {
            if (lowQualityCommentParameterCount >= commentedParameterCount) {
                this.decreaseQuality(evaluationResult);
            } else if (lowQualityCommentParameterCount < 0) {
                this.increaseQuality(evaluationResult);
            }
            if (commentedParameterCount < parameterCount) {
                this.decreaseQuality(evaluationResult);
            }
        }
    }

    private assessQualityBasedOnName(comment: string, nodeName: string,
                                     quality: IEvaluationResult, threshold: number) {
        const usefulCommentParts = this.normaliseWords(
                    this.filterCommonWords(Utils.splitIntoNormalizedWords(comment))).sort();
        if (usefulCommentParts.length === 0) {
            this.decreaseQuality(quality);
            return;
        }
        const nameParts = this.normaliseWords(
                this.filterCommonWords(Utils.splitIntoNormalizedWords(nodeName))).sort();
        const intersection = Utils.getIntersection(nameParts, usefulCommentParts);
        if (intersection.length === 0 || intersection.length / usefulCommentParts.length > threshold) {
            if (intersection.length === 0) {
                quality.reasons.push("No relation between comment and code could be found");
            } else {
                quality.reasons.push("Too much overlap between comment and code");
            }
            this.decreaseQuality(quality);
        } else {
            // TODO: more heuristics upon what is good comment text
            this.increaseQuality(quality);
        }
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

    private increaseQuality(current: IEvaluationResult) {
        current.quality = Math.min(current.quality + 1, CommentQuality.High);
    }

    private decreaseQuality(current: IEvaluationResult) {
        current.quality = Math.max(current.quality - 1, CommentQuality.Unhelpful);
    }

}
