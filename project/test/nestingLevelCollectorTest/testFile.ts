// tslint:disable
class Bar {

    private foo() {
        const bar = () => {
            const aNumber = 5;
            aNumber.toExponential().toLocaleLowerCase().trim();
        };
    }

}

enum Test {
    value1,
    value2,
    value3,
}

const anotherVariable = { anAttribute: "aValue" };

function test(foo: number): boolean {
    if (foo < 100)
        return false;
    else if (foo > 1)
        return foo < 5;
    else
        foo += 5;
    do
        foo++;
    while (foo < 100)
}
