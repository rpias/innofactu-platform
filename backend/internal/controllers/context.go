package controllers

import "context"

type contextKey string

func contextWithValue(ctx context.Context, key string, value interface{}) context.Context {
	return context.WithValue(ctx, contextKey(key), value)
}
