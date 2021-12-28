package Spindly

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type HubServer struct {
	Manager *HubManager
}

// We'll need to define an Upgrader
// this will require a Read and Write buffer size
var upgrader = websocket.Upgrader{
	ReadBufferSize:    1024,
	WriteBufferSize:   1024,
	CheckOrigin:       func(r *http.Request) bool { return true },
	EnableCompression: false,
}

func (HSvr *HubServer) ServeHub(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	hubclass := vars["hubclass"]
	instance := vars["instance"]
	log("Hub Connected : " + hubclass + "/" + instance)

	// upgrade this connection to a WebSocket
	// connection
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logerr(err)
		return
	}

	sendch := make(chan []byte, 256)

	go func() {
		// Read sendch
		for {
			msg := <-sendch

			if err := ws.WriteMessage(websocket.TextMessage, msg); err != nil {
				if ce, ok := err.(*websocket.CloseError); ok {
					logerrmsg("WSSend : Websocket closed : "+hubclass+"/"+instance+" : ", ce)
					return
				} else {
					logerrmsg("WSSend : Message send error on : "+hubclass+"/"+instance+" : ", err)
					return
				}
			}

		}
	}()

	conn := &WSConnector{
		ws: ws,
	}

	conn.send = func(storename string, value interface{}) {

		messagemap := map[string]interface{}{storename: value}
		message, jsonerr := json.Marshal(messagemap)
		if jsonerr != nil {
			logerrmsg("Error serializing websocket message : "+hubclass+"/"+instance+"."+storename, jsonerr)
			return
		}
		sendch <- message
		// log("Sending : " + hubclass + "/" + instance + " : " + string(message))
	}

	if !HSvr.Manager.ConnectionEstablished(hubclass, instance, conn) {
		logerrmsg("Error establishing Hub connection : Hub class "+hubclass+" not found on Host ", nil)
		return
	}

	SendSnapshot := func() {
		snap := conn.getSnapshot()
		for storename, val := range snap {
			conn.send(storename, val)
		}
	}

	go func() {
		<-server_shutdown_channel
		log("Closing Hub connection : " + hubclass + "/" + instance)
		ws.Close()
	}()

	go func() {
		for {
			// read in a message
			messageType, msg, err := ws.ReadMessage()
			if err != nil {

				if ce, ok := err.(*websocket.CloseError); ok {
					logerrmsg("WSReceive : Websocket closed : "+hubclass+"/"+instance+" : ", ce)
					conn.onClose()
					HSvr.ExitIfUnused()
					return
				} else {
					logerrmsg("WSReceive : Message read error on : "+hubclass+"/"+instance+" : ", err)
					continue
				}

			}

			if messageType == websocket.TextMessage {

				var messagemap map[string]json.RawMessage
				jsonerr := json.Unmarshal(msg, &messagemap)
				if jsonerr != nil {
					logerrmsg("Error deserializing websocket message : "+hubclass+"/"+instance, jsonerr)
					continue
				}

				for storename, value := range messagemap {
					logobj("Received : "+hubclass+"/"+instance+"."+storename+" : ", value)
					conn.onReceived(storename, value)
				}
			} else if messageType == websocket.PingMessage {
				log("Ping received : " + hubclass + "/" + instance)
				SendSnapshot()
			}

		}
	}()

	SendSnapshot()

}

func (HSvr *HubServer) ExitIfUnused() {

	for i := 0; i < 10 && HSvr.Manager.IsUnused(); i++ {
		time.Sleep(time.Millisecond * 500)
	}

	if HSvr.Manager.IsUnused() {
		ShutdownServer()
	}
}

type WSConnector struct {
	send        func(storename string, value interface{})
	onReceived  func(storename string, value json.RawMessage)
	getSnapshot func() map[string]interface{}
	onClose     func()
	ws          *websocket.Conn
}

func (conn *WSConnector) Send(storename string, value interface{}) {
	conn.send(storename, value)
}

func (conn *WSConnector) OnReceived(callBack func(storename string, value json.RawMessage)) {
	conn.onReceived = callBack
}

func (conn *WSConnector) GetSnapshot(callBack func() map[string]interface{}) {
	conn.getSnapshot = callBack
}

func (conn *WSConnector) OnClose(callBack func()) {
	conn.onClose = callBack
}
