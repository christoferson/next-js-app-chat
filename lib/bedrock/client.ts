import 'server-only';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

const clients = new Map<string, BedrockRuntimeClient>();

export function defaultRegion(): string {
  return process.env.AWS_REGION ?? 'us-east-1';
}

/** Cached Bedrock runtime client per region. Credentials come from the
 *  default provider chain (AWS_PROFILE / SSO). */
export function bedrockClientFor(region: string): BedrockRuntimeClient {
  let client = clients.get(region);
  if (!client) {
    client = new BedrockRuntimeClient({ region });
    clients.set(region, client);
  }
  return client;
}
