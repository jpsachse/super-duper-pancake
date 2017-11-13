// Taken from vscode: vscode/src/vs/base/common/jsonEdit.ts

function withFormatting(text: string, edit: Edit, formattingOptions: FormattingOptions): Edit[] {

	let newText = applyEdit(text, edit);

	let begin = edit.offset;
	let end = edit.offset + edit.content.length;
	let edits = format(newText, { offset: begin, length: end - begin }, formattingOptions);

	for (let i = edits.length - 1; i >= 0; i--) {
		let edit = edits[i];
		newText = applyEdit(newText, edit);
		begin = Math.min(begin, edit.offset);
		end = Math.max(end, edit.offset + edit.length);
		end += edit.content.length - edit.length;
	}

	let editLength = text.length - (newText.length - end) - begin;
	return [{ offset: begin, length: editLength, content: newText.substring(begin, end) }];
}
