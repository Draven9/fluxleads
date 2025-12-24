function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET() {
  const enabled = process.env.INSTALLER_ENABLED !== 'false';
  const requiresToken = Boolean(process.env.INSTALLER_TOKEN);

  return json({ enabled, requiresToken });
}
