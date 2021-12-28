package Spindly

import "encoding/json"

// Hubs instances are used to manage the stores.
// Use HubManager to manage Hub instances.
type HubInstance struct {
	HubClass   string
	InstanceID string

	Stores  map[string]*SpindlyStore
	Manager *HubManager

	connectors map[int]HubConnector
}

func (SI *HubInstance) Register(V *SpindlyStore) {
	SI.Stores[V.Name] = V
	V.Instance = SI
}

func (SI *HubInstance) Unregister(V *SpindlyStore) {
	delete(SI.Stores, V.Name)
}

func (SI *HubInstance) Send(storename string, value interface{}) {
	for _, c := range SI.connectors {
		c.Send(storename, value)
	}
}

func (SI *HubInstance) onReceived(storename string, value json.RawMessage) {
	store, storeok := SI.Stores[storename]
	if !storeok {
		return
	}

	tmpl := store.Template()
	json.Unmarshal(value, &tmpl)
	store.Set(tmpl)
}

func (SI *HubInstance) onConnetionClose(connID int) {
	delete(SI.connectors, connID)
}

func (SI *HubInstance) getSnapshot() map[string]interface{} {
	snapshot := make(map[string]interface{})
	for _, store := range SI.Stores {
		snapshot[store.Name] = store.Get()
	}
	return snapshot
}

type HubConnector interface {
	Send(storename string, value interface{})

	OnReceived(callBack func(storename string, value json.RawMessage))
	GetSnapshot(callBack func() map[string]interface{})
	OnClose(callBack func())
}
