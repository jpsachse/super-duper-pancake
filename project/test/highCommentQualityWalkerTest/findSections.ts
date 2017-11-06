
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

function anotherFunction(withAParameter: number): number {

    const instantiationService = { invokeFunction: (a) => a() };

    return instantiationService.invokeFunction((aVariable) => {

        const aConstant = 5;
        let aVariable = 42;

        for (let i = 0; i < aConstant; ++i) {
            aVariable += aConstant * Math.random();

        }
    });
}
