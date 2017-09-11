
class Foo {

    private bar() {
        // tslint:disable-next-line:arrow-return-shorthand
        const foo = () => { return () => { return; }; };
    }

}
