// tslint:disable
// Taken from ionic: ionic/src/navigation/nav-util.ts

export function getComponent(linker: DeepLinker, nameOrPageOrView: any, params?: any): Promise<ViewController> {
    if (typeof nameOrPageOrView === 'function') {
        return Promise.resolve(
            new ViewController(nameOrPageOrView, params)
        );
    }

    if (typeof nameOrPageOrView === 'string') {
        return linker.getComponentFromName(nameOrPageOrView).then((component) => {
            const vc = new ViewController(component, params);
            vc.id = nameOrPageOrView;
            return vc;
        });
    }

    return Promise.resolve(null);
}
