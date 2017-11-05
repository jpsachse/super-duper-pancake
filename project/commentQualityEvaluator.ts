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

export class EvaluationResult {

    constructor(public quality: CommentQuality, public reasons: string[]) { }

    public increaseQuality() {
        this.quality = Math.min(this.quality + 1, CommentQuality.High);
    }

    public decreaseQuality() {
        this.quality = Math.max(this.quality - 1, CommentQuality.Unhelpful);
    }

}

// tslint:disable-next-line:max-classes-per-file
export class CommentQualityEvaluator {

    private static WORD_MATCH_THRESHOLD = 0.5;
    private static PARAMETER_WORD_MATCH_THRESHOLD = 0.8;

    /**
     * Evaluate the quality of a SourceComment based on its surroundings.
     * @param comment The comment whose quality should be evaluated.
     * @param classifications The classifications of the comment.
     * @param sourceMap The SourceMap of the file the comment is located in.
     * @param sectionEndLine The last line of the section the comment is associated with.
     */
    public evaluateQuality(comment: SourceComment,
                           classifications: ICommentClassification[],
                           sourceMap: SourceMap,
                           sectionEndLine: number): EvaluationResult {
        if (classifications.find((c) => c.lines === undefined &&
                (c.commentClass === CommentClass.Task || c.commentClass === CommentClass.Annotation))) {
            return new EvaluationResult(CommentQuality.Unknown, []);
        }
        if (classifications.find((c) => c.lines === undefined && c.commentClass === CommentClass.Code)) {
            return new EvaluationResult(CommentQuality.Unhelpful, ["Code should not be commented out"]);
        }
        const commentEndLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(comment.end).line;
        let nextNode = sourceMap.getFirstNodeInLine(commentEndLine);
        if (!nextNode) {
            nextNode = sourceMap.getFirstNodeAfterLine(commentEndLine);
        }
        if (!nextNode) {
            return new EvaluationResult(CommentQuality.Unknown, []);
        }
        // If this comment is a jsDoc comment, its end will lie within the JSDoc node, which will be
        // returned by getFirstNodeInLine, but we actually want to assess the quality relative to its parent.
        if (ts.isJSDoc(nextNode) && comment.getCompleteComment().jsDoc.find((jsDoc) => jsDoc === nextNode)) {
            nextNode = nextNode.parent;
        }
        if (Utils.isDeclaration(nextNode)) {
            return this.assessDeclarationComment(comment, nextNode, sourceMap);
        } else {
            return this.assessInlineComment(comment, sourceMap, sectionEndLine);
        }
    }

    /**
     * Evaluate the quality of an inline SourceComment based on the content of the section it is associated with.
     * @param comment The comment whose quality should be evaluated.
     * @param sourceMap The SourceMap of the file the comment is located in.
     * @param sectionEndLine The last line of the section the comment is associated with.
     */
    private assessInlineComment(comment: SourceComment, sourceMap: SourceMap,
                                sectionEndLine: number): EvaluationResult {
        const evaluationResult = new EvaluationResult(CommentQuality.Low, []);
        const startLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(comment.end).line + 1;
        const keywords = this.collectKeywords(sourceMap, startLine, sectionEndLine);
        const codeContent = keywords.join("-");
        this.evaluateContentOverlap(evaluationResult, comment.getSanitizedCommentText().text, codeContent, 0.5, 0.5);
        return evaluationResult;
    }

    /**
     * Collect keywords found in the section, based on identifier names.
     * @param sourceMap The SourceMap of the file whose section contents should be collected.
     * @param sectionStart The start of the section.
     * @param sectionEnd The end of the section.
     */
    private collectKeywords(sourceMap: SourceMap, sectionStart: number, sectionEnd: number): string[] {
        const result: string[] = [];
        let currentLine = sectionStart;
        let previousNode: ts.Node;
        // Iterate over all lines in the section and collect contained keywords of their enclosing nodes
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
            currentLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(enclosingNode.end).line + 1;
        }
        return result;
    }

    /**
     * Collect keywords, based on identifier names of the given node and its children.
     * @param node The node that is the starting point for the analysis.
     */
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
                                     sourceMap: SourceMap): EvaluationResult {
        // TODO: this has to be refined considerably, e.g., by stripping common fill words (a, this, any, ...)
        // and also add handling for texts that reference parameters of functions
        const evaluationResult = new EvaluationResult(CommentQuality.Low, []);
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
        this.evaluateContentOverlap(evaluationResult, commentText, name, CommentQualityEvaluator.WORD_MATCH_THRESHOLD);
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
    private assessJSDocComment(jsDoc: ts.JSDoc, declaration: ts.Declaration, evaluationResult: EvaluationResult) {
        const assessParamCommentQuality = (comment: string, parameter: ts.ParameterDeclaration): EvaluationResult => {
            const result = new EvaluationResult(CommentQuality.Medium, []);
            const parameterName = this.getNameOfDeclaration(parameter);
            this.evaluateContentOverlap(result, comment, parameterName,
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
                    evaluationResult.decreaseQuality();
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
                evaluationResult.decreaseQuality();
            } else if (lowQualityCommentParameterCount < 0) {
                evaluationResult.increaseQuality();
            }
            if (commentedParameterCount < parameterCount) {
                evaluationResult.decreaseQuality();
            }
        }
    }

    private evaluateContentOverlap(evaluationResult: EvaluationResult, comment: string, nodeName: string,
                                   commentCoverageThreshold: number, nameCoverageThreshold?: number) {
        const usefulCommentParts = this.normaliseWords(this.filterCommonWords(Utils.splitWords(comment))).sort();
        if (usefulCommentParts.length === 0) {
            evaluationResult.decreaseQuality();
            return;
        }
        const nameParts = this.normaliseWords(this.filterCommonWords(Utils.splitWords(nodeName))).sort();
        if (nameParts.length === 0) {
            evaluationResult.quality = CommentQuality.Unknown;
            evaluationResult.reasons.push("Could not create english wording for commented code");
            return;
        }
        const intersection = Utils.getIntersection(nameParts, usefulCommentParts);
        const nameCoverage = intersection.length / nameParts.length;
        const commentCoverage = intersection.length / usefulCommentParts.length;

        if (intersection.length === 0) {
            evaluationResult.reasons.push("No relation between comment and code could be found");
            evaluationResult.decreaseQuality();
            return;
        }
        if ((commentCoverage > commentCoverageThreshold) &&
                (nameCoverageThreshold === undefined || nameCoverage > nameCoverageThreshold)) {
            evaluationResult.reasons.push("Too much overlap between comment and code");
            evaluationResult.decreaseQuality();
            return;
        }
        evaluationResult.increaseQuality();
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

}
