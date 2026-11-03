import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { request, type Account } from './account';

export const supportsPasskeys = () => browserSupportsWebAuthn() && window.isSecureContext;
export async function createPasskey() {
    const { options, challengeId } = await request<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string }>('passkey/register/options', 'POST', {});
    const response = await startRegistration({ optionsJSON: options });
    await request('passkey/register/verify', 'POST', { challengeId, response });
}
export async function loginWithPasskey() {
    const { options, challengeId } = await request<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }>('passkey/login/options', 'POST', {});
    const response = await startAuthentication({ optionsJSON: options });
    return request<Account>('passkey/login/verify', 'POST', { challengeId, response });
}
