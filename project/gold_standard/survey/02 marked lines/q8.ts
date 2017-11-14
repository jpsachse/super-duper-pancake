// Taken from ionic: ionic/src/tap-click/ripple.ts

function _downAction(ev: UIEvent, activatableEle: HTMLElement, _startCoord: PointerCoordinates) {
    if (isActivatedDisabled(ev, activatableEle)) {
        return;
    }

    var j = activatableEle.childElementCount;
    while (j--) {
        var rippleEle: any = activatableEle.children[j];
        if (rippleEle.classList.contains('button-effect')) {
            var clientRect = activatableEle.getBoundingClientRect();
            rippleEle.$top = clientRect.top;
            rippleEle.$left = clientRect.left;
            rippleEle.$width = clientRect.width;
            rippleEle.$height = clientRect.height;
            break;
        }
    }
}
