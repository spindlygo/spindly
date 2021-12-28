package Spindly

// HubManager is used to manage Hub instances
type HubManager struct {
	instances     map[string]*HubInstance
	Classes       map[string]func() HubClass
	hubConnectors map[int]*HubConnector
}

func NewHubManager() *HubManager {
	return &HubManager{
		instances:     make(map[string]*HubInstance),
		Classes:       make(map[string]func() HubClass),
		hubConnectors: make(map[int]*HubConnector),
	}
}

func (M *HubManager) Register(inst *HubInstance) {
	if inst == nil {
		panic("Cannot register a nil instance")
	}

	M.instances[inst.HubClass+"/"+inst.InstanceID] = inst
	inst.Manager = M
	inst.connectors = map[int]HubConnector{}
}

func (M *HubManager) RegisterClass(hubclass string, hubctor func() HubClass) {
	M.Classes[hubclass] = hubctor
}

func (M *HubManager) Unregister(inst *HubInstance) {

	for _, conn := range inst.connectors {
		conn.OnReceived(nil)
	}

	delete(M.instances, inst.HubClass+"/"+inst.InstanceID)
}

func (M *HubManager) Get(hubClass, instanceID string) *HubInstance {
	inst, ok := M.instances[hubClass+"/"+instanceID]

	if ok {
		return inst
	} else {
		return nil
	}
}

// Internal use only. Do not call.
func (M *HubManager) ConnectionEstablished(hubclass string, instanceid string, conn HubConnector) bool {
	inst := M.Get(hubclass, instanceid)

	if inst == nil {
		classCtor, hubClassFound := M.Classes[hubclass]

		if hubClassFound && (classCtor != nil) {
			cls := classCtor()
			inst = cls.Instanciate(instanceid)
		} else {
			return false
		}
	}

	if inst != nil {
		id := <-genNextID

		M.hubConnectors[id] = &conn
		inst.connectors[id] = conn
		conn.OnReceived(inst.onReceived)
		conn.OnClose(func() {
			delete(M.hubConnectors, id)
			inst.onConnetionClose(id)
		})
		conn.GetSnapshot(inst.getSnapshot)
		return true
	}

	return false
}

func (M *HubManager) IsUnused() bool {
	return len(M.hubConnectors) == 0
}

type HubClass interface {
	Instanciate(InstanceID string) *HubInstance
}
