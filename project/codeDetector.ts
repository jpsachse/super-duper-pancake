
export abstract class CodeDetector {
    constructor(protected ruleLocation: string) {}
    public abstract isCommentedCode(text: string): boolean;
}
