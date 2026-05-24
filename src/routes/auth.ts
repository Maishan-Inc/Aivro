import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppContext } from '../types';
import { fail, ok } from '../utils/response';
import { getOAuthConfig } from '../services/oauth';
import {
  signOAuthState,
  verifyOAuthState,
  clearOAuthStateCookie,
  createSession,
  revokeSession,
  clearSessionCookie,
  upsertUserFromOAuth,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE,
  type OAuthUserProfile
} from '../services/auth';
import { isBanned } from '../services/bans';

export const authRoutes = new Hono<AppContext>();

authRoutes.get('/me', (c) => ok(c, { user: c.get('user') ?? null }));

authRoutes.get('/:provider/start', async (c) => {
  const provider = c.req.param('provider');
  if (provider !== 'google' && provider !== 'linuxdo') return fail(c, 'BAD_PROVIDER', '不支持的登录平台。');

  const cfg = await getOAuthConfig(c.env, provider);
  if (!cfg.enabled) return fail(c, 'PROVIDER_DISABLED', `${provider} 登录未启用。`, 400);
  if (!cfg.clientId || !cfg.redirectUri) return fail(c, 'PROVIDER_NOT_CONFIGURED', `${provider} 登录配置不完整。`, 500);

  const { state, cookie } = await signOAuthState(c.env, provider);

  const url = new URL(cfg.authorizationEndpoint);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', cfg.scope);
  url.searchParams.set('state', state);

  c.header('Set-Cookie', cookie);
  return c.redirect(url.toString());
});

authRoutes.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  if (provider !== 'google' && provider !== 'linuxdo') return fail(c, 'BAD_PROVIDER', '不支持的登录平台。');

  const code = c.req.query('code');
  const state = c.req.query('state');
  const oauthError = c.req.query('error');
  if (oauthError) {
    c.header('Set-Cookie', clearOAuthStateCookie());
    return fail(c, 'OAUTH_PROVIDER_ERROR', `登录失败：${oauthError}`, 400);
  }
  if (!code || !state) return fail(c, 'BAD_CALLBACK', 'OAuth 回调参数不完整。');

  const stateCookie = getCookie(c, OAUTH_STATE_COOKIE_NAME);
  const stateValid = await verifyOAuthState(c.env, provider, stateCookie, state);
  if (!stateValid) {
    c.header('Set-Cookie', clearOAuthStateCookie());
    return fail(c, 'BAD_STATE', 'OAuth state 校验失败，请重新登录。', 400);
  }

  const cfg = await getOAuthConfig(c.env, provider);
  if (!cfg.enabled) return fail(c, 'PROVIDER_DISABLED', `${provider} 登录未启用。`, 400);
  if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) {
    return fail(c, 'PROVIDER_NOT_CONFIGURED', `${provider} 登录配置不完整。`, 500);
  }

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret
  });

  let accessToken: string;
  try {
    const tokenRes = await fetch(cfg.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: tokenBody.toString()
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error(`[oauth] ${provider} token exchange failed`, tokenRes.status, text.slice(0, 200));
      return fail(c, 'TOKEN_EXCHANGE_FAILED', '换取 access token 失败。', 502);
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return fail(c, 'TOKEN_MISSING', 'access_token 缺失。', 502);
    }
    accessToken = tokenJson.access_token;
  } catch (err) {
    console.error(`[oauth] ${provider} token exchange error`, err);
    return fail(c, 'TOKEN_EXCHANGE_ERROR', '换取 access token 出错。', 502);
  }

  let userInfoRaw: Record<string, unknown>;
  try {
    const uiRes = await fetch(cfg.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });
    if (!uiRes.ok) {
      const text = await uiRes.text();
      console.error(`[oauth] ${provider} userinfo failed`, uiRes.status, text.slice(0, 200));
      return fail(c, 'USERINFO_FAILED', '读取用户信息失败。', 502);
    }
    userInfoRaw = (await uiRes.json()) as Record<string, unknown>;
  } catch (err) {
    console.error(`[oauth] ${provider} userinfo error`, err);
    return fail(c, 'USERINFO_ERROR', '读取用户信息出错。', 502);
  }

  if (c.env.APP_ENV === 'development') {
    console.log('[oauth-debug]', provider, Object.keys(userInfoRaw));
  }

  const profile = mapUserInfo(provider, userInfoRaw);
  if (!profile.providerUserId) {
    return fail(c, 'OAUTH_BAD_PROFILE', '用户信息缺少唯一标识，无法完成登录。', 502);
  }

  const { userId } = await upsertUserFromOAuth(c.env, provider, profile);

  const banCheck = await isBanned(c.env, {
    userId,
    email: profile.email,
    ip: c.req.header('CF-Connecting-IP') ?? undefined
  });
  if (banCheck.banned) {
    const existingToken = getCookie(c, SESSION_COOKIE);
    if (existingToken) await revokeSession(c.env, existingToken);
    c.header('Set-Cookie', clearOAuthStateCookie(), { append: true });
    c.header('Set-Cookie', clearSessionCookie(), { append: true });
    return c.redirect('/?error=banned');
  }

  const session = await createSession(c.env, userId);

  c.header('Set-Cookie', clearOAuthStateCookie(), { append: true });
  c.header('Set-Cookie', session.cookie, { append: true });
  return c.redirect('/');
});

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await revokeSession(c.env, token);
  c.header('Set-Cookie', clearSessionCookie());
  return ok(c, { loggedOut: true });
});

function mapUserInfo(provider: 'google' | 'linuxdo', raw: Record<string, unknown>): OAuthUserProfile {
  if (provider === 'google') {
    return {
      providerUserId: typeof raw.sub === 'string' ? raw.sub : '',
      email: typeof raw.email === 'string' ? raw.email : undefined,
      name: typeof raw.name === 'string' ? raw.name : undefined,
      avatarUrl: typeof raw.picture === 'string' ? raw.picture : undefined,
      raw
    };
  }

  // Linux.DO (Discourse OIDC): prefer sub (string), fallback to id (may be number)
  const sub = raw.sub;
  const id = raw.id;
  let providerUserId = '';
  if (typeof sub === 'string' && sub.length > 0) {
    providerUserId = sub;
  } else if (typeof id === 'number' && Number.isFinite(id)) {
    providerUserId = String(id);
  } else if (typeof id === 'string' && id.length > 0) {
    providerUserId = id;
  }

  // Avatar: prefer picture (full URL), then avatar_url, then avatar_template with {size} replaced
  let avatarUrl: string | undefined;
  if (typeof raw.picture === 'string' && raw.picture.length > 0) {
    avatarUrl = raw.picture;
  } else if (typeof raw.avatar_url === 'string' && raw.avatar_url.length > 0) {
    avatarUrl = raw.avatar_url;
  } else if (typeof raw.avatar_template === 'string' && raw.avatar_template.length > 0) {
    avatarUrl = raw.avatar_template.replace('{size}', '96');
  }

  const username = typeof raw.username === 'string' ? raw.username : undefined;
  const preferredUsername = typeof raw.preferred_username === 'string' ? raw.preferred_username : undefined;
  const name = typeof raw.name === 'string' ? raw.name : undefined;

  return {
    providerUserId,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    name: name || preferredUsername || username,
    avatarUrl,
    raw
  };
}
