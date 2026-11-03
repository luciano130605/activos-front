import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { request, type Account } from './account';

export const supportsPasskeys = () => browserSupportsWebAuthn() && window.isSecureContext;
export type RegistrationOptions = { options: PublicKeyCredentialCreationOptionsJSON; challengeId: string };
export const preparePasskey = () => request<RegistrationOptions>('passkey/register/options', 'POST', {});
export const passkeyStatus = () => request<{ count: number }>('passkey/status');
export async function createPasskey({ options, challengeId }: RegistrationOptions) {
    const response = await startRegistration({ optionsJSON: options });
    await request('passkey/register/verify', 'POST', { challengeId, response });
}
export async function loginWithPasskey() {
    const { options, challengeId } = await request<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }>('passkey/login/options', 'POST', {});
    const response = await startAuthentication({ optionsJSON: options });
    return request<Account>('passkey/login/verify', 'POST', { challengeId, response });
}
