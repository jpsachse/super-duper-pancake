
function testMethod(): number {
    return 42;
}

console.log("testing");
const aVariable = testMethod() + 5;
const anotherVariable = Math.random() * 100;
if (aVariable < anotherVariable) {
    console.log(aVariable);
} else {
    console.log(anotherVariable);
}
