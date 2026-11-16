//go:build js && wasm

package mail

import (
	"context"
	"encoding/json"
	"fmt"
	"syscall/js"
	"time"

	pbmailer "github.com/pocketbase/pocketbase/tools/mailer"
	"github.com/pocketflare/pocketflare/adapter/internal/jsutil"
)

var _ pbmailer.Mailer = (*CloudflareProvider)(nil)

// CloudflareProvider delivers email using Cloudflare Email Sending via the native
// Workers send_email binding (env.EMAIL).
type CloudflareProvider struct{}

func NewCloudflareProvider() pbmailer.Mailer {
	return &CloudflareProvider{}
}

func IsCloudflareAvailable() bool {
	transport := js.Global().Get("__pocketflare_cloudflare_email_send")
	return !transport.IsUndefined() && !transport.IsNull()
}

func (c *CloudflareProvider) Send(msg *pbmailer.Message) error {
	payload, err := NewPayload(msg)
	if err != nil {
		return fmt.Errorf("mail: cloudflare build payload: %w", err)
	}

	transport := js.Global().Get("__pocketflare_cloudflare_email_send")
	if transport.IsUndefined() || transport.IsNull() {
		return fmt.Errorf("mail: Cloudflare Email JS transport not available (missing __pocketflare_cloudflare_email_send)")
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("mail: cloudflare marshal payload: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	promise := transport.Invoke(string(payloadBytes))
	_, err = jsutil.AwaitPromise(ctx, promise)
	if err != nil {
		return fmt.Errorf("mail: cloudflare send: %w", err)
	}

	return nil
}
