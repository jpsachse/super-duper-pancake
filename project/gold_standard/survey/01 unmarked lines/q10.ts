// tslint:disable
// Taken from ionic: ionic/src/navigation/overlay-proxy.ts

function present(navOptions: NavOptions = {}) {

    const isLazyLoaded = isString(this._component);
    if (isLazyLoaded) {
        return this._deepLinker.getComponentFromName(this._component).then((loadedComponent: any) => {
            this._component = loadedComponent;
            return this.createAndPresentOverlay(navOptions);
        });
    } else {
        return this.createAndPresentOverlay(navOptions);
    }
}
