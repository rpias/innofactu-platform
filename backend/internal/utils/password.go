package utils

import (
	"crypto/rand"
	"math/big"
)

// GenerateSecurePassword genera una contraseña segura de longitud dada.
// Garantiza al menos 1 mayúscula, 1 minúscula, 1 dígito, 1 carácter especial.
func GenerateSecurePassword(length int) string {
	if length < 12 {
		length = 12
	}
	const (
		upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ"
		lower   = "abcdefghjkmnpqrstuvwxyz"
		digits  = "23456789"
		special = "!@#$%&*"
	)
	all := upper + lower + digits + special

	result := make([]byte, length)
	// Garantizar al menos uno de cada tipo
	pools := []string{upper, lower, digits, special}
	for i, pool := range pools {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(pool))))
		result[i] = pool[n.Int64()]
	}
	// Rellenar el resto
	for i := len(pools); i < length; i++ {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(all))))
		result[i] = all[n.Int64()]
	}
	// Mezclar con Fisher-Yates
	for i := len(result) - 1; i > 0; i-- {
		j, _ := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		result[i], result[j.Int64()] = result[j.Int64()], result[i]
	}
	return string(result)
}
