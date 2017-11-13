// Taken from vscode: vscode/src/vs/base/common/arrays.ts

export function sortedDiff<T>(before: T[], after: T[], compare: (a: T, b: T) => number): Splice<T>[] {
    const result: Splice<T>[] = [];

    function pushSplice(start: number, deleteCount: number, inserted: T[]): void {
        if (deleteCount === 0 && inserted.length === 0) {
            return;
        }

        const latest = result[result.length - 1];

        if (latest && latest.start + latest.deleteCount === start) {
            latest.deleteCount += deleteCount;
            latest.inserted.push(...inserted);
        } else {
            result.push({ start, deleteCount, inserted });
        }
    }

    let beforeIdx = 0;
    let afterIdx = 0;

    while (true) {
        if (beforeIdx === before.length) {
            pushSplice(beforeIdx, 0, after.slice(afterIdx));
            break;
        }
        if (afterIdx === after.length) {
            pushSplice(beforeIdx, before.length - beforeIdx, []);
            break;
        }

        const beforeElement = before[beforeIdx];
        const afterElement = after[afterIdx];
        const n = compare(beforeElement, afterElement);
        if (n === 0) {
            // equal
            beforeIdx += 1;
            afterIdx += 1;
        } else if (n < 0) {
            // beforeElement is smaller -> before element removed
            pushSplice(beforeIdx, 1, []);
            beforeIdx += 1;
        } else if (n > 0) {
            // beforeElement is greater -> after element added
            pushSplice(beforeIdx, 0, [afterElement]);
            afterIdx += 1;
        }
    }

    return result;
}
