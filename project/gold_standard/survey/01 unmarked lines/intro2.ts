// tslint:disable
// taken from TypeScript: TypeScript/src/services/classifier.ts

function convertClassificationsToResult(classifications: Classifications, text: string): ClassificationResult {
    const entries: ClassificationInfo[] = [];
    const dense = classifications.spans;
    let lastEnd = 0;

    for (let i = 0; i < dense.length; i += 3) {
        const start = dense[i];
        const length = dense[i + 1];
        const type = <ClassificationType>dense[i + 2];

        if (lastEnd >= 0) {
            const whitespaceLength = start - lastEnd;
            if (whitespaceLength > 0) {
                entries.push({ length: whitespaceLength, classification: TokenClass.Whitespace });
            }
        }

        entries.push({ length, classification: convertClassification(type) });
        lastEnd = start + length;
    }

    const whitespaceLength = text.length - lastEnd;
    if (whitespaceLength > 0) {
        entries.push({ length: whitespaceLength, classification: TokenClass.Whitespace });
    }

    return { entries, finalLexState: classifications.endOfLineState };
}
