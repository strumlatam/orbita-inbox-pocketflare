//go:build !js || !wasm

package mail

import (
	"errors"

	pbmailer "github.com/pocketbase/pocketbase/tools/mailer"
)

type CloudflareProvider struct{}

func NewCloudflareProvider() pbmailer.Mailer {
	return &CloudflareProvider{}
}

func IsCloudflareAvailable() bool {
	return false
}

func (c *CloudflareProvider) Send(msg *pbmailer.Message) error {
	return errors.New("mail: Cloudflare Email Sending is only supported in WASM runtime")
}
