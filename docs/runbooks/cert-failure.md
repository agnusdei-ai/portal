# Runbook: certificate failure

Use this when browsers report a certificate error, or Cloudflare reports an origin TLS failure.

The site sends HSTS with preload, so browsers will not let members click past a certificate error.
A certificate failure is a full outage. Treat it as urgent.

## Find which certificate failed

There are two:

- **Edge:** the certificate Cloudflare shows to browsers.
- **Origin:** the certificate Render shows to Cloudflare. Cloudflare SSL mode must be Full (strict),
  so an invalid origin certificate fails every request.

1. In a browser, open the site and inspect the certificate. A Cloudflare-issued certificate that is
   expired or names the wrong host is an edge problem.
2. If browsers see a Cloudflare error page about the origin, it is an origin problem.

## Edge

1. In Cloudflare, check the SSL/TLS edge certificates for the domain and their expiry.
2. Re-order or renew the certificate there. Check the domain still points at Cloudflare.

## Origin

1. In Render, check the custom domain shows a valid certificate.
2. If renewal failed, check that the DNS record Render validates against still exists.
3. Do not lower Cloudflare's SSL mode to Flexible or Full to get the site back. That sends member
   traffic unencrypted or unverified between Cloudflare and the origin.

## Afterward

1. Record the cause and the time to recovery in a ticket.
2. Add an expiry alert if the failure was an unnoticed expiry.
