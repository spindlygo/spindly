package Spindly

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
)

// Using github.com/gorilla/mux

// ServerHandler implements the http.Handler interface, so we can use it
// to respond to HTTP requests. The path to the static directory and
// path to the index file within that static directory are used to
// serve the SPA in the given static directory.
type ServerHandler struct {
	staticPath string
	indexPath  string
	handler    http.Handler
}

// ServeHTTP inspects the URL path to locate a file within the static dir
// on the SPA handler. If a file is found, it will be served. If not, the
// file located at the index path on the SPA handler will be served. This
// is suitable behavior for serving an SPA (single page application).
func (h ServerHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {

	// prepend the path with the path to the static directory
	path := filepath.Join(h.staticPath, r.URL.Path)

	// check whether a file exists at the given path
	_, staterr := os.Stat(path)
	if errors.Is(staterr, fs.ErrNotExist) {
		// file does not exist, serve index.html
		http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
		return
	} else if staterr != nil {
		// if we got an error (that wasn't that the file doesn't exist) stating the
		// file, return a 500 internal server error and stop
		http.Error(w, staterr.Error(), http.StatusInternalServerError)
		return
	}

	// otherwise, use http.FileServer to serve the static dir
	h.handler.ServeHTTP(w, r)
}
