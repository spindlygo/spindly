export default function GoRun() {
    let gppid;

    function toExit() {
        if (gppid) {
            var kill = require('tree-kill');
            kill(gppid);
        }
    }

    const GORUN = (process.env.GORUN && process.env.GORUN === '1') || false;
    if (GORUN) {
        return {
            writeBundle() {
                if (gppid) {
                    var kill = require('tree-kill');
                    kill(gppid);
                    console.log("Restarting Go");
                }

                let server = require('child_process').spawn('go', ["run", "."], {
                    stdio: ['ignore', 'inherit', 'inherit'],
                    // shell: true,
                });

                gppid = server.pid;

                process.on('SIGTERM', toExit);
                process.on('exit', toExit);
            }
        };
    } else {
        return {}
    }
}