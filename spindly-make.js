let fg = require("fast-glob");
let fs = require("fs");
let child_process = require("child_process");

let { Driver_In_Browser, Driver_ChromeApp, Driver_Adaptive } = require("./go-drivers");


let Verbose = false;
let GoStoreFileName;

exports.SpindlyMake = async (verbose = false) => {
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

import (
    "time"

    "github.com/spindlygo/SpindlyExports"
    "github.com/spindlygo/spindly/Spindly"
)

var HubManager *Spindly.HubManager = Spindly.NewHubManager()
`
    const hublist = Object.entries(SpindlyStores);


    for (const [hubclass, hub] of hublist) {


        async function MakeSvelteHub() {
            // Get the name of the store

            let jshub = `src/${hub.filepath}.spindlyhubs.js`;

            if (Verbose) console.log("\tHub : ", jshub);

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
            let js = `import { ConnectHub } from "spindly-hubs";

const hub_name = '${hubclass}';

export function ${hubclass}(hub_instance_id, preserve = false) {
    let SpindlyStore = ConnectHub(hub_name, hub_instance_id, preserve);
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

            goExportedStruct = `
type ${hubclass}Exported struct {
`
            goExporterFunc = `
func (hub *${hubclass}) ToExported() *${hubclass}Exported {
    return &${hubclass}Exported{
`


            for (const [name, V] of Object.entries(hub.stores)) {

                if (V.type === "event") {
                    js += `        ${name}: SpindlyEventStore("${name}"),\n`;
                    hub.stores[name].type = "float64";
                } else {
                    js += `        ${name}: SpindlyStore("${name}"),\n`;
                }

                go += `\t${name} Spindly.SpindlyStore\n`;
                goExportedStruct += `\t${name} *SpindlyExports.ExportedStore\n`;
                goExporterFunc += `\t\t${name}:\thub.${name}.ToExported(),\n`;

            }


            js += `    }
}

`;
            go += `}
var ${hubclass}_OnInstanciate func(*${hubclass})

`

            goExportedStruct += `}\n`;
            goExporterFunc += `\t}\n}\n`;

            go += goExportedStruct;
            go += goExporterFunc;

            if ((hub.hasOwnProperty("instances")) && (hub.instances.length > 0)) {
                for (const instname of hub.instances) {
                    js += `export let ${instname} = ${hubclass}("${instname}", true);\n`;
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

    let instancedHubs = [];

    for (const [hubclass, hub] of hublist) {
        go += `    HubManager.RegisterClass("${hubclass}", func() Spindly.HubClass { return &${hubclass}{} })
`
        if ((hub.hasOwnProperty("instances")) && (hub.instances.length > 0)) {
            for (const instname of hub.instances) {
                go += `${instname} = ${hubclass}{}.New("${instname}")\n`
                instancedHubs.push({ name: instname, hubclass: hubclass });
            }
        }
    }

    go += `\tnamedExports = &NamedExportedHubs{\n`

    for (const inst of instancedHubs) {
        go += `\t\t${inst.name}: ${inst.name}.ToExported(),\n`
    }

    go += `\t}\n}
type NamedExportedHubs struct {
`

    for (const inst of instancedHubs) {
        go += `\t${inst.name} *${inst.hubclass}Exported\n`
    }

    go += `}\n
var namedExports *NamedExportedHubs = nil

func NamedExports() *NamedExportedHubs {
	for namedExports == nil {
		println("Waiting for NamedExports")
		time.Sleep(100 * time.Millisecond)
	}

	return namedExports
}
`


    // Make the Go store file
    fs.writeFileSync(GoStoreFileName, go);

    if (SpindlyConfigs.hasOwnProperty("devdriver") && SpindlyConfigs.devdriver) {
        let devdriver = SpindlyConfigs.devdriver;
        if (devdriver == "browser") {
            fs.writeFileSync("spindlyapp/driver.go", Driver_In_Browser);
        } else if (devdriver == "adaptive") {
            fs.writeFileSync("spindlyapp/driver.go", Driver_Adaptive);
        } else if (devdriver == "chromeapp") {
            fs.writeFileSync("spindlyapp/driver.go", Driver_ChromeApp);
        }
    }

    await Promise.all(MakePromises);

    await Exec(`go fmt ${GoStoreFileName} `);
    await Exec(`go mod tidy`);


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
