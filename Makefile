# 変数定義
GO = go
GOOS = js
GOARCH = wasm
GO_DIR = art/go
WASM_DIR = public/wasm

# デフォルトのアート名
ART_NAME ?= ruby_image
ART_LANG ?= go

# ターゲット
.PHONY: all clean build

help:
	@echo 'make go-build ART_NAME=hogehoge'

go-build: $(WASM_DIR)/wasm_exec.js
	cd $(GO_DIR)  && GOOS=$(GOOS) GOARCH=$(GOARCH) $(GO) build -o ../../$(WASM_DIR)/$(ART_LANG)_$(ART_NAME).wasm $(ART_NAME)/main.go
go-build-all:
	for dir in $(shell find $(GO_DIR) -mindepth 1 -maxdepth 1 -type d); do \
		ART_NAME=$$(basename $$dir) $(MAKE) go-build; \
	done

clean:
	rm -f $(WASM_DIR)/*.wasm

# wasm_exec.jsのコピー
$(WASM_DIR)/wasm_exec.js:
	cp $$(go env GOROOT)/misc/wasm/wasm_exec.js $(WASM_DIR)/

update-all:
	yarn build
	make go-build-all