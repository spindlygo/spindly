let gppid;

exports.SpindlyGoRun = () => {

    function toExit() {
        if (gppid) {
            var kill = require('tree-kill');
            kill(gppid);
        }
    }

    const GORUN = !(process.env.GORUN && process.env.GORUN.toUpperCase() === 'FALSE');
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