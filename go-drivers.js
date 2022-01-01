
exports.Driver_WebApp = `package spindlyapp

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
	go Spindly.TryAndOpenChromiumWindow("http://localhost:"+DefaultPort, true)
	Spindly.Serve(router, DefaultPort)
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
}
`

exports.Driver_Webview = `package spindlyapp

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

	url := "http://localhost:" + DefaultPort

	if Spindly.TryAndOpenChromiumWindow(url, false) {
		Spindly.Serve(router, DefaultPort)
		return
	}

	println("Cannot find a chromium based browser, opening with webview instead")

	go func() {
		Spindly.Serve(router, DefaultPort)
	}()

	time.Sleep(time.Millisecond * 500)

	wv = webview.New(debug)
	defer wv.Destroy()
	wv.SetTitle("Spindly")
	wv.SetSize(1024, 640, webview.HintMin)
	wv.Navigate(url)
	wv.Run()
}
`