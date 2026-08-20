export async function POST(req) {
  return new Response(JSON.stringify({ message: 'Ready' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
