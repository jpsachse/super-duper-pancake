
// This is a class header comment.
class foo {

    // This is a member comment
    private bar: string;

    // This is a member comment for a member with superfluous tokens
    ; ; private fooBar: number;

    // This is a constructor comment
    constructor() { return; }

    // This is a method header comment
    public bars() {
        // This is an inline comment for the enum
        enum anEnum {
            first, // This is a trailing inline comment for the first enum value
            second,
            third,
        } // This is a trailing inline comment for the enum
        return;
    }

}

// This is a function header comment
function fooBar() {
    return;
}
