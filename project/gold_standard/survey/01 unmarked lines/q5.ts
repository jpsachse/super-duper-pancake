// tslint:disable
// Taken from oni: oni/browser/src/Utility.ts

export function ignoreWhilePendingPromise<T, U>(observable$: Observable<T>, promiseFunction: (input: T) => Promise<U>): Observable<U> {

        const ret = new Subject<U>()

        let pendingInputs: T[] = []
        let isPromiseInFlight = false

        const promiseExecutor = () => {

            if (pendingInputs.length > 0) {
                const latestValue = pendingInputs[pendingInputs.length - 1]
                pendingInputs = []

                isPromiseInFlight = true
                promiseFunction(latestValue)
                    .then((v) => {
                        ret.next(v)

                        isPromiseInFlight = false
                        promiseExecutor()
                    }, (err) => {
                         isPromiseInFlight = false
                         promiseExecutor()
                         throw err
                    })

            }
        }

        observable$.subscribe((val: T) => {
            pendingInputs.push(val)

            if (!isPromiseInFlight) {
                promiseExecutor()
            }
        },
        (err) => ret.error(err),
        () => ret.complete())

        return ret
    }
