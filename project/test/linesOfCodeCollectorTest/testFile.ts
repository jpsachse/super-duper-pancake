
function allLines(): number {
    const bar = 5;
    return bar;
}

function noEmptyLines(): number {
    const bar = 5;

    return bar;
}

function noCommentLines(): number {
    const bar = 5;
    // Returning bar to be a good function
    return bar;
}

function trickyCommentLines(): number {
    let bar = 5;
    /* I don't know why*/ bar = 6; /*, but people can be evil */
    return bar;
}

function trickyCommentOnlyLines(): number {
    const bar = 5;
    /* I don't know why*/  /*, but people can be evil */
    return bar;
}
