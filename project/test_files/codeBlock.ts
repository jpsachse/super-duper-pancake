// if (annotation.commentClass === CommentClass.Code ||
//         annotation.commentClass === CommentClass.Copyright) {

// Utils.forEachComment(sourceFile, (fullText, range) => {
//     const text = fullText.substring(range.pos, range.end);
//     const classificationResult = classifier.classify(new SourceComment(range.pos, range.end, text));
//     classificationResult.classifications.forEach( (classification) => {
//         if (classification.commentClass === CommentClass.Code) {
//             const pos = classificationResult.comment.getCommentParts()[classification.line].pos;
//             const end = classificationResult.comment.getCommentParts()[classification.line].end;
//             this.addFailure(pos, end, classification.note);
//         }
//     });
// });
