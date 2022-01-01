#!/bin/sh

go mod tidy

git tag v$1 -m "Release $1"
git push origin v$1

GOPROXY=proxy.golang.org go list -m github.com/spindlygo/spindly@v$1
