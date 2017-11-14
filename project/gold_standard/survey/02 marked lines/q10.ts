// Taken from ionic: ionic/src/platform/platform.ts

function _calcDim() {

    if (this._isPortrait === null || this._isPortrait === false && this._win['innerWidth'] < this._win['innerHeight']) {
        var win = this._win;

        var innerWidth = win['innerWidth'];
        var innerHeight = win['innerHeight'];

        if (win.screen.width > 0 && win.screen.height > 0) {
            if (innerWidth < innerHeight) {

                if (this._pW <= innerWidth) {
                    console.debug('setting _isPortrait to true');
                    this._isPortrait = true;
                    this._pW = innerWidth;
                }

                if (this._pH <= innerHeight) {
                    console.debug('setting _isPortrait to true');
                    this._isPortrait = true;
                    this._pH = innerHeight;
                }

            } else {
                if (this._lW !== innerWidth) {
                    console.debug('setting _isPortrait to false');
                    this._isPortrait = false;
                    this._lW = innerWidth;
                }

                if (this._lH !== innerHeight) {
                    console.debug('setting _isPortrait to false');
                    this._isPortrait = false;
                    this._lH = innerHeight;
                }
            }

        }
    }
}
