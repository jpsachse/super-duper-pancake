// tslint:disable
// Taken from oni: oni/browser/src/Editor/NeovimRenderer.tsx

function componentDidMount(): void {
    if (this._element) {
        this.props.renderer.start(this._element)

        this._onResize()
    }

    if (!this._boundOnResizeMethod) {
        this._boundOnResizeMethod = this._onResize.bind(this)
        this._resizeObserver = new window["ResizeObserver"]((entries: any) => {
            if (this._boundOnResizeMethod) {
                this._boundOnResizeMethod()
            }
        })
        this._resizeObserver.observe(this._element)
    }
}
