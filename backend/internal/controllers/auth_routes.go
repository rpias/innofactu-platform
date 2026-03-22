package controllers

import (
	"github.com/go-chi/chi/v5"
)

func AuthRoutes() chi.Router {
	r := chi.NewRouter()
	r.Post("/login", LoginPlatform)
	r.Group(func(r chi.Router) {
		r.Use(AuthRequired)
		r.Get("/me", GetMePlatform)
	})
	return r
}
