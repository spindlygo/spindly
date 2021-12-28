
exports.Driver_WebApp = `
package spindlyapp

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"

    "github.com/spindlygo/spindly/Spindly"
	"github.com/gorilla/mux"
)

var router *mux.Router

func Configure() {
	InitializeHubs()
	router = Spindly.NewRouter()
	Spindly.HandleHub(router, HubManager)
	Spindly.HandleStatic(router, "public", "index.html")
}

func Serve() {
	go Open("http://localhost:32510")
	Spindly.Serve(router, "32510")
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


exports.Driver_In_Browser = `
package spindlyapp

import (
    "github.com/spindlygo/spindly/Spindly"
	"github.com/gorilla/mux"
)

var router *mux.Router

func Configure() {
	InitializeHubs()
	router = Spindly.NewRouter()
	Spindly.HandleHub(router, HubManager)
	Spindly.HandleStatic(router, "public", "index.html")
}

func Serve() {
	Spindly.Serve(router, "32510")
}

`

exports.Driver_Webview = `
package spindlyapp

import (
	"time"

    "github.com/spindlygo/spindly/Spindly"
	"github.com/gorilla/mux"
	"github.com/webview/webview"
)

const Port = "32510"
const debug = true

var router *mux.Router
var wv webview.WebView

func Configure() {
	InitializeHubs()
	router = Spindly.NewRouter()
	Spindly.HandleHub(router, HubManager)
	Spindly.HandleStatic(router, "public", "index.html")

}

func Serve() {
	go func() {
		Spindly.Serve(router, Port)
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