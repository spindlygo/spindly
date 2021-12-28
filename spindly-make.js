
import fg from 'fast-glob';
import fs from 'fs';
import child_process from 'child_process';


let Verbose = false;
let GoStoreFileName;

export async function SpindlyMake(verbose = false) {
    Verbose = verbose;

    if (Verbose) console.log('Spindly Make Started');

    let SpindlyStores = JSON.parse(fs.readFileSync('SpindlyStores.json', 'utf8'));

    const GoStorePackageName = "spindlyapp";

    GoStoreFileName = GoStorePackageName + "/spindlyhubs.go";

    let SpindlyConfigs = JSON.parse(fs.readFileSync('SpindlyConfigs.json', 'utf8'));

    await CleanSpindlyHubs();

    let MakePromises = [];

    // Make the Go store file
    let go = `package ${GoStorePackageName}

import "github.com/HasinduLanka/Spindly/Spindly"

var HubManager *Spindly.HubManager = Spindly.NewHubManager()
`
    const hublist = Object.entries(SpindlyStores);


    for (const [hubclass, hub] of hublist) {


        async function MakeSvelteHub() {
            // Get the name of the store

            let jshub = `src/${hub.filepath}.spindlyhubs.js`;

            if (Verbose) console.log("\tJS Hub : ", jshub);

            CreateDir(jshub);


            // Count how many nested directories are in the file path
            // and make rootDirPath for js module imports
            let rootDirPath = '';
            for (let i = 0; i < hub.filepath.length; i++) {
                if (hub.filepath[i] == '/') {
                    rootDirPath += "../";
                }
            }

            if (rootDirPath.length == 0) {
                rootDirPath = './';
            }


            // Make the svelte Hub file
            let js = `import ConnectHub from '${rootDirPath}SpindlyHubs.js'

const hub_name = '${hubclass}';

export function ${hubclass}(hub_instance_id) {
    let SpindlyStore = ConnectHub(hub_name, hub_instance_id);
    let SpindlyEventStore = (storename) => {
        let es = SpindlyStore(storename);
        return () => { es.set(Math.random()); };
    };
    return {
`;
            go += `
type ${hubclass} struct {
    Instance *Spindly.HubInstance
`


            for (const [name, V] of Object.entries(hub.stores)) {
                if (Verbose) console.log("\t\SpindlyStore : ", name);

                if (V.type === "event") {
                    js += `        ${name}: SpindlyEventStore("${name}"),\n`;
                    hub.stores[name].type = "float64";
                } else {
                    js += `        ${name}: SpindlyStore("${name}"),\n`;
                }

                go += `\t${name} Spindly.SpindlyStore\n`;

            }


            js += `    }
}

`;
            go += `}
var ${hubclass}_OnInstanciate func(*${hubclass})

`

            if ((hub.hasOwnProperty("instances")) && (hub.instances.length > 0)) {
                for (const instname of hub.instances) {
                    js += `export let ${instname} = ${hubclass}("${instname}");\n`;
                    go += `var ${instname} *${hubclass}\n`
                }
            }

            go += `
func (hub ${hubclass}) New(InstanceID string) *${hubclass} {
    hub.Instanciate(InstanceID)
    return &hub
}
            
func (hub *${hubclass}) Instanciate(InstanceID string) *Spindly.HubInstance {
	hub.Instance = &Spindly.HubInstance{
		HubClass:    "${hubclass}",
		InstanceID: InstanceID,
		Stores:     make(map[string]*Spindly.SpindlyStore),
	}
`


            for (const [name, V] of Object.entries(hub.stores)) {
                go += `
    hub.${name} = Spindly.NewSpindlyStore(
		"${name}",
		func() interface{} {
            `;

                if ((V.hasOwnProperty("template")) && (V.template)) {
                    go += `return ${V.template}`;
                } else {

                    if (V.type === "string") {
                        go += `return ""`;

                    } else if (V.type === "int") {
                        go += `return 0`;

                    } else if (V.type === "bool") {
                        go += `return false`;

                    } else if (V.type === "float64") {
                        go += `return 0.0`;

                    } else {
                        go += `return ${V.type}{}`;
                    }
                }

                go += `
		},
		`;


                if ((V.hasOwnProperty("default")) && (V.default)) {
                    if (V.type === "string") {
                        go += `\`${V.default}\`,`;
                    } else {
                        go += `${V.default},`;
                    }

                } else {
                    go += `nil,`;
                }

                go += `
	)
    hub.Instance.Register(&hub.${name})
`;

            }

            go += `
	HubManager.Register(hub.Instance)
    if ${hubclass}_OnInstanciate != nil {
		go ${hubclass}_OnInstanciate(hub)
	}
    return hub.Instance
}
`;


            for (const [name, V] of Object.entries(hub.stores)) {
                go += `
func (hub *${hubclass}) Get${name}() ${V.type} {
    return hub.${name}.Get().(${V.type})
}`;
            }
            //instances
            go += `\n`;


            fs.writeFileSync(jshub, js);

        }

        if (Verbose) {
            await MakeSvelteHub(hubclass, hub);
        } else {
            // Concurency
            MakePromises.push(MakeSvelteHub(hubclass, hub));
        }

    }

    go += `
func InitializeHubs() {
`


    for (const [hubclass, hub] of hublist) {
        go += `    HubManager.RegisterClass("${hubclass}", func() Spindly.HubClass { return &${hubclass}{} })
`
        if ((hub.hasOwnProperty("instances")) && (hub.instances.length > 0)) {
            for (const instname of hub.instances) {
                go += `${instname} = ${hubclass}{}.New("${instname}")\n`
            }
        }
    }
    go += `}`

    // Make the Go store file
    fs.writeFileSync(GoStoreFileName, go);

    if (SpindlyConfigs.hasOwnProperty("devdriver") && SpindlyConfigs.devdriver) {
        let devdriver = SpindlyConfigs.devdriver;
        if (devdriver == "browser") {
            fs.writeFileSync("spindlyapp/driver.go", Driver_In_Browser);
        } else if (devdriver == "webview") {
            fs.writeFileSync("spindlyapp/driver.go", Driver_Webview);
        } else if (devdriver == "webapp") {
            fs.writeFileSync("spindlyapp/driver.go", Driver_WebApp);
        }
    }

    await Promise.all(MakePromises);

    Exec(`go fmt ${GoStoreFileName} `);

}

function Exec(file) {
    var exec = child_process.exec;
    exec(file, function callback(error, stdout, stderr) {
        if (stdout) console.log(file + ': ' + stdout);
        if (stderr) console.log(file + ': Erro : ' + stderr);
        if (error) console.error(error);
    });
}



function CreateDir(filename) {
    // Get directory of the filename
    let dir = filename.substring(0, filename.lastIndexOf('/'));
    if (dir.length != 0) {
        // Make directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            if (Verbose) console.log('\tCreating directory: ' + dir);
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}


function getRegexGroupMatches(string, regex, index) {
    index || (index = 1); // default to the first capturing group
    var matches = [];
    var match;
    while (match = regex.exec(string)) {
        matches.push(match[index]);
    }
    return matches;
}


async function CleanSpindlyHubs() {

    // Optimized for concurency

    let rmGoFile = RemoveFile(GoStoreFileName);

    const jsfiles = await fg("src/**/**/*.spindlyhubs.js");
    let filesdels = new Array(jsfiles.length + 1);
    filesdels.push(rmGoFile);

    for (let file of jsfiles) {
        filesdels.push(RemoveFile(file));
    }

    CreateDir(GoStoreFileName);

    await Promise.all(filesdels);
}

async function RemoveFile(file) {
    fs.rmSync(file, { force: true });
    return null;
}


export const Driver_WebApp = `
package spindlyapp

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/HasinduLanka/Spindly/SpindlyServer"
	"github.com/gorilla/mux"
)

var router *mux.Router

func Configure() {
	InitializeHubs()
	router = SpindlyServer.NewRouter()
	SpindlyServer.HandleHub(router, HubManager)
	SpindlyServer.HandleStatic(router, "public", "index.html")
}

func Serve() {
	go Open("http://localhost:32510")
	SpindlyServer.Serve(router, "32510")
}

// Open tries to open url in a browser and reports whether it succeeded.
func Open(url string) bool {
	for _, args := range Commands(url) {

		fmt.Println("Opening", url, "with", args)
		cmd := exec.Command(args[0], args[1:]...)

		if cmd.Start() == nil && appearsSuccessful(cmd, 3*time.Second) {
			return true
		}
	}
	return false
}

func Commands(url string) [][]string {

	var cmds [][]string

	switch runtime.GOOS {
	case "darwin": // Mac OS

		chromeLocations := []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"/usr/bin/google-chrome-stable",
			"/usr/bin/google-chrome",
			"/usr/bin/chromium",
			"/usr/bin/chromium-browser",
		}

		for _, channel := range []string{"", "-stable", "-browser", "-beta", "-canary", "-dev", "-nightly"} {
			for _, chromiumBrowser := range chromeLocations {
				if ProgramExists(chromiumBrowser + channel) {
					cmds = append(cmds, []string{chromiumBrowser + channel, "--app=" + url})
				}
			}
		}

		for _, chromeBin := range []string{"Google Chrome", "Microsoft Edge"} {
			cmds = append(cmds, []string{"open -a \\\"" + chromeBin + "\\\"", "--app=" + url})
		}

		cmds = append(cmds, []string{"/usr/bin/open", url})

	case "windows":

		// Lets hope that the user didn't find a way to uninstall Edge.
		cmds = append(cmds, []string{"cmd", "/c", "start", "msedge", "--app=" + url})
		cmds = append(cmds, []string{"cmd", "/c", "start", url})

	default:
		// case "linux":
		for _, channel := range []string{"", "-stable", "-browser", "-beta", "-canary", "-dev", "-nightly"} {
			for _, chromiumBrowser := range []string{"google-chrome", "chromium", "chrome", "msedge", "vivaldi", "opera", "brave", "/snap/bin/chromium"} {
				if ProgramExists(chromiumBrowser + channel) {
					cmds = append(cmds, []string{chromiumBrowser + channel, "--app=" + url})
				}
			}

		}

		if ProgramExists("firefox") {
			cmds = append(cmds, []string{"firefox", "-ssb " + url})
		}
		if ProgramExists("firefox-stable") {
			cmds = append(cmds, []string{"firefox-stable", "-ssb " + url})
		}

		if os.Getenv("DISPLAY") != "" {
			// xdg-open is only for use in a desktop environment.
			cmds = append(cmds, []string{"xdg-open", url})
		}

	}
	return cmds

}

func ProgramExists(program string) bool {
	_, err := exec.LookPath(program)
	return err == nil
}

// appearsSuccessful reports whether the command appears to have run successfully.
// If the command runs longer than the timeout, it's deemed successful.
// If the command runs within the timeout, it's deemed successful if it exited cleanly.
func appearsSuccessful(cmd *exec.Cmd, timeout time.Duration) bool {
	errc := make(chan error, 1)
	go func() {
		errc <- cmd.Wait()
	}()

	select {
	case <-time.After(timeout):
		return true
	case err := <-errc:
		return err == nil
	}
}

`


export const Driver_In_Browser = `
package spindlyapp

import (
	"github.com/HasinduLanka/Spindly/SpindlyServer"
	"github.com/gorilla/mux"
)

var router *mux.Router

func Configure() {
	InitializeHubs()
	router = SpindlyServer.NewRouter()
	SpindlyServer.HandleHub(router, HubManager)
	SpindlyServer.HandleStatic(router, "public", "index.html")
}

func Serve() {
	SpindlyServer.Serve(router, "32510")
}

`

export const Driver_Webview = `
package spindlyapp

import (
	"time"

	"github.com/HasinduLanka/Spindly/SpindlyServer"
	"github.com/gorilla/mux"
	"github.com/webview/webview"
)

const Port = "32510"
const debug = true

var router *mux.Router
var wv webview.WebView

func Configure() {
	InitializeHubs()
	router = SpindlyServer.NewRouter()
	SpindlyServer.HandleHub(router, HubManager)
	SpindlyServer.HandleStatic(router, "public", "index.html")

}

func Serve() {
	go func() {
		SpindlyServer.Serve(router, Port)
	}()

	time.Sleep(time.Millisecond * 500)

	wv = webview.New(debug)
	defer wv.Destroy()
	wv.SetTitle("Spindly")
	wv.SetSize(1024, 640, webview.HintMin)
	wv.Navigate("http://localhost:" + Port)
	wv.Run()
}

`