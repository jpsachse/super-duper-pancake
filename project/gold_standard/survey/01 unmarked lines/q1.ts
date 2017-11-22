// tslint:disable
// Taken from tslint: src/enableDisableRules.ts

export function removeDisabledFailures(sourceFile: ts.SourceFile, failures: RuleFailure[]): RuleFailure[] {
    if (failures.length === 0) {
        return failures;
    }

    const failingRules = new Set(failures.map((f) => f.getRuleName()));
    const map = getDisableMap(sourceFile, failingRules);
    return failures.filter((failure) => {
        const disabledIntervals = map.get(failure.getRuleName());
        return disabledIntervals === undefined || !disabledIntervals.some(({ pos, end }) => {
            const failPos = failure.getStartPosition().getPosition();
            const failEnd = failure.getEndPosition().getPosition();
            return failEnd >= pos && (end === -1 || failPos <= end);
        });
    });
}
