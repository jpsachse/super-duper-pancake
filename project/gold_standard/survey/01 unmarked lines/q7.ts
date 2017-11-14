// tslint:disable
// Taken from rxjs: rxjs/src/ReplaySubject.ts

function _subscribe(subscriber: Subscriber<T>): Subscription {
    const _events = this._trimBufferThenGetEvents();
    const scheduler = this.scheduler;
    let subscription: Subscription;

    if (this.closed) {
        throw new ObjectUnsubscribedError();
    } else if (this.hasError) {
        subscription = Subscription.EMPTY;
    } else if (this.isStopped) {
        subscription = Subscription.EMPTY;
    } else {
        this.observers.push(subscriber);
        subscription = new SubjectSubscription(this, subscriber);
    }

    if (scheduler) {
        subscriber.add(subscriber = new ObserveOnSubscriber<T>(subscriber, scheduler));
    }

    const len = _events.length;
    for (let i = 0; i < len && !subscriber.closed; i++) {
        subscriber.next(_events[i].value);
    }

    if (this.hasError) {
        subscriber.error(this.thrownError);
    } else if (this.isStopped) {
        subscriber.complete();
    }

    return subscription;
}
