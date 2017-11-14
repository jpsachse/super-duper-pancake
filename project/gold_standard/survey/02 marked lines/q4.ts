// Taken from ionic: ionic/src/navigation/nav-controller-base.ts

function _success(result: NavResult, ti: TransitionInstruction) {
    if (this._queue === null) {
        this._fireError('nav controller was destroyed', ti);
        return;
    }
    this._init = true;
    this._trnsId = null;

    this.setTransitioning(false);
    this._swipeBackCheck();

    this._nextTrns();

    if (ti.done) {
        ti.done(
            result.hasCompleted,
            result.requiresTransition,
            result.enteringName,
            result.leavingName,
            result.direction
        );
    }
    ti.resolve(result.hasCompleted);
}
