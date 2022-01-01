package Spindly

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"strconv"
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
func Serve(router *mux.Router, port string) string {

	if len(port) == 0 {
		port = "0"
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		panic(err)
	}

	port = strconv.Itoa(listener.Addr().(*net.TCPAddr).Port)

	srv := &http.Server{
		Handler: router,
		Addr:    "localhost:" + port,
	}

	go func() {
		final := srv.Serve(listener)

		if final != nil && len(server_shutdown_channel) == 0 {
			panic(final)
		}
	}()

	hostURL := "http://localhost:" + port

	log("Host on " + hostURL)

	go func() {
		<-server_shutdown_channel

		log("Shutting down host...")

		go logerr(srv.Shutdown(context.Background()))
		time.Sleep(time.Second * 4)
		go logerr(srv.Close())
	}()

	return hostURL

}

func BlockWhileHostRunning() {
	<-server_shutdown_channel
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
