package main

import "net/http"

func main() {
	http.Handle("/", http.StripPrefix("/", http.FileServer(http.Dir("docs"))))
	http.ListenAndServe(":3000", nil)
}
