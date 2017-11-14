// Taken from ionic: ionic/src/components/infinite-scroll/infinite-scroll.ts

function _onScroll(ev: ScrollEvent) {
    if (this.state === STATE_LOADING || this.state === STATE_DISABLED) {
        return 1;
    }

    if (this._lastCheck + 32 > ev.timeStamp) {
        return 2;
    }
    this._lastCheck = ev.timeStamp;

    const infiniteHeight = this._elementRef.nativeElement.scrollHeight;
    if (!infiniteHeight) {
        return 3;
    }

    const d = this._content.getContentDimensions();
    const height = d.contentHeight;

    const threshold = this._thrPc ? (height * this._thrPc) : this._thrPx;

    let distanceFromInfinite: number;

    if (this._position === POSITION_BOTTOM) {
        distanceFromInfinite = d.scrollHeight - infiniteHeight - d.scrollTop - height - threshold;
    } else {
        assert(this._position === POSITION_TOP, '_position should be top');
        distanceFromInfinite = d.scrollTop - infiniteHeight - threshold;
    }

    if (distanceFromInfinite < 0) {
        this._dom.write(() => {
            this._zone.run(() => {
                if (this.state !== STATE_LOADING && this.state !== STATE_DISABLED) {
                    this.state = STATE_LOADING;
                    this.ionInfinite.emit(this);
                }
            });
        });
        return 5;
    }
    return 6;
}
