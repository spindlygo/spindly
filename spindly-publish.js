let { Driver_In_Browser, Driver_ChromeApp, Driver_Adaptive } = require("./go-drivers");

let fs = require("fs");
let os = require("os");
let path = require("path");
let child_process = require("child_process");

let Verbose = true;

BuildPackages();

async function BuildPackages() {

    const publishDir = "published-app";

    fs.rmSync(publishDir, { force: true, recursive: true });
    fs.mkdirSync(publishDir);

    let SpindlyConfigs = JSON.parse(fs.readFileSync('SpindlyConfigs.json', 'utf8'));

    let appname = "SpindlyApp";

    if (SpindlyConfigs.hasOwnProperty("appname") && SpindlyConfigs.appname) {
        appname = SpindlyConfigs.appname;
    }




    let alldrivers = [];

    if (SpindlyConfigs.hasOwnProperty("driver") && SpindlyConfigs.driver) {
        alldrivers = SpindlyConfigs.driver;
    }

    let archs = [];

    if (SpindlyConfigs.hasOwnProperty("arch") && SpindlyConfigs.arch) {
        archs = SpindlyConfigs.arch;
    }

    let PublishApp = async (targetos, ext, arch, driver, buildargs = "", envvars = "") => {
        let dir = publishDir + "/" + appname + "-" + targetos + "-" + arch + "-" + driver + "/";
        fs.mkdirSync(dir + "public", { recursive: true });
        CopyFolder("public", dir);
        let cmd = `env GOOS=${targetos} GOARCH=${arch} ${envvars} go build ${buildargs} -o ${dir}${appname}${ext}`;
        await Exec(cmd);

        if (Verbose) console.log("> " + cmd);
        if (Verbose) console.log("Built " + dir + "\n");

    }

    let PublishMobileBind = async (targetos, ext, buildargs = "", envvars = "") => {
        let dir = publishDir + "/" + appname + "-" + targetos + "/";
        fs.mkdirSync(dir + "public", { recursive: true });
        CopyFolder("public", dir);
        let cmd = `env ${envvars} gomobile bind ${buildargs} -o ${dir}${appname}${ext} ./GoApp`;
        await Exec(cmd);

        if (Verbose) console.log("> " + cmd);
        if (Verbose) console.log("Built " + dir + "\n");

    }

    if (process.env.SPINDLYBUILD === "BROWSER") {
        alldrivers = ["browser"];
    }

    if (process.env.SPINDLYBUILD === "ADAPTIVE") {
        alldrivers = ["adaptive"];
    }


    if (alldrivers.indexOf("chromeapp") > -1) {

        fs.writeFileSync("spindlyapp/driver.go", Driver_ChromeApp);
        await Exec(`go mod tidy`);

        if (SpindlyConfigs.hasOwnProperty("os") && SpindlyConfigs.os) {

            let targetos = SpindlyConfigs.os;

            if (targetos.indexOf("windows") > -1) {
                if (archs.indexOf("amd64") > -1) {
                    await PublishApp("windows", ".exe", "amd64", "chromeapp", (SpindlyConfigs.windowscli ? "" : `-ldflags="-H windowsgui"`));
                }
                if (archs.indexOf("386") > -1) {
                    await PublishApp("windows", ".exe", "386", "chromeapp", (SpindlyConfigs.windowscli ? "" : `-ldflags="-H windowsgui"`));
                }

            }

            if (targetos.indexOf("darwin") > -1) {
                if (archs.indexOf("amd64") > -1) {
                    await PublishApp("darwin", "", "amd64", "chromeapp");
                }
            }

            if (targetos.indexOf("linux") > -1) {
                if (archs.indexOf("amd64") > -1) {
                    await PublishApp("linux", "", "amd64", "chromeapp");
                }
                if (archs.indexOf("386") > -1) {
                    await PublishApp("linux", "", "386", "chromeapp");
                }
                if (archs.indexOf("arm") > -1) {
                    await PublishApp("linux", "", "arm", "chromeapp");
                }
            }
        }
    }

    if (alldrivers.indexOf("browser") > -1) {

        fs.writeFileSync("spindlyapp/driver.go", Driver_In_Browser);
        await Exec(`go mod tidy`);

        if (SpindlyConfigs.hasOwnProperty("os") && SpindlyConfigs.os) {

            let targetos = SpindlyConfigs.os;

            if (targetos.indexOf("windows") > -1) {
                if (archs.indexOf("amd64") > -1) {
                    await PublishApp("windows", ".exe", "amd64", "browser", (SpindlyConfigs.windowscli ? "" : `-ldflags="-H windowsgui"`));
                }
                if (archs.indexOf("386") > -1) {
                    await PublishApp("windows", ".exe", "386", "browser", (SpindlyConfigs.windowscli ? "" : `-ldflags="-H windowsgui"`));
                }

            }

            if (targetos.indexOf("darwin") > -1) {
                if (archs.indexOf("amd64") > -1) {
                    await PublishApp("darwin", "", "amd64", "browser");
                }
            }

            if (targetos.indexOf("linux") > -1) {
                if (archs.indexOf("amd64") > -1) {
                    await PublishApp("linux", "", "amd64", "browser");
                }
                if (archs.indexOf("386") > -1) {
                    await PublishApp("linux", "", "386", "browser");
                }
                if (archs.indexOf("arm") > -1) {
                    await PublishApp("linux", "", "arm", "browser");
                }
            }
        }
    }


    if (alldrivers.indexOf("adaptive") > -1) {

        fs.writeFileSync("spindlyapp/driver.go", Driver_Adaptive);


        await Exec(`go mod tidy`);

        if (SpindlyConfigs.hasOwnProperty("os") && SpindlyConfigs.os) {

            let targetos = SpindlyConfigs.os;

            let ostype = os.type();
            let osarch = os.arch();

            if ((ostype === "Windows_NT") && targetos.indexOf("windows") > -1) {
                if ((osarch === "x64") && archs.indexOf("amd64") > -1) {
                    await PublishApp("windows", ".exe", "amd64", "adaptive", (SpindlyConfigs.windowscli ? "" : `-ldflags="-H windowsgui"`));
                }
                if ((osarch === "x32") && archs.indexOf("386") > -1) {
                    await PublishApp("windows", ".exe", "386", "adaptive", (SpindlyConfigs.windowscli ? "" : `-ldflags="-H windowsgui"`));
                }

            }

            if ((ostype === "Darwin") && targetos.indexOf("darwin") > -1) {
                if ((osarch === "x64") && archs.indexOf("amd64") > -1) {
                    await PublishApp("darwin", "", "amd64", "adaptive");
                }
            }

            if ((ostype === "Linux") && targetos.indexOf("linux") > -1) {
                if ((osarch === "x64") && archs.indexOf("amd64") > -1) {
                    await PublishApp("linux", "", "amd64", "adaptive");
                }
                if ((osarch === "x32") && archs.indexOf("386") > -1) {
                    await PublishApp("linux", "", "386", "adaptive");
                }
                if ((osarch === "arm") && archs.indexOf("arm") > -1) {
                    await PublishApp("linux", "", "arm", "adaptive");
                }
            }
        }
    }


    if (alldrivers.indexOf("adaptive-cross") > -1) {

        fs.writeFileSync("spindlyapp/driver.go", Driver_Adaptive);


        await Exec(`go mod tidy`);

        if (SpindlyConfigs.hasOwnProperty("os") && SpindlyConfigs.os) {

            let targetos = SpindlyConfigs.os;
            const mingenv = `CGO_ENABLED=1 CC=x86_64-w64-mingw32-gcc CXX=x86_64-w64-mingw32-g++`;

            if (targetos.indexOf("windows") > -1) {
                if (archs.indexOf("amd64") > -1) {
                    await PublishApp("windows", ".exe", "amd64", "adaptive-cross", `-ldflags="-H windowsgui"`, mingenv);
                }
                if (archs.indexOf("386") > -1) {
                    await PublishApp("windows", ".exe", "386", "adaptive-cross", `-ldflags="-H windowsgui"`, mingenv);
                }

            }

            if (targetos.indexOf("darwin") > -1) {
                if (archs.indexOf("amd64") > -1) {
                    await PublishApp("darwin", "", "amd64", "adaptive-cross", "", mingenv);
                }
            }

            if (targetos.indexOf("linux") > -1) {
                if (archs.indexOf("amd64") > -1) {
                    await PublishApp("linux", "", "amd64", "adaptive-cross", "", mingenv);
                }
                if (archs.indexOf("386") > -1) {
                    await PublishApp("linux", "", "386", "adaptive-cross", "", mingenv);
                }
                if (archs.indexOf("arm") > -1) {
                    await PublishApp("linux", "", "arm", "adaptive-cross", "", mingenv);
                }
            }
        }
    }


    if (alldrivers.indexOf("flutter") > -1) {

        fs.writeFileSync("spindlyapp/driver.go", Driver_In_Browser);

        await Exec(`go mod tidy`);
        await Exec(`go get golang.org/x/mobile/bind`);

        if (SpindlyConfigs.hasOwnProperty("os") && SpindlyConfigs.os) {

            let targetos = SpindlyConfigs.os;

            if (targetos.indexOf("android") > -1) {

                await PublishMobileBind("android", ".aar");
            }
        }

        await Exec(`go mod tidy`);
    }


    // fs.mkdirSync("published-app/windows/public", { recursive: true });
    // CopyFolder("public", "published-app/windows/public");


    // Exec("go build -o published-app/app");

    if (Verbose) console.log("Spindly Publish Finished");
    return null;

}



function copyFileSync(source, target) {

    var targetFile = target;

    // If target is a directory, a new file with the same name will be created
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function CopyFolder(source, target) {
    var files = [];

    // Check if folder needs to be created or integrated
    var targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
    }

    // Copy
    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            var curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                CopyFolder(curSource, targetFolder);
            } else {
                copyFileSync(curSource, targetFolder);
            }
        });
    }
}

function Exec(file) {
    var exec = child_process.exec;

    return new Promise((resolve, reject) => {
        exec(file, function execcallback(error, stdout, stderr) {
            if (stdout) console.log(file + ': ' + stdout);
            if (stderr) console.log(file + ': Erro : ' + stderr);
            if (error) console.error(error);

            resolve();
        });
    });

}
