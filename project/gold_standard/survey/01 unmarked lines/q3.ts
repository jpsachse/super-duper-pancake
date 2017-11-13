// tslint:disable
// Taken from oni: oni/browser/src/Editor/BufferManager.ts

function async applyTextEdits(textEdits: types.TextEdit | types.TextEdit[]): Promise<void> {

    const textEditsAsArray = textEdits instanceof Array ? textEdits : [textEdits]

    const sortedEdits = sortTextEdits(textEditsAsArray)

    const deferredEdits = sortedEdits.map((te) => {
        return Observable.defer(async () => {
            const range = te.range
            Log.info("[Buffer] Applying edit")

            const characterStart = range.start.character
            const lineStart = range.start.line
            const lineEnd = range.end.line
            const characterEnd = range.end.character

            if (lineStart === lineEnd) {
                const [lineContents] = await this.getLines(lineStart, lineStart + 1, false)
                const beginning = lineContents.substring(0, range.start.character)
                const end = lineContents.substring(range.end.character, lineContents.length)
                const newLine = beginning + te.newText + end

                const lines = newLine.split(os.EOL)

                await this.setLines(lineStart, lineStart + 1, lines)
            } else if (characterEnd === 0 && characterStart === 0) {
                const lines = te.newText.split(os.EOL)
                await this.setLines(lineStart, lineEnd, lines)
            } else {
                Log.warn("Multi-line mid character edits not currently supported")
            }
        })
    })

    await Observable.from(deferredEdits)
            .concatMap(de => de)
            .toPromise()
}
