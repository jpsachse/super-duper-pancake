import * as compendium from "compendium-js";
import * as pluralize from "pluralize";
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
        if (classifications.find((c) => c.lines === undefined && this.nonEvaluableClass(c.commentClass))) {
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
            return this.assessDeclarationComment(comment, nextNode, sourceMap, classifications);
        } else {
            return this.assessInlineComment(comment, sourceMap, sectionEndLine, classifications);
        }
    }

    private nonEvaluableClass(commentClass: CommentClass): boolean {
        return commentClass === CommentClass.Task ||
               commentClass === CommentClass.Annotation ||
               commentClass === CommentClass.Unknown;
    }

    /**
     * Evaluate the quality of an inline SourceComment based on the content of the section it is associated with.
     * @param comment The comment whose quality should be evaluated.
     * @param sourceMap The SourceMap of the file the comment is located in.
     * @param sectionEndLine The last line of the section the comment is associated with.
     */
    private assessInlineComment(comment: SourceComment,
                                sourceMap: SourceMap,
                                sectionEndLine: number,
                                classifications: ICommentClassification[]): EvaluationResult {
        const evaluationResult = new EvaluationResult(CommentQuality.Low, []);
        const startLine = sourceMap.sourceFile.getLineAndCharacterOfPosition(comment.end).line + 1;
        const keywords = this.collectKeywords(sourceMap, startLine, sectionEndLine);
        const codeContent = keywords.join("-");
        const commentText = this.filterCodeLines(comment.getSanitizedCommentText().text, classifications);
        this.evaluateContentOverlap(evaluationResult, commentText, codeContent, 0.5, 0.5);
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

    /**
     * Evaluate the quality of a comment associated with a declaration based on the declaration's identifier.
     * @param comment  The comment whose quality should be evaluated.
     * @param declaration The declaraction the comment is associated with
     * @param sourceMap The SourceMap of the file the comment is located in.
     */
    private assessDeclarationComment(comment: SourceComment,
                                     declaration: ts.Declaration,
                                     sourceMap: SourceMap,
                                     classifications: ICommentClassification[]): EvaluationResult {
        const evaluationResult = new EvaluationResult(CommentQuality.Low, []);
        const jsDocs = comment.getCompleteComment().jsDoc;
        let commentText: string;
        if (jsDocs.length > 0) {
            commentText = jsDocs.map((jsDoc) => jsDoc.comment).join("\n");
            this.assessJSDocComment(jsDocs[jsDocs.length - 1], declaration, evaluationResult);
        } else {
            commentText = this.filterCodeLines(comment.getSanitizedCommentText().text, classifications);
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

    private filterCodeLines(text: string, classifications: ICommentClassification[]): string {
        const codeClassifications = classifications.filter((c) => c.commentClass === CommentClass.Code);
        if (codeClassifications.length > 0) {
            // lines will not be undefined, as it would have been caught before and this method
            // would not have been called
            const codeLines = Utils.flatten(codeClassifications.map((c) => c.lines));
            let lines = text.split("\n");
            for (let i = codeLines.length - 1; i >= 0; --i) {
                lines.splice(codeLines[i], 1);
            }
            text = lines.join("\n");
        }
        return text;
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
     * Evaluates the quality and completeness of the JSDoc comment, similar to the valid-jsdoc eslint rule.
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
        // Collect all parameters commented in the JSDoc comment
        const jsDocParameterComments = new Map<string, string>();
        jsDoc.forEachChild((docChild) => {
            if (ts.isJSDocParameterTag(docChild)) {
                jsDocParameterComments.set(docChild.name.getText(), docChild.comment);
            }
        });
        let commentedParameterCount = 0;
        let lowQualityCommentParameterCount = 0;
        let parameterCount = 0;
        // Iterate over all parameters in the declaration and assess their comment quality
        declaration.forEachChild((child) => {
            if (ts.isParameter(child)) {
                parameterCount++;
                const parameterComment = jsDocParameterComments.get(child.name.getText());
                // Lower the comment quality if parameters are missing from the JSDoc
                if (!parameterComment) {
                    evaluationResult.decreaseQuality();
                    const failureReason = "Missing explanation for parameter: " + this.getNameOfDeclaration(child);
                    evaluationResult.reasons.push(failureReason);
                    return;
                }
                commentedParameterCount++;
                const parameterQuality = assessParamCommentQuality(parameterComment, child);
                // Count the total quality distance of all parameters from CommentQuality.Medium
                if (parameterQuality.quality < CommentQuality.Medium) {
                    lowQualityCommentParameterCount += CommentQuality.Medium - parameterQuality.quality;
                    evaluationResult.reasons.push(...parameterQuality.reasons);
                } else {
                    lowQualityCommentParameterCount -= parameterQuality.quality - CommentQuality.Medium;
                }
            }
        });
        // Adjust evaluated quality based on total distance to .Medium and reduce quality if a parameter
        // is not commented
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

    /**
     * Evaluate the overlap between both given strings. Both strings get normalized by splitting them
     * into sets of lowercase words and applying inflection rules.
     * @param evaluationResult The evaluation result object on which this evaluation is based.
     * This object gets changed and will contain the result.
     * @param comment The comment whose quality should be evaluated.
     * @param nodeName The name of the node that should be compared with the comment
     * @param commentCoverageThreshold The threshold of the percentage of words of the comment
     * that can be also in the name. If the overlap is higher, the quality might be decreased.
     * @param nameCoverageThreshold The threshold of the percentage words of the name that can
     * also be in the comment. If the overlap is higher, the quality might be decreased.
     */
    private evaluateContentOverlap(evaluationResult: EvaluationResult, comment: string, nodeName: string,
                                   commentCoverageThreshold: number, nameCoverageThreshold?: number) {
        // Get words of comment and node and calculate intersection
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

        // Comment and node might be unrelated, as no intersection is found
        if (intersection.length === 0) {
            evaluationResult.reasons.push("No relation between comment and code could be found");
            evaluationResult.decreaseQuality();
            return;
        }
        // The comment might add no additional information and thus be unhelpful
        if ((commentCoverage >= commentCoverageThreshold) &&
                (nameCoverageThreshold === undefined || nameCoverage >= nameCoverageThreshold)) {
            evaluationResult.reasons.push("Too much overlap between comment and code");
            evaluationResult.decreaseQuality();
            return;
        }
        evaluationResult.increaseQuality();
    }

    private filterCommonWords(words: string[]): string[] {
        return stopword.removeStopwords(words);
    }

    /**
     * Normalize an array of words by applying inflection rules and returning infinitive versions.
     * @param words The array of words to be normalized.
     */
    private normaliseWords(words: string[]): string[] {
        const inflector = compendium.inflector;
        const result: string[] = [];
        return Array.from(new Set(words.map((word, index) => {
            const singular = pluralize.singular(word);
            const normalized = inflector.infinitive(singular);
            return normalized ? normalized : singular;
        })));
    }

}
