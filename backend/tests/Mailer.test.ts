import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendMailer } from '../src/services/Mailer';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResendMailer', () => {
  it('sendet an die Resend-API mit Bearer-Token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'abc' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await new ResendMailer('re_test', 'Fixkosten <noreply@guita.dev>').send('guita@example.com', 'Betreff', 'Text');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body)).toEqual({ from: 'Fixkosten <noreply@guita.dev>', to: ['guita@example.com'], subject: 'Betreff', text: 'Text' });
  });

  it('wirft bei Fehlerantwort mit Meldung der API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"The guita.dev domain is not verified"}', { status: 403 })));
    await expect(new ResendMailer('re_test', 'x@guita.dev').send('a@b.de', 's', 't')).rejects.toThrow('Resend-Fehler 403');
  });
});
