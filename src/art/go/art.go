package art

import (
	"syscall/js"
)

type Generator interface {
	Generate(this js.Value, args []js.Value) any
}

func Do(name string, i Interface) {
	c := make(chan struct{}, 0)
	js.Global().Set(name, js.ValueOf(map[string]any{
		"generate":    js.FuncOf(i.Generate),
	}))
	<-c
}