// Cloudflare Email Sending transport for Cloudflare Workers using the native send_email binding.
//
// Usage:
//   import { registerCloudflareEmailTransport } from './cloudflare-email.mjs';
//   registerCloudflareEmailTransport(() => runtimeContext?.env);

export function registerCloudflareEmailTransport(getEnv) {
  if (globalThis.__pocketflare_cloudflare_email_send) {
    return;
  }

  globalThis.__pocketflare_cloudflare_email_send = async (payloadJson) => {
    const env = typeof getEnv === "function" ? getEnv() : globalThis.__pocketflare_env;
    const emailBinding = env?.EMAIL || env?.SEND_EMAIL;

    if (!emailBinding || typeof emailBinding.send !== "function") {
      throw new Error(
        "Cloudflare Email Sending is not available: 'EMAIL' binding not found in environment. " +
        "Ensure [[send_email]] name = \"EMAIL\" is configured in wrangler.toml."
      );
    }

    const payload = JSON.parse(payloadJson);

    // Format From address
    let from = payload.from?.address || "";
    if (payload.from?.name) {
      from = { name: payload.from.name, email: payload.from.address };
    }

    // Format To recipients
    const to = (payload.to || []).map((addr) => {
      if (addr.name) {
        return { name: addr.name, email: addr.address };
      }
      return addr.address;
    });

    if (to.length === 0) {
      throw new Error("Cloudflare Email Sending: at least one recipient in 'to' is required");
    }

    const message = {
      from,
      to: to.length === 1 ? to[0] : to,
      subject: payload.subject || "",
    };

    if (payload.html) {
      message.html = payload.html;
    }
    if (payload.text) {
      message.text = payload.text;
    }

    // CC recipients
    if (payload.cc && payload.cc.length > 0) {
      const cc = payload.cc.map((addr) => {
        if (addr.name) return { name: addr.name, email: addr.address };
        return addr.address;
      });
      message.cc = cc.length === 1 ? cc[0] : cc;
    }

    // BCC recipients
    if (payload.bcc && payload.bcc.length > 0) {
      const bcc = payload.bcc.map((addr) => {
        if (addr.name) return { name: addr.name, email: addr.address };
        return addr.address;
      });
      message.bcc = bcc.length === 1 ? bcc[0] : bcc;
    }

    // Headers (exclude reserved email fields to prevent E_HEADER_USE_API_FIELD)
    if (payload.headers && payload.headers.length > 0) {
      const headers = {};
      for (const h of payload.headers) {
        if (h.name && h.value) {
          const lower = h.name.toLowerCase();
          if (lower !== "from" && lower !== "to" && lower !== "subject" && lower !== "cc" && lower !== "bcc") {
            headers[h.name] = h.value;
          }
        }
      }
      if (Object.keys(headers).length > 0) {
        message.headers = headers;
      }
    }

    // Attachments & Inline Attachments
    const attachments = [];
    if (payload.attachments && payload.attachments.length > 0) {
      for (const att of payload.attachments) {
        attachments.push({
          filename: att.name,
          content: att.contentBase64,
          type: att.contentType || "application/octet-stream",
          disposition: "attachment",
        });
      }
    }
    if (payload.inlineAttachments && payload.inlineAttachments.length > 0) {
      for (const att of payload.inlineAttachments) {
        attachments.push({
          filename: att.name,
          content: att.contentBase64,
          type: att.contentType || "application/octet-stream",
          disposition: "inline",
          contentId: att.name,
        });
      }
    }
    if (attachments.length > 0) {
      message.attachments = attachments;
    }

    const res = await emailBinding.send(message);
    return JSON.stringify(res || {});
  };
}
