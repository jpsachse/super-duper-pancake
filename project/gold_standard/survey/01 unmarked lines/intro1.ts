// tslint:disable
// taken from ionic: ionic/src/components/app/app.ts

export function findTopNavs(nav: NavigationContainer): NavigationContainer[] {
    let containers: NavigationContainer[] = [];
    const childNavs = nav.getActiveChildNavs();
    if (!childNavs || !childNavs.length) {
        containers.push(nav);
    } else {
        childNavs.forEach(childNav => {
            const topNavs = findTopNavs(childNav);
            containers = containers.concat(topNavs);
        });
    }
    return containers;
}
