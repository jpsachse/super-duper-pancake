// tslint:disable
// Taken from tslint: src/enableDisableRules.ts

function getDisableMap(sourceFile: ts.SourceFile, failingRules: Set<string>): ReadonlyMap<string, ts.TextRange[]> {
    const map = new Map<string, ts.TextRange[]>();

    utils.forEachComment(sourceFile, (fullText, comment) => {
        const commentText = comment.kind === ts.SyntaxKind.SingleLineCommentTrivia
            ? fullText.substring(comment.pos + 2, comment.end)
            : fullText.substring(comment.pos + 2, comment.end - 2);
        const parsed = parseComment(commentText);
        if (parsed !== undefined) {
            const { rulesList, isEnabled, modifier } = parsed;
            const switchRange = getSwitchRange(modifier, comment, sourceFile);
            if (switchRange !== undefined) {
                const rulesToSwitch = rulesList === "all" ? Array.from(failingRules) : rulesList.filter((r) => failingRules.has(r));
                for (const ruleToSwitch of rulesToSwitch) {
                    switchRuleState(ruleToSwitch, isEnabled, switchRange.pos, switchRange.end);
                }
            }
        }
    });

    return map;

    function switchRuleState(ruleName: string, isEnable: boolean, start: number, end: number): void {
        const disableRanges = map.get(ruleName);

        if (isEnable) {
            if (disableRanges !== undefined) {
                const lastDisable = disableRanges[disableRanges.length - 1];
                if (lastDisable.end === -1) {
                    lastDisable.end = start;
                    if (end !== -1) {
                        disableRanges.push({ pos: end, end: -1 });
                    }
                }
            }
        } else {
            if (disableRanges === undefined) {
                map.set(ruleName, [{ pos: start, end }]);
            } else if (disableRanges[disableRanges.length - 1].end !== -1) {
                disableRanges.push({ pos: start, end });
            }
        }
    }
}