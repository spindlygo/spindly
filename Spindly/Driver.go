package Spindly

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

// TODO : False
var Verbose bool = true

func NewRouter() *mux.Router {
	router := mux.NewRouter()
	return router
}

// Handle static content.
func HandleStatic(router *mux.Router, staticPath string, indexPath string) {
	handler := http.FileServer(http.Dir(staticPath))
	spa := ServerHandler{staticPath: staticPath, indexPath: indexPath, handler: handler}
	router.PathPrefix("/").Handler(spa)
}

// Handle websocket connections.
func HandleHub(router *mux.Router, manager *HubManager) {
	wshandler := HubServer{Manager: manager}
	router.HandleFunc("/spindly/ws/{hubclass}/{instance}", wshandler.ServeHub)

	go func() {
		time.Sleep(time.Second * 120)
		wshandler.ExitIfUnused()
	}()
}

// Starts serving router on the given port.
// This function blocks until the server stops.
func Serve(router *mux.Router, port string) {

	srv := &http.Server{
		Handler: router,
		Addr:    "localhost:" + port,
	}

	log("Host on http://localhost:" + port)

	go func() {
		final := srv.ListenAndServe()

		if final != nil && len(server_shutdown_channel) == 0 {
			panic(final)
		}
	}()

	<-server_shutdown_channel

	log("Shutting down server...")

	go logerr(srv.Shutdown(context.Background()))
	time.Sleep(time.Second * 4)
	go logerr(srv.Close())

}

var server_shutdown_channel = make(chan bool, 132)

func ShutdownServer() {
	go func() {
		for i := 0; len(server_shutdown_channel) < 128; i++ {
			for j := 0; j < 64; j++ {
				server_shutdown_channel <- true
			}
			time.Sleep(time.Millisecond * 400)
		}

	}()

	time.Sleep(time.Second * 10)

	log("Closing application...")
	os.Exit(0)

}

func log(msg string) {
	if Verbose {
		println(msg)
	}
}

func logobj(msg string, obj interface{}) {
	if Verbose {
		json, jsonerr := json.Marshal(obj)
		if jsonerr == nil {
			println(msg + " " + string(json))
		} else {
			println(msg)
		}
	}
}

func logerr(err error) {
	if err != nil {
		println(err.Error())
	}
}

func logerrmsg(msg string, err error) {
	println(msg + "\n" + err.Error())
}
