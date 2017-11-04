
function aFunction(withAParameter: number): number {
    const test = 5;
    let varTest = test;
    if (withAParameter < 5) {
        console.log(withAParameter);
    }
    withAParameter++;

    varTest += test;
    // This is a two line
    // comment
    return varTest;
}
