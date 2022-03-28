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
var SecondsToKeepAliveIfUnused int = 5

const AlivePath = "/spindly/alive"

func NewRouter() *mux.Router {
	router := mux.NewRouter()

	router.HandleFunc(AlivePath, func(w http.ResponseWriter, r *http.Request) {
		if IsShuttingDown || len(server_shutdown_channel) != 0 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}

		w.WriteHeader(http.StatusOK)
	})

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
func Serve(router *mux.Router, port string, onServerStart func()) (url string, AssignedPort string) {

	println(" --- Start Spindly Server --- ")

	if len(port) == 0 {
		port = "0"
	}

	listener, err := net.Listen("tcp", ":"+port)

	tries := 32
	for err != nil {

		if tries < 28 {

			// HTTP request to AlivePath will succeed if another server is running
			resp, respErr := http.Get("http://localhost:" + port + AlivePath)
			if respErr == nil {
				if resp.StatusCode == http.StatusOK {
					println("Another spindly app is already running on port " + port)
					return "", ""

				}
			}

			if resp != nil && resp.StatusCode == http.StatusServiceUnavailable {
				println("Another spindly app is already running on port " + port + ", but it's shutting down")

				time.Sleep(time.Millisecond * 500)
			}
		}

		if tries <= 0 {
			panic(err)
		}

		println(`Failed to start server on port : ` + port + `. Trying again in 500ms.`)
		time.Sleep(time.Millisecond * 500)

		tries--

		listener, err = net.Listen("tcp", ":"+port)
	}

	port = strconv.Itoa(listener.Addr().(*net.TCPAddr).Port)

	srv := &http.Server{
		Handler: router,
		Addr:    "localhost:" + port,
	}

	go func() {
		final := srv.Serve(listener)

		if final != nil && !IsShuttingDown {
			panic(final)
		}
	}()

	hostURL := "http://localhost:" + port

	log("Host on " + hostURL)

	// Clear older shutdown channels
	// On android, activity can be destroyed and recreated, so we need to clear the shutdown channel
	IsShuttingDown = false

	if len(server_shutdown_channel) > 0 {
		for range server_shutdown_channel {
		}

		close(server_shutdown_channel)
	}

	server_shutdown_channel = make(chan bool, 132)

	go func() {
		<-server_shutdown_channel

		log("Shutting down web server...")

		go logerr(srv.Shutdown(context.Background()))
		time.Sleep(time.Second * 1)
		go logerr(srv.Close())
	}()

	if onServerStart != nil {
		go onServerStart()
	}

	return hostURL, port

}

func BlockWhileHostRunning() {
	<-server_shutdown_channel
}

var server_shutdown_channel = make(chan bool, 132)
var IsShuttingDown bool = false

func ShutdownServer() {
	IsShuttingDown = true
	go func() {
		log("Shutting down hubs...")

		for i := 0; len(server_shutdown_channel) < 128; i++ {
			for j := 0; j < 64; j++ {
				server_shutdown_channel <- true
			}
			// time.Sleep(time.Millisecond * 400)
		}

	}()

	time.Sleep(time.Second * 10)

	if IsShuttingDown {
		log("Shutdown application.")
		os.Exit(0)

	} else {
		log("Application shutdown cancelled.")
	}

}

func CheckIfAnotherSpindlyAppIsRunning(port string) bool {
	// HTTP request to AlivePath will succeed if another server is running
	resp, respErr := http.Get("http://localhost:" + port + AlivePath)
	if respErr == nil {
		if resp.StatusCode == http.StatusOK {
			println("Another spindly app is already running on port " + port)
			return true

		}
	}

	return false
}

// Returns true if another app is running and it's not shutting down after 8 seconds
func InitializeForMobile(serverPort string, currentWorkingDir string) bool {
	doubleRunningCheckCount := 16
	for CheckIfAnotherSpindlyAppIsRunning(serverPort) {
		time.Sleep(500 * time.Millisecond)

		doubleRunningCheckCount--
		if doubleRunningCheckCount < 1 {
			println("Another Spindly app is already running. Exiting...")
			return true
		}
	}

	os.Chdir(currentWorkingDir)
	SecondsToKeepAliveIfUnused = 60 * 60 // 1 hour

	oswd, _ := os.Getwd()
	println("Spindly Working Directory: " + oswd)

	return false
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
