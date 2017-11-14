// Taken from ionic: ionic/src/components/content/content.ts

function addScrollPadding(newPadding: number) {
    assert(typeof this._scrollPadding === 'number', '_scrollPadding must be a number');
    if (newPadding === 0) {
        this._inputPolling = false;
        this._scrollPadding = -1;
    }
    if (newPadding > this._scrollPadding) {
        console.debug(`content, addScrollPadding, newPadding: ${newPadding}, this._scrollPadding: ${this._scrollPadding}`);

        this._scrollPadding = newPadding;
        var scrollEle = this.getScrollElement();
        if (scrollEle) {
            this._dom.write(() => {
                scrollEle.style.paddingBottom = (newPadding > 0) ? newPadding + 'px' : '';
            });
        }
    }
}
