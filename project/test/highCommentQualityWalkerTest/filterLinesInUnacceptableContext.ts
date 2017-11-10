/**
 * This is a JSDoc comment with code.
 * this.is.not.allowed();
 * ```
 * this.is.okay()
 * ```
 * this.is.also.not.allowed();
 * @example this.one.as.well();
 * this.is.also.okay();
 * @param this this.is.not.okay();
 * this.neither();
 */
function thisIsHereSoThatICanFindTheComment() {}

// Here is some more not allowed code:
// console.log();
// And some allowed code:
// ```
// console.log();
// ```
// console.log()
function thisIsHereSoThatICanFindTheCommentv2() {}

function test() {
    // Here is a comment that is indented.
    // console.log();
    // ```
    // console.log();
    // ```
    if (true) { return; }
}
