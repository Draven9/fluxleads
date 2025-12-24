// Esta rota foi descontinuada.
// Optamos por deixar os defaults do cockpit hardcoded no frontend (features/deals/cockpit/DealCockpitClient).

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET() {
  return json({ error: 'Not Found' }, 404);
}

export async function POST() {
  return json({ error: 'Not Found' }, 404);
}
