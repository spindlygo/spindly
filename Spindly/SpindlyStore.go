package Spindly

import (
	"encoding/json"

	"github.com/spindlygo/SpindlyExports"
)

var genNextID chan int = make(chan int)

func init() {
	go func() {
		i := 0
		for {
			genNextID <- i
			i++
		}
	}()

}

// SpindlyStore is a variable that can be listened to and set.
// It's a state mirror of the corresponding svelte store
// Use HubInstances to manage multiple stores
type SpindlyStore struct {
	Name      string
	value     interface{}
	Template  func() interface{}
	Instance  *HubInstance
	listeners map[int]chan interface{} // Internal Go listeners
}

func NewSpindlyStore(name string, template func() interface{}, initialValue interface{}) SpindlyStore {
	if initialValue == nil {
		initialValue = template()
	}

	return SpindlyStore{
		Name:      name,
		Template:  template,
		value:     initialValue,
		listeners: make(map[int]chan interface{}),
	}
}

// Returns the value of the variable
func (v *SpindlyStore) Get() interface{} {
	return v.value
}

// Set the value of the variable, notify all listeners and send it to the store
func (v *SpindlyStore) Set(value interface{}) {
	v.received(value)

	if v.Instance != nil {
		v.Instance.Send(v.Name, value)
	}
}

// Returns a channel that will receive the next values of the variable and a function to unlisten
func (v *SpindlyStore) Listen() (chan interface{}, func()) {
	listener := make(chan interface{})

	id := <-genNextID

	v.listeners[id] = listener

	Unlisten := func() {
		delete(v.listeners, id)
	}

	return listener, Unlisten
}

// (Private) Recieved from the store connection or changed by internal logic.
// When these's multiple ws/jsch connections to the same store, the value is sent to all of them from wsreciver ; not here.
func (v *SpindlyStore) received(value interface{}) {
	v.value = value
	for _, listener := range v.listeners {
		listener <- value
	}
}

// Run a function each time the variable changes
func (v *SpindlyStore) OnChange(f func(interface{})) func() {
	var listner, unlisten = v.Listen()

	var cancel = make(chan bool)
	go func() {
		for {
			select {
			case value := <-listner:
				f(value)
			case <-cancel:
				unlisten()
				return
			}
		}
	}()

	return func() {
		cancel <- true
	}
}

// Waits for the next variable to change and return the value.
// This is a blocking call.
func (v *SpindlyStore) Next() interface{} {
	var listner, unlisten = v.Listen()
	value := <-listner

	unlisten()

	return value
}

func (v *SpindlyStore) ToExported() *SpindlyExports.ExportedStore {

	returnAsJson := func(val interface{}) string {
		Json, JErr := json.Marshal(val)

		var ret string

		if JErr != nil {
			ret = ""
		} else {
			ret = string(Json)
		}

		return ret
	}

	ex := SpindlyExports.ExportedStore{
		Name: v.Name,
		Get: func() string {
			val := v.Get()
			valjson := returnAsJson(val)

			if Verbose {
				log("Export Get : " + v.Instance.HubClass + "/" + v.Instance.InstanceID + "." + v.Name + " : " + valjson)
			}
			return valjson
		},
		Set: func(val string) {
			var value = v.Template()
			json.Unmarshal([]byte(val), &value)

			if Verbose {
				log("Export Set : " + v.Instance.HubClass + "/" + v.Instance.InstanceID + "." + v.Name + " : " + val)
			}

			v.Set(value)
		},
		Next: func() string {
			val := v.Next()
			valjson := returnAsJson(val)

			if Verbose {
				log("Export Next : " + v.Instance.HubClass + "/" + v.Instance.InstanceID + "." + v.Name + " : " + valjson)
			}
			return valjson
		},
	}

	return &ex
}
