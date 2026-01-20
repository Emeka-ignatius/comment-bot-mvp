import { createHash } from "node:crypto";
import { ENV } from "../_core/env";

/**
 * iProyal Residential sticky sessions use tags appended to the PASSWORD:
 *   _session-XXXXXXXX (8 alphanumeric chars)
 *   _lifetime-2h (1s..7d)
 *
 * Example:
 *   geo.iproyal.com:12321:USER:PASS_session-AB12CD34_lifetime-2h
 */

function stableSessionId8(accountId: number): string {
  // 8 hex chars are alphanumeric and deterministic
  return createHash("sha256").update(String(accountId)).digest("hex").slice(0, 8);
}

function stripIProyalTags(password: string): string {
  // In case someone pastes a full formatted proxy password (with _country/_session/_lifetime),
  // normalize back to the base password so we can apply deterministic per-account tags.
  return password
    .replace(/_(country|state|city)-[^_]+/gi, "")
    .replace(/_session-[a-z0-9]+/gi, "")
    .replace(/_lifetime-[0-9]+[smhd]/gi, "")
    .trim();
}

function buildPasswordWithTags(basePassword: string, accountId: number): string {
  let p = stripIProyalTags(basePassword);

  // Optional geo tags if provided
  if (ENV.iproyalCountry) p += `_country-${ENV.iproyalCountry}`;
  if (ENV.iproyalState) p += `_state-${ENV.iproyalState}`;
  if (ENV.iproyalCity) p += `_city-${ENV.iproyalCity}`;

  p += `_session-${stableSessionId8(accountId)}_lifetime-${ENV.iproyalSessionLifetime}`;
  return p;
}

export function getIProyalProxyUrlForAccount(accountId: number): string | undefined {
  if (
    !ENV.iproyalHost ||
    !ENV.iproyalPort ||
    !ENV.iproyalUsername ||
    !ENV.iproyalPassword
  ) {
    return undefined;
  }

  const username = encodeURIComponent(ENV.iproyalUsername);
  const password = encodeURIComponent(buildPasswordWithTags(ENV.iproyalPassword, accountId));
  const host = ENV.iproyalHost;
  const port = ENV.iproyalPort;

  return `http://${username}:${password}@${host}:${port}`;
}

