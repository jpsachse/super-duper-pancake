// tslint:disable
// Taken from ionic: ionic/src/navigation/nav-util.ts

export function convertToViews(linker: DeepLinker, pages: any[]): Promise<ViewController[]> {
    const views: Promise<ViewController>[] = [];
    if (isArray(pages)) {
        for (var i = 0; i < pages.length; i++) {
            var page = pages[i];
            if (page) {
                if (isViewController(page)) {
                    views.push(page);

                } else if (page.page) {
                    views.push(convertToView(linker, page.page, page.params));

                } else {
                    views.push(convertToView(linker, page, null));
                }
            }
        }
    }
    return Promise.all(views);
}
