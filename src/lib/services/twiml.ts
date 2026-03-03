export function twimlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" }
  });
}
