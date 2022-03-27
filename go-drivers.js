
exports.Driver_ChromeApp = `package spindlyapp

import (
	"github.com/gorilla/mux"
	"github.com/spindlygo/spindly/Spindly"
)

var router *mux.Router
var DefaultPort string = "0"
var HostURL string

func Configure() {
	InitializeHubs()
	router = Spindly.NewRouter()
	Spindly.HandleHub(router, HubManager)
	Spindly.HandleStatic(router, "public", "index.html")
}

func Serve() bool {
	HostURL, DefaultPort = Spindly.Serve(router, DefaultPort)

	if HostURL == "" {
		return false
	}

	Spindly.TryAndOpenChromiumWindow(HostURL, true)
	Spindly.BlockWhileHostRunning()

	return true
}
`


exports.Driver_In_Browser = `package spindlyapp

import (
	"github.com/gorilla/mux"
	"github.com/spindlygo/spindly/Spindly"
)

var router *mux.Router
var DefaultPort string = "0"
var HostURL string

func Configure() {
	InitializeHubs()
	router = Spindly.NewRouter()
	Spindly.HandleHub(router, HubManager)
	Spindly.HandleStatic(router, "public", "index.html")
}

func Serve() bool {
	HostURL, DefaultPort = Spindly.Serve(router, DefaultPort)

	if HostURL == "" {
		return false
	}

	Spindly.BlockWhileHostRunning()

	return true
}
`

exports.Driver_Adaptive = `package spindlyapp

import (
	"time"

	"github.com/gorilla/mux"
	"github.com/spindlygo/spindly/Spindly"
	"github.com/webview/webview"
)

var DefaultPort string = "0"
var HostURL string

const debug = true

var router *mux.Router
var wv webview.WebView

func Configure() {
	InitializeHubs()
	router = Spindly.NewRouter()
	Spindly.HandleHub(router, HubManager)
	Spindly.HandleStatic(router, "public", "index.html")

}

func Serve() bool {
	HostURL, DefaultPort = Spindly.Serve(router, DefaultPort)

	if HostURL == "" {
		return false
	}

	if Spindly.TryAndOpenChromiumWindow(HostURL, false) {
		Spindly.BlockWhileHostRunning()
		return true
	}

	println("Cannot find a chromium based browser, opening with webview instead")

	time.Sleep(time.Millisecond * 500)

	wv = webview.New(debug)
	defer wv.Destroy()
	wv.SetTitle("Spindly")
	wv.SetSize(1024, 640, webview.HintMin)
	wv.Navigate(HostURL)
	wv.Run()

	return true
}
`