
exports.Driver_ChromeApp = `package spindlyapp

import (
	"github.com/gorilla/mux"
	"github.com/spindlygo/spindly/Spindly"
)

var router *mux.Router
var DefaultPort string = "32510"

func Configure() {
	InitializeHubs()
	router = Spindly.NewRouter()
	Spindly.HandleHub(router, HubManager)
	Spindly.HandleStatic(router, "public", "index.html")
}

func Serve() {
	url := Spindly.Serve(router, DefaultPort)
	Spindly.TryAndOpenChromiumWindow(url, true)
	Spindly.BlockWhileHostRunning()
}
`


exports.Driver_In_Browser = `package spindlyapp

import (
	"github.com/gorilla/mux"
	"github.com/spindlygo/spindly/Spindly"
)

var router *mux.Router
var DefaultPort string = "32510"

func Configure() {
	InitializeHubs()
	router = Spindly.NewRouter()
	Spindly.HandleHub(router, HubManager)
	Spindly.HandleStatic(router, "public", "index.html")
}

func Serve() {
	Spindly.Serve(router, DefaultPort)
	Spindly.BlockWhileHostRunning()
}
`

exports.Driver_Adaptive = `package spindlyapp

import (
	"time"

	"github.com/gorilla/mux"
	"github.com/spindlygo/spindly/Spindly"
	"github.com/webview/webview"
)

var DefaultPort string = "32510"

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

	url := Spindly.Serve(router, DefaultPort)

	if Spindly.TryAndOpenChromiumWindow(url, false) {
		Spindly.BlockWhileHostRunning()
		return
	}

	println("Cannot find a chromium based browser, opening with webview instead")

	time.Sleep(time.Millisecond * 500)

	wv = webview.New(debug)
	defer wv.Destroy()
	wv.SetTitle("Spindly")
	wv.SetSize(1024, 640, webview.HintMin)
	wv.Navigate(url)
	wv.Run()
}
`