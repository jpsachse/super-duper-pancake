// Taken from ionic: ionic/src/navigation/deep-linker.ts

function navChange(direction: string) {
    if (direction) {
        const activeNavContainers = this._app.getActiveNavContainers();

        for (const activeNavContainer of activeNavContainers) {
            if (isTabs(activeNavContainer) || (activeNavContainer as NavController).isTransitioning()) {
                return;
            }
        }

        let segments: NavSegment[] = [];
        const navContainers: NavigationContainer[] = this._app.getRootNavs();
        for (const navContainer of navContainers) {
            const segmentsForNav = this.getSegmentsFromNav(navContainer);
            segments = segments.concat(segmentsForNav);
        }
        segments = segments.filter(segment => !!segment);
        if (segments.length) {
            const browserUrl = this._serializer.serialize(segments);
            this._updateLocation(browserUrl, direction);
        }
    }
}
