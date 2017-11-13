// tslint:disable:no-console .
// Taken from vscode: src/vs/code/node/cliProcessMain.ts

function quit(accessor: ServicesAccessor, reason?: ExpectedError | Error): void {
    const logService = accessor.get(ILogService);
    const lifecycleService = accessor.get(ILifecycleService);

    let exitCode = 0;

    if (reason) {
        if ((reason as ExpectedError).isExpected) {
            logService.log(reason.message);
        } else {
            exitCode = 1;

            if (reason.stack) {
                console.error(reason.stack);
            } else {
                console.error(`Startup error: ${reason.toString()}`);
            }
        }
    }

    lifecycleService.kill(exitCode);
}
