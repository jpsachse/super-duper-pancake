
// This function returns the sum of all numbers between 0 and bar or 0 if bar is negative.
function foo(bar: number): number {
    if (bar <= 0) {
        return 0;
    }
    return bar + foo(bar - 1);
}

function baz() {
    return;
}
