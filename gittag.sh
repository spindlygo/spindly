#!/bin/sh

go mod tidy

git tag $1 -m "Release $1"
git push origin $1

GOPROXY=proxy.golang.org go list -m github.com/spindlygo/spindly@$1
